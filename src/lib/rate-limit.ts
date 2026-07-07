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

export type UsageKind = 'query' | 'upload' | 'summary';

/**
 * Daily caps per tier. Pro is high but FINITE on purpose — we never allow
 * unbounded inference/ingestion cost, even for paying users (same principle as
 * PRO_LIMITS in limits.ts). Tunable with real usage.
 *
 * `summary` is a DEDICATED counter (its own column, its own cap): a summary sends
 * the whole document to Claude, so it must be bounded independently of the query
 * cap and must never drain a user's question quota (see Phase 3 in
 * docs/PROGRESS.md). Free is deliberately low because each summary is expensive.
 */
const DAILY_CAPS: Record<'free' | 'pro', Record<UsageKind, number>> = {
  free: { query: 30, upload: 5, summary: 5 },
  pro: { query: 2000, upload: 500, summary: 100 },
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
  kind: UsageKind
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
        error: 'You are sending requests too quickly. Please wait a moment and try again.',
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
      error: 'Service is temporarily unavailable. Please try again shortly.',
    };
  }

  if (data > cap) {
    const noun =
      kind === 'query' ? 'questions' : kind === 'upload' ? 'uploads' : 'summaries';
    const tail =
      tier === 'pro'
        ? 'Please try again tomorrow.'
        : 'Upgrade to Pro for a higher limit, or try again tomorrow.';
    return {
      allowed: false,
      status: 429,
      error: `You've reached your daily limit of ${cap} ${noun}. ${tail}`,
    };
  }

  return { allowed: true, count: data };
}
