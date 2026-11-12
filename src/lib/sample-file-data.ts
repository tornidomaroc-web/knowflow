/**
 * The sample file's committed chunks and embeddings (server only: imported by
 * /api/sample, never by a client component). Produced once by
 * .github/workflows/sample-embeddings.yml (run 43122125966) with the
 * ingestion service's own functions; scripts/verify-sample-file.mjs fails
 * when the model, the chunker or the PDFs drift from them.
 */
import ar from '../../data/sample-file/cell.ar.json';
import en from '../../data/sample-file/cell.en.json';
import type { SampleData } from '@/lib/sample-file';

export function sampleData(lang: 'ar' | 'en'): SampleData {
  return lang === 'ar' ? ar : en;
}
