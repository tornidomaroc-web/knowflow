/**
 * THE PAGE READER'S I/O: the photos in storage, the model, the ledger.
 * (The rules: src/lib/page-reader.ts. The route: src/app/api/page-read/route.ts.)
 *
 * IN THIS ORDER, after the route's gates have passed, all under ONE deadline
 * (PAGE_READ_DEADLINE_MS) that starts before the first storage call:
 *   1. Each photo's size from the batch folder's listing, BEFORE it is
 *      downloaded: a missing photo or one over MAX_PHOTO_BYTES is never pulled
 *      into memory. (Names are compared exactly; the listing is of the
 *      student's own folder, under their session.)
 *   2. Preparing, at most PAGE_READ_CONCURRENCY photos at once: the download
 *      with the student's own session (storage RLS: the first path segment
 *      must be the caller, the rule checkPhotoKeys already applied), cut off
 *      at PAGE_READ_DOWNLOAD_TIMEOUT_MS so one slow photo fails alone; the
 *      header (no decoder yet: HEIC, another format, a progressive or
 *      interlaced file, or one outside the pixel, side and shape bounds fails
 *      that photo only); then sharp, one photo at a time in the whole process
 *      (src/lib/page-photo-image.ts). The raw bytes are let go as soon as the
 *      photo is ready, so a request holds about three raw photos at most.
 *   3. The photos removed from storage, before the long part, with the
 *      service role, which no policy limits (the student's own DELETE, any
 *      own object on production today and own page-photos only after
 *      20261118_storage_lockdown_production.sql, is not relied on), and the
 *      removal checked rather than assumed: storage answers a path it did
 *      not delete with nothing, not with an error.
 *   4. Reading, at most PAGE_READ_CONCURRENCY pages at once. Each call's own
 *      time limit is what is left of the deadline, so the SDK never abandons
 *      a slow page and sends it again; its retries are left for answers that
 *      were not billed. Each call also races the deadline, because the SDK
 *      sleeps out a 429's `retry-after` without looking at the signal.
 *   5. Every call that Anthropic billed recorded in the ledger at its real
 *      price (`usage`), right after it returns and before its text is
 *      checked: a cut-off, empty or mid-answer-refused page was billed. A
 *      refusal before any output is billed only in some categories
 *      (`responseBilled`); otherwise it is not recorded. A call that failed,
 *      or that the deadline cut off, returned no `usage` and is not estimated
 *      (logged as `kf-page-read-error`).
 * A photo not prepared, or a page not finished, by the deadline fails as
 * `read-timeout`; a page not started by then is never sent. One photo failing
 * never loses the others.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { haiku55Usd } from '@/lib/ai-allowance';
import { recordAiSpend } from '@/lib/ai-allowance-server';
import type { SessionClient } from '@/lib/ingest-material';
import { photoForModel, type ModelPhoto } from '@/lib/page-photo-image';
import {
  headerRefusal,
  MAX_PHOTO_BYTES,
  PAGE_READ_CONCURRENCY,
  PAGE_READ_DEADLINE_MS,
  PAGE_READ_DOWNLOAD_TIMEOUT_MS,
  PAGE_READ_MAX_RETRIES,
  PAGE_READ_MAX_TOKENS,
  PAGE_READ_MODEL,
  PAGE_READ_PROMPT,
  pageText,
  readPhotoHeader,
  responseBilled,
  type PhotoFailure,
  type PhotoOutcome,
} from '@/lib/page-reader';
import { DOCUMENTS_BUCKET } from '@/lib/storage-key';
import { usageTokens } from '@/lib/usage-cost';

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Remove the batch's photos. Only ever called with keys checkPhotoKeys accepted
 * for the caller, all in one `{userId}/page-photos/{batchId}` folder, so the
 * service role can only reach the caller's own photos. Never throws. A photo
 * left behind is logged with the tag `kf-page-photos-left` (account deletion
 * still sweeps the whole user folder).
 */
