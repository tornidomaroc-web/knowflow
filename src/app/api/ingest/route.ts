import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';
import { recordStudyEvent } from '@/lib/study-events';
import { ALLOWED_FILE_TYPES, type FileType } from '@/types';

// (b1) The ingestion service's ack. Deliberately tiny: it persists the chunks and
// writes the terminal document status itself, so nothing comes back here except
// confirmation. The old contract returned every chunk with its 1024-float
// embedding plus the full markdown, and `await pyResponse.json()` materialized
// all of it in this function's memory.
interface IngestionAck {
  document_id?: string;
  chunk_count?: number;
  status?: string;
}

// B5a: upload allowlist — only the formats MarkItDown handles well. Maps each
// allowed extension to the MIME type(s) we accept for it. The extension is the
// primary gate (it drives file_type and what we hand the converter); MIME is a
// secondary sanity check — clients can spoof it and browsers report it
// inconsistently, so empty / generic values are tolerated at the call site.
//
// Keyed by `FileType` (the shared ALLOWED_FILE_TYPES source of truth), so this
// MIME map and the `Document.file_type` domain cannot drift: a key here that
// isn't in ALLOWED_FILE_TYPES — or an allowed type missing its MIME row — is a
// compile error, not a silent 415/type-lie.
const ALLOWED_TYPES: Record<FileType, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain'],
};

// Type guard against the SoT array, so the runtime membership test and the
// compile-time FileType domain are literally the same list. `.some` (not
// `.includes`) lets us compare against a widened `string` with no cast.
function isAllowedFileType(ext: string): ext is FileType {
  return ALLOWED_FILE_TYPES.some((t) => t === ext);
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

    // B5a: reject anything outside the extension + MIME allowlist before any
    // storage or forwarding to the converter. ext is also reused as file_type
    // below, so it's always a normalized, known value.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!isAllowedFileType(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}.` },
        { status: 415 }
      );
    }
    // `ext` is now narrowed to `FileType`, so this index is total (no undefined)
    // and `file_type: ext` below writes a value guaranteed to be in the union.
    const allowedMimes = ALLOWED_TYPES[ext];
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

    // (b1) Once the request leaves for the ingestion service, THAT service owns
    // the terminal status — it writes `ready` before it acks us. So a failure on
    // OUR side after the forward must never blind-write `error`: the service may
    // well have succeeded and had its ack lost to a timeout, and stomping a
    // correctly-finished `ready` row would destroy a document that is actually
    // fine. The `.eq('status', 'processing')` guard makes this write a no-op in
    // exactly that case, and still rescues the row when the service never got
    // far enough to set anything. Pre-forward failures below keep their
    // unconditional writes — nothing else can have touched the row yet.
    const failIfStillProcessing = async (message: string) => {
      const { error: guardErr } = await supabase
        .from('documents')
        .update({ status: 'error', embedding_status: 'error', error_message: message })
        .eq('id', docRecord.id)
        .eq('status', 'processing');
      if (guardErr) console.error('Post-forward error write failed:', guardErr);
    };

    const pythonServiceUrl = process.env.INGESTION_SERVICE_URL || 'http://localhost:8000';
    const ingestionToken = process.env.INGESTION_TOKEN;
    if (!ingestionToken) {
      console.error('INGESTION_TOKEN env var is not set');
      await supabase.from('documents').update({ status: 'error', embedding_status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    // (b1) The ingestion service writes to Supabase AS THIS USER, so it needs the
    // user's own access token. It is NOT given a service-role key — see the note
    // in services/ingestion/main.py and register #45: that service was publicly
    // duplicable, so an RLS-bypassing credential there is a full-database breach.
    // `getUser()` above already verified the session against the auth server;
    // this only lifts the token that verification was performed on.
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      console.error('No access token on an authenticated session');
      await supabase.from('documents').update({ status: 'error', embedding_status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    // document_id + kb_id travel with the file so the service knows which row to
    // write; the user token travels in its own header (Authorization is already
    // carrying the service-to-service token) and is never put in the form body.
    const pyFormData = new FormData();
    pyFormData.append('file', file);
    pyFormData.append('document_id', docRecord.id);
    pyFormData.append('kb_id', kbId);

    let pyResponse: Response;
    try {
      pyResponse = await fetch(`${pythonServiceUrl}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ingestionToken}`,
          'X-Supabase-Token': accessToken,
        },
        body: pyFormData,
      });
    } catch (fetchErr) {
      // The orphan class this whole change exists to kill: the request died in
      // flight (timeout, socket reset) and we have no idea whether the service
      // finished. Previously this fell to the outer catch and left the row at
      // `processing` forever. Now the service has already written `ready` if it
      // succeeded, and the guard below only touches the row if it did not.
      console.error('Ingestion service unreachable:', fetchErr);
      await failIfStillProcessing('Ingestion service unreachable');
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    if (!pyResponse.ok) {
      // The service sets its own `error` status on its own failures; this is the
      // fallback for the cases where it could not (misconfig, 401, crash).
      await failIfStillProcessing('Ingestion failed');
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    // Small ack only: {document_id, chunk_count, status}. No chunks, no
    // embeddings, no markdown — none of it is materialized here any more.
    const ack: IngestionAck = await pyResponse.json();
    if (ack.status !== 'ready' || typeof ack.chunk_count !== 'number') {
      console.error('Unexpected ingestion ack:', ack);
      await failIfStillProcessing('Ingestion returned an unexpected result');
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    // P5.2 study event. The emit stays gated on a CONFIRMED success, which is now
    // the service's ack rather than a ready-write made here: reaching this line
    // means the service reported `status: 'ready'`, and it only reports that
    // after its chunk inserts AND its `documents` update both landed (it verifies
    // the update matched a row, since an RLS-filtered UPDATE returns 200/0 rows).
    // Every failure path above returns non-2xx before this point.
    //
    // Past the 400, the 413, both 415s, the 401, the per-KB 403, the rate-limit
    // denial, the storage 500, the insert 500, the misconfig 500, the missing-token
    // 500, the unreachable-service 500, the non-2xx ack 500, and the bad-ack 500.
    // Fails open; never throws.
    await recordStudyEvent(supabase, 'material_uploaded');

    return NextResponse.json({ success: true, document_id: docRecord.id, chunk_count: ack.chunk_count });
  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
