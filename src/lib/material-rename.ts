import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveStorageKey } from './storage-key';
import { renamedFilename, renameRefused } from './material-name';

/**
 * Rename ONE material. Register #47, the half that had to wait for #110.
 *
 * WHY THIS IS NOT JUST `update filename`. A row created before #110 has no
 * `storage_path`: its file is found by recomputing the old key FROM ITS
 * FILENAME (`effectiveStorageKey`). Change the filename and that recomputation
 * points somewhere else, so the delete path would leave the real file behind.
 * So for such a row, the key it resolves to TODAY is written into
 * `storage_path` in the SAME update that changes the name, and that update
 * only matches while `storage_path` is still NULL and the name is still the one
 * the key was computed from. From then on the file is found by the stored key,
 * exactly the file the delete path would have removed before the rename.
 *
 * A row created since #110 already carries `storage_path`, so only its name
 * changes. Its stored key keeps the letters of the name it was uploaded under
 * (`.../{documentId}/_____-110.txt`); that is cosmetic, and nothing reads it.
 *
 * NO FILE IS MOVED AND STORAGE IS NEVER TOUCHED. This is one row update through
 * the user's own session: RLS decides ownership, and no service-role client is
 * involved. `documents` has a single `for all` policy whose `using` clause also
 * serves as its check, so a user can update only their own rows.
 *
 * THE ONE IRREVERSIBLE THING IT DOES. The first rename of a pre-#110 row
 * PERMANENTLY writes a `storage_path` to an existing row. From that moment the
 * #110 migration can no longer be undone by dropping the column, because the
 * column is then the only record of that file's key (see the runbook at the
 * bottom of `supabase/migrations/20260923_documents_storage_path.sql`).
 *
 * Self-contained on purpose: it imports only a type, `./storage-key` and
 * `./material-name`, so it can be exercised against a scripted client with no
 * database, as `material-deletion.ts` is.
 */

export type MaterialRenameResult =
  /** `pathWritten`: this rename persisted a pre-#110 row's key. */
  | { ok: true; filename: string; unchanged: boolean; pathWritten: boolean }
  /** No row visible to this user. Nothing was attempted. */
  | { ok: false; stage: 'not-found'; reason: string }
  /** The new name is empty, has a control character or a slash, or is too long. Nothing changed. */
  | { ok: false; stage: 'invalid-name'; reason: string }
  /** A pre-#110 row whose key cannot be derived from its name. Nothing changed. */
  | { ok: false; stage: 'unresolvable-key'; reason: string }
  /** Another row already stores this key (a pre-#110 collision). Nothing changed. */
  | { ok: false; stage: 'path-taken'; reason: string }
  /** The row changed between the read and the update. Nothing changed. */
  | { ok: false; stage: 'conflict'; reason: string }
  /** A read failed. Nothing changed. */
  | { ok: false; stage: 'lookup'; reason: string }
  /** The update failed. It is one statement, so nothing changed. */
  | { ok: false; stage: 'update'; reason: string };

/** `strict: false` (register #41) will not narrow on `ok`; a predicate does. */
export function materialRenameFailed(
  r: MaterialRenameResult
): r is Extract<MaterialRenameResult, { ok: false }> {
  return !r.ok;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres `unique_violation`: the partial unique index on `storage_path`. */
const UNIQUE_VIOLATION = '23505';

export async function renameMaterial(
  session: SupabaseClient,
  userId: string,
  documentId: string,
  input: string
): Promise<MaterialRenameResult> {
  if (!UUID_RE.test(userId)) {
    return { ok: false, stage: 'lookup', reason: 'userId is not a UUID' };
  }
  if (!UUID_RE.test(documentId)) {
    return { ok: false, stage: 'not-found', reason: 'documentId is not a UUID' };
  }

  // ---- 1. Ownership, decided by RLS, exactly as the delete path does it. ----
  const { data: doc, error: readError } = await session
    .from('documents')
    .select('id, kb_id, filename, storage_path')
    .eq('id', documentId)
    .maybeSingle();
  if (readError) {
    return { ok: false, stage: 'lookup', reason: readError.message };
  }
  if (!doc) {
    return { ok: false, stage: 'not-found', reason: 'no such document for this user' };
  }
  if (!UUID_RE.test(doc.kb_id)) {
    return { ok: false, stage: 'lookup', reason: 'kb_id is not a UUID' };
  }

  // ---- 2. The new name. The current extension is kept. ----
  const next = renamedFilename(doc.filename, input);
  if (renameRefused(next)) {
    return { ok: false, stage: 'invalid-name', reason: next.reason };
  }
  if (next.filename === doc.filename) {
    // Nothing to do, and nothing is written: an unchanged save must not be the
    // thing that permanently persists a pre-#110 row's key.
    return { ok: true, filename: doc.filename, unchanged: true, pathWritten: false };
  }

  // ---- 3a. A row created since #110: its key is already stored. Name only. ----
  if (doc.storage_path) {
    const { error: updateError, count } = await session
      .from('documents')
      .update({ filename: next.filename }, { count: 'exact' })
      .eq('id', documentId)
      .eq('storage_path', doc.storage_path);
    if (updateError) {
      return { ok: false, stage: 'update', reason: updateError.message };
    }
    if (count !== 1) {
      return { ok: false, stage: 'conflict', reason: `expected to update 1 row, updated ${count ?? 'unknown'}` };
    }
    return { ok: true, filename: next.filename, unchanged: false, pathWritten: false };
  }

  // ---- 3b. A row created before #110: persist the key it resolves to TODAY,
  // in the same statement that changes the name. The update matches only while
  // `storage_path` is still NULL and the name is still the one the key was
  // computed from; anything else is a conflict and changes nothing. ----
  const key = effectiveStorageKey(userId, doc);
  if (!key) {
    return { ok: false, stage: 'unresolvable-key', reason: 'filename reduces to an empty key' };
  }
  const { error: updateError, count } = await session
    .from('documents')
    .update({ filename: next.filename, storage_path: key }, { count: 'exact' })
    .eq('id', documentId)
    .eq('filename', doc.filename)
    .is('storage_path', null);
  if (updateError) {
    if (updateError.code === UNIQUE_VIOLATION) {
      return { ok: false, stage: 'path-taken', reason: 'another row already stores this key' };
    }
    return { ok: false, stage: 'update', reason: updateError.message };
  }
  if (count !== 1) {
    return { ok: false, stage: 'conflict', reason: `expected to update 1 row, updated ${count ?? 'unknown'}` };
  }
  return { ok: true, filename: next.filename, unchanged: false, pathWritten: true };
}
