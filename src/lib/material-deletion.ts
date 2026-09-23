import type { SupabaseClient } from '@supabase/supabase-js';
import { DOCUMENTS_BUCKET, effectiveStorageKey } from './storage-key';

/**
 * Delete ONE material: its stored file, then its `documents` row. Register #47.
 *
 * THE ORDER IS THE DESIGN, and it mirrors `account-deletion/orchestrate.ts`.
 *
 *   1. ownership        -- read through the user's own session, so RLS decides.
 *                          No row means 404, and nothing else runs.
 *   2. the stored file  -- removed with the service role, then PROVEN gone by
 *                          re-listing. Any failure aborts with the row intact.
 *   3. the row          -- deleted through the user's session. Postgres removes
 *                          the rest by foreign key: `chunks` (text and
 *                          embeddings), `quizzes`, and through them
 *                          `quiz_items`. The summary and the extracted text are
 *                          columns on the row itself.
 *
 * WHY THE FILE GOES FIRST. The row is the only thing that names the file: its
 * `storage_path` since #110, or its `filename` for rows from before it (see
 * `effectiveStorageKey` in `storage-key.ts`). Delete the row
 * first and a failed file removal leaves bytes nothing can find again short of
 * deleting the whole account. File first, and a failed row delete leaves a row
 * whose file is already gone, which costs nothing: no code reads a stored file
 * back after upload (the ingestion service receives the bytes directly), and a
 * retry finishes the job because removing an absent file is not an error.
 *
 * ANY STATUS MAY BE DELETED, `processing` AND `error` INCLUDED. A row stuck at
 * `processing` has no reaper and no other way out (`/api/ingest`), so refusing
 * would trap exactly the rows that most need removing. The race with the
 * ingestion service is safe: `chunks.document_id` references `documents`, so a
 * late chunk insert fails instead of orphaning, and its final status update
 * matches no row.
 *
 * THE SHARED KEY. Before #110 the key rule mapped every non-ASCII character to
 * `_`, so two pre-#110 materials in one subject can share ONE stored file (see
 * `storage-key.ts`). A row written since #110 cannot share: its key contains
 * its own document id. The file is removed only when no other row in the
 * subject maps to its key; otherwise it is kept and the result says so.
 *
 * DELIBERATELY NOT TOUCHED, AS RULED: the day's usage counters (work already
 * done), `study_events` (it names no document), and saved chat answers, which
 * were written from this material's passages and stay until the conversation's
 * account is deleted. The confirmation the student clicks through says so.
 *
 * THE RESULT CARRIES ITS OWN EVIDENCE (`DeletionEvidence`): whether the file was
 * there, and the chunk, quiz and quiz-item counts before and after, taken with
 * the service role. They are reads only and never block the delete.
 *
 * Self-contained on purpose: it imports only a type and `./storage-key`, so it
 * can be exercised against a scripted client with no database.
 */

/** Rows beneath one document, counted with the service role. null = the count failed. */
export interface DependentCounts {
  chunks: number | null;
  quizzes: number | null;
  quizItems: number | null;
}

/**
 * WHAT THE DELETE CAN PROVE ABOUT ITSELF, returned as counts only.
 *
 * Counted with the SERVICE ROLE, and that is the point: the `quizzes` and
 * `quiz_items` policies reach ownership THROUGH `documents.kb_id`, so once the
 * row is gone an orphaned quiz is invisible to the user's own session, and a
 * read-back through it would report 0 whether the cascade worked or not. Only a
 * count that bypasses RLS can fail, so only that one is a witness.
 */
export interface DeletionEvidence {
  /** Whether the file was listed before removal; null on the kept-shared path. */
  fileExistedBefore: boolean | null;
  before: DependentCounts;
  after: DependentCounts;
}

export type MaterialDeletionResult =
  | { ok: true; file: 'removed' | 'kept-shared'; sharedWith: number; evidence: DeletionEvidence }
  /** No row visible to this user. Nothing was attempted. */
  | { ok: false; stage: 'not-found'; reason: string }
  /** The key could not be derived from the filename. Nothing was attempted. */
  | { ok: false; stage: 'unresolvable-key'; reason: string }
  /** A read failed before anything was removed. Nothing was attempted. */
  | { ok: false; stage: 'lookup'; reason: string }
  /** The file could not be removed, or could not be proven gone. The row stands. */
  | { ok: false; stage: 'storage'; reason: string }
  /** The file is gone and the row still stands. A retry finishes it. */
  | { ok: false; stage: 'row'; reason: string };

/**
 * `tsconfig` sets `strict: false` (register #41), so TypeScript will not narrow
 * this union on `ok`. A predicate narrows regardless, as in `orchestrate.ts`.
 */
export function materialDeletionFailed(
  r: MaterialDeletionResult
): r is Extract<MaterialDeletionResult, { ok: false }> {
  return !r.ok;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase `list()` caps a page; page explicitly rather than trusting a default. */
const LIST_PAGE = 100;

type Bucket = ReturnType<SupabaseClient['storage']['from']>;

/**
 * Whether `folder/name` exists, or an error message. `search` narrows the
 * listing, but it is a case-insensitive pattern in which `_` matches any
 * character, so it can only ever return MORE entries than the one asked for,
 * never fewer. The exact comparison below is what decides.
 */
async function fileExists(bucket: Bucket, folder: string, name: string): Promise<boolean | string> {
  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(folder, { limit: LIST_PAGE, offset, search: name });
    if (error) return error.message;
    if (!data || data.length === 0) return false;
    if (data.some((entry) => entry.id !== null && entry.name === name)) return true;
    if (data.length < LIST_PAGE) return false;
    offset += data.length;
  }
}

