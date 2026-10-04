import type { CookieOptions } from '@supabase/ssr';

/**
 * THE ONE PLACE THE SESSION COOKIES' FLAGS ARE DECIDED (register #135).
 *
 * `@supabase/ssr` writes `sb-<ref>-auth-token` (chunked at 3,180 bytes) with
 * `Path=/; SameSite=Lax; Max-Age=400 days` and NOTHING else: its
 * `DEFAULT_COOKIE_OPTIONS` set no `Secure`, and it never infers one from the
 * scheme. Four clients write these cookies (the route handler, the middleware
 * refresh, server components, the browser after a password sign-in), and a
 * later write replaces the earlier cookie flags and all, so the flags must
 * come from one constant that every client passes, or the strictest one is
 * undone by the next refresh.
 *
 * `Secure`: the cookie is never sent over plain HTTP. tryknowflow.com serves
 * HTTPS only (Vercel answers `http://` with a 308 and sends HSTS), but a
 * non-Secure cookie still rides along on a browser's first `http://` request
 * before that redirect. Stricter, and free on every deployed environment.
 * A `next dev` server on `http://localhost` is the one place this bites:
 * Chrome accepts Secure cookies from localhost, Safari does not. Nobody runs
 * the app locally (it would write to the production database), so that is
 * accepted and recorded here rather than made conditional.
 *
 * NOT `HttpOnly`, on purpose: the browser client reads these cookies to know
 * who is signed in (Supabase's own guidance says HttpOnly "is not necessary"
 * here). Adding it would sign every student out of the client side.
 *
 * NOT the cause of #135 (a). The success 307 that Safari's Private tab failed
 * on carries these cookies without `Secure`; no WebKit, Apple or RFC 6265bis
 * rule rejects a `Lax` cookie over HTTPS, and a rejected cookie is dropped
 * silently, never a failed navigation. This is hardening the register named,
 * shipped as hardening. `src/app/api/auth/cookie-probe/route.ts` is the
 * experiment that decides the cause.
 */
export const SESSION_COOKIE_OPTIONS: Pick<CookieOptions, 'secure'> = {
  secure: true,
};
