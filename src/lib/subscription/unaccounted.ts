import { computeTier } from '@/lib/entitlement-core';

/**
 * "IS ANYTHING BILLING THIS CUSTOMER THAT THIS CODE CANNOT REACH?"
 *
 * THE PREMISE THIS REPAIRS, AND IT IS LOAD-BEARING IN TWO SHIPPED PATHS.
 * `src/lib/subscription/cancel.ts` and `src/lib/account-deletion/paddle.ts`
 * both selected `paddle_subscription_id`, dropped the nulls, and treated an
 * empty list as SUCCESS -- `nothing-to-cancel` and `no-paddle-subscription`
 * respectively. The deletion module states the premise in its own comment: *"A
 * row with a null `paddle_subscription_id` is the `status='free'` default: real
 * in our table, absent from Paddle, nothing to cancel."*
 *
 * That premise is true ONLY while Paddle is the sole billing source, and it
 * fails SILENTLY and DESTRUCTIVELY the moment it is not:
 *
 *   - cancel would return `ok: true`, and the card would tell a customer their
 *     subscription is cancelled while the other source kept charging them;
 *   - deletion would return `ok: true`, walk PAST the irreversible boundary to
 *     `auth.admin.deleteUser`, and let the cascade erase the row -- destroying
 *     the only record that a live subscription was still billing a real person.
 *     That is precisely the orphan the deletion ordering exists to prevent, and
 *     it would happen on the SUCCESS path with no orphan log at all.
 *
 * THE TEST IS NOT "DOES IT HAVE A PADDLE ID". A row is unaccounted when it has
 * no Paddle id AND it is currently granting Pro. Keying on entitlement rather
 * than on any particular vendor column is what makes this correct for a billing
 * source nobody has written yet: whatever writes the row, if it grants Pro and
 * we cannot reach it to cancel it, it must never be reported as nothing.
 *
 * WHY IT DOES NOT SIMPLY FLAG EVERY NULL. The `status='free'` default row is a
 * null with `current_period_end` also null, so `computeTier` returns `free` and
 * it is correctly ignored. So is a dead row -- `canceled`, or an entitling
 * status whose period has already ended. Flagging those would block account
 * deletion for people with nothing billing at all, which trades a silent data
 * loss for a loud denial of a right Apple guideline 5.1.1(v) requires us to
 * offer. Neither is acceptable; only the live-and-unreachable case is.
 *
 * The entitling-status rule is NOT duplicated here. It is imported from
 * `@/lib/entitlement-core`, which exists for that reason -- see that file.
 */

/** The three columns this question is answered from. */
export interface BillingRow {
  paddle_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
}

/** Does this row carry a Paddle id we can actually act on? */
export function hasPaddleSubscriptionId(row: BillingRow): boolean {
  const id = row?.paddle_subscription_id;
  return typeof id === 'string' && id.length > 0;
}

/**
 * True when the row grants Pro but carries no Paddle id -- something is billing
 * this customer through a source this code cannot see, let alone cancel.
 */
export function isUnaccountedBillingRow(row: BillingRow): boolean {
  if (hasPaddleSubscriptionId(row)) return false;
  return computeTier(row?.status ?? null, row?.current_period_end ?? null) === 'pro';
}

/** How many of these rows are billing through a source we cannot reach. */
export function countUnaccountedBillingRows(rows: BillingRow[] | null | undefined): number {
  let n = 0;
  for (const row of rows ?? []) if (isUnaccountedBillingRow(row)) n += 1;
  return n;
}

/**
 * The operator-facing sentence. Deliberately says what is NOT known rather than
 * naming a vendor: the whole point is that the source is unidentified.
 */
export function unaccountedReason(n: number): string {
  return (
    `refusing to report success: ${n} subscription row(s) grant Pro but carry no ` +
    `paddle_subscription_id, so this customer is being billed through a source ` +
    `this code cannot reach or cancel`
  );
}
