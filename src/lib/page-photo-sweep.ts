/**
 * The page-photo sweep: removes the CALLER'S OWN abandoned camera batches.
 *
 * WHY. The app uploads a batch of photos to `{userId}/page-photos/{batchId}/`
 * and then calls POST /api/page-read, which deletes them whatever happens. If
 * that POST never arrives (the app killed, the network gone, a client bug),
 * the photos stay. The student's session could delete them (production has
 * had a hand-made "Users delete own files" policy on any own object;
 * 20261118_storage_lockdown_production.sql narrows it to
 * {own uid}/page-photos/), but an app that never sent its POST will not send
 * a delete either, and nothing else removes them. Account deletion does
 * (src/lib/account-deletion/storage.ts walks the whole user folder), but
 * only then.
 *
 * WHY NOT A CRON. GitHub drops most scheduled runs on this repository, and a
 * cron would need the service-role key as a repository secret. This sweep
 * instead runs, after the answer (`after()`), whenever the student reaches
 * POST /api/page-read (once the keys are proven theirs) or POST /api/ingest
 * (once the session is checked), with the service client those routes already
 * have. A student who abandons a batch and never comes back keeps it until
 * account deletion.
 *
 * WHAT IT MAY TOUCH, and nothing else:
 *   - only `{userId}/page-photos/`, the user id checked as a lowercase UUID
 *     first (an empty or odd id would widen the prefix to other users);
 *   - only folders named as a batch id (a UUID) other than the request's
 *     own batch, and only when every entry in the folder is a photo key the
 *     route itself would accept (checkPhotoKeys); a folder holding anything
 *     else (a sub-folder, an odd name, more than MAX_PAGE_PHOTOS entries)
 *     was not made by the app and is skipped, never a reason to stop;
 *   - only when the folder's NEWEST photo (created or updated) is at least
 *     PAGE_PHOTO_STALE_MS old: a batch still being uploaded on another
 *     device, or waiting for its POST, is younger than that.
 *
 * THE CONTRACT THIS RESTS ON (the camera screen must keep it): a batch is
 * uploaded and POSTed at once. A client that POSTs a batch more than about
 * 55 minutes after its last upload (PAGE_PHOTO_STALE_MS less the route's
 * 300 s) can meet another request's sweep removing it mid-read; it must
 * re-upload under a new batch id instead of retrying the old one.
 *
 * BOUNDED: at most PAGE_PHOTO_SWEEP_MAX_BATCHES folders and
 * PAGE_PHOTO_SWEEP_MAX_OBJECTS photos per request (whole batches only), so at
 * most 1 + 5 list calls and 1 remove call. Every list call runs inside
 * PAGE_PHOTO_SWEEP_BUDGET_MS; the one remove call takes no signal in
 * storage-js 2.103, so it is bounded by the route's maxDuration instead. What
 * is left goes on a later request.
 *
 * NEVER FAILS ANYTHING. It never throws; a failure is logged with the tag
 * `kf-page-photos-left` (as removePagePhotos logs a photo it could not
 * remove), a removal with `kf-page-photos-swept`. It runs after the answer,
 * so it cannot change it or delay it.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { checkPhotoKeys, MAX_PAGE_PHOTOS, PAGE_PHOTOS_FOLDER } from '@/lib/page-reader';
import { DOCUMENTS_BUCKET } from '@/lib/storage-key';

/** A batch whose newest photo is this old was abandoned: the route answers within 300 s. */
export const PAGE_PHOTO_STALE_MS = 60 * 60 * 1000;
/**
 * Batches looked at per request. One look is one list call (~100 ms); five
 * keeps the sweep near half a second and still clears more than a student
 * plausibly abandons between two uploads.
 */
