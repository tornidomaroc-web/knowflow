import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';

interface IngestionChunk {
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[];
}

// B5a: upload allowlist — only the formats MarkItDown handles well. Maps each
// allowed extension to the MIME type(s) we accept for it. The extension is the
// primary gate (it drives file_type and what we hand the converter); MIME is a
// secondary sanity check — clients can spoof it and browsers report it
// inconsistently, so empty / generic values are tolerated at the call site.
const ALLOWED_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain'],
};

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

    // B5a: reject anything outside the extension + MIME allowlist before any
    // storage or forwarding to the converter. ext is also reused as file_type
    // below, so it's always a normalized, known value.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const allowedMimes = ALLOWED_TYPES[ext];
    if (!allowedMimes) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}.` },
        { status: 415 }
      );
    }
    const mime = (file.type || '').toLowerCase();
    // Tolerate empty / generic MIME (browsers send these for valid files); only
    // reject a specific MIME that contradicts the extension.
    if (mime && mime !== 'application/octet-stream' && !allowedMimes.includes(mime)) {
      return NextResponse.json(
        { error: `File content type "${file.type}" does not match its .${ext} extension.` },
        { status: 415 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Entitlement-gated (B1): Pro users get PRO_LIMITS. Needs user.id, so this
    // now runs after auth — which is also correct ordering (no DB count for an
    // unauthenticated request).
    const docLimit = await checkDocumentLimit(kbId, user.id);
    if (!docLimit.allowed) {
      // Tier-correct: state the tier's actual limit and only offer the upgrade
      // path to free users (a Pro user has no higher tier to upsell).
      const tail = docLimit.tier === 'pro' ? '' : ' Upgrade to Pro for a higher limit.';
      return NextResponse.json(
        { error: `You've reached this subject's limit of ${docLimit.limit} materials.${tail}` },
        { status: 403 }
      );
    }

    // B7 cost guard: daily upload cap, in front of the expensive storage +
    // ingestion/embedding work. Placed after the per-KB document check so the
    // counter only increments for uploads that actually proceed.
    const limit = await enforceLimit(user.id, 'upload');
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    // B4 (path-traversal fix): reduce the client-supplied filename to a safe,
    // flat basename so the storage key cannot escape the user's prefix
    // (e.g. ../../evil.pdf). Storage key only; the original name is preserved
    // for display in the documents row below.
    const safeName =
      ((file.name || '').split(/[/\\]/).pop() || '') // basename: drop directories
        .replace(/[\x00-\x1f\x7f]/g, '')             // strip control chars
        .replace(/[^A-Za-z0-9._-]/g, '_')            // allowlist
        .replace(/^\.+/, '')                         // drop leading dots ("..", etc.)
      || `upload-${Date.now()}`;                     // fallback if nothing safe remains

    const filePath = `${user.id}/${kbId}/${safeName}`;
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
        file_type: ext, // B5a: validated, normalized extension (was raw split/'unknown')
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