/**
 * Counts beneath one document, with the service role. `quizIds` is captured
 * BEFORE the delete, because afterwards nothing links a quiz item to the
 * document except the quiz rows the cascade should have removed.
 */
async function countDependents(
  admin: SupabaseClient,
  documentId: string,
  quizIds: string[]
): Promise<DependentCounts> {
  const chunks = await admin
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);
  const quizzes = await admin
    .from('quizzes')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);
  const quizItems =
    quizIds.length === 0
      ? { count: 0, error: null }
      : await admin
          .from('quiz_items')
          .select('*', { count: 'exact', head: true })
          .in('quiz_id', quizIds);
  return {
    chunks: chunks.error ? null : chunks.count ?? null,
    quizzes: quizzes.error ? null : quizzes.count ?? null,
    quizItems: quizItems.error ? null : quizItems.count ?? null,
  };
}

export async function deleteMaterial(
  session: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  documentId: string
): Promise<MaterialDeletionResult> {
  // The prefix is built from these ids, and a malformed one widens it. The user
  // id comes from the session; the document id comes from the URL.
  if (!UUID_RE.test(userId)) {
    return { ok: false, stage: 'lookup', reason: 'userId is not a UUID' };
  }
  if (!UUID_RE.test(documentId)) {
    return { ok: false, stage: 'not-found', reason: 'documentId is not a UUID' };
  }

  // ---- 1. Ownership, decided by RLS. ----
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

  // `storage_path` for rows written since #110, the old rule for rows before it.
  const key = effectiveStorageKey(userId, doc);
  if (!key) {
    return { ok: false, stage: 'unresolvable-key', reason: 'filename reduces to an empty key' };
  }
  // The service role removes whatever this names, so a stored key is not trusted
  // blindly: it must sit strictly inside this user's own subject folder, with no
  // empty or dot segments. Our own ingest writes it, and this is the check that
  // keeps it that way if anything else ever does.
  const prefix = `${userId}/${doc.kb_id}/`;
  const rest = key.startsWith(prefix) ? key.slice(prefix.length) : '';
  if (!rest || rest.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    return { ok: false, stage: 'unresolvable-key', reason: 'stored key is outside the subject folder' };
  }
  const slash = key.lastIndexOf('/');
  const folder = key.slice(0, slash);
  const name = key.slice(slash + 1);

  // ---- The shared key: does any OTHER row in this subject map to the same file?
  // Only pre-#110 rows can: a stored key contains its own document id. ----
  const { data: siblings, error: siblingError } = await session
    .from('documents')
    .select('id, kb_id, filename, storage_path')
    .eq('kb_id', doc.kb_id)
    .neq('id', documentId);
  if (siblingError) {
    return { ok: false, stage: 'lookup', reason: siblingError.message };
  }
  const sharedWith = (siblings ?? []).filter((s) => effectiveStorageKey(userId, s) === key).length;

  // ---- The "before" half of the evidence. Reads only; a failed count is
  // recorded as null and never blocks the delete the student asked for. ----
  const quizRows = await admin.from('quizzes').select('id').eq('document_id', documentId);
  const quizIds: string[] = quizRows.error ? [] : (quizRows.data ?? []).map((q: { id: string }) => q.id);
  const before = await countDependents(admin, documentId, quizIds);
  if (quizRows.error) before.quizItems = null;

  // ---- 2. The file. Removed only when nothing else maps to it, then proven gone. ----
  let fileExistedBefore: boolean | null = null;
  if (sharedWith === 0) {
    const bucket = admin.storage.from(DOCUMENTS_BUCKET);

    const existed = await fileExists(bucket, folder, name);
    if (typeof existed === 'string') {
      return { ok: false, stage: 'storage', reason: `listing failed: ${existed}` };
    }
    fileExistedBefore = existed;

    const { error: removeError } = await bucket.remove([key]);
    if (removeError) {
      return { ok: false, stage: 'storage', reason: `remove failed: ${removeError.message}` };
    }

    const still = await fileExists(bucket, folder, name);
    if (typeof still === 'string') {
      // Unverified is treated as failed: the row must not go on a claim nobody checked.
      return { ok: false, stage: 'storage', reason: `verification failed: ${still}` };
    }
    if (still) {
      return { ok: false, stage: 'storage', reason: 'file still listed after removal reported success' };
    }
  }

  // ---- 3. The row. The foreign keys remove its chunks and quizzes. ----
  const { error: deleteError, count } = await session
    .from('documents')
    .delete({ count: 'exact' })
    .eq('id', documentId);
  if (deleteError) {
    return { ok: false, stage: 'row', reason: deleteError.message };
  }
  if (count !== 1) {
    return { ok: false, stage: 'row', reason: `expected to delete 1 row, deleted ${count ?? 'unknown'}` };
  }

  // ---- The "after" half. Non-zero here would mean the cascade did not run; the
  // row is already gone, so it is reported rather than turned into a failure. ----
  const after = await countDependents(admin, documentId, quizIds);
  if (quizRows.error) after.quizItems = null;

  return {
    ok: true,
    file: sharedWith === 0 ? 'removed' : 'kept-shared',
    sharedWith,
    evidence: { fileExistedBefore, before, after },
  };
}
