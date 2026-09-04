import type { SupabaseClient } from '@supabase/supabase-js';
import type { Paddle } from '@paddle/paddle-node-sdk';
import { sweepUserStorage, type SweepResult } from './storage';
import { cancelUserSubscriptions, type CancelResult } from './paddle';
import { recordDeletionOrphan } from './orphan-record';

/**
 * Account deletion, ordered so that everything that can fail happens BEFORE the
 * one act that cannot be undone.
 *
 * THE ORDERING IS THE DESIGN. Read this before changing a line of it.
 *
 *   1. sweep storage        -- fallible, reversible-in-effect, ABORTS on failure
 *   2. erase waitlist row   -- fallible, ABORTS on failure
 *   3. cancel Paddle        -- IRREVERSIBLE BOUNDARY
 *   4. delete auth.users    -- one statement; the cascade does the rest
 *
 * WHY THE SWEEP RUNS FIRST, AND NOT AFTER THE CANCEL. `./storage.ts` states its
 * own contract: the caller must abort on `ok: false` and must not delete the
 * user row, because the `{user_id}/...` prefix is the ONLY handle anything has
 * on those objects -- no table references them. Deleting the user first turns
 * every surviving file into orphaned personal data findable only by scanning the
 * bucket for a UUID that exists nowhere else. Running the sweep before the
 * Paddle call means a sweep failure costs NOTHING: no subscription cancelled, no
 * row deleted, nothing irreversible attempted. The user retries.
 *
 * WHY PADDLE IS CANCELLED BEFORE THE ROW IS DELETED, AND NOT AFTER.
 * `subscriptions.user_id` is `ON DELETE CASCADE` from `auth.users`, so the
 * Paddle subscription id is destroyed by the same statement that deletes the
 * account. Delete first and the subscription can NEVER be cancelled -- the user
 * is billed indefinitely with no record left to cancel against, and nothing
 * surfaces it. That is the invisible, unbounded failure. Cancelling first trades
 * it for a visible, bounded one, described next.
 *
 * THE ACCEPTED FAILURE STATE, STATED RATHER THAN DISCOVERED.
 * If step 3 succeeds and step 4 fails, the user has a CANCELLED SUBSCRIPTION AND
 * AN INTACT ACCOUNT. They keep every byte of their data and lose what they paid
 * for. No code here can undo it: Paddle cancellation is not reversible by API,
 * and this route cannot recreate a subscription on the original billing terms.
 *
 * This is deliberate and it is the smaller harm. It is also why the window is
 * one statement wide: after the cancel there is exactly one call left, and it is
 * atomic. Both arms below now leave THREE traces, in this order and for these
 * reasons: the `[account-deletion-orphan]` log line, which fires FIRST and
 * unconditionally so that nothing can regress what was already there; then an
 * awaited `recordDeletionOrphan`, which writes the durable row register #54 was
 * opened for and CANNOT throw or hang, so the trace can never damage the
 * handling; then a response that names the state to the user precisely, in their
 * own language, so the report reaching the operator is a work order rather than a
 * mystery.
 *
 * THE AWAIT IS LOAD-BEARING. A floating promise here would be dropped when the
 * serverless invocation is frozen or torn down at the end of the handler -- this
 * project has already recorded that outcome once (P5.2: an agent emit lost on
 * teardown). `orphan-record.ts` bounds the write at five seconds precisely so
 * that awaiting it is affordable on a path that is already returning a 409.
 *
 * WHAT IS NOT VERIFIED HERE, STATED SO NOBODY HAS TO INFER IT. Reaching either
 * arm requires fault injection, which was refused. The recorder is proven against
 * the live table; that THESE TWO LINES call it is verified by inspection and by
 * `scripts/verify-orphan-call-sites.py`, which is a static check and executes
 * nothing. Neither closes the gap.
 */

/** Discriminated the same way as `SweepResult` and `CancelResult`, deliberately. */
export type DeletionResult =
  | { ok: true; storageDeleted: number; subscriptionsCanceled: number; waitlistRemoved: number }
  /** Nothing irreversible was attempted. The account is exactly as it was. */
  | { ok: false; stage: 'storage' | 'waitlist' | 'billing'; reason: string }
  /**
   * THE ACCEPTED STATE. Billing is cancelled and the account still exists.
   * Callers MUST surface this distinctly -- it is not a generic failure and the
   * user must not be told to simply try again as though nothing had happened.
   */
  | { ok: false; stage: 'orphaned'; reason: string; subscriptionsCanceled: number };

/**
 * Explicit type predicates rather than `if (!result.ok)`.
 *
 * `tsconfig` sets `strict: false` (register #41), so `strictNullChecks` is off
 * and TypeScript does NOT narrow a discriminated union on a boolean discriminant
 * in that mode -- `sweep.reason` after `if (!sweep.ok)` is a compile error, not a
 * safe access. A predicate narrows regardless of the flag. The alternative,
 * loosening the shipped `SweepResult`/`CancelResult` shapes so every field is
 * optional everywhere, would trade a real guarantee for a syntactic convenience.
 */
