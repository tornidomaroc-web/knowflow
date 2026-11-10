/**
 * Executable proof for activation fix 3 (the 2026-11-09 audit, cause #2):
 * in the app, a signed-out visitor on a device that has never held a session
 * opens on SIGN-UP; a device that has (cookie `kf-seen=1`) opens on LOGIN; the
 * web is unchanged.
 *
 * The REAL things under test:
 *   - `signedOutPage` / `markSeen` (`src/lib/first-screen.ts`), the decision;
 *   - `middleware` (`src/middleware.ts`) with the real `updateSession`
 *     (`src/lib/supabase/middleware.ts`) and the real `@supabase/ssr` client,
 *     driven with `NextRequest`s: where the app's and the web's signed-out
 *     request for the dashboard is sent, and which signed-in responses write
 *     the mark, with which flags. The only stand-in is `fetch`: GoTrue's
 *     `GET /auth/v1/user` answers a made-up user for the signed-in cases, and
 *     any other request fails the run.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-activation-3.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, { 'next/server': `export * from 'next/server.js';` });
const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

// ── 1. The decision ─────────────────────────────────────────────────────────
// On a tree without the helper (main before this change) part 1 fails as one
// line and part 2 still runs, so the real middleware's answers are printed.
const HAS_HELPER = existsSync(resolvePath(ROOT, 'src/lib/first-screen.ts'));
check(HAS_HELPER, 'src/lib/first-screen.ts exists (the first-screen decision)');
const fs = HAS_HELPER ? await load('src/lib/first-screen.ts') : { signedOutPage: () => 'absent', markSeen: () => 'absent' };
const DECISIONS = [
  ['native', undefined, 'signup', 'the app on a fresh device opens on sign-up'],
  ['native', '1', 'login', 'the app on a device that held a session opens on login'],
  ['native', '0', 'signup', 'the app with any other cookie value opens on sign-up'],
  ['web', undefined, 'login', 'the web without the cookie opens on login (unchanged)'],
  ['web', '1', 'login', 'the web with the cookie opens on login (unchanged)'],
];
for (const [platform, seen, want, why] of DECISIONS) {
  const got = fs.signedOutPage(platform, seen);
  check(got === want, `${why}: signedOutPage(${platform}, ${seen}) = ${got}, want ${want}`);
}
check(fs.markSeen('native', undefined) === true, 'the app writes the mark when it is missing');
check(fs.markSeen('native', '1') === false, 'the app does not write the mark twice');
check(fs.markSeen('web', undefined) === false, 'the web never writes the mark');

// ── 2. The real middleware ──────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-not-a-key';
const USER = { id: '3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c', aud: 'authenticated', role: 'authenticated', email: 'student@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-11-10T00:00:00Z' };
const stray = [];
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (/\/auth\/v1\/user$/.test(url)) {
    return new Response(JSON.stringify(USER), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  stray.push(url);
  return new Response('{}', { status: 500 });
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, aud: 'authenticated', role: 'authenticated', exp })}.sig`;
const SESSION = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: USER })).toString('base64url')}`;

const { NextRequest } = await import('next/server.js');
const { middleware } = await load('src/middleware.ts');
const APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const WEB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
async function ask(path, ua, cookies = []) {
  const headers = { 'user-agent': ua, accept: 'text/html', 'sec-fetch-dest': 'document' };
  if (cookies.length) headers.cookie = cookies.join('; ');
  const res = await middleware(new NextRequest(`https://tryknowflow.com${path}`, { headers }));
  const loc = res.headers.get('location');
  return {
    status: res.status,
    to: loc ? new URL(loc).pathname : null,
    rewrite: res.headers.get('x-middleware-rewrite') ? new URL(res.headers.get('x-middleware-rewrite')).pathname : null,
    seen: (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('kf-seen=')) ?? null,
  };
}

const REDIRECTS = [
  ['/en/dashboard', APP, [], '/en/signup', 'the app, signed out, fresh device: dashboard -> sign-up'],
  ['/ar/dashboard', APP, [], '/ar/signup', '...in Arabic too'],
  ['/en/dashboard', APP, ['kf-seen=1'], '/en/login', 'the app, signed out, device that held a session: dashboard -> login'],
  ['/ar/dashboard/settings', APP, ['kf-seen=1'], '/ar/login', '...any dashboard page, in Arabic'],
  ['/en/dashboard', WEB, [], '/en/login', 'the web, signed out: dashboard -> login (unchanged)'],
  ['/en/dashboard', WEB, ['kf-seen=1'], '/en/login', 'the web with the cookie: dashboard -> login (unchanged)'],
  ['/en', APP, [], '/en/dashboard', 'the app\'s root still goes to the dashboard first (unchanged)'],
];
for (const [path, ua, cookies, want, why] of REDIRECTS) {
  const r = await ask(path, ua, cookies);
  check(r.to === want, `${why}: ${path} -> ${r.to} (status ${r.status}), want ${want}`);
  check(r.seen === null, `${why}: a signed-out response writes no kf-seen (${r.seen})`);
}
// An explicit visit to either page is served, in the app as its twin.
for (const [path, cookies, want] of [['/en/login', [], '/en/native/login'], ['/en/signup', [], '/en/native/signup'], ['/ar/login', ['kf-seen=1'], '/ar/native/login']]) {
  const r = await ask(path, APP, cookies);
  check(r.to === null && r.rewrite === want, `the app asking ${path} (${cookies.join(',') || 'no cookie'}) gets that page's twin: to=${r.to} rewrite=${r.rewrite}`);
}

// Signed in: the app writes the mark once; the web never does.
const signedApp = await ask('/en/dashboard', APP, [SESSION]);
check(signedApp.to === null, `the app, signed in, stays on the dashboard: to=${signedApp.to}`);
const flags = (signedApp.seen ?? '').split(';').map((s) => s.trim().toLowerCase());
check(signedApp.seen !== null && flags[0] === 'kf-seen=1', `the app, signed in, writes kf-seen=1: ${signedApp.seen}`);
for (const f of ['path=/', 'max-age=34560000', 'httponly', 'secure', 'samesite=lax']) {
  check(flags.includes(f), `...with ${f}: ${signedApp.seen}`);
}
const signedAppLogin = await ask('/en/login', APP, [SESSION]);
check(signedAppLogin.seen !== null && signedAppLogin.rewrite === '/en/native/login', `...on a twin page too, the rewrite keeping the cookie: rewrite=${signedAppLogin.rewrite} seen=${signedAppLogin.seen}`);
const signedAppAgain = await ask('/en/dashboard', APP, [SESSION, 'kf-seen=1']);
check(signedAppAgain.seen === null, `the app, signed in, already marked: no second write (${signedAppAgain.seen})`);
const signedWeb = await ask('/en/dashboard', WEB, [SESSION]);
check(signedWeb.to === null && signedWeb.seen === null, `the web, signed in: no redirect and no kf-seen (to=${signedWeb.to} seen=${signedWeb.seen})`);
check(stray.length === 0, `no request left the process except GoTrue's /user: ${stray.join(', ')}`);

for (const f of failures) console.log(`FAIL ${f}`);
console.log(`${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
