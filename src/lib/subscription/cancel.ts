import type { SupabaseClient } from '@supabase/supabase-js';
import type { Paddle, Subscription } from '@paddle/paddle-node-sdk';

/**
 * Cancelling a subscription WITHOUT destroying the account. Register #70,
 * issue #96: until this existed, the only way a paying customer could stop
 * being billed was to delete every byte of their data.
 *
 *
 * PERIOD END, NEVER IMMEDIATELY -- AND THIS IS THE DECISION, NOT A DEFAULT
 * -----------------------------------------------------------------------
 * The customer has already paid for the current period. Cancelling immediately
 * takes that time away and does NOT refund it: a refund in Paddle is a separate
 * `adjustments` call this codebase has never made and has no code for. So
 * `immediately` here would mean keeping their money and withdrawing the
 * service, which is the worst of the three available outcomes and the one you
 * get by default if nobody rules.
 *
 * `src/lib/account-deletion/paddle.ts` passes `immediately` and stays correct
 * for the opposite reason: there the account is being destroyed, so billing to
 * period end would charge for a service that no longer exists. Same API, two
 * call sites, two different right answers. Neither is the other's default.
 *
 * THE REFUND EDGE, STATED RATHER THAN HIDDEN. Someone who cancels the day after
 * renewal gets nothing back. That follows from having no refund code, and it is
 * acceptable -- but only because the UI says so before they click. The defect
 * would not be the policy; it would be shipping the button silently. See
 * `settings.cancelSubscription.noRefund` in both locales.
 *
 *
 * WHY `verifiablyCanceled` FROM THE DELETION MODULE IS **NOT** REUSED
 * ------------------------------------------------------------------
 * Read this before "simplifying" the two into one helper.
 *
 * `account-deletion/paddle.ts` asserts `status === 'canceled' && !scheduledChange`.
 * That is the correct end state for an IMMEDIATE cancellation and it is the
 * EXACT OPPOSITE of the correct end state here. A period-end cancellation
 * succeeds by leaving the subscription `active` and ATTACHING a scheduled
 * change; Paddle's own default for `subscriptions.cancel` is
 * `next_billing_period`, which is why that module had to pass `immediately`
 * explicitly and read the status back.
 *
 * So reusing that predicate here would report FAILURE ON EVERY SUCCESS -- and
 * the caller would then tell a customer their cancellation had failed while
 * Paddle had in fact scheduled it, inviting them to cancel again or to reach
 * for the deletion button instead. The two predicates look like duplication and
 * are not.
 *
 *
 * NOTHING IS WRITTEN TO THE DATABASE, AND THE ABSENCE OF THE WRITE IS THE DESIGN
 * -----------------------------------------------------------------------------
 * DO NOT ADD ONE. `src/lib/entitlement.ts` grants Pro iff the status is
 * entitling AND `current_period_end` is in the future. After a period-end
 * cancellation Paddle leaves the status `active`, and our row already says
 * `active` with a future `current_period_end` -- so entitlement is ALREADY
 * correct, stays Pro for the time that was paid for, and lapses BY THE CLOCK
 * when the date passes. No column, no migration, no webhook needed for that.
 *
 * The tempting write is `status = 'canceled'`, and it is a trap: `canceled` is
 * not in `ENTITLED_STATUSES`, so writing it would revoke access INSTANTLY and
 * take away exactly the time this module exists to protect. The schema as it
 * stands already expresses the truth; a write would make it lie.
 *
 * There is also no column for a scheduled cancellation (`20260414_subscriptions.sql`
 * has `status` and `current_period_end` and nothing else that could hold one),
 * and adding one was refused: Paddle already knows, the settings page asks it
 * directly, and a second copy is a second thing that can drift.
 *
 *
 * SERVICE ROLE, AND WHY THE READ IS PLURAL
 * ----------------------------------------
 * `subscriptions` grants exactly one RLS policy -- `FOR SELECT` -- so this runs
 * server-side with the service-role client, never in a browser holding a Paddle
 * key.
 *
 * The read is a plain `select` over ALL matching rows and never `.single()` or
 * `.maybeSingle()`, for the reason `account-deletion/paddle.ts` records at
 * length: `subscriptions.user_id` has NO unique constraint (register #9), so a
 * user who subscribed, cancelled and subscribed again owns two rows and either
 * could name a live subscription. Cancelling only "the" subscription would
 * leave the other one billing.
 */

