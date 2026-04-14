import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { paddleClient } from '@/lib/paddle';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transaction = await paddleClient.transactions.create({
      items: [{ priceId: process.env.PADDLE_PRO_PRICE_ID!, quantity: 1 }],
      customData: { user_id: user.id }
    });

    return NextResponse.json({ checkoutUrl: transaction.checkout?.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