export const PAGE_PHOTO_SWEEP_MAX_BATCHES = 5;
/** Photos removed per request: five full batches (MAX_PAGE_PHOTOS = 10), one remove call. */
export const PAGE_PHOTO_SWEEP_MAX_OBJECTS = 50;
/** Every list call; past it nothing more is listed or removed (the remove call itself is not cut). */
export const PAGE_PHOTO_SWEEP_BUDGET_MS = 3000;
/** One list page; a folder of more than MAX_PAGE_PHOTOS entries is not an app batch. */
const LIST_LIMIT = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Entry = { name: string; id: string | null; created_at?: string | null; updated_at?: string | null };
/** The two storage calls the sweep makes, as storage-js 2.103 types them. */
export interface SweepBucket {
  list(
    path: string,
    options: { limit: number; offset?: number; sortBy?: { column: string; order: string } },
    parameters?: { signal?: AbortSignal }
  ): Promise<{ data: Entry[] | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

export interface PagePhotoSweep {
  /** Batch folders looked into. */
  inspected: number;
  /** Batches removed whole. */
  batches: number;
  /** Photos storage reports removed. */
  removed: number;
  /** Why the sweep stopped early, when it did. */
  error?: string;
}

function serviceBucket(): SweepBucket | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin.storage.from(DOCUMENTS_BUCKET) as unknown as SweepBucket;
}

/** The newest of an entry's two timestamps, or null when neither reads. */
function newestOf(e: Entry): number | null {
  const times = [e.created_at, e.updated_at].map((t) => (typeof t === 'string' ? Date.parse(t) : NaN)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/**
 * Remove the caller's stale page-photo batches, except `currentBatch`.
 * `options` exists for the proof (scripts/verify-page-photo-sweep.mjs).
 */
export async function sweepStalePagePhotos(
  userId: string,
  currentBatch: string | null,
  options: { now?: number; bucket?: SweepBucket; budgetMs?: number } = {}
): Promise<PagePhotoSweep> {
  const result: PagePhotoSweep = { inspected: 0, batches: 0, removed: 0 };
  const folder = `${typeof userId === 'string' ? userId : ''}/${PAGE_PHOTOS_FOLDER}`;
  const stop = (reason: string): PagePhotoSweep => {
    console.error(JSON.stringify({ tag: 'kf-page-photos-left', reason: `sweep: ${reason}`, folder, count: null }));
    return { ...result, error: reason };
  };
  try {
    // THE PREFIX IS THE ONLY FENCE between this user and every other one.
    if (typeof userId !== 'string' || !UUID_RE.test(userId)) return stop('user id is not a lowercase UUID');
    if (currentBatch !== null && (typeof currentBatch !== 'string' || !UUID_RE.test(currentBatch))) {
      return stop('current batch is not a lowercase UUID');
    }
    const bucket = options.bucket ?? serviceBucket();
    if (!bucket) return stop('service role not configured');
    const now = options.now ?? Date.now();
    const signal = AbortSignal.timeout(options.budgetMs ?? PAGE_PHOTO_SWEEP_BUDGET_MS);

    const top = await bucket.list(folder, { limit: LIST_LIMIT, sortBy: { column: 'name', order: 'asc' } }, { signal });
    if (top.error) return stop(`list: ${top.error.message}`);
    const candidates = (top.data ?? [])
      .filter((e) => e && e.id === null && UUID_RE.test(e.name) && e.name !== currentBatch)
      .slice(0, PAGE_PHOTO_SWEEP_MAX_BATCHES);

    const doomed: string[] = [];
    for (const c of candidates) {
      if (signal.aborted) break;
      result.inspected += 1;
      const batchFolder = `${folder}/${c.name}`;
      const listed = await bucket.list(batchFolder, { limit: LIST_LIMIT }, { signal });
      if (listed.error) return stop(`list: ${listed.error.message}`);
      const entries = listed.data ?? [];
      if (entries.length === 0 || entries.length > MAX_PAGE_PHOTOS) continue;
      const keys = entries.map((e) => `${batchFolder}/${e.name}`);
      // Every entry a file, every key one the route itself accepts for this user and batch.
      if (entries.some((e) => e.id === null)) continue;
      if (keys.some((k) => !checkPhotoKeys(userId, [k]).ok)) continue;
      const times = entries.map(newestOf);
      if (times.some((t) => t === null)) continue;
      if (now - Math.max(...(times as number[])) < PAGE_PHOTO_STALE_MS) continue;
      // Whole batches only: one that does not fit waits for a later request
      // (5 batches of at most 10 cannot pass 50; held anyway, and never a stop).
      if (doomed.length + keys.length > PAGE_PHOTO_SWEEP_MAX_OBJECTS) continue;
      doomed.push(...keys);
      result.batches += 1;
    }
    if (doomed.length === 0) return result;
    if (signal.aborted) return stop('time budget spent before the removal');

    const removed = await bucket.remove(doomed);
    if (removed.error) return stop(`remove: ${removed.error.message}`);
    result.removed = removed.data?.length ?? 0;
    console.log(JSON.stringify({ tag: 'kf-page-photos-swept', folder, batches: result.batches, removed: result.removed }));
    return result;
  } catch (e) {
    return stop(String(e instanceof Error ? e.message : e));
  }
}
