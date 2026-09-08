import { NextResponse, type NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

/**
 * TEST HARNESS, NOT A FEATURE.
 *
 * The sign-in buttons are deliberately not built in this run. Something still
 * has to start the flow, and it cannot be a hand-written authorize URL: PKCE
 * means the code_verifier must be generated and stored in the cookie jar that
 * /api/auth/callback will later read. signInWithOAuth on a server client does
 * exactly that and returns the URL instead of navigating, because there is no
 * window here. Delete this route, or gate it, before the real buttons ship.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const { supabase, applyCookies } = createRouteClient(request);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/api/auth/callback` },
  });

  if (error || !data?.url) {
    console.error('[auth/signin/google] could not build authorize URL', error);
    return NextResponse.json(
      { error: error?.message ?? 'no url returned', status: error?.status ?? null },
      { status: 500 }
    );
  }

  console.log('[auth/signin/google] authorize url', data.url);
  return applyCookies(NextResponse.redirect(data.url));
}
