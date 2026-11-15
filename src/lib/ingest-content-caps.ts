/**
 * The ingestion service's three content-cap refusals (services/ingestion/main.py,
 * fix/ai-cost-caps): a file whose converted text is over MAX_CONVERTED_CHARS
 * (`text_too_long`), or a .docx/.pptx/.xlsx whose archive unpacks to over
 * MAX_ARCHIVE_BYTES or MAX_ARCHIVE_ENTRIES (`archive_too_large`), or a file
 * whose conversion went over the converter's memory or time bound
 * (`file_too_heavy`, fix/pdf-memory-guard: a dense or hostile PDF, a huge
 * spreadsheet). All are a 422 whose FastAPI body is
 * `{"detail": "<code>: <reason>"}`, sent after the service has marked the
 * document `error` and before anything reached Voyage. The student is told
 * the same sentence for all three: the file holds more than one file can be
 * read for, and splitting it is the way through.
 *
 * `/api/ingest` tells the student `too-much-text` for any of them, instead of the
 * `unconfirmed` reply every other service failure gets: here the outcome IS
 * known (the file failed, and why), so saying "we could not confirm" would be
 * untrue. Anything that does not match exactly keeps the old reply.
 */
export const CONTENT_CAP_CODES = ['text_too_long', 'archive_too_large', 'file_too_heavy'] as const;

export function isContentCapRefusal(status: number, body: string): boolean {
  if (status !== 422) return false;
  try {
    const detail = (JSON.parse(body) as { detail?: unknown })?.detail;
    return typeof detail === 'string' && CONTENT_CAP_CODES.some((code) => detail.startsWith(`${code}:`));
  } catch {
    return false;
  }
}
