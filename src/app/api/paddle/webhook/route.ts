import { NextRequest, NextResponse } from 'next/server';
import { paddleClient } from '@/lib/paddle';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Statuses that grant Pro (B3, Option A). Mirrors the entitling subset on the
 * read side (src/lib/entitlement.ts) MINUS the legacy 'pro' value: we no longer
 * WRITE 'pro' — we persist Paddle's own status verbatim and let getEntitlement
 * derive the tier. 'past_due' is entitling on purpose so a single failed charge
 * doesn't lock the user out; access continues through the grace window until
 * current_period_end, which getEntitlement enforces with its expiry check.
 */
const ENTITLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const rawBody = await request.text();
  const signature = request.headers.get('paddle-signature') ?? '';

  try {
    const event = await paddleClient.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET!,
      signature
    );

    switch (event.eventType) {
      // One faithful sync for every subscription lifecycle event. Rather than
      // branching per event, we mirror Paddle's current status + period end
      // into our row and let getEntitlement decide the tier (Option A). This is
      // more robust than per-event logic: a transition we don't special-case
      // still lands correctly, and a missed 'created' self-heals on the next
      // 'updated'. The shared block also gives us discriminated-union narrowing
      // on event.data across all these cases.
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.trialing':
      case 'subscription.past_due':
      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.canceled': {
        const sub = event.data;
        const status = sub.status; // faithful Paddle status, not the legacy 'pro'
        const periodEnd = sub.currentBillingPeriod?.endsAt ?? null;
        const userId = sub.customData?.user_id;

        // HARD OBLIGATION (registered after S1): it must be impossible to persist
        // an entitling row without a known expiry. If Paddle ever hands us an
        // entitling status with no current_period_end, refuse the write and 400
        // so it is retried and surfaced — never write a Pro row that would grant
        // unbounded access. A paying user briefly resolving to free is the safe,
        // self-correcting failure; an expiry-less Pro row is not.
        if (ENTITLING_STATUSES.has(status) && !periodEnd) {
          console.error(
            'Paddle webhook: refusing entitling subscription row without current_period_end',
            { subscriptionId: sub.id, eventType: event.eventType, status }
          );
          return NextResponse.json(
            { error: 'Entitling subscription missing current_period_end' },
            { status: 400 }
          );
        }

        const row = {
          status,
          current_period_end: periodEnd,
          paddle_customer_id: sub.customerId,
          updated_at: new Date().toISOString(),
        };

        if (userId) {
          // Upsert keyed on the UNIQUE paddle_subscription_id: inserts on the
          // first event for this subscription, updates it thereafter. user_id
          // (NOT NULL) comes from customData, which Paddle persists on the
          // subscription and replays on every subsequent event.
          await supabase.from('subscriptions').upsert(
            { user_id: userId, paddle_subscription_id: sub.id, ...row },
            { onConflict: 'paddle_subscription_id' }
          );
        } else {
          // No customData (not expected for subscriptions we create): update an
          // existing row by subscription id rather than inserting one we cannot
          // attribute to a user (user_id is NOT NULL).
          await supabase
            .from('subscriptions')
            .update(row)
            .eq('paddle_subscription_id', sub.id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }
}
