import type { Tier } from '@/types';

/**
 * The entitlement rules that are PURE, split out of `./entitlement.ts` so code
 * which must not depend on Next.js can still reach them.
 *
 * WHY THIS FILE EXISTS, AND IT IS NOT TIDINESS. `./entitlement.ts` imports
 * `@/lib/supabase/server`, which reaches `next/headers`. Two modules need the
 * entitling-status rule and neither may take that dependency:
 * `src/lib/subscription/cancel.ts` and `src/lib/account-deletion/paddle.ts` are
 * both written to receive their clients as PARAMETERS precisely so they can be
 * executed outside a request — which is how every one of their proofs was
 * obtained. Importing `entitlement.ts` into either would drag a server-only
 * module into code that is deliberately free of one.
 *
 * THE ALTERNATIVE WAS A SECOND COPY OF THE STATUS LIST, AND THAT IS THE FAILURE
 * THIS FILE PREVENTS. If `ENTITLED_STATUSES` gained a value here and not there,
 * `isUnaccountedBillingRow` would UNDER-report: a row granting Pro through an
 * unseen billing source would look like an inert free row, and account deletion
 * would destroy the only record of a live subscription. Drift in that direction
 * is silent and destroys evidence, so the list is not duplicated — it is moved,
 * and `./entitlement.ts` re-exports `computeTier` so every existing import site
 * is unchanged.
 */

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
export const ENTITLED_STATUSES = new Set(['pro', 'active', 'trialing', 'past_due']);

/**
 * Pure tier derivation for ONE row, separated from the DB read so it can be
 * reasoned about and tested without a database.
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