function sweepFailed(r: SweepResult): r is Extract<SweepResult, { ok: false }> {
  return !r.ok;
}

function cancelFailed(r: CancelResult): r is Extract<CancelResult, { ok: false }> {
  return !r.ok;
}

/** Same reason. Exported because the route has to branch on the stage. */
export function deletionFailed(
  r: DeletionResult
): r is Extract<DeletionResult, { ok: false }> {
  return !r.ok;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteAccount(
  admin: SupabaseClient,
  paddle: Paddle,
  userId: string,
  email: string
): Promise<DeletionResult> {
  // Defence in depth. The caller derives this from the session, never from the
  // request body, but `sweepUserStorage` widens its prefix on a non-UUID and the
  // cost of being wrong here is other users' files.
  if (!UUID_RE.test(userId)) {
    return { ok: false, stage: 'storage', reason: 'userId is not a UUID' };
  }

  // ---- 1. Storage. Abort on failure; nothing irreversible has happened. ----
  const sweep = await sweepUserStorage(admin, userId);
  if (sweepFailed(sweep)) {
    console.error(
      `[account-deletion-sweep-incomplete] user=${userId} stage=precondition ` +
        `reason=${sweep.reason} remaining=${sweep.remaining ?? 'unknown'}`
    );
    return { ok: false, stage: 'storage', reason: sweep.reason };
  }

  // ---- 2. Waitlist. Erased by email BEFORE the account, because the email is
  // the only handle: `waitlist` has no `user_id` and no foreign key, so no
  // cascade reaches it and after step 4 nothing links the address to anything.
  // Erasing it here also means a failure aborts while that is still free.
  const { error: waitlistError, count: waitlistRemoved } = await admin
    .from('waitlist')
    .delete({ count: 'exact' })
    .eq('email', email);

  if (waitlistError) {
    return { ok: false, stage: 'waitlist', reason: waitlistError.message };
  }

  // ---- 3. Billing. IRREVERSIBLE FROM HERE. ----
  const cancel = await cancelUserSubscriptions(admin, paddle, userId);
  if (cancelFailed(cancel)) {
    // `canceled` can be non-zero on this arm: cancelling two subscriptions is
    // not atomic, so the first may have taken effect before the second failed.
    // That is the orphaned state even though the account delete never ran.
    if (cancel.canceled > 0) {
      console.error(
        `[account-deletion-orphan] user=${userId} email=${email} stage=billing-partial ` +
          `canceled=${cancel.canceled} reason=${cancel.reason}`
      );
      await recordDeletionOrphan(admin, {
        userId,
        email,
        stage: 'billing-partial',
        subscriptionsCanceled: cancel.canceled,
        reason: cancel.reason,
      });
      return {
        ok: false,
        stage: 'orphaned',
        reason: cancel.reason,
        subscriptionsCanceled: cancel.canceled,
      };
    }
    return { ok: false, stage: 'billing', reason: cancel.reason };
  }

  // ---- 4. The account. One statement; the cascade removes profiles,
  // knowledge_bases, documents, chunks, conversations, messages, quizzes,
  // quiz_items, study_events, usage_counters and subscriptions beneath it.
  // Verified live on 2026-08-29: five spine columns NOT NULL, six delete rules
  // CASCADE (register #62). ----
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    // THE ACCEPTED STATE. Everything the operator needs to act is on this line,
    // because there is nowhere durable to put it yet.
    console.error(
      `[account-deletion-orphan] user=${userId} email=${email} stage=account-delete ` +
        `canceled=${cancel.canceled} outcome=${cancel.outcome} reason=${deleteError.message}`
    );
    await recordDeletionOrphan(admin, {
      userId,
      email,
      stage: 'account-delete',
      subscriptionsCanceled: cancel.canceled,
      reason: deleteError.message,
    });
    return {
      ok: false,
      stage: 'orphaned',
      reason: deleteError.message,
      subscriptionsCanceled: cancel.canceled,
    };
  }

  // ---- Post-delete verification. The sweep ran before the cancel, so a file
  // uploaded in the interval would survive its owner. The window is one Paddle
  // call wide and cannot be closed without deleting the user first, which is the
  // worse trade. It is checked and logged rather than assumed away, and the
  // standing reconciliation query in docs/deletion-preflight-read.md finds any
  // that slip through. A failure here does NOT fail the request: the account is
  // already gone and the user's deletion did succeed. ----
  const survivors = await sweepUserStorage(admin, userId);
  if (sweepFailed(survivors)) {
    console.error(
      `[account-deletion-sweep-incomplete] user=${userId} stage=post-delete ` +
        `reason=${survivors.reason}`
    );
  } else if (survivors.deleted > 0) {
    console.error(
      `[account-deletion-sweep-incomplete] user=${userId} stage=post-delete ` +
        `detail=swept ${survivors.deleted} late object(s) uploaded after the precondition sweep`
    );
  }

  return {
    ok: true,
    storageDeleted: sweep.deleted,
    subscriptionsCanceled: cancel.canceled,
    waitlistRemoved: waitlistRemoved ?? 0,
  };
}
