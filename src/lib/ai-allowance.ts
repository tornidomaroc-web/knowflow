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

/**
 * The paid calls, one ledger row each. The SQL check holds the same list: the
 * newest migration that sets ai_spend_kind_check
 * (supabase/migrations/20261116_ai_spend_page_read.sql, which added
 * `page_read`: one row per /api/page-read call that Anthropic billed; an
 * unbilled refusal or a failed call has none, a cut-off or empty page has one).
 */
export const AI_SPEND_KINDS = ['answer', 'summary', 'quiz', 'query_embed', 'upload_embed', 'page_read'] as const;
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
/**
 * `reserveUsd` is what the request is about to spend at most, set aside
 * BEFORE anything is sent (the page reader: 0.0025 USD per photo,
 * src/lib/page-reader.ts). With a reserve the call is allowed only while the
 * spend plus the reserve stays within the ceiling; with none (every other
 * route) the rule is unchanged: at or over the ceiling is refused. Compared in
 * whole micro-dollars, the ledger's own precision (numeric(12, 6)), so no
 * floating-point remainder decides a refusal.
 */
export function allowanceVerdict(spent: number | null, tier: Tier, reserveUsd = 0): AllowanceVerdict {
  if (spent === null || !Number.isFinite(spent)) return { allowed: false, reason: 'unread' };
  const micro = (usd: number) => Math.round(usd * 1_000_000);
  const reserve = Number.isFinite(reserveUsd) && reserveUsd > 0 ? micro(reserveUsd) : 0;
  const ceiling = micro(AI_ALLOWANCE_USD[tier]);
  const used = micro(spent);
  if (used >= ceiling || used + reserve > ceiling) return { allowed: false, reason: 'used' };
  return { allowed: true };
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
 * Claude Haiku 5.5 (the page reader, src/lib/page-reader.ts), in USD per
 * MILLION tokens: 0.10 input and 0.50 output when the prompt is 100,000
 * tokens or fewer, 0.50 and 2.50 above that; cache reads 0.1x input, 5-minute
 * cache writes 1.25x (Claude API skill, "Migrating to Claude Haiku 5.5", read
 * 2026-11-16; G2's runner priced the short card the same). A page's prompt is
 * about 5,000 tokens, so the long card is here only so the price stays right
 * if that ever changes. NOT usageUsd: that is Haiku 4.5's card.
 */
export const HAIKU_55_USD_PER_MTOK = {
  short: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  long: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  longAbovePromptTokens: 100_000,
} as const;

/** The fields of an Anthropic `usage` object the price reads. Missing or bad counts read as 0. */
export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/**
 * One Claude Haiku 5.5 call's real price, from its `usage`, in USD rounded to
 * the ledger's 6 places. Summed in whole nano-dollars (every rate above is a
 * whole number of them per token), so a price that falls exactly between two
 * micro-dollars (4,915 in + 4,000 out = 0.0024915) always rounds up, instead
 * of whichever way binary floating point lands.
 */
export function haiku55Usd(usage: AnthropicUsage | null | undefined): number {
  const n = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);
  const input = n(usage?.input_tokens);
  const output = n(usage?.output_tokens);
  const cacheRead = n(usage?.cache_read_input_tokens);
  const cacheWrite = n(usage?.cache_creation_input_tokens);
  const r = HAIKU_55_USD_PER_MTOK;
  const card = input + cacheRead + cacheWrite > r.longAbovePromptTokens ? r.long : r.short;
  const nano = (rate: number) => Math.round(rate * 1000); // USD per million tokens -> nano-USD per token
  const totalNano =
    input * nano(card.input) + output * nano(card.output) + cacheRead * nano(card.cacheRead) + cacheWrite * nano(card.cacheWrite);
  return Math.round(totalNano / 1000) / 1_000_000;
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
