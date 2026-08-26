import type { SupabaseClient } from '@supabase/supabase-js';
import type { Paddle, Subscription } from '@paddle/paddle-node-sdk';

/**
 * Account deletion, step 1 of 3: cancel every Paddle subscription the user has,
 * and PROVE each one ended up cancelled.
 *
 * WHY THIS IS A PRECONDITION AND NOT A CLEANUP STEP. The Paddle subscription id
 * lives in exactly one place: the `subscriptions` row. That row is
 * `user_id -> auth.users(id) ON DELETE CASCADE`, so deleting the user destroys
 * the only pointer the application has to the subscription. A subscription we
 * can no longer name is a subscription that can never be cancelled -- it keeps
 * billing a person whose account we told them we deleted. So cancellation runs
 * BEFORE the row deletion, and a failure here ABORTS the whole deletion.
 *
 * Same one-way-door shape as the storage sweep (`./storage.ts`), and weaker for
 * the same reason it is survivable: Paddle retains its own customer record, so a
 * failed cancel leaves the subscription findable in Paddle's dashboard. The
 * storage sweep has no such backstop. Both abort; neither proceeds on a claim it
 * could not check.
 *
 * SERVICE ROLE IS REQUIRED. `20260414_subscriptions.sql` grants exactly one
 * policy -- "Users can view own subscription", `FOR SELECT`. There is no INSERT,
 * UPDATE or DELETE policy, and the webhook already reaches this table with a
 * service-role client (`api/paddle/webhook/route.ts`). This must never run in
 * the browser: it holds a Paddle API key.
 */

/**
 * `subscriptions.user_id` HAS NO UNIQUE CONSTRAINT, so a user can own more than
 * one row and this module must never assume otherwise.
 *
 * `20260414_subscriptions.sql` declares `paddle_subscription_id TEXT UNIQUE` and
 * nothing unique on `user_id`; the webhook upserts with
 * `{ onConflict: 'paddle_subscription_id' }`. A user who subscribes, cancels,
 * and subscribes again gets a NEW Paddle subscription id, which conflicts with
 * nothing, so it INSERTS a second row for the same user. Both rows are real and
 * either could name a live subscription.
 *
 * Consequence: the read below is a plain `select` over ALL matching rows, never
 * `.single()` or `.maybeSingle()`. `.maybeSingle()` would RAISE on a user with
 * two rows -- turning a resubscribed customer into a hard deletion failure -- and
 * cancelling only "the" subscription would leave the other one billing.
 *
 * (Noted, not fixed here: `src/lib/entitlement.ts` reads this table with
 * `.maybeSingle()` on `user_id` and has the same latent defect. It is a live
 * entitlement bug independent of deletion and belongs in its own change.)
 */
const TABLE = 'subscriptions';

/**
 * Mirrors the sweep's guard for consistency, though the hazard is milder here: a
 * malformed id goes into a parameterised `.eq()`, so it cannot widen the query
 * the way an empty storage prefix widens a bucket walk. It would instead match
 * ZERO rows and report "this user has no billing record" -- a false clear that
 * would let the caller delete an account whose subscriptions were never even
 * looked for. Wrong answers are refused rather than returned.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Which of the three legitimate successes occurred. The caller does not need to
 * branch on this, but an irreversible account deletion should record WHICH
 * no-op it relied on, not merely that something returned true.
 *
 * - `no-billing-record`  -- the read succeeded and returned zero rows.
 * - `no-paddle-subscription` -- rows exist but none carries a Paddle id (the
 *   `status='free'` default row; there is nothing at Paddle to cancel).
 * - `canceled` -- at least one subscription was verified `canceled`.
 */
export type CancelOutcome = 'no-billing-record' | 'no-paddle-subscription' | 'canceled';

