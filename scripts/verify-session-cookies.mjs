/**
 * Executable proof for register #135 (a): what the auth callback's success
 * 307 ACTUALLY sends, that every writer of the session cookies writes the same
 * flags, and that the #135 cookie probe reproduces that shape by the byte.
 *
 * The REAL things under test:
 *   - `GET` in `src/app/api/auth/callback/route.ts`, through the REAL
 *     `createRouteClient`, the REAL `@supabase/ssr` and the REAL `auth-js`.
 *     Only the network is stubbed: `globalThis.fetch` answers GoTrue's
 *     `POST /auth/v1/verify` with a session of a real account's shape, and a
 *     refusal where a case needs one. The cookies on the 307 are therefore
 *     written by the library that writes them on production, chunked by its
 *     chunker with its defaults, and applied by our `applyCookies`. The #226
 *     lesson: a proof that hand-builds the request or the response proves the
 *     hand, not production.
 *   - `updateSession` in `src/lib/supabase/middleware.ts`, driven with a real
 *     `NextRequest` carrying an EXPIRED session cookie, so `auth-js` refreshes
 *     it (`POST /auth/v1/token?grant_type=refresh_token`, stubbed) and writes
 *     the cookies again: the most frequent writer on production.
 *   - `GET` in `src/app/api/auth/cookie-probe/route.ts`, whose cookies must
 *     match the callback's in every attribute but `Secure` (`real`) or in every
 *     attribute (`secure`).
 *
 * Held:
 *   1. The success 307: `Location` to the landed page, one or more
 *      `sb-<ref>-auth-token` chunks of at most 3,180 encoded bytes that decode
 *      back to the session, `Path=/; SameSite=Lax; Max-Age=400 days`, `Secure`
 *      (red on main), and NOT `HttpOnly` (the browser client must read them).
 *      Nothing else on the response but `Location` and the cookies (Next strips
 *      `x-middleware-set-cookie`, asserted against its source).
 *   2. The refused 307s set no cookie, with auth-js itself doing the refusing.
 *   3. Every client that writes these cookies passes `SESSION_COOKIE_OPTIONS`,
 *      and no other `createServerClient`/`createBrowserClient` call exists.
 *   4. The middleware's refresh writes `Secure` too.
 *   5. The probe: each variant's count, names (never `sb-`), sizes and
 *      attributes; `none` sets nothing; the landing lists what came back;
 *      `clear` expires each probe cookie.
 *   6. The probe never leaks and never lingers: every answer it gives (each
 *      307, the landing, an unknown variant, clear, an error, the sunset)
 *      carries `Cache-Control: no-store`; the landing names no cookie but its
 *      own, prints no value, and renders no planted name; `big` expires in an
 *      hour; after the sunset every request is a 404 that sets nothing.
 *
 * Tier 0: no network, no credential, no database, no app, no mail.
 *
 * Usage: node --experimental-strip-types scripts/verify-session-cookies.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const REF = 'abcdefghijklmnopqrst';
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${REF}.supabase.co`;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-the-proof-only';
installTsxHooks(ROOT, { 'next/server': `export * from 'next/server.js';` });

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

// ── A session of a real account's shape (a plus-address signup with a stored locale).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const uid = '9f1c2a3b-4d5e-4f60-8a71-2b3c4d5e6f70';
const t = '2026-09-29T01:04:00.000Z';
const meta = { email: 'student.name+kf0929@example.com', email_verified: true, full_name: 'Student Example', locale: 'ar', phone_verified: false, sub: uid };
function session(expiresAt) {
  const iat = expiresAt - 3600;
  const jwt = [
    b64({ alg: 'HS256', typ: 'JWT', kid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }),
    b64({ iss: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`, sub: uid, aud: 'authenticated', exp: expiresAt, iat, email: meta.email, phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: meta, role: 'authenticated', aal: 'aal1', amr: [{ method: 'otp', timestamp: iat }], session_id: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f', is_anonymous: false }),
    'x'.repeat(43),
  ].join('.');
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: meta.email, email_confirmed_at: t, phone: '', confirmation_sent_at: t, confirmed_at: t, last_sign_in_at: t, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: meta, identities: [{ identity_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', id: uid, user_id: uid, identity_data: meta, provider: 'email', last_sign_in_at: t, created_at: t, updated_at: t, email: meta.email }], created_at: t, updated_at: t, is_anonymous: false };
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: 'rt-fixture-1234', user };
}
const now = () => Math.floor(Date.now() / 1000);

// ── The network, and nothing else: what GoTrue answers.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let answers = {};
let calls = [];
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  const key = `${init?.method ?? 'GET'} ${u.pathname}${u.search}`;
  calls.push(key);
  const answer = answers[key] ?? answers[`${init?.method ?? 'GET'} ${u.pathname}`];
  return answer ? answer() : json({ message: `unexpected call ${key}` }, 500);
};

const { NextRequest } = await import('next/server.js');
const { GET: callback } = await load('src/app/api/auth/callback/route.ts');
const { GET: probe } = await load('src/app/api/auth/cookie-probe/route.ts');
const { updateSession } = await load('src/lib/supabase/middleware.ts');
const { SESSION_COOKIE_OPTIONS } = await load('src/lib/supabase/cookie-options.ts');
const ssr = await import('@supabase/ssr');

const ORIGIN = 'https://tryknowflow.com';
const COOKIE_NAME = `sb-${REF}-auth-token`;
const cookieName = (sc) => sc.slice(0, sc.indexOf('='));
const cookieValue = (sc) => sc.slice(sc.indexOf('=') + 1, sc.indexOf(';') > -1 ? sc.indexOf(';') : undefined);
// The attributes, normalised: lower-case, sorted, without `Expires` (a clock reading).
const attrs = (sc) => sc.split(';').slice(1).map((a) => a.trim().toLowerCase()).filter((a) => a && !a.startsWith('expires=')).sort();

// ── 1. The success 307, as production sends it.
let successAttrs;
{
  answers = { 'POST /auth/v1/verify': () => json(session(now() + 3600)) };
  calls = [];
  const res = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?token_hash=abc&type=signup`, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) Safari' } }));
  check(res.status === 307, `success: status ${res.status}, expected 307`);
  check(res.headers.get('location') === `${ORIGIN}/ar/dashboard`, `success: location ${res.headers.get('location')}`);
  check(calls.length === 1 && calls[0] === 'POST /auth/v1/verify', `success: GoTrue calls were ${JSON.stringify(calls)}`);
  const sc = res.headers.getSetCookie();
  console.error(`success 307: ${sc.length} Set-Cookie, ${sc.reduce((n, c) => n + c.length, 0)} bytes of cookie headers`);
  check(sc.length >= 1, 'success: no Set-Cookie on the success 307');
  check(sc.every((c) => new RegExp(`^${COOKIE_NAME}(\\.\\d+)?$`).test(cookieName(c))), `success: cookie names ${sc.map(cookieName)}`);
  check(sc.every((c) => encodeURIComponent(cookieValue(c)).length <= ssr.MAX_CHUNK_SIZE), 'success: a chunk exceeds MAX_CHUNK_SIZE');
  // The chunks decode back to the session: written by the library, not by hand.
  const joined = sc.map(cookieValue).join('');
  check(joined.startsWith('base64-'), 'success: the cookie is not base64url-encoded');
  let stored = null;
  try { stored = JSON.parse(Buffer.from(joined.slice('base64-'.length), 'base64url').toString('utf8')); } catch {}
  check(stored?.user?.user_metadata?.locale === 'ar' && stored?.refresh_token === 'rt-fixture-1234', 'success: the cookies do not decode back to the session');
  for (const c of sc) {
    const a = attrs(c);
    console.error(`  ${cookieName(c)}: ${cookieValue(c).length} bytes; ${a.join('; ')}`);
    check(a.includes('path=/'), `${cookieName(c)}: no Path=/`);
    check(a.includes('samesite=lax'), `${cookieName(c)}: SameSite is not Lax`);
    check(a.includes(`max-age=${400 * 24 * 60 * 60}`), `${cookieName(c)}: Max-Age is not 400 days`);
    check(a.includes('secure'), `${cookieName(c)}: no Secure (register #135)`);
    check(!a.includes('httponly'), `${cookieName(c)}: HttpOnly would sign the browser client out`);
  }
  successAttrs = attrs(sc[0]);
  check(sc.every((c) => attrs(c).join('|') === successAttrs.join('|')), 'success: chunks differ in attributes');
  check(sc.reduce((n, c) => n + c.length, 0) < 8192, 'success: cookie headers grew past 8 KB; re-read #135 before accepting');
  const others = [...res.headers.keys()].filter((h) => !['location', 'set-cookie', 'x-middleware-set-cookie'].includes(h));
  check(others.length === 0, `success: unexpected headers ${others}`);
  // Next strips its internal x-middleware-set-cookie before sending, so the
  // wire carries Location and the cookies only.
  const send = readFileSync(resolvePath(ROOT, 'node_modules/next/dist/server/send-response.js'), 'utf8');
  check(/=== 'x-middleware-set-cookie'\)\s*\{\s*return;/.test(send), "Next's send-response no longer strips x-middleware-set-cookie; re-read #135");
}

// ── 2. The refused 307s set no cookie, and auth-js does the refusing.
{
  answers = { 'POST /auth/v1/verify': () => json({ code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }, 403) };
  for (const [q, want] of [
    ['?token_hash=x&type=signup', '/login?notice=link_expired'],
    ['?error=access_denied', '/login'],
    ['?error=access_denied&error_code=otp_expired', '/login?notice=link_expired'],
  ]) {
    calls = [];
    const res = await callback(new NextRequest(`${ORIGIN}/api/auth/callback${q}`));
    const loc = res.headers.get('location') ?? '';
    check(res.status === 307 && loc === `${ORIGIN}${want}`, `refused ${q}: ${res.status} ${loc}`);
    check(res.headers.getSetCookie().length === 0, `refused ${q}: sets a cookie`);
    if (q.startsWith('?token_hash')) check(calls.length === 1, `refused ${q}: GoTrue calls ${JSON.stringify(calls)}`);
  }
}

// ── 3. Every writer passes the same flags, and there is no other writer.
{
  check(SESSION_COOKIE_OPTIONS.secure === true, 'SESSION_COOKIE_OPTIONS.secure is not true');
  check(!('httpOnly' in SESSION_COOKIE_OPTIONS), 'SESSION_COOKIE_OPTIONS must not set httpOnly');
  const writers = ['src/lib/supabase/route.ts', 'src/lib/supabase/middleware.ts', 'src/lib/supabase/server.ts', 'src/lib/supabase/client.ts'];
  for (const f of writers) {
    const src = readFileSync(resolvePath(ROOT, f), 'utf8');
    check(/cookieOptions:\s*SESSION_COOKIE_OPTIONS/.test(src), `${f} does not pass SESSION_COOKIE_OPTIONS`);
  }
  // A writer is a file that takes a client constructor from @supabase/ssr; the
  // route handlers that import our wrappers under the same name are not.
  const hits = execSync('git grep -l -E "^import .*create(Server|Browser)Client.*from .@supabase/ssr." -- src', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean).sort();
  check(hits.join(',') === [...writers].sort().join(','), `session cookie writers are ${hits}, expected exactly ${[...writers].sort()}`);
}

// ── 4. The middleware's refresh writes Secure too.
{
  const expired = session(now() - 60);
  const enc = 'base64-' + Buffer.from(JSON.stringify(expired)).toString('base64url');
  const cookie = ssr.createChunks(COOKIE_NAME, enc).map((c) => `${c.name}=${c.value}`).join('; ');
  answers = {
    'POST /auth/v1/token?grant_type=refresh_token': () => json(session(now() + 3600)),
    'GET /auth/v1/user': () => json(session(now() + 3600).user),
  };
  calls = [];
  const res = await updateSession(new NextRequest(`${ORIGIN}/ar/dashboard`, { headers: { cookie } }));
  const sc = res.headers.getSetCookie();
  console.error(`middleware refresh: GoTrue calls ${JSON.stringify(calls)}; ${sc.length} Set-Cookie`);
  check(calls.some((c) => c.startsWith('POST /auth/v1/token')), 'middleware: an expired session was not refreshed');
  check(res.status === 200, `middleware: a refreshed session was redirected (${res.status} ${res.headers.get('location')})`);
  const written = sc.filter((c) => cookieName(c).startsWith(COOKIE_NAME) && cookieValue(c) !== '');
  check(written.length >= 1, 'middleware: the refreshed session was not written');
  check(written.every((c) => attrs(c).join('|') === successAttrs.join('|')), `middleware: refreshed cookies differ from the callback's: ${written.map((c) => attrs(c).join('; '))}`);
}

// ── 5. The #135 cookie probe reproduces the production shape.
{
  const PROBE = `${ORIGIN}/api/auth/cookie-probe`;
  const withoutSecure = successAttrs.filter((a) => a !== 'secure');
  const expect = {
    none: { count: 0 },
    real: { count: 2, attrs: withoutSecure },
    secure: { count: 2, attrs: successAttrs },
    one: { count: 1, attrs: withoutSecure },
    big: { count: 6, attrs: withoutSecure.map((a) => (a.startsWith('max-age=') ? 'max-age=3600' : a)).sort() },
  };
  for (const [variant, want] of Object.entries(expect)) {
    const res = await probe(new NextRequest(`${PROBE}?variant=${variant}`));
    check(res.status === 307 && res.headers.get('location') === `${PROBE}?landed=${variant}`, `probe ${variant}: ${res.status} ${res.headers.get('location')}`);
    const sc = res.headers.getSetCookie();
    check(sc.length === want.count, `probe ${variant}: ${sc.length} cookies, expected ${want.count}`);
    check(sc.every((c) => /^kf-probe-auth-token(\.\d+)?$/.test(cookieName(c))), `probe ${variant}: names ${sc.map(cookieName)}`);
    check(sc.every((c) => !cookieName(c).startsWith('sb-')), `probe ${variant}: must never write an sb- cookie`);
    check(sc.every((c) => encodeURIComponent(cookieValue(c)).length <= ssr.MAX_CHUNK_SIZE), `probe ${variant}: a chunk exceeds MAX_CHUNK_SIZE`);
    if (want.count) check(sc.every((c) => attrs(c).join('|') === want.attrs.join('|')), `probe ${variant}: attributes ${attrs(sc[0]).join('; ')}, expected ${want.attrs.join('; ')}`);
    console.error(`probe ${variant}: ${sc.length} cookies, ${sc.reduce((n, c) => n + c.length, 0)} bytes`);
  }
  // The two `real` chunks are one full chunk and a tail, as a real session splits.
  const real = (await probe(new NextRequest(`${PROBE}?variant=real`))).headers.getSetCookie();
  check(cookieValue(real[0]).length === ssr.MAX_CHUNK_SIZE && cookieValue(real[1]).length > 0 && cookieValue(real[1]).length < ssr.MAX_CHUNK_SIZE, 'probe real: not one full chunk and a tail');
  // The landing lists what came back; an unknown variant sets nothing.
  const landed = await probe(new NextRequest(`${PROBE}?landed=real`, { headers: { cookie: real.map((c) => `${cookieName(c)}=${cookieValue(c)}`).join('; ') } }));
  const html = await landed.text();
  check(landed.status === 200 && /text\/html/.test(landed.headers.get('content-type') ?? ''), 'probe landing: not an HTML page');
  check(html.includes('kf-probe-auth-token.0') && html.includes('kf-probe-auth-token.1') && html.includes('<strong>2</strong>'), 'probe landing: does not list the two cookies');
  check(landed.headers.getSetCookie().length === 0, 'probe landing: sets a cookie');
  const unknown = await probe(new NextRequest(`${PROBE}?variant=sb-evil`));
  check(unknown.status === 200 && unknown.headers.getSetCookie().length === 0, 'probe: an unknown variant must set nothing');
  // Clear expires each probe cookie the browser sent, and nothing else.
  const cleared = await probe(new NextRequest(`${PROBE}?clear=1`, { headers: { cookie: `${real.map((c) => `${cookieName(c)}=x`).join('; ')}; ${COOKIE_NAME}=keep; kf-locale=ar` } }));
  const csc = cleared.headers.getSetCookie();
  check(cleared.status === 307 && csc.length === 2 && csc.every((c) => /^kf-probe-auth-token\.\d=;/.test(c) && /max-age=0/i.test(c)), `probe clear: ${csc.map((c) => c.slice(0, 40))}`);
}

// ── 6. The probe never leaks and never lingers.
{
  const PROBE = `${ORIGIN}/api/auth/cookie-probe`;
  const noStore = (res, what) => check(res.headers.get('cache-control') === 'no-store', `probe ${what}: Cache-Control is ${res.headers.get('cache-control')}, expected no-store`);
  for (const q of ['?variant=none', '?variant=real', '?variant=secure', '?variant=one', '?variant=big', '?landed=real', '?variant=sb-evil', '?clear=1', '']) {
    noStore(await probe(new NextRequest(`${PROBE}${q}`)), q || 'bare');
  }
  // A browser carrying a real session, other app cookies and a planted name.
  const FOREIGN = 'base64-session-fixture-value';
  const planted = 'kf-probe-auth-token.<img src=x onerror=alert(1)>';
  const cookie = [`${COOKIE_NAME}.0=${FOREIGN}`, `${COOKIE_NAME}.1=${FOREIGN}`, 'kf-locale=ar', `${planted}=a`, 'kf-probe-auth-token.0=aaaa', 'kf-probe-x=aaaa'].join('; ');
  const landed = await probe(new NextRequest(`${PROBE}?landed=real`, { headers: { cookie } }));
  const html = await landed.text();
  noStore(landed, 'landing with foreign cookies');
  check(!html.includes('sb-') && !html.includes(FOREIGN) && !html.includes('kf-locale') && !html.includes('kf-probe-x'), 'probe landing: names or shows a cookie that is not its own');
  check(!html.includes('<img') && !html.includes('onerror'), 'probe landing: renders a planted cookie name');
  check(html.includes('<strong>1</strong>, 25 bytes') && !html.includes('aaaa'), 'probe landing: must count only its own cookie and print its size, never its value');
  const cleared = await probe(new NextRequest(`${PROBE}?clear=1`, { headers: { cookie } }));
  check(cleared.headers.getSetCookie().every((c) => cookieName(c) === 'kf-probe-auth-token.0'), `probe clear: touches ${cleared.headers.getSetCookie().map(cookieName)}`);
  // An error inside the handler: a 500 that says nothing and is not stored.
  let broken = null;
  try { broken = await probe({ url: `${PROBE}?landed=real`, cookies: { getAll() { throw new Error(FOREIGN); } } }); } catch {}
  check(broken !== null, 'probe error: the handler threw; Next would answer with its own 500, not ours');
  if (broken) {
    check(broken.status === 500 && !(await broken.text()).includes(FOREIGN) && broken.headers.getSetCookie().length === 0, `probe error: ${broken.status}`);
    noStore(broken, 'error');
  }
  // After the sunset, nothing: a 404 that sets no cookie, on every path.
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-11-01T00:00:00Z');
  try {
    for (const q of ['?variant=real', '?variant=big', '?clear=1', '?landed=real']) {
      const res = await probe(new NextRequest(`${PROBE}${q}`, { headers: { cookie } }));
      check(res.status === 404 && res.headers.getSetCookie().length === 0, `probe after sunset ${q}: ${res.status}, ${res.headers.getSetCookie().length} cookies`);
      noStore(res, `after sunset ${q}`);
    }
    Date.now = () => Date.parse('2026-10-31T23:59:00Z');
    check((await probe(new NextRequest(`${PROBE}?variant=real`))).status === 307, 'probe: answers 404 before the sunset');
  } finally {
    Date.now = realNow;
  }
}

if (failures.length === 0) {
  console.log('PASS: register #135 holds: the real success 307 carries Secure session cookies, every writer agrees, refusals set nothing, and the probe reproduces the shape.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
