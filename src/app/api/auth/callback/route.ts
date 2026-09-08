import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createRouteClient } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

/**
 * The one place a mail link or a provider comes back to.
 *
 * Lives under /api on purpose: the middleware matcher excludes `api`, so this
 * is the only path NOT rewritten to /<locale>/... on the way in. It is also
 * already on the project's redirect allow-list for both origins, which is why
 * signup points `emailRedirectTo` here rather than at a new path that would
 * need a dashboard change to be reachable at all.
 *
 * @supabase/ssr pins flowType 'pkce', so a `code` is worthless to the browser
 * and has to be exchanged server-side against the jar holding the verifier.
 */

// verifyOtp takes a narrow union. Anything outside it is refused rather than
// forwarded, so a hand-edited link cannot steer the call.
const OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // 1. GoTrue refused before handing us anything. Note this arm cannot catch an
  //    expired MAIL link: /verify drops those on the Site URL with the reason in
  //    a hash fragment, which is never sent to a server. Measured, not assumed.
  const providerError = searchParams.get('error');
  if (providerError) {
    const detail = {
      stage: 'provider',
      error: providerError,
      error_code: searchParams.get('error_code'),
      error_description: searchParams.get('error_description'),
    };
    console.error('[auth/callback] provider refused', detail);
    return NextResponse.redirect(loginWith(origin, 'signin_required', detail));
  }

  // 2. Hashed OTP. This arm needs no PKCE verifier, so it still works when the
  //    mail is opened on a different device from the one that signed up, which
  //    is the ordinary case for someone who signs up on a laptop and reads mail
  //    on a phone.
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  if (tokenHash && rawType) {
    if (!OTP_TYPES.includes(rawType as EmailOtpType)) {
      console.error('[auth/callback] unknown otp type', { type: rawType });
      return NextResponse.redirect(loginWith(origin, 'link_expired'));
    }
    const { supabase, applyCookies } = createRouteClient(request);
    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      console.error('[auth/callback] verifyOtp failed', {
        type: rawType,
        error_code: error.code ?? String(error.status ?? ''),
        error_description: error.message,
      });
      return NextResponse.redirect(loginWith(origin, 'link_expired'));
    }
    console.log('[auth/callback] verifyOtp ok', { type: rawType });
    return applyCookies(NextResponse.redirect(`${origin}/dashboard`));
  }

  // 3. PKCE code: a provider return, or a mail link opened on the same device.
  const code = searchParams.get('code');
  if (!code) {
    console.error('[auth/callback] nothing to exchange');
    return NextResponse.redirect(loginWith(origin, 'signin_required'));
  }

  const { supabase, applyCookies } = createRouteClient(request);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The two ways to get here are a genuine provider failure and a mail link
    // opened in a browser that never held the verifier. In the second case
    // GoTrue already confirmed the address before redirecting, so the account
    // is fine and only the session is missing. `signin_required` is the one
    // message that is true of both.
    console.error('[auth/callback] exchange failed', {
      error: error.name,
      error_code: error.code ?? String(error.status ?? ''),
      error_description: error.message,
    });
    return applyCookies(NextResponse.redirect(loginWith(origin, 'signin_required')));
  }

  console.log('[auth/callback] exchange ok', {
    user_id: data.user?.id,
    identities: data.user?.identities?.map((i) => i.provider),
  });

  // No locale prefix on purpose: this route never sees one, and /dashboard
  // bounces through the i18n hop, which picks the locale from the same
  // Accept-Language rule every other entry point uses.
  return applyCookies(NextResponse.redirect(`${origin}/dashboard`));
}

function loginWith(
  origin: string,
  notice: 'signin_required' | 'link_expired',
  detail?: Record<string, string | null | undefined>
) {
  const url = new URL('/login', origin);
  url.searchParams.set('notice', notice);
  if (detail) {
    Object.entries(detail).forEach(([k, v]) => {
      if (v && k !== 'stage') url.searchParams.set(k, v);
    });
  }
  return url;
}
