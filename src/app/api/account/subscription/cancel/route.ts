import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { paddleClient } from '@/lib/paddle';
import {
  scheduleSubscriptionCancellation,
  cancelScheduleFailed,
} from '@/lib/subscription/cancel';

/**
 * POST /api/account/subscription/cancel — stop billing at the end of the period
 * the customer has already paid for. Register #70, issue #96.
 *
 * WHAT THIS IS NOT. It is not account deletion and it must never be confused
 * with it: nothing is destroyed, no data is touched, and the customer keeps
 * everything they have. Until this route existed, `DELETE /api/account` was the
 * ONLY way to stop being billed — a customer who wanted to keep their work had
 * no exit at all.
 *
 * WHY THERE IS NO TYPED CONFIRMATION, unlike the deletion route. That route
 * demands the session's own email typed back because deletion is unrecoverable:
 * there is no soft-delete, no grace period, no restore. Cancelling is
 * recoverable by resubscribing and destroys nothing, so the same ceremony would
 * MISLABEL A REVERSIBLE ACT AS AN IRREVERSIBLE ONE. Weight is a signal; spending
 * it here would devalue it there.
 *
 * The user id still comes from the session and NEVER from the body — the same
 * rule the deletion route states, for the same reason: a body-supplied id would
 * make this a "cancel anyone's subscription" endpoint behind a typo.
 *
 * THE SERVICE-ROLE CLIENT IS DELIBERATE. `subscriptions` grants exactly one RLS
 * policy, `FOR SELECT`, so a user-scoped client can read the row but the Paddle
 * key must never reach a browser regardless. The read is scoped to the session's
 * OWN id, which is why that id must not be attacker-controlled.
 *
 * NOTHING IS WRITTEN TO THE DATABASE HERE OR ANYWHERE DOWNSTREAM, AND THAT IS
 * THE DESIGN. `src/lib/subscription/cancel.ts` explains why at length: the row
 * already says `active` with a future `current_period_end`, which is exactly
 * what `getEntitlement` needs to keep the customer Pro for the time they paid
 * for, and to lapse them by the clock afterwards.
 */
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = await scheduleSubscriptionCancellation(admin, paddleClient, user.id);

  if (cancelScheduleFailed(result)) {
    // A failure here costs nothing irreversible — no account was destroyed and
    // no data was touched — so this is a plain retryable error, not the
    // deletion route's carefully distinguished 409. The reason is logged for an
    // operator and NOT returned: it carries Paddle subscription ids.
    console.error(
      `[subscription-cancel-failed] user=${user.id} scheduled=${result.scheduled} reason=${result.reason}`
    );
    return NextResponse.json(
      { error: 'CancelFailed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // `nothing-to-cancel` is a success, not an error: it is the state of every
  // free user. The card is only rendered for Pro, so reaching it means the row
  // changed between render and click — the customer is not billed either way,
  // which is what they asked for.
  return NextResponse.json(
    { canceled: true, outcome: result.outcome, effectiveAt: result.effectiveAt },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
