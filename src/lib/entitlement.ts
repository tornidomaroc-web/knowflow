/**
 * Single source of truth for billing entitlement (docs/PIVOT_PLAN.md §3).
 *
 * Entitlement is derived ONLY from the `subscriptions` table. `profiles.plan` is
 * deliberately ignored as an entitlement signal (B2) — it is retired but the
 * column is kept for now.
 *
 * The read is user-scoped: it uses the RLS-bound server client, so a caller can
 * only ever resolve the entitlement of the logged-in user. The Paddle webhook
 * keeps its own separate service-role path; there is intentionally no
 * service-role variant here until a real background/server-to-server need exists.
 */

import { createClient } from '@/lib/supabase/server';
import type { Entitlement, Tier } from '@/types';

/**
 * Subscription statuses that grant Pro access.
 *
 * Includes both the legacy value the current webhook writes (`'pro'`) and the
 * faithful Paddle statuses introduced in S4 (`active`/`trialing`/`past_due`), so
 * this helper is correct before and after the webhook hardening.
 *
 * `past_due` is intentionally entitled: access continues through the grace
 * window until `current_period_end`, which the time check below enforces. This
 * is what prevents a single failed charge from causing instant lockout.
 */
const ENTITLED_STATUSES = new Set(['pro', 'active', 'trialing', 'past_due']);

/**
 * Pure tier derivation, separated from the DB read so it can be reasoned about
 * and tested without a database.
 *
 * Rule (per plan §3): Pro iff the status is entitling AND the current period has
 * not yet ended. A missing `current_period_end` resolves to `free` — we never
 * grant Pro without a known, future expiry, so a stale/incomplete row can't leak
 * unbounded access. S4 must always persist `current_period_end` on entitling rows.
 */
export function computeTier(
  status: string | null,
  currentPeriodEnd: string | null
): Tier {
  if (!status || !ENTITLED_STATUSES.has(status)) return 'free';
  if (!currentPeriodEnd) return 'free';
  return new Date(currentPeriodEnd).getTime() > Date.now() ? 'pro' : 'free';
}

/**
 * Resolve the entitlement for a user. Returns `free` when there is no
 * subscription row, when the status is non-entitling, or when the period has
 * lapsed.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  const tier = computeTier(data?.status ?? null, data?.current_period_end ?? null);

  return {
    tier,
    adsEnabled: tier === 'free',
    expiresAt: tier === 'pro' ? data?.current_period_end ?? null : null,
  };
}
