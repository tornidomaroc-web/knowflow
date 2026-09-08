import { NextResponse, type NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

/**
 * TEST HARNESS, NOT A FEATURE. Read-only, and deliberately least-privilege.
 *
 * The question this run answers is whether a Google sign-in LINKS to the
 * existing password user or CREATES a second one. Answering it means reading
 * auth.users and profiles — and the standing constraint is that no real user's
 * row may be read. So this reads through the signed-in user's own session, not
 * a service key: `getUser` is verified server-side against GoTrue, and the
 * profiles select runs under `using (auth.uid() = id)`. It is structurally
 * incapable of returning anybody else's row. No tokens are echoed.
 *
 * Delete before merge.
 */
export async function GET(request: NextRequest) {
  const { supabase, applyCookies } = createRouteClient(request);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return applyCookies(
      NextResponse.json(
        { signed_in: false, error: userError?.message ?? 'no user', status: userError?.status ?? null },
        { status: 200 }
      )
    );
  }

  const user = userData.user;
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, created_at')
    .eq('id', user.id);

  return applyCookies(
    NextResponse.json({
      signed_in: true,
      auth_users_row: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        app_metadata: user.app_metadata,
        identities: (user.identities ?? []).map((i) => ({
          provider: i.provider,
          identity_id: i.identity_id,
          user_id: i.user_id,
          email: (i.identity_data as { email?: string } | undefined)?.email ?? null,
          created_at: i.created_at,
          last_sign_in_at: i.last_sign_in_at,
        })),
      },
      profiles_rows_visible_to_this_user: profiles,
      profiles_error: profileError?.message ?? null,
    })
  );
}
