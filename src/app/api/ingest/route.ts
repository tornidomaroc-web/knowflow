import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceUrl } from '@/lib/ingestion';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';
import { recordStudyEvent } from '@/lib/study-events';
import { ALLOWED_FILE_TYPES, type FileType } from '@/types';

// (b1) The ingestion service's ack, and deliberately tiny. The service persists
// the chunks and writes the terminal document status itself, so nothing comes
// back here except confirmation. The endpoint this replaces returned every
// chunk with its 1024-float embedding PLUS the full markdown, and
// `await pyResponse.json()` materialized all of it in this function's memory.
// (Named without its literal path on purpose. N5 gates PR C on a `grep -rn`
// for that path over `src/` returning ZERO hits — a comment is enough to turn
// that check into a false failure someone then has to explain away, and an
// explanation that quotes the path defeats itself the same way.)
// Every field is optional because this is an unvalidated wire shape until the
// check below narrows it — a service that answers 200 with something else must
// fail loudly here, not flow into the success path.
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

    // (b1) THE POST-FORWARD ERROR WRITE, AND WHY IT IS CONDITIONAL.
    //
    // Once the request leaves for the ingestion service, THAT service owns the
    // terminal status: it writes `ready` (or `error`) itself, before it acks us.
    // So a failure on OUR side after the forward must never blind-write `error`.
    // The service may well have succeeded and had its ack lost to a timeout, a
    // socket reset, or a platform-level request cutoff — and stomping a
    // correctly-finished `ready` row would destroy a document that is fine,
    // taking its chunks out of the Ask path while the user watches the upload
    // fail. The row would be wrong AND the chunks would be orphaned.
    //
    // `.eq('status', 'processing')` makes this write a no-op in exactly that
    // case, because the service has already moved the row off `processing`. It
    // still rescues the row when the service never got far enough to write
    // anything — which is the orphan-stuck-at-`processing` class this whole
    // change exists to kill. PostgREST reports a filtered-out UPDATE as success
    // with zero rows, so "did nothing" and "worked" are the same return here,
    // and that is correct: both mean the row is in the state it should be in.
    //
    // PRE-forward failures below KEEP their unconditional writes, and the
    // asymmetry is deliberate rather than an oversight: before the forward,
    // nothing else can have touched the row — this route inserted it moments
    // ago and no other writer exists — so there is no correct state to protect
    // and an unconditional write is the honest one.
    const failIfStillProcessing = async (message: string) => {
      const { error: guardErr } = await supabase
        .from('documents')
        .update({ status: 'error', embedding_status: 'error', error_message: message })
        .eq('id', docRecord.id)
        .eq('status', 'processing');
      // Register #54 again: a failure to record a failure is the exact silence
      // this repo spent nine days inside. It cannot change the response, but it
      // must not be swallowed.
      if (guardErr) console.error('Post-forward error write failed:', guardErr.message);
    };

    // Shared with embedQuery's client so the two callers of this service cannot
    // disagree about where it lives, and so the production guard applies to
    // uploads as well as to Ask.
    const pythonServiceUrl = getServiceUrl();
    const ingestionToken = process.env.INGESTION_TOKEN;
    if (!ingestionToken) {
      console.error('INGESTION_TOKEN env var is not set');
      await supabase.from('documents').update({ status: 'error', embedding_status: 'error' }).eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    // (b1) The ingestion service writes to Supabase AS THIS USER, so it needs the
    // user's own access token. It is deliberately NOT given a service-role key:
    // that service was publicly duplicable once already (register #45), and an
    // RLS-bypassing credential sitting in it turns any exposure into a
    // full-database breach. Sending the user's token instead means RLS decides
    // what the service may touch, exactly as it decides for this route.
    //
    // `getUser()` above already verified this session against the auth server —
    // that is the check that matters and it has happened. This only lifts the
    // token that verification was performed on; it is not a second, weaker auth
    // check standing in for the first.
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      // Pre-forward: unconditional write, per the note above.
      console.error('Authenticated session carries no access token');
      await supabase
        .from('documents')
        .update({ status: 'error', embedding_status: 'error', error_message: 'no access token on an authenticated session' })
        .eq('id', docRecord.id);
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    // `document_id` and `kb_id` travel in the form body so the service knows
    // which row it is completing. The user token travels in its OWN header,
    // because `Authorization` is already carrying INGESTION_TOKEN — two
    // credentials doing two different jobs (service-to-service identity vs. the
    // end user's database authority), and neither is put in the form body.
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
      // THE ORPHAN CLASS, HANDLED AT LAST. The request died in flight and we do
      // not know whether the service finished. Previously this fell through to
      // the outer catch, which logged and returned 500 without touching the row
      // — leaving it at `processing` forever, with no reaper and no UI path out.
      // Now: if the service succeeded, it has already written `ready` and the
      // guard leaves that alone; if it never got there, the guard rescues the
      // row. Either way the document stops lying about its state.
      const reason = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('Ingestion service unreachable:', reason);
      await failIfStillProcessing(`ingestion service unreachable: ${reason.slice(0, 500)}`);
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    if (!pyResponse.ok) {
      // DO NOT LOSE THE UPSTREAM CAUSE. This branch previously flipped the row
      // to `error` with a NULL error_message and logged nothing whatsoever, so
      // a 401 from a desynchronized INGESTION_TOKEN, a 503 from an unset one,
      // a 500 from the converter and a 404 from a version-skewed endpoint were
      // all indistinguishable — from the user ("Ingestion failed"), from the
      // database (status='error', error_message=null), and from the server logs
      // (silence). That is the whole reason the 2026-07-23 credential outage ran
      // for nine days: nothing anywhere recorded a status code. Register #54.
      //
      // The body is read only on the failure path, so the success path is
      // untouched, and .catch() keeps a body-read failure from masking the
      // status we came here to record. Truncated because this string is written
      // to the database.
      //
      // (b1) THE CAPTURE SURVIVES THE MOVE — it is now the argument to the
      // guarded write rather than an unconditional update. That is not a
      // weakening, and the case split is worth stating because it is the whole
      // reason this is safe: when the service failed AFTER it could reach the
      // database, it has already written `error` with its OWN, more specific
      // message (`_mark_error`), so the guard correctly declines to overwrite a
      // better diagnosis with a worse one. When the service could NOT write —
      // a 401 at its auth gate before it builds a client, a 404 from version
      // skew, a 503, a crash — the row is still `processing` and this string
      // lands exactly as it did before. Either way the status code reaches the
      // database, and it reaches the logs unconditionally on the line above.
      const detail = await pyResponse.text().catch(() => '');
      const upstream = `ingestion service returned ${pyResponse.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`;
      console.error('Ingestion service error:', upstream);
      // error_message is written by this route and rendered nowhere under src/
      // (verified), so recording the upstream status here does not put internal
      // detail in front of a user. The user-facing body below is deliberately
      // unchanged.
      await failIfStillProcessing(upstream);
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    // Small ack only: {document_id, chunk_count, status}. No chunks, no
    // embeddings, no markdown — none of it crosses the network or is
    // materialized here any more. The chunk rows, the markdown and the `ready`
    // transition were all written by the service, under this user's RLS, before
    // this response was sent.
    //
    // A 200 is NOT taken as success on its own. A version-skewed or misbehaving
    // service that answers 200 with a body we do not recognise must not be
    // allowed to flow into the emit and the success response — that is how a
    // document gets reported ready to a user while nothing was persisted.
    const ack: IngestionAck = await pyResponse.json().catch(() => ({} as IngestionAck));
    if (ack.status !== 'ready' || typeof ack.chunk_count !== 'number') {
      const shape = JSON.stringify(ack).slice(0, 500);
      console.error('Unexpected ingestion ack:', shape);
      await failIfStillProcessing(`ingestion returned an unexpected ack: ${shape}`);
      return NextResponse.json({ success: false, error: 'Ingestion failed' }, { status: 500 });
    }

    // P5.2 study event. The emit is still gated on a CONFIRMED success — but the
    // confirmation is now the service's ack rather than a `ready` write made
    // here. Reaching this line means the service reported `status: 'ready'`, and
    // it only reports that after BOTH its chunk inserts and its `documents`
    // update landed (it verifies the update matched a row, because an
    // RLS-filtered UPDATE returns 200 with zero rows rather than an error). The
    // old guarantee — "the row is `ready` unless we verified otherwise and
    // bailed" — is unchanged in substance; what changed is which process did the
    // verifying. (A future move to background processing would still break it,
    // and the emit would have to follow the work rather than the request.)
    //
    // Past the 400, the 413, both 415s, the 401, the per-KB 403, the rate-limit
    // denial, the storage 500, the insert 500, the token-misconfig 500, the
    // no-access-token 500, the unreachable-service 500, the non-2xx 500, and the
    // bad-ack 500. Fails open; never throws.
    await recordStudyEvent(supabase, 'material_uploaded');

    return NextResponse.json({ success: true, document_id: docRecord.id, chunk_count: ack.chunk_count });
  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
