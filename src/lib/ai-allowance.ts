/**
 * THE AI ALLOWANCE: A USD CEILING ON WHAT ONE ACCOUNT CAN SPEND AT ANTHROPIC
 * AND VOYAGE AI IN ANY 30 DAYS.
 *
 * The daily caps (src/lib/rate-limit.ts, DAILY_CAPS) count calls. A call's
 * price is not fixed: a summary of a long material, or the embedding of a
 * 4 MiB text file, costs many times the typical one, so the daily caps alone
 * bound a month only at the worst case (Free 53.81 USD per 30 days, Pro over
 * the 9.99 USD price, docs in the PR). This module adds the bound that is in
 * dollars: before every paid call the account's spend in the window is read
 * from the `ai_spend` ledger (supabase/migrations/20261115_ai_spend.sql), and
 * at or over the ceiling the call is refused and the provider is not called.
 * After a call that the provider billed, its real price is written to the
 * ledger by the server (src/lib/ai-allowance-server.ts), never by the client.
 *
 * Pure: no I/O here, so the rules are checked by
 * scripts/verify-ai-allowance.mjs without a database.
 */
import type { Tier } from '@/types';
import type { Locale } from '@/lib/i18n';
import { useTranslation as dictionaryFor } from '@/lib/i18n';
import { usageUsd, type UsageTokens } from '@/lib/usage-cost';

/**
 * THE CEILINGS, IN USD PER ROLLING 30 DAYS. ONE PLACE, DECIDED AT REVIEW.
 *
 * Pro 5.00: the 9.99 USD price nets about 7.41 (Morocco) to 8.52 (UAE) per
 * subscriber after Paddle and sales tax. A Pro month at every daily limit is
 * about 8.73 of model spend plus 0.78 of uploads at the #94 document's size
 * (rate-limit.ts), so the daily caps alone let one subscriber cost more than
 * they pay. 5.00 is 67% of the lowest net and leaves 2.41 for hosting,
 * refunds and exchange rates; it still holds all 25 questions a day for 30
 * days (4.22) with room for summaries and quizzes.
 *
 * Free 1.00: Free pays nothing. At every daily limit a Free account costs
 * 6.40 per 30 days typically and 53.81 at worst; 1.00 is about 180 typical
 * questions, far more than a student trying the app uses, and caps the
 * worst case of one account at 1.00 plus the one call in flight.
 */
export const AI_ALLOWANCE_USD: Record<Tier, number> = {
  free: 1.0,
  pro: 5.0,
};

/** The window: the 30 days before now, rolling (not the calendar month). */
export const AI_ALLOWANCE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function allowanceWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - AI_ALLOWANCE_WINDOW_DAYS * DAY_MS);
}

/**
 * The stable refusal code. JSON routes send it as `code`, `/api/agent` (a
 * text/plain stream) as the `X-KF-Refusal` header, beside status 429.
 */
export const AI_ALLOWANCE_REFUSAL = 'ai-allowance-used';

/** The paid calls, one ledger row each. The SQL check holds the same list. */
export const AI_SPEND_KINDS = ['answer', 'summary', 'quiz', 'query_embed', 'upload_embed'] as const;
export type AiSpendKind = (typeof AI_SPEND_KINDS)[number];

/**
 * What one row may carry. Never negative, never NaN or infinite, and never
 * more than one call can cost (the SQL check is the same bound): the most
 * expensive call is a 4 MiB file embedded at one token per byte, 0.76 USD.
 */
export const MAX_USD_PER_CALL = 10;
export function isRecordableUsd(usd: unknown): usd is number {
  return typeof usd === 'number' && Number.isFinite(usd) && usd >= 0 && usd <= MAX_USD_PER_CALL;
}

/**
 * The decision. `spent` is null when the ledger could not be read: the call is
 * then refused as unavailable (fail closed, like `enforceLimit`), because a
 * ceiling that cannot be read is not a ceiling.
 */
// One shape, not a union: the project compiles with strict:false, where a
// boolean discriminant does not narrow (the note on LimitResult, rate-limit.ts).
export interface AllowanceVerdict {
  allowed: boolean;
  reason?: 'used' | 'unread';
}
export function allowanceVerdict(spent: number | null, tier: Tier): AllowanceVerdict {
  if (spent === null || !Number.isFinite(spent)) return { allowed: false, reason: 'unread' };
  return spent >= AI_ALLOWANCE_USD[tier] ? { allowed: false, reason: 'used' } : { allowed: true };
}

/** The refusal sentence (DRAFT until approved: docs/copy-drafts/ai_monthly_allowance.md). */
export function aiAllowanceRefusalMessage(locale: Locale): string {
  return dictionaryFor(locale).dashboard.aiAllowance.used;
}

// --- prices -------------------------------------------------------------------

/** Claude Haiku 4.5, from the response's `usage` (src/lib/usage-cost.ts). */
export function anthropicUsd(t: UsageTokens): number {
  return usageUsd(t);
}

/**
 * voyage-3-large: 0.18 USD per million tokens (the rate services/ingestion/
 * main.py states at MAX_CONVERTED_CHARS). Like the Haiku rates, re-read
 * before quoting it anywhere money is decided.
 */
export const VOYAGE_USD_PER_TOKEN = 0.18 / 1_000_000;

export function voyageUsd(tokens: number): number {
  return Number((tokens * VOYAGE_USD_PER_TOKEN).toFixed(6));
}

/**
 * Voyage's own count, when the ingestion service reports it (`voyage_tokens`
 * on /embed and /ingest, read from Voyage's `usage.total_tokens`), else a
 * CONSERVATIVE estimate, flagged `estimated: true` on the row:
 *   - a question: one token per character (an assumption, not measured:
 *     subword tokenizers usually give several characters one token). A
 *     question is at most 4,000 characters, 0.00072 USD.
 *   - an upload: one token per byte of the file, capped at the 4 MiB upload
 *     limit; 0 when the service made no chunks (nothing was sent to Voyage).
 *     For text files bytes are at least characters; the one production
 *     measurement (a 4 MiB .txt, about a million Voyage tokens) is a quarter
 *     of this. It over-charges a PDF that is mostly images.
 * The estimate is the fallback for a service deployed before this change.
 */
export const MAX_ESTIMATED_UPLOAD_TOKENS = 4 * 1024 * 1024;

export function reportedTokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function queryEmbedSpend(reported: unknown, question: string): { usd: number; estimated: boolean } {
  const tokens = reportedTokens(reported);
  if (tokens !== null) return { usd: voyageUsd(tokens), estimated: false };
  return { usd: voyageUsd([...question].length), estimated: true };
}

export function uploadEmbedSpend(
  reported: unknown,
  chunkCount: number,
  fileBytes: number
): { usd: number; estimated: boolean } {
  const tokens = reportedTokens(reported);
  if (tokens !== null) return { usd: voyageUsd(tokens), estimated: false };
  if (chunkCount === 0) return { usd: 0, estimated: false };
  return { usd: voyageUsd(Math.min(Math.max(fileBytes, 0), MAX_ESTIMATED_UPLOAD_TOKENS)), estimated: true };
}
