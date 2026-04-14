import { NextRequest, NextResponse } from 'next/server';
import { paddleClient } from '@/lib/paddle';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('paddle-signature') ?? '';

  try {
    const event = await paddleClient.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET!,
      signature
    );

    switch (event.eventType) {
      case 'subscription.created': {
        const userId = event.data.customData?.user_id;
        if (userId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            paddle_subscription_id: event.data.id,
            paddle_customer_id: event.data.customerId,
            status: 'pro',
            current_period_end: event.data.currentBillingPeriod?.endsAt
          });
        }
        break;
      }
      case 'subscription.canceled': {
        await supabase
          .from('subscriptions')
          .update({ status: 'free' })
          .eq('paddle_subscription_id', event.data.id);
        break;
      }
      case 'subscription.updated': {
        await supabase
          .from('subscriptions')
          .update({ current_period_end: event.data.currentBillingPeriod?.endsAt })
          .eq('paddle_subscription_id', event.data.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }
}
