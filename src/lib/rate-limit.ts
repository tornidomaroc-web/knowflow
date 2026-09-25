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
} from '@/lib/limit-messages';

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
// `pro.query` IS THE SETTLED PRICE'S ALLOWANCE, NOT A TUNING KNOB (register #80(b)).
// The price (40 USD a semester, 12 USD a month) was set on Pro at 25 questions a
// day (#94). It was 2,000, which at the measured $0.005622 a question is $337 per
// 30 days against a $12 month. `enforceLimit` counts every question, so keeping
// one conversation open does not get past it (scripts/verify-pro-question-cap.mjs).
//
// `pro.summary` and `pro.quiz` ARE SET FROM THE SAME PRICE (register #80(b)).
// They were 100 and 100, which at the measured $0.015891 a summary and $0.014168 a
// quiz (#94) is $90 per 30 days. At 5 and 5 it is $4.51, so with 25 questions a
// Pro day is about $8.72 per 30 days at that document's size. They now EQUAL
// Free's 5 and 5: Pro buys more questions, not more summaries or quizzes
// (scripts/verify-pro-summary-quiz-caps.mjs).
export const DAILY_CAPS: Record<Tier, Record<UsageKind, number>> = {
  free: { query: 10, upload: 5, summary: 5, quiz: 5 },
  pro: { query: 25, upload: 500, summary: 5, quiz: 5 },
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
