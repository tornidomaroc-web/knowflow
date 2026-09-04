import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The WRITER for register #54's durable half: one row into
 * `public.account_deletion_orphans` per account-deletion orphan.
 *
 * The store landed first (`supabase/migrations/20260904_account_deletion_orphans.sql`,
 * applied to production and read back live, nine rows). This is the half that
 * puts something in it. `.github/workflows/deletion-orphan-watch.yml` is the
 * half that reads it. Until all three exist an orphan produces what it has
 * always produced: a `console.error` in a function log nobody reads.
 *
 *
 * THIS FUNCTION CANNOT THROW, AND THAT IS THE WHOLE POINT OF IT
 * ------------------------------------------------------------
 * Both call sites sit AFTER the irreversible boundary in `orchestrate.ts` --
 * line 130, where one Paddle subscription is already cancelled and a second
 * failed, and line 155, where the cancel succeeded and `auth.admin.deleteUser`
 * did not. In both, the user's billing is gone and their account is intact. The
 * arm's job from there is to return `stage: 'orphaned'` so the route can answer
 * 409 `BillingCanceledAccountIntact` and name the state to the user.
 *
 * If this function could throw, that rejection would propagate out of the arm
 * and the route would answer 500 instead. The user would be told to try again,
 * against an account whose subscription is already cancelled. So the failure of
 * the TRACE would corrupt the HANDLING of the incident it was written to record
 * -- a recorded incident converted into an unrecorded one plus a worse outcome.
 *
 * The migration file already made the SCHEMA unable to raise, deliberately, and
 * says why: it has no NOT NULL beyond `id` and `occurred_at`, no CHECK on
 * `stage`, and no foreign key, because "an INSERT that raises converts a
 * recorded incident into a silent one". That hardening lives entirely in
 * Postgres. If this wrapper can raise, the hardening is defeated one layer up
 * and register #54's founding failure mode -- a fault invisible at every layer
 * at once -- is rebuilt inside its own fix.
 *
 * Hence: every path is caught. A returned PostgREST `error`, a thrown fetch
 * rejection, an abort, a malformed response -- all become a log line and a
 * normal return. There is no signature by which a caller could branch on
 * failure even if it wanted to, which is why the return type is `void` and not
 * `boolean`. A boolean invites an `if`, and an `if` after the irreversible
 * boundary is a new way to fail.
 *
 *
 * IT CANNOT HANG EITHER
 * ---------------------
 * A `void` return is not enough on its own. `supabase-js` sets no request
 * timeout, so an unreachable or wedged PostgREST leaves the insert pending and
 * the route awaiting it until the platform kills the invocation. The user then
 * gets a gateway error instead of the 409 that names their state -- the same
 * damage as a throw, arriving more slowly. `AbortSignal.timeout` bounds it.
 *
 * The bound is deliberately short. Nothing downstream is waiting on this row;
 * the operator reads it minutes to hours later. Spending more than a few
 * seconds of a user-facing request on a best-effort audit write is the wrong
 * trade in every direction.
 *
 * No retry, and this is a decision rather than an omission. `postgrest-js`
 * retries only GET/HEAD/OPTIONS, so this POST is attempted exactly once by the
 * client and nothing here adds a loop on top. A retry would multiply the very
 * latency the timeout exists to bound, and the console line below survives
 * regardless -- so a retry buys a slightly better chance at the durable copy at
 * the cost of the request that is still trying to answer the user.
 *
 *
 * THE CONSOLE LINE IS NOT THIS FUNCTION'S JOB
 * -------------------------------------------
 * The `[account-deletion-orphan]` incident line stays at the CALL SITES and
 * fires FIRST, before this is ever called. The table is added BESIDE that line
 * and never in place of it: if this write dies, the Vercel log is exactly what
 * it is today and no regression is possible. What this function logs is only
 * its OWN failure, under a distinct tag -- `[account-deletion-orphan-record-failed]`
 * -- so "we had an orphan" and "we also failed to record it durably" are two
 * greppable facts and not one ambiguous one.
 */

/**
 * Short on purpose. See "IT CANNOT HANG EITHER" above. Exported so the
 * verification harness asserts against the real value rather than a copy of it.
 */
export const ORPHAN_INSERT_TIMEOUT_MS = 5_000;

export type OrphanRecord = {
  userId: string;
  /**
   * Nullable, and the column comment says why it is retained at all: the
   * deletion did NOT complete, so this is the record of an incomplete erasure
   * rather than data kept after a successful one. The operator NULLs it when
   * setting `resolved_at`.
   */
  email: string | null;
  /**
   * `'billing-partial'` (orchestrate.ts:130) or `'account-delete'` (:155).
   * Deliberately a bare `string`: the column has no CHECK constraint for the
   * reason given above, and a union here would put back at the type layer the
   * failure the schema layer just removed -- a future third arm passing an
   * unrecognised stage must write an odd row, not fail to write one.
   */
  stage: string;
  subscriptionsCanceled: number;
  reason: string;
};

export async function recordDeletionOrphan(
  admin: SupabaseClient,
  orphan: OrphanRecord
): Promise<void> {
  try {
    const { error } = await admin
      .from('account_deletion_orphans')
      .insert({
        user_id: orphan.userId,
        email: orphan.email,
        stage: orphan.stage,
        subscriptions_canceled: orphan.subscriptionsCanceled,
        reason: orphan.reason,
      })
      .abortSignal(AbortSignal.timeout(ORPHAN_INSERT_TIMEOUT_MS));

    if (error) {
      console.error(
        `[account-deletion-orphan-record-failed] user=${orphan.userId} ` +
          `stage=${orphan.stage} reason=${error.message}`
      );
    }
  } catch (caught) {
    // Rejections, aborts, and anything else the client can produce. The catch
    // is unconditional on purpose: a narrower one is a list of the failures
    // somebody thought of.
    console.error(
      `[account-deletion-orphan-record-failed] user=${orphan.userId} ` +
        `stage=${orphan.stage} reason=${caught instanceof Error ? caught.message : String(caught)}`
    );
  }
}
