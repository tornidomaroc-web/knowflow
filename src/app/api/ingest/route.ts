import { after, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceUploadLimit } from '@/lib/rate-limit';
import { defaultLocale, resolveLocale, type Locale } from '@/lib/i18n';
import { platformFromRequest } from '@/lib/platform';
import { AI_CONSENT_REFUSAL, aiConsentRefusalMessage, hasAiConsent } from '@/lib/ai-consent';
import { fileTooLargeMessage, subjectMaterialsMessage, uploadRefusalMessage } from '@/lib/limit-messages';
import { isOverUploadLimit } from '@/lib/upload-limits';
import { checkAiAllowance } from '@/lib/ai-allowance-server';
import { ingestMaterial, todaysKeptUploads, type IngestTrace } from '@/lib/ingest-material';
import { sweepStalePagePhotos } from '@/lib/page-photo-sweep';
import { fileExtension, isAllowedFileType, type FileType } from '@/types';

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
  // the `try` so the catch-all can read them (`trace.forwarded` is set by
  // `ingestMaterial`, src/lib/ingest-material.ts, as the file leaves).
  const trace: IngestTrace = { forwarded: false };
  let safeLocale: Locale = defaultLocale;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kbId = formData.get('kb_id') as string;
    // Whitelisted server-side, as /api/summarize does (register #27). A multipart
    // field rather than a JSON key because this route takes formData.
    safeLocale = resolveLocale(formData.get('locale'));

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

    // A camera batch this student abandoned (src/lib/page-photo-sweep.ts) is
    // removed after the answer, so a student who gave up on the camera and
    // uploads a file instead is cleaned too. It cannot change this answer.
    after(() => sweepStalePagePhotos(user.id, null));

    // Apple 5.1.2(i) (src/lib/ai-consent.ts): no permission, no upload. Before
    // the document count, the usage counter and the storage upload, so a
    // refused file is not stored, not counted and never reaches the ingestion
    // service or Voyage AI.
    if (!hasAiConsent(user)) {
      return NextResponse.json(
        { success: false, error: aiConsentRefusalMessage(safeLocale), code: AI_CONSENT_REFUSAL },
        { status: 403 }
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
        { error: subjectMaterialsMessage(safeLocale, docLimit.limit, docLimit.tier, platformFromRequest(request)) },
        { status: 403 }
      );
    }

    // The AI allowance (src/lib/ai-allowance.ts): before the day's upload
    // counter and the storage upload, so a refused file is not counted, not
    // stored, never reaches Voyage AI and is not recorded.
    const allowance = await checkAiAllowance(user.id, safeLocale);
    if (!allowance.allowed) {
      return NextResponse.json(
        { success: false, error: allowance.error, code: allowance.code },
        { status: allowance.status }
      );
    }

    // B7 cost guard: daily upload cap, in front of the expensive storage +
    // ingestion/embedding work. Placed after the per-KB document check so the
    // counter only increments for uploads that actually proceed.
    //
    // Activation 5 (cause #10): the day's uploads are today's documents that
    // did not fail, so a processing failure gives its place back; the atomic
    // counter still takes every attempt and holds them to the day's uploads
    // plus FAILED_UPLOAD_ALLOWANCE (src/lib/upload-allowance.ts). The read
    // (todaysKeptUploads, src/lib/ingest-material.ts, shared with
    // /api/page-read) is RLS-scoped: `documents` rows are the caller's own
    // through their subjects.
    const limit = await enforceUploadLimit(user.id, safeLocale, platformFromRequest(request), () => todaysKeptUploads(supabase));
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    // Everything after the gates (the stored file, the documents row, the
    // ingestion service, the Voyage spend, the study event) is the one path
    // every material takes, shared with /api/page-read.
    return await ingestMaterial({ supabase, user, kbId, file, fileType: ext, safeLocale, trace });
  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json(
      { success: false, error: uploadRefusalMessage(safeLocale, trace.forwarded ? 'unconfirmed' : 'nothing-saved') },
      { status: 500 }
    );
  }
}
