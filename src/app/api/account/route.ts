import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { paddleClient } from '@/lib/paddle';
import { deleteAccount, deletionFailed } from '@/lib/account-deletion/orchestrate';

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
  try {
    const body = await request.json();
    confirmation = body?.confirmEmail;
  } catch {
    return NextResponse.json({ error: 'ConfirmationRequired' }, { status: 400 });
  }

  // Case-insensitive and trimmed: the address is a confirmation gesture, not a
  // credential, and failing a user for capitalisation would push them toward
  // pasting rather than reading. The comparison is still exact on content.
  const typed = typeof confirmation === 'string' ? confirmation.trim().toLowerCase() : '';
  if (!typed || typed !== user.email.trim().toLowerCase()) {
    return NextResponse.json({ error: 'ConfirmationMismatch' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await deleteAccount(admin, paddleClient, user.id, user.email);

  if (!deletionFailed(result)) {
    return NextResponse.json(
      { deleted: true, storageDeleted: result.storageDeleted },
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

  // Every other stage aborted before anything irreversible was attempted, so
  // retrying is safe and is the right advice.
  return NextResponse.json(
    { error: 'DeletionFailed', stage: result.stage },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  );
}
