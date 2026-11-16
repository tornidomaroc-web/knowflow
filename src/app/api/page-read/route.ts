import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { checkDocumentLimit } from '@/lib/limits-server';
import { enforceUploadLimit } from '@/lib/rate-limit';
import { defaultLocale, resolveLocale, type Locale } from '@/lib/i18n';
import { platformFromRequest } from '@/lib/platform';
import { AI_CONSENT_REFUSAL, aiConsentRefusalMessage, hasAiConsent } from '@/lib/ai-consent';
import { subjectMaterialsMessage, TEMPORARILY_UNAVAILABLE, uploadRefusalMessage } from '@/lib/limit-messages';
import { checkAiAllowance } from '@/lib/ai-allowance-server';
import { ingestMaterial, todaysKeptUploads, type IngestTrace } from '@/lib/ingest-material';
import { renamedFilename, renameRefused } from '@/lib/material-name';
import { isOverUploadLimit } from '@/lib/upload-limits';
import {
  checkPhotoKeys,
  PAGE_PHOTO_FOREIGN,
  PAGE_READ_ANSWER_MARGIN_MS,
  PAGE_READ_MAX_DURATION_S,
  PAGES_UNREAD,
  pageReadReserveUsd,
  pagesMarkdown,
  type PhotoOutcome,
} from '@/lib/page-reader';
import { readPagePhotos, removePagePhotos } from '@/lib/page-reader-server';

/**
 * POST /api/page-read: "photograph your pages" (صوّر صفحاتك), the server half.
 * The rules and the reasons are in src/lib/page-reader.ts; this file is the
 * order they run in.
 *
 * BODY (JSON): { kb_id, keys: string[] (1 to 10, in page order), name, locale }
 *   keys  the photos the app uploaded to `{userId}/page-photos/{batchId}/…`
 *   name  the new material's name; it is stored as `<name>.md`, under the same
 *         rules a rename follows (src/lib/material-name.ts).
 *
 * ORDER, as in every paid route: the session; the keys, all of them the
 * caller's own, before anything touches storage; the student's permission
 * (Apple 5.1.2(i)); the subject is the caller's and has room; the AI allowance
 * with every photo's worst case reserved (0.0025 USD each); the day's upload
 * counter (one batch is one upload: it becomes one material); only then the
 * photos are downloaded and read. A refusal therefore sends nothing to
 * Anthropic, records nothing in the ledger and costs no upload.
 *
 * THE PHOTOS ARE SINGLE-USE. From the moment the keys are known to be the
 * caller's, they are deleted whatever the answer (refused, failed or read);
 * reading removes them as soon as they are in memory. Keys that are not the
 * caller's are refused before anything is deleted or read.
 *
 * ANSWER: the shared ingestion's answer (src/lib/ingest-material.ts) plus
 * `photos`, one { n, read, code? } per key in order; when no photo could be
 * read, 422 with `code: 'pages-unread'` and nothing saved.
 */
