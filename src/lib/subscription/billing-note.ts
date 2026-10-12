import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../supabase/database.types';

/**
 * WHETHER THE DELETE CARD'S BILLING LINE IS TRUE FOR THIS ACCOUNT (Step
 * Wording-1, Apple 3.1.3(f)).
 *
 * "If you have an active subscription, it is cancelled immediately" is
 * information only for an account that has one, and inside the app it is the
 * only place a free student would read the word. So it is shown exactly when
 * deletion would cancel something: a row carrying a Paddle subscription id
 * that is not already `canceled`, the same rows src/lib/account-deletion/
 * paddle.ts cancels (whatever their status: active, trialing, past_due,
 * paused). The `status='free'` default row has no Paddle id and does not count.
 *
 * Read with the student's own client (RLS: own rows only), the way
 * src/lib/entitlement.ts reads the same table. A failed read SHOWS the line:
 * hiding true billing information because a read failed would be the
 * dishonest error, and deletion itself refuses when billing cannot be read.
 */
export async function deletionWouldCancelBilling(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, paddle_subscription_id')
    .eq('user_id', userId);
  if (error || !data) return true;
  return data.some((row) => !!row.paddle_subscription_id && row.status !== 'canceled');
}