/** Same guard, same reason, as the deletion module's: a malformed id matches
 *  zero rows and would read as "this user has nothing to cancel" -- a false
 *  clear. Wrong answers are refused rather than returned. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABLE = 'subscriptions';

/**
 * Which legitimate outcome occurred. `nothing-to-cancel` is not a failure: it is
 * the state of every free user, and the caller renders the affordance only for
 * Pro anyway, so reaching it means the row went away between render and click.
 */
export type CancelScheduleOutcome = 'nothing-to-cancel' | 'scheduled';

export type CancelScheduleResult =
  | { ok: true; outcome: CancelScheduleOutcome; scheduled: number; effectiveAt: string | null }
  | { ok: false; reason: string; scheduled: number };

/**
 * Explicit type predicate rather than `if (!result.ok)`, for the reason
 * `account-deletion/orchestrate.ts` records: `tsconfig` sets `strict: false`
 * (register #41), so `strictNullChecks` is off and TypeScript does NOT narrow a
 * discriminated union on a boolean discriminant.
 *
 * CONFIRMED HERE RATHER THAN ASSUMED: the first build of the route reading
 * `result.reason` after `if (!result.ok)` failed with
 * `TS2339: Property 'reason' does not exist on type 'CancelScheduleResult'`.
 * The predicate narrows regardless of the flag.
 */
export function cancelScheduleFailed(
  r: CancelScheduleResult
): r is Extract<CancelScheduleResult, { ok: false }> {
  return !r.ok;
}

/**
 * THE END STATE IS THE TEST, NOT THE CALL'S RETURN -- the same principle the
 * deletion module applies, pointed at the opposite target.
 *
 * A resolved promise proves nothing: Paddle can accept a cancellation and hand
 * back a subscription with no scheduled change attached. What we require is the
 * scheduled change itself, because that is the thing that will actually stop the
 * next charge. `pause` and `resume` are the other members of the union and
 * neither is what was asked for, so the action is compared exactly.
 */
export function verifiablyScheduledToCancel(sub: Subscription): boolean {
  return sub.scheduledChange?.action === 'cancel';
}

/**
 * Schedule one cancellation and prove it. Returns the effective date on success,
 * or the reason it could not be proved.
 *
 * ON FAILURE WE RE-READ, for the same reason the deletion module does: a
 * subscription that is ALREADY scheduled to cancel plausibly throws rather than
 * returning cleanly, and a customer who clicks twice must not be told their
 * cancellation failed when it is already in place. `get()` answers the only
 * question that matters -- is it scheduled to cancel now? -- and costs one
 * request on a path that is not the common case.
 */
async function scheduleAndVerify(
  paddle: Paddle,
  subscriptionId: string
): Promise<{ effectiveAt: string } | { reason: string }> {
  let result: Subscription;

  try {
    result = await paddle.subscriptions.cancel(subscriptionId, {
      effectiveFrom: 'next_billing_period',
    });
  } catch (cancelError) {
    const first = cancelError instanceof Error ? cancelError.message : String(cancelError);

    try {
      const current = await paddle.subscriptions.get(subscriptionId);
      if (verifiablyScheduledToCancel(current)) {
        return { effectiveAt: current.scheduledChange!.effectiveAt };
      }
      return {
        reason: `cancel failed (${first}); ${subscriptionId} has no pending cancellation`,
      };
    } catch (readError) {
      const second = readError instanceof Error ? readError.message : String(readError);
      return {
        reason: `cancel failed (${first}) and state could not be re-read (${second}) for ${subscriptionId}`,
      };
    }
  }

  if (!verifiablyScheduledToCancel(result)) {
    const attached = result.scheduledChange
      ? ` (a '${result.scheduledChange.action}' change is scheduled instead)`
      : ' (no scheduled change was attached)';
    return {
      reason: `cancel returned success but ${subscriptionId} is not scheduled to cancel${attached}`,
    };
  }

  return { effectiveAt: result.scheduledChange!.effectiveAt };
}