export const runtime = 'nodejs';
// PAGE_READ_MAX_DURATION_S (src/lib/page-reader.ts): the reading deadline
// (120 s) plus the ingestion's share. Next.js reads this export statically, so
// it is a literal here; scripts/verify-page-reader.mjs holds the two equal.
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const startedAt = Date.now();
  // As in /api/ingest: which 500 sentence is true depends on whether the .md
  // file was forwarded to the ingestion service.
  const trace: IngestTrace = { forwarded: false };
  let safeLocale: Locale = defaultLocale;
  // The caller's own photos once their keys are checked: removed in `finally`
  // unless reading already removed them.
  let owned: string[] = [];
  let removed = false;
  let photos: PhotoOutcome[] | undefined;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const b: Record<string, unknown> = body && typeof body === 'object' ? body : {};
    safeLocale = resolveLocale(b.locale);
    const kbId = typeof b.kb_id === 'string' && UUID_RE.test(b.kb_id) ? b.kb_id : null;
    const named = renamedFilename('pages.md', typeof b.name === 'string' ? b.name : '');
    if (!kbId || !Array.isArray(b.keys) || renameRefused(named)) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'request') },
        { status: 400 }
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

    // Every key in the caller's own folder, one batch, at most 10. Nothing is
    // read or deleted for a request that names anyone else's key.
    const batch = checkPhotoKeys(user.id, b.keys);
    if (!batch.ok) {
      const foreign = batch.reason === 'foreign';
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'request'), ...(foreign ? { code: PAGE_PHOTO_FOREIGN } : {}) },
        { status: foreign ? 403 : 400 }
      );
    }
    owned = b.keys as string[];

    // Apple 5.1.2(i) (src/lib/ai-consent.ts): no permission, nothing read.
    if (!hasAiConsent(user)) {
      return NextResponse.json(
        { success: false, error: aiConsentRefusalMessage(safeLocale), code: AI_CONSENT_REFUSAL },
        { status: 403 }
      );
    }

    // The subject must be the caller's (RLS: knowledge_bases is owner-only)
    // BEFORE anything is spent; /api/ingest learns it from the insert, after
    // the upload, which here would be after the pages were paid for.
    const { data: subject, error: subjectError } = await supabase.from('knowledge_bases').select('id').eq('id', kbId).maybeSingle();
    if (subjectError) {
      // Unread is not "not yours": fail closed, as the allowance and the counter do.
      console.error('Subject not read:', subjectError.message);
      return NextResponse.json({ success: false, error: TEMPORARILY_UNAVAILABLE[safeLocale] }, { status: 503 });
    }
    if (!subject) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'request') },
        { status: 404 }
      );
    }

    const docLimit = await checkDocumentLimit(kbId, user.id);
    if (!docLimit.allowed) {
      return NextResponse.json(
        { error: subjectMaterialsMessage(safeLocale, docLimit.limit, docLimit.tier, platformFromRequest(request)) },
        { status: 403 }
      );
    }

    // The AI allowance, with every photo's worst case set aside: refused
    // unless the window's spend plus 0.0025 USD per photo stays within the
    // ceiling. Nothing has been counted, sent or recorded yet.
    const allowance = await checkAiAllowance(user.id, safeLocale, pageReadReserveUsd(owned.length));
    if (!allowance.allowed) {
      return NextResponse.json(
        { success: false, error: allowance.error, code: allowance.code },
        { status: allowance.status }
      );
    }

    // One batch is one upload: it becomes one material.
    const limit = await enforceUploadLimit(user.id, safeLocale, platformFromRequest(request), () => todaysKeptUploads(supabase));
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    const result = await readPagePhotos({
      supabase,
      anthropic,
      userId: user.id,
      folder: batch.folder as string,
      names: batch.names as string[],
      keys: owned,
    });
    removed = result.photosRemoved;
    photos = result.outcomes;

    if (result.pages.length === 0) {
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'nothing-saved'), code: PAGES_UNREAD, photos },
        { status: 422 }
      );
    }

    // ONE .md file, a heading per photo read, each page's text exactly as the
    // model wrote it, through the one path every material takes.
    const file = new File([pagesMarkdown(result.pages, safeLocale)], (named as { filename: string }).filename, { type: 'text/markdown' });
    // The ingestion service sizes its own limit (MAX_INGEST_BYTES) on every
    // file it receives being within MAX_UPLOAD_BYTES, as /api/ingest checks.
    // Ten pages of at most 4,000 tokens are far below it; held all the same.
    if (isOverUploadLimit(file.size)) {
      console.error(JSON.stringify({ tag: 'kf-page-read-too-much-text', user_id: user.id, bytes: file.size }));
      return NextResponse.json(
        { success: false, error: uploadRefusalMessage(safeLocale, 'too-much-text'), photos },
        { status: 422 }
      );
    }
    // What is left of maxDuration, less a margin to answer in: past it the
    // route stops waiting and answers `unconfirmed` (the service still
    // finishes the material) rather than leave the platform to cut it off.
    const left = PAGE_READ_MAX_DURATION_S * 1000 - PAGE_READ_ANSWER_MARGIN_MS - (Date.now() - startedAt);
    const ingested = await ingestMaterial({
      supabase,
      user,
      kbId,
      file,
      fileType: 'md',
      safeLocale,
      trace,
      signal: AbortSignal.timeout(Math.max(1000, left)),
    });
    const answer = (await ingested.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ...answer, photos }, { status: ingested.status });
  } catch (error) {
    console.error('Page read API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: uploadRefusalMessage(safeLocale, trace.forwarded ? 'unconfirmed' : 'nothing-saved'),
        ...(photos ? { photos } : {}),
      },
      { status: 500 }
    );
  } finally {
    if (owned.length > 0 && !removed) await removePagePhotos(owned);
  }
}
