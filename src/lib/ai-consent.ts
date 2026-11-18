// Aliased: a plain lookup, not a hook, called from route handlers.
import { useTranslation as dictionaryFor, type Locale } from '@/lib/i18n';

/**
 * THE STUDENT'S PERMISSION BEFORE CONTENT GOES TO THIRD-PARTY AI (Apple
 * guideline 5.1.2(i): "You must clearly disclose where personal data will be
 * shared with third parties, including with third-party AI, and obtain
 * explicit permission before doing so"; docs/store/STORE_PATH.md S4).
 *
 * Five routes send a student's content to Anthropic or Voyage AI: /api/ingest
 * (the file's text, through the ingestion service, to Voyage AI), /api/agent
 * (the question to both), /api/summarize and /api/quiz/generate (the
 * material's text to Anthropic), and /api/page-read (photos of the student's
 * pages to Anthropic, then their text to Voyage AI like any upload; the
 * consent copy names text only, so it must name photos before a screen sends
 * any, see docs/copy-drafts/page_reader.md). Each one refuses with 403 and
 * `code: AI_CONSENT_REFUSAL` until the account carries the permission, and the
 * refusal comes BEFORE the usage counter, the storage upload and any call out,
 * so a refused request costs nothing and sends nothing. A summary or quiz that
 * already exists is served from the database before the check, because
 * re-reading it sends nothing anywhere.
 *
 * WHERE THE PERMISSION LIVES: `user_metadata.ai_consent` on the Supabase auth
 * user, `{ version, at }`. No table and no migration: the student writes it
 * with their own session (`supabase.auth.updateUser`, the sheet in
 * `AiConsentProvider`), and every route already reads the user from the auth
 * server with `getUser()`, which returns the current metadata, not a cached
 * token. Withdrawing sets it to null, which Supabase removes from the
 * metadata. One rule on the web and in the app: the web has no exemption to
 * keep in step.
 *
 * `version` lets a later change of providers or of what they receive ask
 * again: raise AI_CONSENT_VERSION and every earlier permission stops counting.
 *
 * PHOTOS (the camera screen): version 2 is the same permission with one more
 * sentence on the sheet, naming photos of pages sent to Anthropic. Only
 * /api/page-read requires it (PAGE_READ_CONSENT_VERSION); every other route
 * keeps requiring 1, so no student is asked again until they first send
 * photos, and a version-2 permission counts everywhere a version-1 one does.
 */
export const AI_CONSENT_VERSION = 1;

/** The permission /api/page-read requires: the sheet that named photos. */
export const PAGE_READ_CONSENT_VERSION = 2;

/** The `code` of the 403 those routes send without the permission. */
export const AI_CONSENT_REFUSAL = 'ai_consent_required';

type MaybeUser = { user_metadata?: Record<string, unknown> | null } | null | undefined;

/** Whether the account holds the permission at `atLeast` (AI_CONSENT_VERSION unless a route asks for more). */
export function hasAiConsent(user: MaybeUser, atLeast: number = AI_CONSENT_VERSION): boolean {
  const consent = user?.user_metadata?.ai_consent;
  if (!consent || typeof consent !== 'object') return false;
  const version = (consent as { version?: unknown }).version;
  return typeof version === 'number' && version >= atLeast;
}

/**
 * What the sheet writes into `user_metadata` when the student agrees: the
 * version of the sheet they read (PAGE_READ_CONSENT_VERSION when it named photos).
 */
export function aiConsentGrant(now: Date, version: number = AI_CONSENT_VERSION): { ai_consent: { version: number; at: string } } {
  return { ai_consent: { version, at: now.toISOString() } };
}

/** What Settings writes when the student withdraws. */
export const AI_CONSENT_WITHDRAWN = { ai_consent: null } as const;

/** The refusal sentence, the same one the sheet shows after "Not now". */
export function aiConsentRefusalMessage(locale: Locale): string {
  return dictionaryFor(locale).dashboard.aiConsent.declined;
}
