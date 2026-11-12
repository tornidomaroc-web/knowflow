/**
 * The ids of the caller's sample documents (`documents.is_sample`), read
 * under RLS. A SEPARATE, TOLERANT read on purpose: the home, Ask and the
 * upload route each already read `documents`, and adding the column to those
 * selects would make every one of them fail outright if the code were ever
 * live before the migration (20261112_documents_is_sample.sql is applied by
 * hand). Here a refused read is "no sample": the home and Ask render as they
 * did, and the day's uploads are counted as before.
 */
type Reader = {
  from: (table: 'documents') => {
    select: (cols: string) => { eq: (col: string, value: boolean) => PromiseLike<{ data: { id: string; kb_id: string }[] | null; error: { message: string } | null }> };
  };
};

export async function sampleDocuments(supabase: unknown): Promise<{ id: string; kb_id: string }[]> {
  try {
    const { data, error } = await (supabase as Reader).from('documents').select('id, kb_id').eq('is_sample', true);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
