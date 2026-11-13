/**
 * Per-user rate limiting (B7) — the pre-revenue cost-control backstop.
 *
 * Two layers:
 *  1. A best-effort in-memory burst guard (queries only) that kills tight client
 *     loops cheaply, before any DB work.
 *  2. A durable daily cap backed by usage_counters + the increment_usage RPC,
 *     tier-aware via getEntitlement.
 *
 * Per the standing rule, tier is resolved ONLY through getEntitlement — never a
 * raw subscriptions read.
 */
import { getEntitlement } from '@/lib/entitlement';
import { createClient } from '@/lib/supabase/server';
import type { Tier } from '@/types';
import type { Locale } from '@/lib/i18n';
import type { Platform } from '@/lib/platform';
import type { LimitKind } from '@/lib/limit-messages';
import {
  dailyLimitMessage,
  nextDailyReset,
  TOO_FAST,
  TEMPORARILY_UNAVAILABLE,
  uploadFailuresMessage,
} from '@/lib/limit-messages';
import { uploadVerdict } from '@/lib/upload-allowance';

// Single source of truth: the kind list lives with the copy it must stay in step
// with (src/lib/limit-messages.ts). Aliased, not restated, so a new kind cannot be
// added to one list and forgotten in the other. Re-exported: callers import it here.
export type UsageKind = LimitKind;

/**
 * Daily caps per tier. Pro is FINITE on purpose — we never allow
 * unbounded inference/ingestion cost, even for paying users (same principle as
 * PRO_LIMITS in limits.ts). Tunable with real usage.
 *
 * `summary` and `quiz` are each a DEDICATED counter (own column, own cap): both
 * send a whole document to Claude, so they must be bounded independently of the
 * query cap and of each other, and must never drain a user's question quota (see
 * Phase 3 / Phase 4 in docs/PROGRESS.md). Free is deliberately low because each is
 * expensive; `quiz` mirrors `summary`.
 */
// EXPORTED so the student home can print the same ceilings this limiter
// enforces. Restating the numbers in the UI is how copy and enforcement drift
// apart — register #1 records that exact failure for the limit messages.
//
// THE PRICE THESE ARE SET AGAINST: Pro is 9.99 USD a month, one price for every
// country (2026-11-13). Paddle keeps 5% + 0.50 USD of each payment, so a month
// nets about 8.99 USD before any sales tax that comes out of the same 9.99.
// Unit costs are the measured ones (#94, one 13,421-character Arabic document).
//
// `pro.query` (register #80(b)): 25 a day. At $0.005622 a question that is $4.22
// per 30 days. It was 2,000 ($337). `enforceLimit` counts every question, so
// keeping one conversation open does not get past it
// (scripts/verify-pro-question-cap.mjs).
//
// `pro.summary` and `pro.quiz` (register #80(b)): 5 and 5, EQUAL to Free's. At
// $0.015891 a summary and $0.014168 a quiz that is $4.51 per 30 days (they were
// 100 and 100, $90). With the questions, a Pro month at every model limit is
// $8.73 at that document's size: about the whole of the 8.99 USD net
// (scripts/verify-pro-summary-quiz-caps.mjs).
//
// `pro.upload` (fix/ai-cost-caps): 20 a day, was 500. An upload's cost is its
// Voyage AI embedding, which grows with the file's text: about $0.0013 for the
// #94 document (estimated at 2 characters a token, not measured), about $0.18 for the largest text one file may hold
// (MAX_CONVERTED_CHARS in services/ingestion/main.py: 4,194,304 characters,
// measured on production as about a million Voyage tokens). At 20 a day that
// is $0.78 to $108 per 30 days; at 500 it was $20 to $2,700. The attempt
// ceiling is 20 + FAILED_UPLOAD_ALLOWANCE = 25 (src/lib/upload-allowance.ts).
// The per-file cap bounds one file, not a month: the top of that range is still
// over the price, and the monthly spend allowance is the PR that closes it.
export const DAILY_CAPS: Record<Tier, Record<UsageKind, number>> = {
  free: { query: 10, upload: 5, summary: 5, quiz: 5 },
  pro: { query: 25, upload: 20, summary: 5, quiz: 5 },
};


/**
 * Burst guard: minimum spacing between a user's queries. Best-effort and
 * per-instance (module memory) — it is NOT durable across serverless instances
 * or cold starts. That is fine: its only job is to defang a runaway loop
 * hammering a single warm instance; the daily cap is the hard, durable ceiling.
 * Applied to queries only (the expensive inference path).
 */
