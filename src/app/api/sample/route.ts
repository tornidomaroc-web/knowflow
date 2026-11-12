import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkKBLimit } from '@/lib/limits-server';
import { AI_CONSENT_REFUSAL, aiConsentRefusalMessage, hasAiConsent } from '@/lib/ai-consent';
import { resolveLocale, useTranslation as dictionaryFor, type Locale } from '@/lib/i18n';
import { DOCUMENTS_BUCKET, documentStorageKey } from '@/lib/storage-key';
import { sampleData } from '@/lib/sample-file-data';
import {
  SAMPLE_FAILED,
  SAMPLE_SUBJECT_LIMIT,
  sampleChunkRows,
  sampleDocumentRow,
  sampleFileName,
  sampleLanguage,
} from '@/lib/sample-file';

// The PDF is read from disk (data/sample-file/, traced into this function by
// `outputFileTracingIncludes` in next.config.ts), so it needs the Node runtime.
export const runtime = 'nodejs';

/**
 * POST /api/sample: THE SAMPLE FILE (audit cause 9, docs/plans/sample-file.md).
 *
 * Everything is written with the STUDENT'S OWN SESSION under RLS; there is no
 * service role here. Nothing is sent to the ingestion service, to Voyage AI or
 * to Anthropic, `/api/ingest` is not called and no usage counter is
 * incremented: the chunks and their embeddings are the committed ones.
 *
 * In order:
 *  1. the session, or 401;
 *  2. the AI permission, or 403 `ai_consent_required`, exactly as /api/ingest:
 *     creating the sample sends nothing, but the very next tap (the ready
 *     question) does, so the permission is asked first and cannot be skipped
 *     by calling this route directly;
 *  3. IDEMPOTENT: a sample document the student already has answers with its
 *     subject's id and creates nothing;
 *  4. the subject: an EMPTY subject of the sample's name is reused (there is
 *     no subject delete, so a student who deleted the sample file would
 *     otherwise collect one empty "Sample" subject per press); otherwise the
 *     subject limit (`checkKBLimit`, as the new-subject page) and one insert;
 *  5. the PDF to the documents bucket at the normal key, the `documents` row
 *     (ready, `is_sample`), and the chunks in one insert.
 *
 * A failure after the subject exists removes what this request created (the
 * document row, whose delete cascades to its chunks, and the subject if this
 * request made it) and answers 500 `sample_failed`. THE STORED FILE CANNOT BE
 * REMOVED HERE: a student's session may insert and read in the bucket
 * (supabase/migrations/002_storage.sql) but not delete, so a failure after
 * the upload can leave one 10 to 17 KB file with no row, the gap register
 * #111 already records for /api/ingest. The removal is still attempted, so it
 * starts working the day a policy allows it.
 *
 * Two requests at the same instant can both pass step 3 and create two
 * samples (accepted in the plan, section 5: the button disables on press and
 * shows only at zero material; the student can delete the extra file).
 */
export async function POST(request: Request) {
  let locale: Locale = resolveLocale(undefined);
  try {
    const body = await request.json().catch(() => null);
    locale = resolveLocale(body?.locale);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 });
    }

    if (!hasAiConsent(user)) {
      return NextResponse.json(
        { success: false, error: aiConsentRefusalMessage(locale), code: AI_CONSENT_REFUSAL },
        { status: 403 }
      );
    }

    // 3. Idempotent. RLS scopes the read to the caller's own documents.
    const { data: existing, error: existingError } = await supabase
      .from('documents')
      .select('kb_id')
      .eq('is_sample', true)
      .limit(1);
    if (existingError) {
      console.error('Sample: the existing-sample read failed:', existingError.message);
      return NextResponse.json({ success: false, code: SAMPLE_FAILED }, { status: 500 });
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, subjectId: existing[0].kb_id, created: false });
    }

    const home = dictionaryFor(locale).dashboard.home;
    const lang = sampleLanguage(locale);
    const data = sampleData(lang);
    const filename = sampleFileName(home.sampleFileName);

    // 4. An empty subject of the sample's name is reused.
    let kbId: string | null = null;
    let subjectCreated = false;
    const { data: named } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', home.sampleSubjectName);
    for (const kb of named ?? []) {
      const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('kb_id', kb.id);
      if (!countError && (count ?? 0) === 0) { kbId = kb.id; break; }
    }

    if (!kbId) {
      const limit = await checkKBLimit(user.id);
      if (!limit.allowed) {
        return NextResponse.json(
          { success: false, code: SAMPLE_SUBJECT_LIMIT, limit: limit.limit, tier: limit.tier },
          { status: 403 }
        );
      }
      const { data: createdKb, error: kbError } = await supabase
        .from('knowledge_bases')
        .insert({ user_id: user.id, name: home.sampleSubjectName, description: null, language: lang })
        .select('id')
        .single();
      if (kbError || !createdKb) {
        console.error('Sample: the subject insert failed:', kbError?.message);
        return NextResponse.json({ success: false, code: SAMPLE_FAILED }, { status: 500 });
      }
      kbId = createdKb.id;
      subjectCreated = true;
    }

    // 5. From here on a failure undoes what this request created.
    const documentId = crypto.randomUUID();
    const storagePath = documentStorageKey(user.id, kbId, documentId, filename);
    let uploaded = false;
    let documentInserted = false;
    const undo = async (step: string, message: string | undefined) => {
      console.error(`Sample: ${step} failed:`, message);
      if (documentInserted) await supabase.from('documents').delete().eq('id', documentId);
      // Refused by the bucket's policies today (see the header); attempted anyway.
      if (uploaded) await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      if (subjectCreated) await supabase.from('knowledge_bases').delete().eq('id', kbId);
      return NextResponse.json({ success: false, code: SAMPLE_FAILED }, { status: 500 });
    };

    let pdf: Buffer;
    try {
      pdf = await readFile(path.join(process.cwd(), 'data', 'sample-file', `cell.${lang}.pdf`));
    } catch (e) {
      return undo('reading the committed PDF', e instanceof Error ? e.message : String(e));
    }

    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, pdf, { upsert: false, contentType: 'application/pdf' });
    if (storageError) return undo('the storage upload', storageError.message);
    uploaded = true;

    const { error: docError } = await supabase
      .from('documents')
      .insert(sampleDocumentRow({ id: documentId, kbId, filename, storagePath, data }));
    if (docError) return undo('the document insert', docError.message);
    documentInserted = true;

    const { error: chunkError } = await supabase
      .from('chunks')
      .insert(sampleChunkRows(data, documentId, kbId));
    if (chunkError) return undo('the chunk insert', chunkError.message);

    return NextResponse.json({ success: true, subjectId: kbId, created: true });
  } catch (e) {
    console.error('Sample: unexpected failure:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ success: false, code: SAMPLE_FAILED }, { status: 500 });
  }
}
