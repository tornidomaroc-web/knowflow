import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createRouteClient } from '@/lib/supabase/route';
import { RECOVERY_COOKIE, resolveLandingPath } from '@/lib/auth/recovery-landing';
import {
  PASSWORD_REPLACED_COOKIE,
  detectPasswordReplaced,
} from '@/lib/auth/password-replaced';

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

  // Backing out of Google's account chooser is not a failure, and it is the
  // most common thing that will ever happen on this arm. The provider reports
  // it as `access_denied`, and the honest response is to put the person back on
  // the login page with NOTHING said: they know what they did, and every notice
  // this route can render would be describing a fault that did not occur.
  // `signin_required` in particular would read as "we could not sign you in",
  // which blames the app for the user's own decision.
  if (providerError === 'access_denied') {
    console.log('[auth/callback] provider cancelled by user', {
      error_code: searchParams.get('error_code'),
    });
    return NextResponse.redirect(new URL('/login', origin));
  }

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
    return applyCookies(landing(request, origin, rawType));
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

  // An unconfirmed password user who arrives here via Google has just had their
  // password destroyed by GoTrue, silently. `detectPasswordReplaced` explains
  // the mechanism and why the test is an age gap rather than provider absence.
  //
  // GUARDED, per register #78. The detector fails closed on every wrong shape
  // GoTrue can actually emit, but "fails closed" is a claim about the PRODUCER,
  // not a property of our parser: a `null` element inside `identities` would
  // make `i.provider` raise, and this call sits on the success path of a sign
  // in that has ALREADY completed. Unguarded, that answers a person who just
  // signed in correctly with a 500, which is the worst outcome in this whole
  // route and the only catastrophic one.
  //
  // Today it is unreachable, and only because `Identities []Identity`
  // (`internal/models/user.go:68`) is a VALUE slice, so JSON elements are
  // always objects and a nil slice marshals as `null` for the whole array,
  // which the detector already handles. That is an incidental property of a Go
  // struct in a dependency we do not control and have not been promised. Four
  // lines is a cheap price for not depending on it.
  //
  // The catch degrades to the same silent no-fire every other wrong shape
  // produces: no notice, and the landing proceeds untouched. Losing a notice is
  // the failure this whole feature already accepts; losing the sign-in is not.
  let passwordReplaced = false;
  try {
    passwordReplaced = detectPasswordReplaced(data.user);
  } catch (detectError) {
    console.error('[auth/callback] password-replaced detector threw', {
      error: detectError instanceof Error ? detectError.message : String(detectError),
    });
  }

  // The two timestamps are logged BESIDE the verdict because without them the
  // verdict cannot be read. `detectPasswordReplaced` fails closed on anything it
  // cannot parse, so an absent or epoch-shaped `created_at` returns false for
  // EVERY user, including a genuinely harmed one. That is indistinguishable from
  // the healthy steady state, where false is also what every ordinary Google
  // sign-in produces. An unbroken run of `password_replaced: false` therefore
  // proves nothing on its own: it is equally the signature of a detector that is
  // armed and waiting, and of one that is silently broken on the only two values
  // it decides on. Logging the raw strings is what separates them, and both are
  // read straight off the response rather than re-derived, so what appears here
  // is what the discriminator actually saw.
  console.log('[auth/callback] exchange ok', {
    user_id: data.user?.id,
    identities: data.user?.identities?.map((i) => i.provider),
    user_created_at: data.user?.created_at,
    identity_created_at: data.user?.identities?.map((i) => i.created_at),
    password_replaced: passwordReplaced,
  });

  // No locale prefix on purpose: this route never sees one, and /dashboard
  // bounces through the i18n hop, which picks the locale from the same
  // Accept-Language rule every other entry point uses.
  const response = applyCookies(landing(request, origin));

  if (passwordReplaced) {
    // Not `httpOnly`: the banner clears this from the browser once it has been
    // seen, which is what makes it one-shot. It carries no secret and grants no
    // authority, and the worst a forged one can do is show its owner a notice
    // about their own account. `SameSite=Lax` so it survives the redirect chain
    // (provider -> here -> /dashboard -> the i18n hop) that follows.
    response.cookies.set(PASSWORD_REPLACED_COOKIE, '1', {
      path: '/',
      maxAge: 600,
      sameSite: 'lax',
    });
  }

  return response;
}

/**
 * Where a successful landing goes.
 *
 * Recovery cannot go to the dashboard. The session is already live by the time
 * we get here (that is how Supabase recovery works, and `updateUser` needs it),
 * so dropping the user on the dashboard would leave an account open behind a
 * password its owner has forgotten and not yet replaced. Sending them straight
 * to the form that ends that window is the mitigation.
 */
function landing(request: NextRequest, origin: string, otpType?: string | null) {
  const path = resolveLandingPath({
    otpType,
    hasRecoveryCookie: request.cookies.get(RECOVERY_COOKIE)?.value === '1',
  });
  const response = NextResponse.redirect(`${origin}${path}`);
  if (path === '/reset-password') {
    response.cookies.set(RECOVERY_COOKIE, '', { path: '/', maxAge: 0 });
  }
  console.log('[auth/callback] landing', { otpType: otpType ?? null, path });
  return response;
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
