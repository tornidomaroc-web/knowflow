import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDocumentLimit } from '@/lib/limits-server';

interface IngestionChunk {
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[];
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kbId = formData.get('kb_id') as string;

    if (!file || !kbId) {
      return NextResponse.json({ success: false, error: 'Missing file or kb_id' }, { status: 400 });
    }

    if (file.size > 52428800) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 413 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Entitlement-gated (B1): Pro users get PRO_LIMITS. Needs user.id, so this
    // now runs after auth — which is also correct ordering (no DB count for an
    // unauthenticated request).
    const canUpload = await checkDocumentLimit(kbId, user.id);
    if (!canUpload) {
      return NextResponse.json({ error: 'Document limit reached. Free plan allows 10 documents per knowledge base.' }, { status: 403 });
    }

    const filePath = `${user.id}/${kbId}/${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });

    if (storageError) {
      return NextResponse.json({ success: false, error: storageError.message }, { status: 500 });
    }

    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        kb_id: kbId,
        filename: file.name,
        file_type: file.name.split('.').pop() || 'unknown',
        status: 'processing',
        embedding_status: 'processing',
      })
      .select()
      .single();

    if (docError || !docRecord) {
      return NextResponse.json({ success: false, error: docError?.message }, { status: 500 });
    }

    const pythonServiceUrl = process.env.INGESTION_SERVICE_URL || 'http://localhost:8000';
    const ingestionToken = process.env.INGESTION_TOKEN;
    if (!ingestionToken) {
      console.error('INGESTION_TOKEN env var is not set');
      await supabase.from('documents').update({ status: 'error', embedding_status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    const pyFormData = new FormData();
    pyFormData.append('file', file);

    const pyResponse = await fetch(`${pythonServiceUrl}/convert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ingestionToken}` },
      body: pyFormData,
    });

    if (!pyResponse.ok) {
      await supabase.from('documents').update({ status: 'error', embedding_status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    const result: { markdown?: string; chunks?: IngestionChunk[] } = await pyResponse.json();
    const chunks = result.chunks ?? [];

    if (chunks.length > 0) {
      const rows = chunks.map((c) => ({
        document_id: docRecord.id,
        kb_id: kbId,
        chunk_index: c.chunk_index,
        content: c.content,
        token_count: c.token_count,
        embedding: c.embedding,
      }));

      // Insert in batches to avoid Supabase request-size limits.
      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error: chunkErr } = await supabase.from('chunks').insert(rows.slice(i, i + BATCH));
        if (chunkErr) {
          console.error('Chunk insert error:', chunkErr);
          await supabase
            .from('documents')
            .update({ status: 'error', embedding_status: 'error', error_message: chunkErr.message })
            .eq('id', docRecord.id);
          return NextResponse.json({ success: false, error: 'Failed to store chunks' }, { status: 500 });
        }
      }
    }

    // We still keep the raw markdown for debugging / re-chunking, but it's no
    // longer used at query time.
    await supabase
      .from('documents')
      .update({
        markdown_content: result.markdown ?? null,
        status: 'ready',
        embedding_status: 'ready',
        chunk_count: chunks.length,
      })
      .eq('id', docRecord.id);

    return NextResponse.json({ success: true, document_id: docRecord.id, chunk_count: chunks.length });
  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