/**
 * Schedule cancellation of every Paddle subscription belonging to `userId`, at
 * the end of the period each has already been paid for.
 *
 * Unlike the deletion path, a failure here costs the caller nothing
 * irreversible: no account is destroyed, nothing is deleted, and the customer
 * can simply try again. That is why this returns a plain failure rather than
 * demanding an abort protocol -- the asymmetry is the whole point of having a
 * cancel path separate from deletion.
 *
 * Sequential, and the count is returned on both arms: with two subscriptions, a
 * failure on the second must not be reported as if neither had been scheduled.
 */
export async function scheduleSubscriptionCancellation(
  admin: SupabaseClient,
  paddle: Paddle,
  userId: string
): Promise<CancelScheduleResult> {
  if (!UUID_RE.test(userId)) {
    return {
      ok: false,
      reason: 'refusing to cancel: userId is not a UUID, so a zero-row result would prove nothing',
      scheduled: 0,
    };
  }

  const { data, error } = await admin
    .from(TABLE)
    .select('paddle_subscription_id')
    .eq('user_id', userId);

  // Checked before `data`: "there is nothing to cancel" and "I could not find
  // out whether there is anything to cancel" are different facts, and only one
  // of them may be reported to a customer as success.
  if (error) {
    return { ok: false, reason: `subscription read failed: ${error.message}`, scheduled: 0 };
  }

  const subscriptionIds = (data ?? [])
    .map((row) => row.paddle_subscription_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (subscriptionIds.length === 0) {
    return { ok: true, outcome: 'nothing-to-cancel', scheduled: 0, effectiveAt: null };
  }

  let scheduled = 0;
  let effectiveAt: string | null = null;

  for (const subscriptionId of subscriptionIds) {
    const attempt = await scheduleAndVerify(paddle, subscriptionId);
    if ('reason' in attempt) {
      return { ok: false, reason: attempt.reason, scheduled };
    }
    scheduled += 1;
    // The soonest date is the one the customer cares about: it is when their
    // access actually starts lapsing.
    if (!effectiveAt || attempt.effectiveAt < effectiveAt) effectiveAt = attempt.effectiveAt;
  }

  return { ok: true, outcome: 'scheduled', scheduled, effectiveAt };
}

/**
 * Ask PADDLE -- not our table -- whether this user's subscription is scheduled
 * to cancel, so the settings page can say "cancels on" instead of "renews on".
 *
 * WHY PADDLE AND NOT A COLUMN. There is no column, and adding one was refused:
 * it would mean a migration applied to production by hand before merge under
 * the standing rule, plus a manifest entry and regenerated types, for one field
 * whose value Paddle already holds -- and it would create a second source of
 * truth that can disagree with the first.
 *
 * NEVER THROWS, AND THE DEGRADATION RULE IS WRITTEN HERE RATHER THAN LEFT TO BE
 * DISCOVERED: if Paddle is unreachable, slow, or answers with anything
 * unexpected, this returns `null` and the page shows the plain entitlement with
 * no scheduled-cancellation line. It must never turn the settings page into an
 * error page. A billing display that fails closed on a read is worth less than
 * a settings page that still shows the customer their email address.
 *
 * Takes the RLS-bound server client: the user may read their own subscription
 * rows and no one else's, so no service role is needed to render a page.
 */
export async function readScheduledCancellation(
  supabase: SupabaseClient,
  paddle: Paddle,
  userId: string
): Promise<string | null> {
  if (!UUID_RE.test(userId)) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('paddle_subscription_id')
      .eq('user_id', userId);

    if (error) return null;

    const subscriptionIds = (data ?? [])
      .map((row) => row.paddle_subscription_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    let soonest: string | null = null;

    for (const subscriptionId of subscriptionIds) {
      const sub = await paddle.subscriptions.get(subscriptionId);
      if (!verifiablyScheduledToCancel(sub)) continue;
      const at = sub.scheduledChange!.effectiveAt;
      if (!soonest || at < soonest) soonest = at;
    }

    return soonest;
  } catch {
    // Deliberately silent to the page. See the degradation rule above.
    return null;
  }
}