/**
 * Same discriminated shape as `SweepResult` in `./storage.ts`, deliberately: the
 * deletion flow reads both with one idiom, and `ok: false` means the same thing
 * in both places -- STOP, do not delete the user.
 *
 * `canceled` is present on BOTH arms and is load-bearing on the failure arm.
 * Cancellation is not reversible, so aborting after cancelling one of two
 * subscriptions has already taken effect: the account survives with one
 * subscription cancelled. See ACCEPTED RISK below.
 */
export type CancelResult =
  | { ok: true; outcome: CancelOutcome; canceled: number }
  | { ok: false; reason: string; canceled: number };

/** The only end state we accept. See `verifiablyCanceled`. */
const CANCELED: Subscription['status'] = 'canceled';

/**
 * THE END STATE IS THE TEST, NOT THE TRANSITION -- and this is the single most
 * important decision in the module.
 *
 * `subscriptions.cancel()` resolves to a `Subscription`, and a resolved promise
 * is NOT evidence of cancellation. Paddle's `CancelSubscription` body takes
 * `effectiveFrom?: 'next_billing_period' | 'immediately'`, and the API's default
 * is `next_billing_period`: that call SUCCEEDS and returns a subscription still
 * `status: 'active'` carrying `scheduledChange: { action: 'cancel', ... }`. It is
 * still live and it will still bill. Trusting the call would delete the account
 * and destroy the only pointer to a subscription that had not been cancelled at
 * all -- the exact failure this module exists to prevent. `effectiveFrom` is
 * therefore passed explicitly and the returned status is read.
 *
 * A residual `scheduledChange` is also rejected. If a cancellation is still
 * PENDING against this subscription, it has not taken effect, whatever the
 * status field says.
 *
 * WHY THIS ALSO DISSOLVES THE `already canceled` / `paused` / `past_due`
 * QUESTION, rather than deferring it. Those are INPUT states, not outcomes. The
 * requirement is not "a transition occurred" -- it is "this subscription is
 * cancelled when we finish". A subscription already `canceled` satisfies that by
 * construction, so it needs no special case and contributes no untested branch.
 * Asserting the end state is what makes the five-value status enum
 * (`active | canceled | past_due | paused | trialing`) irrelevant on the way in.
 */
function verifiablyCanceled(sub: Subscription): boolean {
  return sub.status === CANCELED && !sub.scheduledChange;
}

/**
 * Cancel one subscription and prove it. Returns null on success, or the reason
 * it could not be proved.
 *
 * ON FAILURE WE RE-READ RATHER THAN ABORT IMMEDIATELY, and the reason is not
 * defensive padding. `already_canceled` is a real member of the SDK's shared
 * `ErrorCode` union, so cancelling an already-cancelled subscription plausibly
 * THROWS instead of returning `status: 'canceled'`. Aborting on the throw would
 * make account deletion PERMANENTLY IMPOSSIBLE for any user whose subscription
 * had already ended -- they would retry forever and abort forever, and the
 * deletion path the privacy page promises would be closed to them by a billing
 * edge case. A `get()` answers the only question that matters (is it cancelled
 * now?) and costs one request on a path that is not the common case.
 *
 * If the re-read also fails, or reports anything but a verified cancellation, we
 * abort. Unverified is treated as failed, exactly as the storage sweep treats an
 * unconfirmable removal.
 */
async function cancelAndVerify(paddle: Paddle, subscriptionId: string): Promise<string | null> {
  let result: Subscription;

  try {
    result = await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: 'immediately' });
  } catch (cancelError) {
    const first = cancelError instanceof Error ? cancelError.message : String(cancelError);

    try {
      const current = await paddle.subscriptions.get(subscriptionId);
      if (verifiablyCanceled(current)) return null;
      return `cancel failed (${first}); subscription ${subscriptionId} is still '${current.status}'`;
    } catch (readError) {
      const second = readError instanceof Error ? readError.message : String(readError);
      return `cancel failed (${first}) and state could not be re-read (${second}) for ${subscriptionId}`;
    }
  }

  if (!verifiablyCanceled(result)) {
    const pending = result.scheduledChange
      ? ` with a pending '${result.scheduledChange.action}' scheduled change`
      : '';
    return `cancel returned success but ${subscriptionId} is '${result.status}'${pending}`;
  }

  return null;
}

