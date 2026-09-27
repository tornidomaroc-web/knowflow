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
