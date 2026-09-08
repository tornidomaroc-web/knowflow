import { NextResponse, type NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

/**
 * OAuth return leg.
 *
 * Lives under /api on purpose: the middleware matcher excludes `api`, so this
 * path is the only one that is NOT rewritten to /<locale>/... on the way in.
 * The registered Supabase redirect URL is this exact path.
 *
 * @supabase/ssr pins flowType: 'pkce', so the provider hands back a `code` that
 * is worthless to the browser — it has to be exchanged server-side, against the
 * same cookie jar that holds the verifier written at initiation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // GoTrue redirects here with error params when it refuses to complete the
  // sign-in itself — including when a trigger on auth.users raises during user
  // creation. That arm never carries a `code`, so it must be read first.
  const providerError = searchParams.get('error');
  if (providerError) {
    const detail = {
      stage: 'provider',
      error: providerError,
      error_code: searchParams.get('error_code'),
      error_description: searchParams.get('error_description'),
    };
    console.error('[auth/callback] provider refused', detail);
    return NextResponse.redirect(failureUrl(origin, detail));
  }

  const code = searchParams.get('code');
  if (!code) {
    const detail = { stage: 'callback', error: 'missing_code', error_description: 'No code and no error on the callback URL.' };
    console.error('[auth/callback] nothing to exchange', detail);
    return NextResponse.redirect(failureUrl(origin, detail));
  }

  const { supabase, applyCookies } = createRouteClient(request);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const detail = {
      stage: 'exchange',
      error: error.name,
      error_code: error.code ?? String(error.status ?? ''),
      error_description: error.message,
    };
    console.error('[auth/callback] exchange failed', detail);
    return applyCookies(NextResponse.redirect(failureUrl(origin, detail)));
  }

  console.log('[auth/callback] exchange ok', {
    user_id: data.user?.id,
    identities: data.user?.identities?.map((i) => i.provider),
    providers: data.user?.app_metadata?.providers,
  });

  // No locale prefix on purpose. This route never sees one (the matcher skips
  // /api), and /dashboard bounces through the i18n hop, which picks the locale
  // from the same Accept-Language rule every other entry point uses.
  return applyCookies(NextResponse.redirect(`${origin}/dashboard`));
}

function failureUrl(origin: string, detail: Record<string, string | null | undefined>) {
  const url = new URL('/login', origin);
  Object.entries(detail).forEach(([k, v]) => {
    if (v) url.searchParams.set(k === 'stage' ? 'auth_stage' : k, v);
  });
  return url;
}