/**
 * Cancel every Paddle subscription belonging to `userId`, verifying each one.
 *
 * THE CALLER MUST ABORT THE WHOLE DELETION ON `ok: false` and must not delete
 * the user row -- doing so destroys the only pointer to a subscription that may
 * still be billing a real person.
 *
 * NO SUBSCRIPTION AT ALL IS A SUCCESS, NOT A FAILURE, AND THIS IS A DECISION
 * RATHER THAN AN OVERSIGHT. It is the state of every user in the product today:
 * nobody is paying and the table holds nothing live. Treating it as a failure
 * would mean the precondition BLOCKS THE FEATURE IT GUARDS -- account deletion
 * would be impossible for one hundred percent of current users, which is a
 * worse outcome than any billing edge case it could protect against. Nothing is
 * at stake in this branch either: no row means no `paddle_subscription_id`,
 * which means nothing at Paddle holds this person's money or data. It is
 * reported as a distinct `outcome` rather than silently sharing the cancelled
 * path, because an irreversible deletion should record which no-op it relied on.
 *
 * THE DISTINCTION THAT CARRIES THAT DECISION: `ok: true` must be EARNED BY A
 * SUCCESSFUL READ THAT RETURNED NOTHING -- never by a read that failed. "There
 * is no subscription" and "I could not find out whether there is a subscription"
 * are different facts and only one of them is safe to delete an account on.
 * PostgREST distinguishes them (`data: [], error: null` for a genuine empty
 * result; `error` set on failure), so `error` is checked FIRST and unconditionally.
 *
 * ACCEPTED RISK, WRITTEN DOWN: cancellation is not reversible and the rows are
 * processed in order, so a user with two subscriptions whose second cancel fails
 * ends with the first one cancelled and the account still alive. That is
 * visible, the user still exists to be told, and the count is returned on the
 * failure arm so the caller can say so. The alternative -- deleting the account
 * and orphaning a live subscription -- is the unrecoverable one. A deliberate
 * trade, the same one `./storage.ts` records for its own ordering.
 *
 * This function never throws for an expected condition and never deletes a
 * database row. It does one thing.
 */
export async function cancelUserSubscriptions(
  admin: SupabaseClient,
  paddle: Paddle,
  userId: string
): Promise<CancelResult> {
  if (!UUID_RE.test(userId)) {
    return {
      ok: false,
      reason: 'refusing to cancel: userId is not a UUID, so a zero-row result would prove nothing',
      canceled: 0,
    };
  }

  const { data, error } = await admin
    .from(TABLE)
    .select('paddle_subscription_id')
    .eq('user_id', userId);

  // Checked before `data` is looked at: a failed read must never be mistaken for
  // an empty one.
  if (error) {
    return { ok: false, reason: `subscription read failed: ${error.message}`, canceled: 0 };
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { ok: true, outcome: 'no-billing-record', canceled: 0 };
  }

  // A row with a null `paddle_subscription_id` is the `status='free'` default:
  // real in our table, absent from Paddle, nothing to cancel. Deleting the row
  // is the cascade's job, not this module's.
  const subscriptionIds = rows
    .map((row) => row.paddle_subscription_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (subscriptionIds.length === 0) {
    return { ok: true, outcome: 'no-paddle-subscription', canceled: 0 };
  }

  // Sequential on purpose. Cancellation is irreversible, so the first failure
  // must stop the rest, and a concurrent version could not report honestly how
  // many had already taken effect.
  let canceled = 0;
  for (const subscriptionId of subscriptionIds) {
    const failure = await cancelAndVerify(paddle, subscriptionId);
    if (failure) {
      return { ok: false, reason: failure, canceled };
    }
    canceled += 1;
  }

  return { ok: true, outcome: 'canceled', canceled };
}
