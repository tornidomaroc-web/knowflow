/**
 * THE ONE PATH A MATERIAL'S FILE TAKES INTO KNOWFLOW, AFTER ITS ROUTE'S GATES.
 *
 * Two routes create a material from a file: /api/ingest (a file the student
 * picked) and /api/page-read (the .md file made from photographed pages). Each
 * runs its own gates first, in the order every paid route keeps (session,
 * consent, the subject's material cap, the AI allowance, the day's upload
 * counter), then hands the file to `ingestMaterial`, which does everything
 * after that exactly once for both: the stored file, the documents row, the
 * ingestion service (conversion under the #330 bounds, the #326 content caps,
 * chunks, embeddings, page labels), the Voyage spend and the study event.
 * Moved here unchanged from src/app/api/ingest/route.ts so the two routes
 * cannot drift apart.
 *
 * `todaysKeptUploads` is the day's-uploads reader both routes give
 * `enforceUploadLimit`, for the same reason.
 */
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { createClient } from '@/lib/supabase/server';
import { getServiceUrl } from '@/lib/ingestion';
import { keptUploadsToday, utcDayStart } from '@/lib/upload-allowance';
import { sampleDocuments } from '@/lib/sample-file-server';
import { markSampleRows } from '@/lib/sample-file';
import type { Locale } from '@/lib/i18n';
import { uploadRefusalMessage } from '@/lib/limit-messages';
import { isContentCapRefusal } from '@/lib/ingest-content-caps';
import { recordStudyEvent } from '@/lib/study-events';
import { reportedTokens, uploadEmbedSpend, voyageUsd } from '@/lib/ai-allowance';
import { recordAiSpend } from '@/lib/ai-allowance-server';
import { documentStorageKey } from '@/lib/storage-key';
import type { FileType } from '@/types';

/** The student's session client, as both routes create it (`@/lib/supabase/server`). */
export type SessionClient = Awaited<ReturnType<typeof createClient>>;

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
  // Option C: a PDF's pages and how many have no text; null for any other file.
  pages_total?: number | null;
  pages_no_text?: number | null;
  // The AI allowance: what Voyage AI counted for this file, or null.
  voyage_tokens?: unknown;
}

/** A page count from the ack: a whole number of 0 or more, or null. */
function pageCount(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * #111: which 500 sentence is true depends on whether the file was forwarded
 * to the ingestion service. Before that, no material was saved; after it, the
 * service owns the outcome and the route may not know it. The route keeps this
 * object outside its `try`, so its catch-all can read it after a throw from in
 * here.
 */
export interface IngestTrace {
  forwarded: boolean;
}

/**
 * B7 / activation 5 (cause #10): the day's uploads are today's documents that
 * did not fail, so a processing failure gives its place back; the atomic
 * counter still takes every attempt and holds them to the day's uploads plus
 * FAILED_UPLOAD_ALLOWANCE (src/lib/upload-allowance.ts). The read is
 * RLS-scoped: `documents` rows are the caller's own through their subjects.
 * Null when it cannot read: the attempt counter then decides alone.
 */
export async function todaysKeptUploads(supabase: SessionClient): Promise<number | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, status, created_at')
    .gte('created_at', utcDayStart().toISOString());
  if (error || !data) {
    console.error('Today\'s uploads not read; the attempt counter decides alone:', error?.message);
    return null;
  }
  // The sample file (/api/sample) is not one of the day's uploads. Its
  // ids come from a separate, tolerant read (sample-file-server.ts).
  const sampleIds = new Set((await sampleDocuments(supabase)).map((d) => d.id));
  return keptUploadsToday(markSampleRows(data, sampleIds));
}

/**
 * Store `file`, create its documents row and have the ingestion service turn
 * it into a ready material. Call it only after the route's gates have passed.
 * Answers the route's JSON response; it may throw, and the route's catch-all
 * then answers with `trace.forwarded` deciding the sentence.
 */
export async function ingestMaterial(input: {
  supabase: SessionClient;
  user: User;
  kbId: string;
  file: File;
  /** The validated, normalized extension: the row's file_type. */
  fileType: FileType;
  safeLocale: Locale;
  trace: IngestTrace;
  /**
   * Ends the wait for the ingestion service early, so the caller can answer
   * before its function's time runs out (/api/page-read gives what is left of
   * its maxDuration; /api/ingest gives none and waits as it always has). An
   * abort takes the unreachable-service path: the guarded error write, then
   * `unconfirmed`. The service still finishes the material and writes its
   * final status itself.
   */
  signal?: AbortSignal;
}): Promise<Response> {
  const { supabase, user, kbId, file, safeLocale, trace } = input;
  const ext = input.fileType;

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
      // Postgres text cannot hold U+0000 (22P05), and a client can send one in the
      // name; it is removed here and nothing else is changed (#295 follow-up).
      filename: file.name.replaceAll('\u0000', ''),
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
  trace.forwarded = true;
  try {
    pyResponse = await fetch(`${pythonServiceUrl}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ingestionToken}`,
        'X-Supabase-Token': accessToken,
      },
      body: pyFormData,
      signal: input.signal,
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
    // fix/ai-cost-caps: the service refused the file for its content (too
    // much text, or an archive that unpacks too far) and has marked it
    // `error`, before Voyage (src/lib/ingest-content-caps.ts). The outcome
    // is known, so the student is told it, not `unconfirmed`. Like any
    // failed upload it is not one of the day's (`keptUploadsToday`).
    if (isContentCapRefusal(pyResponse.status, detail)) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'too-much-text') },
        { status: 422 }
      );
    }
    // The AI allowance: any other failure after the embedding (a failed write) was
    // still paid, and the service sends Voyage's count with its 500. Only a
    // reported count is recorded here: an unknown failure is not estimated.
    try {
      const failedTokens = reportedTokens((JSON.parse(detail) as { voyage_tokens?: unknown }).voyage_tokens);
      if (failedTokens) await recordAiSpend(user.id, 'upload_embed', voyageUsd(failedTokens));
    } catch {
      // Not JSON: nothing reported, nothing to record.
    }
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
  // The AI allowance: Voyage's own count for this file, or the stated
  // conservative estimate when this service does not report one. Before the
  // ack check, because the embedding was paid either way.
  if (typeof ack.chunk_count === 'number') {
    const spend = uploadEmbedSpend(ack.voyage_tokens, ack.chunk_count, file.size);
    await recordAiSpend(user.id, 'upload_embed', spend.usd, spend.estimated);
  }
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

  // The page counts pass through as numbers or null. A service from before
  // they existed sends neither, and the upload result is then what it was.
  return NextResponse.json({
    success: true,
    document_id: docRecord.id,
    chunk_count: ack.chunk_count,
    pages_total: pageCount(ack.pages_total),
    pages_no_text: pageCount(ack.pages_no_text),
  });
}