const MIN_QUERY_INTERVAL_MS = 2000;
const lastQueryAt = new Map<string, number>();

// Single shape (not a discriminated union): the project compiles with
// strict:false, where union narrowing on a boolean discriminant does NOT kick
// in, so callers couldn't access status/error after an `if (!allowed)` guard.
// On a denial, status + error are set; on an allow, count is set.
export interface LimitResult {
  allowed: boolean;
  count?: number;
  status?: 429 | 503;
  error?: string;
}

/**
 * Enforce burst + daily limits for `kind` and atomically record the usage.
 * Returns a denial (with the HTTP status the route should send) or an allow with
 * the new count. The caller MUST short-circuit its work on a denial.
 */
export async function enforceLimit(
  userId: string,
  kind: UsageKind,
  locale: Locale,
  // Which shell asked (`platformFromRequest`): the refusal's upgrade sentence
  // is dropped in the store build (Apple 3.1.1(a); src/lib/platform.ts).
  platform: Platform = 'web'
): Promise<LimitResult> {
  // Layer 1: burst guard (queries only). Returns before any DB write, so a
  // burst-denied request is not counted against the daily cap.
  if (kind === 'query') {
    const now = Date.now();
    const prev = lastQueryAt.get(userId);
    if (prev !== undefined && now - prev < MIN_QUERY_INTERVAL_MS) {
      return {
        allowed: false,
        status: 429,
        error: TOO_FAST[locale],
      };
    }
    lastQueryAt.set(userId, now);
  }

  // Layer 2: durable daily cap, tier-aware.
  const { tier } = await getEntitlement(userId);
  const cap = DAILY_CAPS[tier][kind];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_usage', { p_kind: kind });

  if (error || typeof data !== 'number') {
    // Fail CLOSED: the whole point of B7 is to never let runaway cost through, so
    // if we cannot account for usage we deny rather than risk it. A persistent
    // failure here (e.g. migration not applied) is a loud, total block by design
    // — preferable pre-revenue to silently disabling the cost ceiling.
    console.error('increment_usage failed; denying request', { kind, error });
    return {
      allowed: false,
      status: 503,
      error: TEMPORARILY_UNAVAILABLE[locale],
    };
  }

  if (data > cap) {
    return {
      allowed: false,
      status: 429,
      error: dailyLimitMessage(locale, kind, cap, tier, nextDailyReset(), new Date(), platform),
    };
  }

  return { allowed: true, count: data };
}

/**
 * ACTIVATION 5 (cause #10): the upload gate. A failed upload no longer uses one
 * of the day's uploads (src/lib/upload-allowance.ts says how and why).
 *
 * `keptToday` reads today's documents that did not fail. It runs FIRST, so a
 * student whose day is used up is refused without touching the counter. Then
 * the atomic counter takes this attempt, exactly as `enforceLimit` does, and is
 * held to the attempt ceiling. If `keptToday` cannot read (null), the counter
 * alone decides against the day's cap: the rule before this change.
 *
 * Fails closed on the counter, like `enforceLimit`.
 */
export async function enforceUploadLimit(
  userId: string,
  locale: Locale,
  platform: Platform,
  keptToday: () => Promise<number | null>
): Promise<LimitResult> {
  const { tier } = await getEntitlement(userId);
  const cap = DAILY_CAPS[tier].upload;
  const deny = (reason: 'daily' | 'failures'): LimitResult => ({
    allowed: false,
    status: 429,
    error: reason === 'failures'
      ? uploadFailuresMessage(locale, nextDailyReset(), new Date())
      : dailyLimitMessage(locale, 'upload', cap, tier, nextDailyReset(), new Date(), platform),
  });

  const kept = await keptToday().catch(() => null);
  const before = uploadVerdict({ kept, attempts: null, cap });
  if (!before.allowed) return deny(before.reason ?? 'daily');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_usage', { p_kind: 'upload' });
  if (error || typeof data !== 'number') {
    console.error('increment_usage failed; denying request', { kind: 'upload', error });
    return { allowed: false, status: 503, error: TEMPORARILY_UNAVAILABLE[locale] };
  }

  const after = uploadVerdict({ kept, attempts: data, cap });
  if (!after.allowed) return deny(after.reason ?? 'daily');
  return { allowed: true, count: data };
}
