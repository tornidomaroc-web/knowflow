import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { paddleClient } from '@/lib/paddle';
import { deleteAccount, deletionFailed } from '@/lib/account-deletion/orchestrate';
import { appleIdentitySub, exchangeAppleCode, revokeAppleToken, type AppleExchange, type AppleRevokeOutcome } from '@/lib/auth/apple-revoke';

/**
 * DELETE /api/account — destroy the signed-in user's account and everything
 * beneath it. Register #61(b); Apple 5.1.1(v) and Google Play both require it.
 *
 * WHAT THIS REQUIRES OF THE CALLER, AND WHY EACH PART IS THERE.
 *
 *   1. A valid session. The user id and the email BOTH come from
 *      `auth.getUser()` and NEVER from the request body. A body-supplied id
 *      would make this an "delete any account" endpoint behind a typo.
 *   2. A typed confirmation that matches the session's own email, compared
 *      SERVER-SIDE. The client is not trusted to have done the comparison.
 *
 * THIS IS NOT RECOVERABLE. There is no soft-delete, no grace period and no
 * undo. The cascade destroys profiles, knowledge_bases, documents, chunks,
 * conversations, messages, quizzes, quiz_items, study_events, usage_counters and
 * subscriptions; the storage sweep destroys the uploaded files; the Paddle
 * cancellation is not reversible by API. Nothing in this repository establishes
 * a verified restore path, so none is assumed. The typed-email confirmation
 * exists because the action is unrecoverable, not because it is unusual.
 *
 *   3. OR, FOR AN ACCOUNT WITH AN APPLE IDENTITY ONLY, a fresh Apple
 *      authorization code in place of the typed email (Sign in with Apple,
 *      item 4f; the owner's addition to the study). A student who hid their
 *      email cannot reasonably type a random privaterelay address. The code is
 *      exchanged with Apple BEFORE anything is deleted, and it confirms only
 *      if the returned id_token's `sub` is this session's own Apple identity
 *      (src/lib/auth/apple-revoke.ts). Any failure (another Apple ID, an
 *      expired or used code, the key not configured, Apple not answering)
 *      refuses with `AppleConfirmationFailed` and deletes nothing; the card
 *      then asks for the typed email, which stays valid for everyone.
 *
 * AN ACCOUNT WITHOUT AN APPLE IDENTITY GETS EXACTLY TODAY'S ROUTE: the same
 * checks, the same bytes on every arm, and an Apple code in its body is never
 * looked at (scripts/verify-apple-signin.mjs, section 5a, holds every arm to
 * main's bytes).
 *
 * APPLE'S TOKEN IS REVOKED ONLY AFTER A SUCCESSFUL DELETION, with the refresh
 * token the confirming exchange returned; nothing is stored. If the account
 * survives (any failure arm), nothing is revoked. The response of an Apple
 * account gains `appleRevoke` so the card can tell the student to remove
 * KnowFlow in their iPhone settings when Apple's access was not ended.
 *
 * The service-role client is used deliberately: `auth.admin.deleteUser` is not
 * reachable with an anon key, and the storage sweep must enumerate a prefix RLS
 * would hide. Both are scoped to the session's OWN id, which is why that id must
 * not be attacker-controlled.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let confirmation: unknown;
  let appleCode: unknown;
  let appleNonce: unknown;
  try {
    const body = await request.json();
    confirmation = body?.confirmEmail;
    appleCode = body?.appleAuthorizationCode;
    appleNonce = body?.appleNonce;
  } catch {
    return NextResponse.json({ error: 'ConfirmationRequired' }, { status: 400 });
  }

  // Read from the session's own user, never the body: null for every account
  // without an Apple identity, and then nothing below touches Apple.
  const appleSub = appleIdentitySub(user);

  // Case-insensitive and trimmed: the address is a confirmation gesture, not a
  // credential, and failing a user for capitalisation would push them toward
  // pasting rather than reading. The comparison is still exact on content.
  const typed = typeof confirmation === 'string' ? confirmation.trim().toLowerCase() : '';
  const emailConfirmed = !!typed && typed === user.email.trim().toLowerCase();

  // The exchange runs BEFORE the deletion: it is the confirmation itself, and
  // its refresh token is what is revoked once the account is gone.
  let apple: AppleExchange | null = null;
  if (appleSub !== null && typeof appleCode === 'string' && appleCode !== '') {
    apple = await exchangeAppleCode({ code: appleCode, expectedSub: appleSub, rawNonce: typeof appleNonce === 'string' ? appleNonce : null });
    if ('reason' in apple) console.error(`[apple-confirm] user=${user.id} outcome=${apple.reason} status=${apple.status ?? '-'}`);
  }

  const appleConfirmed = apple !== null && 'sub' in apple;
  if (!emailConfirmed && !appleConfirmed) {
    if (apple) {
      return NextResponse.json({ error: 'AppleConfirmationFailed' }, { status: 400 });
    }
    return NextResponse.json({ error: 'ConfirmationMismatch' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await deleteAccount(admin, paddleClient, user.id, user.email);

  if (!deletionFailed(result)) {
    if (appleSub === null) {
      return NextResponse.json(
        { deleted: true, storageDeleted: result.storageDeleted },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    // The account is gone; now end KnowFlow's access to the Apple Account.
    // Deletion stands on every outcome: Apple's answer is reported, not obeyed.
    let appleRevoke: AppleRevokeOutcome = 'skipped';
    let status: number | null = null;
    if (apple !== null && 'sub' in apple) {
      const token = apple.refreshToken ?? apple.accessToken;
      if (token) {
        const r = await revokeAppleToken({ token, hint: apple.refreshToken ? 'refresh_token' : 'access_token' });
        appleRevoke = r.outcome;
        status = r.status;
      } else {
        appleRevoke = 'failed';
      }
    } else if (apple !== null && 'reason' in apple) {
      appleRevoke = apple.reason === 'mismatch' ? 'mismatch' : 'failed';
    }
    console.log(`[apple-revoke] user=${user.id} outcome=${appleRevoke} status=${status ?? '-'}`);
    return NextResponse.json(
      { deleted: true, storageDeleted: result.storageDeleted, appleRevoke },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // THE ACCEPTED STATE gets its own status and its own code. It is not a 500:
  // a 500 invites "try again", and trying again would attempt to cancel a
  // subscription that is already cancelled while the account still stands.
  if (result.stage === 'orphaned') {
    return NextResponse.json(
      { error: 'BillingCanceledAccountIntact', stage: result.stage },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // PERMANENT, NOT TRANSIENT, SO "TRY AGAIN" WOULD BE FALSE ADVICE. Billing we
  // cannot reach will still be unreachable on the next attempt. 409 rather than
  // 500 for the same reason the orphan arm uses one: this is a state, not a
  // fault. The account is untouched and the customer holds the control that
  // clears it.
  if (result.stage === 'billing-unverifiable') {
    return NextResponse.json(
      { error: 'SubscriptionNotCancellableHere', stage: result.stage },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Every other stage aborted before anything irreversible was attempted, so
  // retrying is safe and is the right advice.
  return NextResponse.json(
    { error: 'DeletionFailed', stage: result.stage },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  );
}
