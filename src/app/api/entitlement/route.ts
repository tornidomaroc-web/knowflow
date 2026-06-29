import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/entitlement';

/**
 * GET /api/entitlement — resolve the logged-in user's billing entitlement.
 *
 * Thin auth wrapper over getEntitlement() (S1): it does not derive tier itself,
 * so the entitlement rule stays in one place. The read is RLS-scoped, so a user
 * can only ever resolve their own entitlement.
 *
 * Always responds no-store: entitlement can change the instant a Paddle webhook
 * lands, so a cached "pro"/"free" answer would be a correctness bug.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitlement = await getEntitlement(user.id);

  return NextResponse.json(entitlement, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
