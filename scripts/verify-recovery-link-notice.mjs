/**
 * Executable proof for register #130: a refused password-reset link gets its
 * own notice on the login page, with the way to a new link, and nothing else
 * the auth callback does changes.
 *
 * The REAL things under test:
 *   - `GET` in `src/app/api/auth/callback/route.ts`, driven with real
 *     `NextRequest`s. Only `@/lib/supabase/route` is stubbed: `verifyOtp` and
 *     `exchangeCodeForSession` answer what each case needs, and every call is
 *     recorded, so the proof also sees that verification is asked for exactly
 *     as before.
 *   - `loginNotice` (`src/lib/auth/login-notice.ts`), the one mapping the login
 *     page renders from `?notice=`, with the real dictionaries.
 *
 * Cases: a recovery link refused as expired and as already used; a signup,
 * magiclink and email link refused (link_expired, unchanged); an unknown type
 * (link_expired, verifyOtp never called); a recovery and a signup link that
 * verify (landing unchanged); the code arm failing, no code at all, a provider
 * error and a cancelled Google chooser (all unchanged).
 *
 * Register #131 adds: a mail link GoTrue's /verify refused comes back as
 * `?error=access_denied&error_code=otp_expired` and gets link_expired (it used
 * to fall into the cancelled-chooser arm and say nothing), no GoTrue wording
 * travels on; and the login page clears GoTrue's error fragment, and only that.
 *
 * Register #132 adds: the language a student chose at signup survives the
 * device change. The signup page writes it into the account's metadata; the
 * callback prefixes its landing with this device's cookie first, else the
 * verified account's stored choice, else a `locale` the link carries, each
 * collapsed to ar or en or dropped; with none of them every path is byte for
 * byte what it was, so accounts without a stored choice are untouched.
 *
 * Tier 0: no network, no credential, no database, no app, no mail.
 *
 * Usage: node --experimental-strip-types scripts/verify-recovery-link-notice.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, {
  // The REAL next/server: Next ships no exports map, so ESM needs the file name.
  'next/server': `export * from 'next/server.js';`,
  '@/lib/supabase/route': `
export function createRouteClient() {
  const s = globalThis.__kfAuthStub;
  return {
    supabase: { auth: {
      verifyOtp: async (args) => { s.calls.push(['verifyOtp', args]); return s.verify; },
      exchangeCodeForSession: async (code) => { s.calls.push(['exchange', code]); return s.exchange; },
    } },
    applyCookies: (res) => res,
  };
}`,
});

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

const { NextRequest } = await import('next/server.js');
const { GET } = await load('src/app/api/auth/callback/route.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');

const ORIGIN = 'https://kf.test';
const EXPIRED = { data: null, error: { code: 'otp_expired', status: 403, message: 'Email link is invalid or has expired' } };
const USED = { data: null, error: { status: 403, message: 'Token has expired or is invalid' } };
const OK = { data: { user: { id: 'u1', identities: [], created_at: '2026-09-01T00:00:00Z' } }, error: null };

async function run(query, { verify = OK, exchange = OK, cookie } = {}) {
  globalThis.__kfAuthStub = { verify, exchange, calls: [] };
  const headers = cookie ? { cookie } : {};
  const res = await GET(new NextRequest(`${ORIGIN}/api/auth/callback${query}`, { headers }));
  const loc = res.headers.get('location');
  const url = loc ? new URL(loc) : null;
  return { status: res.status, url, calls: globalThis.__kfAuthStub.calls };
}
const onlyNoticeAt = (url, path, notice) =>
  url && url.pathname === path && url.searchParams.get('notice') === notice && [...url.searchParams.keys()].join() === 'notice';
const onlyNotice = (url, notice) => onlyNoticeAt(url, '/login', notice);
const user = (meta) => ({ data: { user: { id: 'u1', identities: [], created_at: '2026-09-01T00:00:00Z', user_metadata: meta } }, error: null });

// ── 1. A refused reset link: the new notice, and nothing else about the redirect.
for (const [name, verify] of [['expired', EXPIRED], ['already used', USED]]) {
  const r = await run('?token_hash=pkce_abc&type=recovery', { verify });
  console.error(`recovery ${name}: ${r.status} ${r.url}`);
  check(onlyNotice(r.url, 'recovery_expired'), `a recovery link refused as ${name} goes to ${r.url}, expected /login?notice=recovery_expired and no other parameter`);
  check(r.status === 307, `recovery ${name}: status ${r.status}, expected the same 307 redirect as before`);
  check(r.calls.length === 1 && r.calls[0][0] === 'verifyOtp' && r.calls[0][1].type === 'recovery' && r.calls[0][1].token_hash === 'pkce_abc',
    `recovery ${name}: verification was not asked for exactly once with the link's type and token_hash`);
}
// The recovery cookie does not decide it: a refused signup link in a browser that once asked for a reset is still link_expired.
{
  const r = await run('?token_hash=abc&type=signup', { verify: EXPIRED, cookie: 'kf_recovery=1' });
  check(onlyNotice(r.url, 'link_expired'), `a refused signup link with the recovery cookie goes to ${r.url}, expected link_expired`);
}

// ── 2. Every other refused type keeps link_expired.
for (const type of ['signup', 'magiclink', 'email', 'invite', 'email_change']) {
  const r = await run(`?token_hash=abc&type=${type}`, { verify: EXPIRED });
  check(onlyNotice(r.url, 'link_expired'), `a refused ${type} link goes to ${r.url}, expected /login?notice=link_expired`);
}
{
  const r = await run('?token_hash=abc&type=bogus');
  check(onlyNotice(r.url, 'link_expired'), `an unknown type goes to ${r.url}, expected link_expired`);
  check(r.calls.length === 0, 'an unknown type must be refused before verifyOtp is called');
}

// ── 3. Successes land where they did.
{
  const r = await run('?token_hash=abc&type=recovery');
  check(r.url && r.url.pathname === '/reset-password' && r.url.search === '', `a verified recovery link lands on ${r.url}, expected /reset-password`);
  const s = await run('?token_hash=abc&type=signup');
  check(s.url && s.url.pathname === '/dashboard', `a verified signup link lands on ${s.url}, expected /dashboard`);
  const c = await run('?code=xyz');
  check(c.url && c.url.pathname === '/dashboard' && c.calls[0]?.[0] === 'exchange', `a code exchange lands on ${c.url}, expected /dashboard`);
}

// ── 4. The other failures say what they said.
{
  const c = await run('?code=xyz', { exchange: { data: {}, error: { name: 'AuthApiError', message: 'invalid' } } });
  check(onlyNotice(c.url, 'signin_required'), `a failed code exchange goes to ${c.url}, expected signin_required`);
  const n = await run('');
  check(onlyNotice(n.url, 'signin_required'), `nothing to exchange goes to ${n.url}, expected signin_required`);
  const p = await run('?error=server_error&error_code=unexpected_failure');
  check(p.url && p.url.pathname === '/login' && p.url.searchParams.get('notice') === 'signin_required', `a provider error goes to ${p.url}, expected signin_required`);
  const a = await run('?error=access_denied');
  check(a.url && a.url.pathname === '/login' && a.url.search === '', `a cancelled chooser goes to ${a.url}, expected /login with no notice`);
}

// ── 4b. #131: a mail link /verify refused comes back as a provider error with
// error_code=otp_expired (measured 2026-09-28 against the real project). It
// goes to link_expired, and nothing GoTrue wrote travels on to the page.
{
  const DESC = 'error_description=Email+link+is+invalid+or+has+expired';
  const m = await run(`?error=access_denied&error_code=otp_expired&${DESC}`);
  console.error(`refused mail link: ${m.status} ${m.url}`);
  check(onlyNotice(m.url, 'link_expired'), `a mail link /verify refused goes to ${m.url}, expected /login?notice=link_expired and no other parameter`);
  check(m.calls.length === 0, 'a refused mail link must not reach verifyOtp or the code exchange');
  const o = await run(`?error=server_error&error_code=otp_expired&${DESC}`);
  check(onlyNotice(o.url, 'link_expired'), `otp_expired under another error goes to ${o.url}, expected link_expired`);
  const g = await run('?error=access_denied&error_code=provider_error&error_description=cancelled');
  check(g.url && g.url.pathname === '/login' && g.url.search === '', `access_denied with any other code goes to ${g.url}, expected a bare /login as before`);
  const s = await run('?error=server_error&error_code=unexpected_failure');
  check(s.url && s.url.searchParams.get('notice') === 'signin_required', `another provider error goes to ${s.url}, expected signin_required as before`);
}

// ── 5. What the login page says for each code.
const mod = existsSync(resolvePath(ROOT, 'src/lib/auth/login-notice.ts')) ? await load('src/lib/auth/login-notice.ts') : null;
check(mod && typeof mod.loginNotice === 'function', 'src/lib/auth/login-notice.ts does not export loginNotice');
const APPROVED = { ar: 'انتهى الرابط. اطلب رابطًا جديدًا.', en: 'This link has expired. Ask for a new one.' };
if (mod) {
  for (const [locale, t] of [['ar', ar], ['en', en]]) {
    const r = mod.loginNotice('recovery_expired', t, locale);
    console.error(`${locale} recovery_expired: ${JSON.stringify(r)}`);
    check(r?.text === APPROVED[locale], `${locale}: recovery_expired reads ${JSON.stringify(r?.text)}, approved ${JSON.stringify(APPROVED[locale])}`);
    check(r?.link?.href === `/${locale}/forgot-password` && r?.link?.label === t.auth.forgotLink,
      `${locale}: recovery_expired does not link to /${locale}/forgot-password with auth.forgotLink`);
    const l = mod.loginNotice('link_expired', t, locale);
    check(l?.text === t.auth.noticeLinkExpired && l.link === null, `${locale}: link_expired changed`);
    const s = mod.loginNotice('signin_required', t, locale);
    check(s?.text === t.auth.noticeSigninRequired && s.link === null, `${locale}: signin_required changed`);
    check(mod.loginNotice(null, t, locale) === null && mod.loginNotice('anything', t, locale) === null, `${locale}: an absent or unknown code must say nothing`);
  }
}
// ── 6. #131: the login page clears GoTrue's error fragment and only that.
check(mod && typeof mod.isAuthErrorFragment === 'function', 'src/lib/auth/login-notice.ts does not export isAuthErrorFragment');
if (mod && mod.isAuthErrorFragment) {
  const f = mod.isAuthErrorFragment;
  check(f('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb='), 'the /verify error fragment is not recognised');
  check(f('#error_description=x') && f('#error_code=otp_expired'), 'a partial error fragment is not recognised');
  check(!f('') && !f('#') && !f('#how-it-works') && !f('#access_token=abc&type=recovery'), 'a fragment that is not an auth error would be cleared');
}
const page = readFileSync(resolvePath(ROOT, 'src/app/[locale]/login/page.tsx'), 'utf8');
check(/loginNotice\(noticeCode, t, locale\)/.test(page), 'the login page does not render its notice through loginNotice');
check(/if \(isAuthErrorFragment\(window\.location\.hash\)\) \{\s*window\.history\.replaceState\(window\.history\.state, '', window\.location\.pathname \+ window\.location\.search\)/.test(page),
  'the login page does not clear the error fragment (keeping path, query and router state)');
check(!/error_description/.test(page), 'the login page reads error_description; GoTrue\'s wording must never reach the student');

// ── 7. #132: the language chosen at signup survives the device change.
{
  const ll = existsSync(resolvePath(ROOT, 'src/lib/auth/landing-locale.ts')) ? await load('src/lib/auth/landing-locale.ts') : null;
  check(ll && typeof ll.landingLocale === 'function' && typeof ll.localisePath === 'function', 'src/lib/auth/landing-locale.ts does not export landingLocale and localisePath');
  if (ll) {
    const L = ll.landingLocale;
    check(L({}) === null && L({ stored: 'fr' }) === null && L({ stored: '../en' }) === null && L({ stored: { toString: () => 'ar' } }) === null && L({ link: 'AR' }) === null,
      'landingLocale must drop anything that is not exactly one of the supported locales');
    check(L({ cookie: 'en', stored: 'ar', link: 'ar' }) === 'en' && L({ cookie: 'fr', stored: 'ar' }) === 'ar' && L({ stored: 'fr', link: 'en' }) === 'en',
      'landingLocale order must be cookie, then stored, then link, skipping invalid values');
    check(ll.localisePath('/dashboard', null) === '/dashboard' && ll.localisePath('/dashboard', 'ar') === '/ar/dashboard', 'localisePath');
  }

  // The device that opens the mail has no cookie: the account's choice decides.
  for (const [locale, type, path] of [['ar', 'signup', '/ar/dashboard'], ['en', 'signup', '/en/dashboard'], ['ar', 'recovery', '/ar/reset-password'], ['en', 'recovery', '/en/reset-password']]) {
    const r = await run(`?token_hash=abc&type=${type}`, { verify: user({ full_name: 'x', locale }) });
    console.error(`${type} stored ${locale}: ${r.status} ${r.url}`);
    check(r.url && r.url.pathname === path && r.url.search === '' && r.status === 307, `a verified ${type} link with stored locale ${locale} lands on ${r.url}, expected ${path}`);
    check(r.calls.length === 1 && r.calls[0][0] === 'verifyOtp' && r.calls[0][1].token_hash === 'abc', `${type} stored ${locale}: verification changed`);
  }
  // The recovery cookie is still cleared on a prefixed reset landing.
  {
    globalThis.__kfAuthStub = { verify: user({ locale: 'ar' }), exchange: OK, calls: [] };
    const res = await GET(new NextRequest(`${ORIGIN}/api/auth/callback?token_hash=abc&type=recovery`, { headers: { cookie: 'kf_recovery=1' } }));
    const sc = res.headers.get('set-cookie') ?? '';
    check(/kf_recovery=;/.test(sc) && /Max-Age=0/i.test(sc), `a prefixed reset landing must still clear the recovery cookie; set-cookie was ${JSON.stringify(sc)}`);
    check(!/kf-locale=/.test(sc), 'the callback must not write the locale cookie itself (the middleware does, for the page it lands on)');
  }
  // No stored choice, nothing on the link, no cookie: byte for byte today's landing.
  for (const meta of [undefined, {}, { full_name: 'x' }, { locale: 'fr' }, { locale: '/evil' }, { locale: ['ar'] }]) {
    const r = await run('?token_hash=abc&type=signup', { verify: user(meta) });
    check(r.url && r.url.pathname === '/dashboard' && r.url.search === '', `a verified signup with metadata ${JSON.stringify(meta)} lands on ${r.url}, expected /dashboard unchanged`);
    check(r.url && r.url.origin === ORIGIN, `metadata ${JSON.stringify(meta)} moved the landing off origin: ${r.url}`);
  }
  // This device's own choice outranks the stored one, as the middleware would rank it.
  {
    const r = await run('?token_hash=abc&type=signup', { verify: user({ locale: 'ar' }), cookie: 'kf-locale=en' });
    check(r.url && r.url.pathname === '/en/dashboard', `stored ar with this device on en lands on ${r.url}, expected /en/dashboard`);
    const j = await run('?token_hash=abc&type=signup', { verify: user({ locale: 'ar' }), cookie: 'kf-locale=junk' });
    check(j.url && j.url.pathname === '/ar/dashboard', `an invalid locale cookie must be skipped, not trusted: ${j.url}`);
  }
  // A locale on the link: used when nothing better is known, validated the same way.
  {
    const r = await run('?token_hash=abc&type=signup&locale=en', { verify: user({}) });
    check(r.url && r.url.pathname === '/en/dashboard' && r.url.search === '', `a link locale with no stored choice lands on ${r.url}, expected /en/dashboard and no query`);
    const s = await run('?token_hash=abc&type=signup&locale=en', { verify: user({ locale: 'ar' }) });
    check(s.url && s.url.pathname === '/ar/dashboard', `the stored choice must outrank the link's: ${s.url}`);
    for (const bad of ['fr', '..%2Fx', 'https%3A%2F%2Fevil.test', 'ar%2F..']) {
      const b = await run(`?token_hash=abc&type=signup&locale=${bad}`, { verify: user({}) });
      check(b.url && b.url.href === `${ORIGIN}/dashboard`, `link locale ${bad} produced ${b.url}, expected /dashboard untouched`);
    }
  }
  // Refused links: no user is known, so only this device's cookie or the link's locale can say; the notice is unchanged.
  {
    const r = await run('?token_hash=abc&type=recovery', { verify: EXPIRED, cookie: 'kf-locale=ar' });
    check(onlyNoticeAt(r.url, '/ar/login', 'recovery_expired'), `a refused reset link on an ar device goes to ${r.url}, expected /ar/login?notice=recovery_expired and no other parameter`);
    const l = await run('?token_hash=abc&type=signup&locale=en', { verify: EXPIRED });
    check(onlyNoticeAt(l.url, '/en/login', 'link_expired'), `a refused signup link carrying locale=en goes to ${l.url}, expected /en/login?notice=link_expired and no other parameter`);
    const v = await run('?error=access_denied&error_code=otp_expired&locale=ar');
    check(onlyNoticeAt(v.url, '/ar/login', 'link_expired'), `a /verify-refused link carrying locale=ar goes to ${v.url}`);
    const c = await run('?error=access_denied', { cookie: 'kf-locale=ar' });
    check(c.url && c.url.pathname === '/ar/login' && c.url.search === '', `a cancelled chooser on an ar device goes to ${c.url}, expected a bare /ar/login`);
    const n = await run('', { cookie: 'kf-locale=en' });
    check(onlyNoticeAt(n.url, '/en/login', 'signin_required'), `nothing to exchange on an en device goes to ${n.url}`);
  }
  // The code arm: a Google account stores no locale and lands as before; a password signup confirmed on its own device lands in its choice.
  {
    const g = await run('?code=xyz', { exchange: user({ name: 'G', picture: 'p' }) });
    check(g.url && g.url.pathname === '/dashboard' && g.url.search === '', `a Google exchange with no stored locale lands on ${g.url}, expected /dashboard unchanged`);
    const p = await run('?code=xyz', { exchange: user({ full_name: 'x', locale: 'en' }) });
    check(p.url && p.url.pathname === '/en/dashboard', `a same-device signup exchange with stored en lands on ${p.url}, expected /en/dashboard`);
    const f = await run('?code=xyz', { exchange: { data: {}, error: { name: 'AuthApiError', message: 'invalid' } }, cookie: 'kf-locale=ar' });
    check(onlyNoticeAt(f.url, '/ar/login', 'signin_required'), `a failed exchange on an ar device goes to ${f.url}`);
  }
  // The signup page writes the choice, beside full_name, and only there.
  const signup = readFileSync(resolvePath(ROOT, 'src/app/[locale]/signup/page.tsx'), 'utf8');
  check(/data:\s*\{\s*full_name:\s*fullName,\s*locale\s*\}/.test(signup), "the signup page does not send { full_name, locale } as the account's metadata");
}

if (failures.length === 0) {
  console.log('PASS: a refused reset link says "This link has expired. Ask for a new one." with the way to a new link; a mail link /verify refused (otp_expired) gets link_expired and its error fragment is cleared; every other link, success and failure lands exactly as before; the language chosen at signup survives the device change (#132).');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
