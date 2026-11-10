import type { Platform } from '@/lib/platform';

/**
 * WHICH PAGE A SIGNED-OUT STUDENT IN THE APP OPENS ON (activation fix 3, the
 * 2026-11-09 audit, cause #2: three of five downloaders never signed up; the
 * app opened on "Welcome back / Sign in" with sign-up a small link at the
 * bottom).
 *
 * The app's first request is the root, which the middleware sends to the
 * dashboard, which `updateSession` sends to a signed-out page. That page is:
 *
 * - SIGN-UP for the app on a device that has never held a session here;
 * - LOGIN for the app on a device that has (it carries `kf-seen=1`);
 * - LOGIN for the web, always, as before. The web is not changed.
 *
 * THE MARK. `kf-seen=1`, written by the middleware on an app request that
 * carries a session (`markSeen`), whatever made the session: a password
 * sign-in, a sign-up that returned a session, the mail-link callback opened
 * inside the app, or a session that was already there before this change.
 * Reading the session the middleware already has is the one point every
 * sign-in path crosses, so no auth handler is touched. It holds no personal
 * data (the value is "1"), it is HttpOnly (no script reads it), Secure and
 * SameSite=Lax, and it lives 400 days, the longest a browser keeps a cookie.
 * Signing out does not remove it, which is the point: the student comes back
 * to the page for a returning student.
 *
 * THE MARK ONLY CHOOSES BETWEEN TWO PUBLIC PAGES. Both are linked to each
 * other and neither grants anything, so a forged or missing cookie costs one
 * tap and nothing else.
 */
export const SEEN_COOKIE = 'kf-seen';
export const SEEN_COOKIE_VALUE = '1';
/** 400 days: the cap Chrome and the cookie draft (RFC 6265bis) put on Max-Age. */
export const SEEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export const SEEN_COOKIE_OPTIONS = {
  path: '/',
  maxAge: SEEN_COOKIE_MAX_AGE,
  sameSite: 'lax' as const,
  secure: true,
  httpOnly: true,
};

export type SignedOutPage = 'login' | 'signup';

/** The page a signed-out request for the dashboard is sent to. */
export function signedOutPage(platform: Platform, seen: string | undefined): SignedOutPage {
  if (platform !== 'native') return 'login';
  return seen === SEEN_COOKIE_VALUE ? 'login' : 'signup';
}

/**
 * THE MARK WRITTEN FROM THE SIGN-UP PAGE, in the app only, once signUp has
 * succeeded. Confirm-email is on and the app has no universal links, so the
 * mail link opens in Safari: that session never reaches the app, and without
 * this the student who signed up in the app would come back to sign-up and
 * try again. Set from script, so it cannot be HttpOnly; the rest is the
 * middleware's mark (path, 400 days, Lax, Secure, value "1"). If the
 * middleware's HttpOnly mark is already there the browser keeps it, which is
 * the same value.
 */
export const SEEN_COOKIE_SCRIPT = `${SEEN_COOKIE}=${SEEN_COOKIE_VALUE}; Path=/; Max-Age=${SEEN_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;

export function markSeenAfterSignUp(platform: Platform, doc: { cookie: string }): void {
  if (platform === 'native') doc.cookie = SEEN_COOKIE_SCRIPT;
}

/**
 * Whether this request should write the mark if it carries a session (app
 * only, once). `updateSession` writes it only when its `getUser()` found one.
 */
export function markSeen(platform: Platform, seen: string | undefined): boolean {
  return platform === 'native' && seen !== SEEN_COOKIE_VALUE;
}
