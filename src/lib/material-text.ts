/**
 * REGISTER #128: A MATERIAL WITH NO TEXT.
 *
 * The ingestion service marks a file `ready` even when the converted text has
 * no tokens (a scanned PDF with no text layer, photos, an empty file): it
 * writes `status: 'ready'`, `embedding_status: 'ready'` and `chunk_count: 0`
 * in one update (services/ingestion/main.py, `_persist`). Ask has nothing to
 * retrieve from such a file, and summary and quiz refuse it.
 *
 * `embedding_status === 'ready'` is part of the test on purpose. Only the
 * ingestion service (and its backfill) sets it, and both write the real chunk
 * count with it. Rows from before the RAG migration that were never embedded
 * keep `embedding_status` 'pending' or 'error' and a `chunk_count` the first
 * upload route ESTIMATED as words / 100, so a short readable file could hold 0
 * there; calling it "no text" would be false. A null or missing count is
 * unknown, not zero: those rows keep showing as ready.
 */
export interface MaterialTextFields {
  status: string;
  chunk_count?: number | null;
  embedding_status?: string | null;
}

export function hasNoText(d: MaterialTextFields): boolean {
  return d.status === 'ready' && d.embedding_status === 'ready' && d.chunk_count === 0;
}

/**
 * A file Ask can answer from (register #129): ready, and not a file with no
 * text. Built on `hasNoText` so there is one rule, not two. Failed and
 * processing files are not answerable; a pre-RAG row that `hasNoText` leaves
 * alone counts as answerable, as it did before #128.
 */
export function isAnswerable(d: MaterialTextFields): boolean {
  return d.status === 'ready' && !hasNoText(d);
}

/** The subjects that hold at least one answerable file (#129 (c)). */
export function answerableSubjectIds(rows: (MaterialTextFields & { kb_id: string })[]): Set<string> {
  return new Set(rows.filter(isAnswerable).map((r) => r.kb_id));
}

/**
 * The subject Ask opens on (#129 (c)): the one `?kb=` names if it can be
 * asked, else the first that can, else none. A subject that cannot be asked is
 * never preselected, but a past conversation in it still opens (KBSelector
 * selects a conversation's subject from the full list, not this one).
 */
export function initialAskSubject(kbIds: string[], answerable: Set<string>, wanted: string | null): string {
  if (wanted && answerable.has(wanted) && kbIds.includes(wanted)) return wanted;
  return kbIds.find((id) => answerable.has(id)) ?? '';
}
