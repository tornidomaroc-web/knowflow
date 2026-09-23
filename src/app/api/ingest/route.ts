import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceUrl } from '@/lib/ingestion';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceLimit } from '@/lib/rate-limit';
import type { Locale } from '@/lib/i18n';
import { fileTooLargeMessage, subjectMaterialsMessage, uploadRefusalMessage } from '@/lib/limit-messages';
import { isOverUploadLimit } from '@/lib/upload-limits';
import { recordStudyEvent } from '@/lib/study-events';
import { documentStorageKey } from '@/lib/storage-key';
import { fileExtension, isAllowedFileType, type FileType } from '@/types';

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
// `.includes`) lets us compare against a widened `string` with no cast. Shared
// with the drop zone since #111 (`@/types`), so both refuse by one rule.

export async function POST(request: Request) {
  // #111: which 500 sentence is true depends on whether the file was forwarded
  // to the ingestion service. Before that, no material was saved; after it, the
  // service owns the outcome and this route may not know it. Both live outside
  // the `try` so the catch-all can read them.
  let forwarded = false;
  let safeLocale: Locale = 'en';
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kbId = formData.get('kb_id') as string;
    // Whitelisted server-side, as /api/summarize does (register #27). A multipart
    // field rather than a JSON key because this route takes formData.
    safeLocale = formData.get('locale') === 'ar' ? 'ar' : 'en';

    if (!file || !kbId) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'request') },
        { status: 400 }
      );
    }

    // #50: the same limit the browser checks and the drop zone states, from one
    // place (`@/lib/upload-limits`). Past about 4,490,000 bytes the platform
    // refuses the request itself, before this line runs, so this answers the
    // files in between (an old browser bundle during a deploy, a script), in the
    // student's language, before any database or storage call.
    if (isOverUploadLimit(file.size)) {
      return NextResponse.json(
        { success: false, error: fileTooLargeMessage(safeLocale, file.size) },
        { status: 413 }
      );
    }

    // B5a: reject anything outside the extension + MIME allowlist before any
    // storage or forwarding to the converter. ext is also reused as file_type
    // below, so it's always a normalized, known value.
    const ext = fileExtension(file.name);
    if (!isAllowedFileType(ext)) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'type', ext) },
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
        { success: false, error: uploadRefusalMessage(safeLocale, 'mime', ext) },
        { status: 415 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'session') },
        { status: 401 }
      );
    }

    // Entitlement-gated (B1): Pro users get PRO_LIMITS. Needs user.id, so this
    // now runs after auth — which is also correct ordering (no DB count for an
    // unauthenticated request).
    const docLimit = await checkDocumentLimit(kbId, user.id);
    if (!docLimit.allowed) {
      // Tier-correct: states the tier's actual per-subject cap (publishable in
      // both tiers) and offers the upgrade line to free users only.
      return NextResponse.json(
        { error: subjectMaterialsMessage(safeLocale, docLimit.limit, docLimit.tier) },
        { status: 403 }
      );
    }

    // B7 cost guard: daily upload cap, in front of the expensive storage +
    // ingestion/embedding work. Placed after the per-KB document check so the
    // counter only increments for uploads that actually proceed.
    const limit = await enforceLimit(user.id, 'upload', safeLocale);
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    // #110: ONE STORED FILE PER DOCUMENT. The id is minted here rather than by
    // the database default, because the file is uploaded BEFORE the row exists
    // and its key has to contain the id: {userId}/{kbId}/{documentId}/{name}.
    // The old key, {userId}/{kbId}/{name}, let two Arabic filenames of the same
    // shape share one file, and `upsert: true` then overwrote the first. Now the
    // folder makes every key unique, `upsert: false` refuses to overwrite even if
    // one somehow were not, and the key is stored on the row
    // (`documents.storage_path`) so nothing has to recompute it. The name part is
    // still B4's path-traversal fix (`@/lib/storage-key`).
    const documentId = crypto.randomUUID();
    const filePath = documentStorageKey(user.id, kbId, documentId, file.name);
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: false });

    if (storageError) {
      // #111: the storage error text is logged, not shown; a student cannot act
      // on it, and it can name internals.
      console.error('Storage upload failed:', storageError.message);
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'nothing-saved') },
        { status: 500 }
      );
    }

    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        kb_id: kbId,
        filename: file.name,
        file_type: ext, // B5a: validated, normalized extension (was raw split/'unknown')
        status: 'processing',
        embedding_status: 'processing',
        storage_path: filePath,
      })
      .select()
      .single();

    if (docError || !docRecord) {
      // #111: same as above. (The stored file has no row at this point and this
      // route does not remove it; register #111 records that as a known gap.)
      console.error('Document insert failed:', docError?.message);
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'nothing-saved') },
        { status: 500 }
      );
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
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'nothing-saved') },
        { status: 500 }
      );
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
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'nothing-saved') },
        { status: 500 }
      );
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
    forwarded = true;
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
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'unconfirmed') },
        { status: 500 }
      );
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
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'unconfirmed') },
        { status: 500 }
      );
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
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'unconfirmed') },
        { status: 500 }
      );
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
    return NextResponse.json(
      { success: false, error: uploadRefusalMessage(safeLocale, forwarded ? 'unconfirmed' : 'nothing-saved') },
      { status: 500 }
    );
  }
}