export async function removePagePhotos(keys: readonly string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const folder = keys[0].slice(0, keys[0].lastIndexOf('/'));
  const left = (reason: string, count = keys.length) => {
    console.error(JSON.stringify({ tag: 'kf-page-photos-left', reason, folder, count }));
    return false;
  };
  try {
    const admin = serviceClient();
    if (!admin) return left('service role not configured');
    const bucket = admin.storage.from(DOCUMENTS_BUCKET);
    const { data, error } = await bucket.remove([...keys]);
    if (error) return left(error.message);
    if ((data?.length ?? 0) === keys.length) return true;
    // Fewer removed than asked: a photo that never arrived, or one that did
    // not go. Storage does not say which, so look.
    const { data: listed, error: listError } = await bucket.list(folder, { limit: 100 });
    if (listError) return left(`not confirmed: ${listError.message}`);
    const names = new Set(keys.map((k) => k.slice(k.lastIndexOf('/') + 1)));
    const remaining = (listed ?? []).filter((e) => e?.id && names.has(e.name)).length;
    return remaining === 0 ? true : left('still listed after the removal', remaining);
  } catch (e) {
    return left(String(e));
  }
}

/** Run `task` on every index, at most `limit` at once. `task` must not throw. */
async function eachAtMost(indices: readonly number[], limit: number, task: (i: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < indices.length) {
      const i = indices[next];
      next += 1;
      await task(i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, indices.length) }, worker));
}

/** A promise that rejects when `signal` aborts, for racing work that does not watch it. */
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(new Error('the reading deadline passed'));
    else signal.addEventListener('abort', () => reject(new Error('the reading deadline passed')), { once: true });
  });
}

/** One page, one call: the G2 request, bounded by the deadline. */
async function readOnePage(
  anthropic: Anthropic,
  userId: string,
  n: number,
  photo: ModelPhoto,
  signal: AbortSignal,
  deadlineAt: number
): Promise<{ text: string } | { code: PhotoFailure }> {
  const started = Date.now();
  let response: Anthropic.Message;
  try {
    const call = anthropic.messages.create(
      {
        model: PAGE_READ_MODEL,
        max_tokens: PAGE_READ_MAX_TOKENS,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.jpeg.toString('base64') } },
              { type: 'text', text: PAGE_READ_PROMPT },
            ],
          },
        ],
      },
      { signal, timeout: Math.max(1, Math.ceil(deadlineAt - Date.now())), maxRetries: PAGE_READ_MAX_RETRIES }
    );
    // When the deadline wins the race, the SDK's own promise ends later with
    // an abort error that nothing is waiting for; it is swallowed here.
    Promise.resolve(call).catch(() => undefined);
    response = await Promise.race([call, whenAborted(signal)]);
  } catch (e) {
    const timedOut = signal.aborted;
    console.error(
      JSON.stringify({
        tag: 'kf-page-read-error',
        user_id: userId,
        page: n,
        timed_out: timedOut,
        status: (e as { status?: unknown })?.status ?? null,
        error: e instanceof Error ? e.name : String(e),
        ms: Date.now() - started,
      })
    );
    return { code: timedOut ? 'read-timeout' : 'read-failed' };
  }
  // SDK 0.39 types neither the `refusal` stop reason nor `stop_details`.
  const answer = response as unknown as Parameters<typeof responseBilled>[0];
  const billed = responseBilled(answer);
  const usd = haiku55Usd(response.usage);
  // Billed, so recorded, before anything looks at the text.
  if (billed) await recordAiSpend(userId, 'page_read', usd);
  console.log(
    JSON.stringify({
      tag: 'kf-usage',
      route: 'page-read',
      model: PAGE_READ_MODEL,
      user_id: userId,
      page: n,
      ...usageTokens(response.usage),
      stop_reason: response.stop_reason,
      refusal_category: answer.stop_details?.category ?? null,
      billed,
      image_width: photo.width,
      image_height: photo.height,
      image_bytes: photo.jpeg.byteLength,
      ms: Date.now() - started,
      usd: billed ? usd : 0,
    })
  );
  return pageText(response);
}

export interface PageReadResult {
  /** One per photo, in the order the keys came. */
  outcomes: PhotoOutcome[];
  /** The pages that were read, in photo order, each the model's text exactly. */
  pages: { n: number; text: string }[];
  /** Whether the photos are confirmed gone from storage. */
  photosRemoved: boolean;
}

