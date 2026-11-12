/**
 * THE SAMPLE FILE (audit cause 9, docs/plans/sample-file.md, approach (b)).
 *
 * A student with no material can press "Try with a sample file" on the home's
 * three-steps card. `/api/sample` then creates, under the student's own
 * session: a subject ("مثال" / "Sample"), the committed two-page PDF about the
 * cell in the documents bucket, a `documents` row that is already `ready` and
 * marked `is_sample`, and its chunks with the embeddings computed ONCE and
 * committed (data/sample-file/cell.{ar,en}.json). Nothing is sent to the
 * ingestion service, Voyage AI or Anthropic, and no usage counter moves.
 *
 * This file is the pure part: the rows and the names, so the proof
 * (scripts/verify-sample-feature.mjs) can hold them in the typecheck job.
 */
import type { Locale } from '@/lib/i18n';

/** The route's refusal codes, read by the button. `ai_consent_required` is AI_CONSENT_REFUSAL (src/lib/ai-consent.ts). */
export const SAMPLE_SUBJECT_LIMIT = 'subject_limit';
export const SAMPLE_FAILED = 'sample_failed';

/** Both committed PDFs have two pages, each with text (asserted by the keyed run and verify-sample-file). */
export const SAMPLE_PAGES_TOTAL = 2;

export interface SampleChunk {
  chunk_index: number;
  content: string;
  token_count: number;
  page_start: number;
  page_end: number;
  page_kind: string;
  embedding: number[];
}

export interface SampleData {
  lang: string;
  chunks: SampleChunk[];
}

/** The committed file a locale gets: Arabic for `ar`, English otherwise. */
export function sampleLanguage(locale: Locale): 'ar' | 'en' {
  return locale === 'ar' ? 'ar' : 'en';
}

/** The stored file's name: the approved display name with the PDF's extension ("الخلية.pdf", "The cell.pdf"). */
export function sampleFileName(displayName: string): string {
  return `${displayName}.pdf`;
}

/**
 * The file's whole text, for the summary and the quiz (both read
 * `documents.markdown_content`, not the chunks). Consecutive chunks overlap
 * (CHUNK_OVERLAP tokens), so each next chunk is joined after the longest text
 * its start shares with the end of what is already there.
 */
export function sampleMarkdown(chunks: readonly Pick<SampleChunk, 'content'>[]): string {
  let text = '';
  for (const { content } of chunks) {
    let k = Math.min(text.length, content.length);
    while (k > 0 && !text.endsWith(content.slice(0, k))) k--;
    text += content.slice(k);
  }
  return text;
}

/** The `documents` row: ready at once, never processing, marked as the sample. */
export function sampleDocumentRow(input: {
  id: string;
  kbId: string;
  filename: string;
  storagePath: string;
  data: SampleData;
}) {
  return {
    id: input.id,
    kb_id: input.kbId,
    filename: input.filename,
    file_type: 'pdf' as const,
    status: 'ready',
    embedding_status: 'ready',
    chunk_count: input.data.chunks.length,
    pages_total: SAMPLE_PAGES_TOTAL,
    pages_no_text: 0,
    markdown_content: sampleMarkdown(input.data.chunks),
    storage_path: input.storagePath,
    is_sample: true,
  };
}

/**
 * The chunk rows, exactly the columns the ingestion service writes
 * (services/ingestion/main.py, `_store_chunks`), the vector in pgvector's
 * text form.
 */
export function sampleChunkRows(data: SampleData, documentId: string, kbId: string) {
  return data.chunks.map((c) => ({
    document_id: documentId,
    kb_id: kbId,
    chunk_index: c.chunk_index,
    content: c.content,
    token_count: c.token_count,
    embedding: JSON.stringify(c.embedding),
    page_start: c.page_start,
    page_end: c.page_end,
    page_kind: c.page_kind,
  }));
}

/** Where the button sends the student: the new subject's Ask. */
export function sampleAskHref(locale: Locale, kbId: string): string {
  return `/${locale}/dashboard/agent?kb=${encodeURIComponent(kbId)}`;
}

/** The ready question is offered only in a subject that holds the sample file. */
export function sampleQuestionFor(kbId: string, sampleKbIds: readonly string[], question: string): string | null {
  return sampleKbIds.includes(kbId) ? question : null;
}

/** Marks the rows whose id is a sample document's, for `keptUploadsToday`. */
export function markSampleRows<T extends { id: string }>(rows: readonly T[], sampleIds: ReadonlySet<string>): (T & { is_sample: boolean })[] {
  return rows.map((r) => ({ ...r, is_sample: sampleIds.has(r.id) }));
}
