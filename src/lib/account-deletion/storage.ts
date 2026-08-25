import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Account deletion, step 2 of 3: remove every stored file belonging to a user.
 *
 * WHY THIS EXISTS AS APPLICATION CODE AND NOT A DATABASE TRIGGER. Nothing in the
 * schema reaches storage: `storage.objects` has NO foreign key to `auth.users`,
 * to `profiles`, or to anything else, so no cascade touches it. Deleting a user
 * removes every row in the public schema and leaves every uploaded file behind.
 *
 * A delete-side trigger on `auth.users` was considered and REJECTED, and the
 * reason is mechanical rather than stylistic: a Postgres trigger can only
 * `DELETE FROM storage.objects`, which removes the METADATA ROW. The bytes live
 * in the storage backend and are removed by the Storage API, which is what the
 * upload path already uses (`api/ingest/route.ts:131`). A trigger cannot call
 * that API, so it could only ever orphan the files it claimed to delete --
 * precisely the failure this module exists to prevent.
 *
 * SERVICE ROLE IS REQUIRED, NOT PREFERRED. `002_storage.sql` grants storage
 * policies for INSERT ("Users can upload to their own folder") and SELECT
 * ("Users can read own files") ONLY. There is no DELETE policy, so a user's own
 * session cannot delete their own files -- RLS denies it. This must therefore be
 * called with a service-role client (as `api/paddle/webhook/route.ts` does), and
 * consequently must NEVER run in the browser.
 *
 * Layout is `{userId}/{kbId}/{filename}` in the `documents` bucket, set at
 * `api/ingest/route.ts:130`. The walk below does NOT hardcode that depth.
 */

const BUCKET = 'documents';

/** Supabase `list()` caps a page; page explicitly rather than trusting a default. */
const LIST_PAGE = 100;

/** `remove()` takes an array; batch it rather than sending an unbounded list. */
const REMOVE_BATCH = 100;

/**
 * THE SINGLE MOST DANGEROUS LINE IN THIS MODULE IS THE PREFIX, so the userId is
 * validated before one is built. An empty or malformed id yields the prefix `""`,
 * which enumerates the ENTIRE BUCKET and would then delete every file belonging
 * to every user. This is not defensive padding; it is the difference between
 * deleting one account and emptying production.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SweepResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: string; remaining: number | null };

type Bucket = ReturnType<SupabaseClient['storage']['from']>;

/**
 * Depth-agnostic enumeration of every object under `prefix`. Supabase's `list()`
 * is NOT recursive and returns folders as entries whose `id` is null, so folders
 * are walked rather than assumed two deep.
 *
 * Returns an error message, or null on success. Errors are RETURNED, not thrown:
 * a caller that cannot enumerate must abort the deletion, and that decision
 * belongs to the caller rather than to an exception handler somewhere above it.
 */
async function listAll(bucket: Bucket, prefix: string, out: string[]): Promise<string | null> {
  let offset = 0;

  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE, offset });
    if (error) return error.message;
    if (!data || data.length === 0) return null;

    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        // Folder placeholder: recurse. Paging state for THIS prefix is untouched.
        const nested = await listAll(bucket, full, out);
        if (nested) return nested;
      } else {
        out.push(full);
      }
    }

    // A short page is the last page.
    if (data.length < LIST_PAGE) return null;
    offset += data.length;
  }
}

/**
 * Delete every stored file for `userId`, then PROVE the prefix is empty.
 *
 * VERIFY-THEN-PROCEED, NOT FIRE-AND-HOPE. `remove()` can partially succeed, so
 * checking its error is not sufficient evidence that anything is gone. The
 * prefix is re-enumerated afterwards and a non-empty result is a FAILURE, not a
 * warning.
 *
 * THE CALLER MUST ABORT THE WHOLE DELETION ON `ok: false`, and must not delete
 * the user row. The path prefix IS the user id, and the user id is the only
 * handle anything has on these files -- no table references them. Delete the
 * user first and any surviving file becomes permanently orphaned personal data,
 * locatable only by scanning a bucket for a UUID that no longer exists anywhere.
 * That is unrecoverable, which is why this is a precondition and not a cleanup.
 *
 * This function never throws for an expected condition and never deletes a
 * database row. It does one thing.
 */
export async function sweepUserStorage(
  admin: SupabaseClient,
  userId: string
): Promise<SweepResult> {
  if (!UUID_RE.test(userId)) {
    return {
      ok: false,
      reason: 'refusing to sweep: userId is not a UUID, which would widen the prefix',
      remaining: null,
    };
  }

  const bucket = admin.storage.from(BUCKET);

  const paths: string[] = [];
  const listError = await listAll(bucket, userId, paths);
  if (listError) {
    return { ok: false, reason: `enumeration failed: ${listError}`, remaining: null };
  }

  // Nothing stored is a legitimate success, not an anomaly: a user who never
  // uploaded has no prefix at all.
  if (paths.length === 0) return { ok: true, deleted: 0 };

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error } = await bucket.remove(paths.slice(i, i + REMOVE_BATCH));
    if (error) {
      return { ok: false, reason: `remove failed: ${error.message}`, remaining: null };
    }
  }

  const survivors: string[] = [];
  const verifyError = await listAll(bucket, userId, survivors);
  if (verifyError) {
    // Removal reported success but the result cannot be confirmed. Unverified is
    // treated as failed, deliberately -- the caller must not proceed on a claim
    // it could not check.
    return { ok: false, reason: `verification failed: ${verifyError}`, remaining: null };
  }
  if (survivors.length > 0) {
    return {
      ok: false,
      reason: 'objects remain under the prefix after removal reported success',
      remaining: survivors.length,
    };
  }

  return { ok: true, deleted: paths.length };
}