export async function readPagePhotos(input: {
  supabase: SessionClient;
  anthropic: Anthropic;
  userId: string;
  /** `{userId}/page-photos/{batchId}`, from checkPhotoKeys. */
  folder: string;
  /** Each key's file name in that folder, and the keys themselves, in photo order. */
  names: readonly string[];
  keys: readonly string[];
  deadlineMs?: number;
  downloadTimeoutMs?: number;
}): Promise<PageReadResult> {
  const { supabase, anthropic, userId, folder, names, keys } = input;
  const outcomes: (PhotoOutcome | null)[] = names.map(() => null);
  const fail = (i: number, code: PhotoFailure) => {
    outcomes[i] = { n: i + 1, read: false, code };
  };
  const open = () => outcomes.map((o, i) => (o === null ? i : -1)).filter((i) => i >= 0);

  const deadlineMs = input.deadlineMs ?? PAGE_READ_DEADLINE_MS;
  const deadlineAt = Date.now() + deadlineMs;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), deadlineMs);
  const ready: (ModelPhoto | null)[] = names.map(() => null);
  const pages: { n: number; text: string }[] = [];
  let photosRemoved = false;
  try {
    try {
      // 1. Sizes from the listing, before any download.
      const sizes = new Map<string, number>();
      try {
        const { data: listed, error: listError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .list(folder, { limit: 100 }, { signal: deadline.signal });
        if (listError) console.error('Page photos not listed:', listError.message);
        for (const entry of listed ?? []) {
          const size = Number(entry?.metadata?.size);
          if (entry?.id && Number.isFinite(size)) sizes.set(entry.name, size);
        }
      } catch (e) {
        console.error('Page photos not listed:', e instanceof Error ? e.message : String(e));
      }
      names.forEach((name, i) => {
        if (deadline.signal.aborted) return fail(i, 'read-timeout');
        const size = sizes.get(name);
        if (size === undefined) fail(i, 'photo-missing');
        else if (size > MAX_PHOTO_BYTES) fail(i, 'photo-too-large');
      });

      // 2. Preparing: download, header, then sharp.
      await eachAtMost(open(), PAGE_READ_CONCURRENCY, async (i) => {
        if (deadline.signal.aborted) return fail(i, 'read-timeout');
        let raw: Uint8Array;
        try {
          const signal = AbortSignal.any([deadline.signal, AbortSignal.timeout(input.downloadTimeoutMs ?? PAGE_READ_DOWNLOAD_TIMEOUT_MS)]);
          const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(keys[i], {}, { signal });
          if (error || !data) return fail(i, deadline.signal.aborted ? 'read-timeout' : 'photo-missing');
          raw = new Uint8Array(await data.arrayBuffer());
        } catch {
          return fail(i, deadline.signal.aborted ? 'read-timeout' : 'photo-missing');
        }
        if (raw.byteLength > MAX_PHOTO_BYTES) return fail(i, 'photo-too-large');
        const refusal = headerRefusal(readPhotoHeader(raw));
        if (refusal) return fail(i, refusal);
        if (deadline.signal.aborted) return fail(i, 'read-timeout');
        try {
          // The decode slot is shared by every request on this instance, so the
          // wait for it races the deadline too; the queued photo itself is
          // dropped unread if its turn comes after the deadline.
          const decode = photoForModel(raw, deadline.signal);
          decode.catch(() => undefined);
          ready[i] = await Promise.race([decode, whenAborted(deadline.signal)]);
        } catch (e) {
          if (deadline.signal.aborted) return fail(i, 'read-timeout');
          console.error(JSON.stringify({ tag: 'kf-page-photo-unreadable', user_id: userId, page: i + 1, error: e instanceof Error ? e.message.slice(0, 200) : String(e) }));
          return fail(i, 'photo-unreadable');
        }
      });
    } finally {
      // 3. Every photo is in memory or has failed: out of storage now.
      photosRemoved = await removePagePhotos(keys);
    }

    // 4 and 5. Reading, until the deadline.
    await eachAtMost(open(), PAGE_READ_CONCURRENCY, async (i) => {
      const photo = ready[i] as ModelPhoto;
      ready[i] = null;
      if (deadline.signal.aborted) return fail(i, 'read-timeout');
      const result = await readOnePage(anthropic, userId, i + 1, photo, deadline.signal, deadlineAt);
      if ('text' in result) {
        outcomes[i] = { n: i + 1, read: true };
        pages.push({ n: i + 1, text: result.text });
      } else {
        fail(i, result.code);
      }
    });
  } finally {
    clearTimeout(timer);
  }

  pages.sort((a, b) => a.n - b.n);
  return { outcomes: outcomes.map((o, i) => o ?? { n: i + 1, read: false, code: 'read-failed' }), pages, photosRemoved };
}
