import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { paddleClient } from '@/lib/paddle';
import { classifyCheckoutFailure, newCheckoutReference } from '@/lib/paddle-errors';

/**
 * Start a Paddle checkout for the signed-in user.
 *
 * WHAT CHANGED, AND WHY IT MATTERED (register #72b). This handler used to end in
 * one `catch` that logged the raw error and returned
 * `{ error: 'Internal Server Error' }` with a 500 for every cause. Paddle sends
 * a precise code, a human detail and a documentation link on every failure, and
 * all of it was flattened into a string the user could not act on and a log line
 * that named no code and no status. A wrong price id, a rejected credential and
 * a dead network were one outcome.
 *
 * See `src/lib/paddle-errors.ts` for the classification and for the argument
 * about which half of the truth goes to the screen and which to the log.
 */
export async function POST() {
  const reference = newCheckoutReference();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Checked here rather than left to `!`. An unset PADDLE_PRO_PRICE_ID used to
    // send `priceId: undefined` to Paddle and come back as a generic 500; it is
    // the single most likely failure on a fresh deploy, and it is OUR
    // configuration, knowable without asking Paddle at all.
    const priceId = process.env.PADDLE_PRO_PRICE_ID;
    if (!priceId) {
      console.error('checkout failed', {
        reference,
        userId: user.id,
        kind: 'configuration',
        message: 'PADDLE_PRO_PRICE_ID is not set; no checkout can be created.',
      });
      return NextResponse.json(
        { error: 'checkout_misconfigured', reference, retryable: false },
        { status: 500 }
      );
    }

    const transaction = await paddleClient.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: { user_id: user.id },
    });

    return NextResponse.json({ transactionId: transaction.id });
  } catch (error) {
    const failure = classifyCheckoutFailure(error);

    // The operator's half: everything Paddle said, including the code and the
    // documentation link, joined to the reference the user can quote back.
    console.error('checkout failed', { reference, ...failure.log });

    // The user's half: a stable code the client translates, and the one bit
    // that is actually actionable.
    return NextResponse.json(
      { error: failure.code, reference, retryable: failure.retryable },
      { status: failure.status }
    );
  }
}
