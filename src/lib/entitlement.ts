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
 *
 *
 * THE READ IS PLURAL, AND THAT IS THE FIX (register #72)
 * -----------------------------------------------------
 * This module used to read with `.maybeSingle()`. `subscriptions.user_id` has NO
 * UNIQUE CONSTRAINT, so a user can own more than one row — and on two rows
 * `.maybeSingle()` does not return the first one, it FAILS. postgrest-js
 * synthesises this CLIENT-SIDE, on an HTTP 200 that already carried both rows:
 *
 *     code    'PGRST116'
 *     message 'JSON object requested, multiple (or no) rows returned'
 *     data    null
 *
 * The old code destructured `{ data }` and dropped `error` on the floor. So
 * `data` was null, `computeTier(null, null)` returned `free`, and A PAYING
 * CUSTOMER WAS SILENTLY DOWNGRADED — ads switched on, Pro limits switched off,
 * no error page, no log line, nothing anywhere saying why.
 *
 * Executed rather than reasoned about, against a real Postgres + PostgREST
 * holding this table's exact definition: a two-row paying user resolved to
 * `{ tier: 'free', adsEnabled: true, expiresAt: null }` before this change and
 * `{ tier: 'pro', adsEnabled: false, expiresAt: <the later date> }` after it.
 *
 * `src/lib/account-deletion/paddle.ts` already read this table plurally for
 * exactly this reason (register #9), and explicitly named this module as
 * carrying the same latent defect. The codebase disagreed with itself. It no
 * longer does.
 *
 *
 * WHY NOT A UNIQUE CONSTRAINT ON `user_id` INSTEAD
 * -----------------------------------------------
 * Because two rows are LEGITIMATE, not corruption. `20260414_subscriptions.sql`
 * declares `paddle_subscription_id TEXT UNIQUE` and nothing unique on `user_id`,
 * and the webhook upserts with `{ onConflict: 'paddle_subscription_id' }`. A
 * customer who subscribes, cancels, and subscribes again gets a NEW Paddle
 * subscription id, which conflicts with nothing, so the upsert INSERTS a second
 * row. Both rows are real and either could name a live subscription.
 *
 * A `UNIQUE (user_id)` would turn that insert into a constraint violation: the
 * webhook would 500 and the customer's NEW subscription would never be recorded
 * at all. They would pay and get nothing — strictly worse than the bug this
 * change fixes. The constraint is refused on correctness grounds.
 *
 * (Checked before ruling rather than assumed: the live `subscriptions` table
 * holds ZERO rows today, so such a constraint would break no existing row. That
 * is not why it is refused; it would still be wrong on the first resubscription.)
 *
 *
 * WHICH ROW WINS: THE MOST GENEROUS ONE, DELIBERATELY
 * ---------------------------------------------------
 * Pro iff ANY row is entitling with a future `current_period_end`, and
 * `expiresAt` is the LATEST such date. Not "the first row", not "the newest by
 * `created_at`".
 *
 * Ordering by creation is a proxy for the question and can answer it wrongly:
 * the most recently created row is easily the dead one — a `canceled` leftover,
 * or the `status='free'` row this table's own DEFAULT produces — while the live
 * subscription sits in an older row. Scanning every row answers the question
 * actually being asked ("does this user hold any live entitlement?") and is the
 * only rule that GUARANTEES the invariant that matters: a paying user is never
 * returned free.
 *
 * The latest date rather than the earliest, for the same reason: when two rows
 * are both live, access ends when the LAST one ends. Reporting the earlier would
 * flip a paying customer to free while they were still paid up.
 *
 * THIS FAILS OPEN, AND THAT IS THE CHOSEN SIDE. A stale entitling row with a
 * future period end grants Pro that Paddle no longer backs. Two things bound
 * that: the webhook writes Paddle's status verbatim, so a cancelled subscription
 * becomes `canceled` and stops entitling; and every entitling row still needs a
 * FUTURE `current_period_end`, so a stale row lapses by the clock on its own.
 * Between wrongly granting Pro to a lapsed customer and wrongly cutting a paying
 * one down to free, only the second is unacceptable.
 *
 *
 * A FAILED READ IS NOW LOGGED RATHER THAN SWALLOWED — BUT STILL RESOLVES `free`
 * ----------------------------------------------------------------------------
 * "This user has no entitlement" and "I could not find out whether this user has
 * an entitlement" are different facts, and the old code could not tell them
 * apart because it never looked at `error`. It looks now, and says so loudly.
 *
 * It still returns `free`, and that is a DEFERRAL, not a finding that `free` is
 * the right answer. Throwing would be more honest, but `getEntitlement` is
 * awaited in `dashboard/layout.tsx` — a layout — so a transient database blip
 * would take the whole dashboard down rather than degrade one badge. That is an
 * availability change across five call sites and needs its own change, with its
 * own thinking about fallback UI. What this change buys is that the failure is
 * VISIBLE in logs instead of indistinguishable from a genuinely free user.
 */

import { createClient } from '@/lib/supabase/server';
import { computeTier } from '@/lib/entitlement-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entitlement, Tier } from '@/types';

const TABLE = 'subscriptions';

/** The two columns entitlement is derived from. One row of the plural read. */
export interface EntitlementRow {
  status: string | null;
  current_period_end: string | null;
}

/** What every caller gets when we cannot grant Pro. */
const FREE: Entitlement = { tier: 'free', adsEnabled: true, expiresAt: null };

/**
 * MOVED, NOT CHANGED. `computeTier` and the entitling-status set now live in
 * `@/lib/entitlement-core` and are re-exported here unchanged, so every existing
 * import site is untouched. They had to leave this file because it imports
 * `@/lib/supabase/server`, and two modules that must NOT take a Next.js
 * dependency need the same rule: `subscription/cancel.ts` and
 * `account-deletion/paddle.ts`, both written to receive their clients as
 * parameters so they can run outside a request. The alternative was a second
 * copy of the status list, whose drift would be silent and would destroy
 * evidence. See that file.
 */
export { computeTier };

/**
 * Reduce EVERY row a user owns to one entitlement. Pure: no client, no clock
 * beyond the one `computeTier` already consults, no I/O.
 *
 * Compared numerically via `getTime()` rather than lexicographically on the ISO
 * strings: `timestamptz` values come back from PostgREST as `+00:00`, but a
 * value written through another path could arrive as `Z`, and those two spellings
 * of the same instant do not sort against each other as text. An unparseable date
 * yields `NaN`, which fails `computeTier`'s future check first and so can never
 * reach the comparison.
 */
export function entitlementFromRows(rows: EntitlementRow[] | null): Entitlement {
  let latestIso: string | null = null;
  let latestMs = -Infinity;

  for (const row of rows ?? []) {
    const status = row?.status ?? null;
    const periodEnd = row?.current_period_end ?? null;
    if (computeTier(status, periodEnd) !== 'pro') continue;

    const ms = new Date(periodEnd as string).getTime();
    if (ms > latestMs) {
      latestMs = ms;
      latestIso = periodEnd;
    }
  }

  if (!latestIso) return FREE;
  return { tier: 'pro', adsEnabled: false, expiresAt: latestIso };
}

/**
 * Resolve entitlement using a caller-supplied client.
 *
 * Separate from `getEntitlement` so this can be executed against a real
 * PostgREST without Next.js — the seam that made the two-row case provable
 * instead of merely arguable.
 */
export async function readEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlement> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('status, current_period_end')
    .eq('user_id', userId);

  // Checked before `data`, for the reason account-deletion/paddle.ts records:
  // a read that failed and a read that found nothing are different facts, and
  // only one of them may be reported to a paying customer as "free".
  if (error) {
    console.error('entitlement read failed; resolving to free', {
      userId,
      code: error.code,
      message: error.message,
    });
    return FREE;
  }

  return entitlementFromRows(data as EntitlementRow[] | null);
}

/**
 * Resolve the entitlement for a user. Returns `free` when there are no
 * subscription rows, when no row is entitling, or when every entitling period
 * has lapsed.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  return readEntitlement(await createClient(), userId);
}
