/**
 * Executable proof for LOGIN FIRST (it replaces activation fix 3's
 * sign-up-first rule): every signed-out entry, in the app and on the web,
 * lands on LOGIN; login carries a full-width "Create account" link to sign-up
 * and sign-up keeps its link back to login. The `kf-seen` mark is gone: no
 * response and no page writes it, and a device that still carries one is
 * treated like any other.
 *
 * The REAL things under test:
 *   - `middleware` (`src/middleware.ts`) with the real `updateSession`
 *     (`src/lib/supabase/middleware.ts`) and the real `@supabase/ssr` client,
 *     driven with `NextRequest`s. The only stand-in is `fetch`: GoTrue's
 *     `GET /auth/v1/user` answers a made-up user for the signed-in cases, and
 *     any other request fails the run;
 *   - the sign-up page's own onSubmit (no cookie written, app or web);
 *   - part 4, activation fix 4, unchanged: what the app's sign-up says;
 *   - part 5: the login and sign-up page functions, their element trees read
 *     for the cross links, in both locales and both shells.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-login-first.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, {
  'next/server': `export * from 'next/server.js';`,
  // Parts 3 to 5: the pages' browser client and platform.
  '@/lib/supabase/client': `export function createClient() { return { auth: { async signUp() { globalThis.__kfSignUp.calls++; return globalThis.__kfSignUp.answer; }, async signInWithPassword() { return { error: null }; } }, from() { return { async upsert() { return { error: null }; } }; } }; }`,
  '@/components/platform/PlatformProvider': `export function usePlatform() { return globalThis.__kfPlatform; }`,
});
const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

// ── 1. Nothing reads or writes the mark any more ────────────────────────────
check(!existsSync(resolvePath(ROOT, 'src/lib/first-screen.ts')), 'src/lib/first-screen.ts (the sign-up-first decision and the kf-seen mark) is gone');
for (const f of ['src/middleware.ts', 'src/lib/supabase/middleware.ts', 'src/app/[locale]/signup/page.tsx', 'src/app/[locale]/login/page.tsx']) {
  const code = readFileSync(resolvePath(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check(!/kf-seen|first-screen|SEEN_COOKIE|markSeen|signedOutPage/.test(code), `${f}: no code names the kf-seen mark or the old decision`);
}

// ── 2. The real middleware ──────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-not-a-key';
const USER = { id: '3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c', aud: 'authenticated', role: 'authenticated', email: 'student@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-11-10T00:00:00Z' };
const stray = [];
globalThis.fetch = async (input) => {
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
const APP2 = APP.replace('KnowFlowApp/1', 'KnowFlowApp/2');
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

// The app's first request is its root, which goes to the dashboard, which a
// signed-out request leaves for login. Each hop is read, then the chain.
const REDIRECTS = [
  ['/en', APP, [], '/en/dashboard', "the app's root goes to the dashboard first (unchanged)"],
  ['/ar', APP2, [], '/ar/dashboard', '...at shell 2 too, in Arabic'],
  ['/en/dashboard', APP, [], '/en/login', 'the app, signed out, fresh device: dashboard -> login'],
  ['/ar/dashboard', APP, [], '/ar/login', '...in Arabic too'],
  ['/ar/dashboard', APP2, [], '/ar/login', '...at shell 2 (Sign in with Apple) too'],
  ['/en/dashboard', APP, ['kf-seen=1'], '/en/login', 'the app, signed out, a device still carrying the old kf-seen mark: login, the same'],
  ['/ar/dashboard/settings', APP, [], '/ar/login', 'any dashboard page, in Arabic'],
  ['/en/dashboard', WEB, [], '/en/login', 'the web, signed out: dashboard -> login (unchanged)'],
  ['/ar/dashboard', WEB, [], '/ar/login', '...in Arabic (unchanged)'],
];
for (const [path, ua, cookies, want, why] of REDIRECTS) {
  const r = await ask(path, ua, cookies);
  check(r.to === want, `${why}: ${path} -> ${r.to} (status ${r.status}), want ${want}`);
  check(r.seen === null, `${why}: writes no kf-seen (${r.seen})`);
}
for (const [locale, ua, shell] of [['en', APP, 1], ['ar', APP, 1], ['ar', APP2, 2]]) {
  const hop1 = await ask(`/${locale}`, ua);
  const hop2 = hop1.to ? await ask(hop1.to, ua) : { to: null };
  const hop3 = hop2.to ? await ask(hop2.to, ua) : { to: null, rewrite: null };
  check(hop2.to === `/${locale}/login` && hop3.to === null && hop3.rewrite === `/${locale}/native/login`, `the app's first launch, ${locale}, shell ${shell}: /${locale} -> ${hop1.to} -> ${hop2.to}, served as ${hop3.rewrite}; want the login twin`);
}
// An explicit visit to either page is served, in the app as its twin.
for (const [path, want] of [['/en/login', '/en/native/login'], ['/en/signup', '/en/native/signup'], ['/ar/login', '/ar/native/login'], ['/ar/signup', '/ar/native/signup']]) {
  const r = await ask(path, APP);
  check(r.to === null && r.rewrite === want, `the app asking ${path} gets that page's twin: to=${r.to} rewrite=${r.rewrite}`);
}
for (const path of ['/en/login', '/en/signup', '/ar/login', '/ar/signup']) {
  const r = await ask(path, WEB);
  check(r.to === null && r.rewrite === null, `the web asking ${path} is served that page: to=${r.to} rewrite=${r.rewrite}`);
}

// Signed in: no redirect, and no mark is written anywhere.
for (const [path, ua, why] of [['/en/dashboard', APP, 'the app on the dashboard'], ['/en/login', APP, 'the app on the login twin'], ['/en/dashboard', WEB, 'the web on the dashboard']]) {
  const r = await ask(path, ua, [SESSION]);
  check(r.to === null && r.seen === null, `signed in, ${why}: no redirect and no kf-seen (to=${r.to} seen=${r.seen})`);
}
check(stray.length === 0, `no request left the process except GoTrue's /user: ${stray.join(', ')}`);

// ── 3. The real sign-up handler writes no cookie ────────────────────────────
// The REAL page function runs with React's hooks it calls answered in place
// (useState -> its initial value, use -> the params, useEffect -> nothing), the
// Supabase browser client and usePlatform stubbed, `document.cookie` recorded;
// the form's own onSubmit is called. Nothing renders and nothing leaves the process.
const PAGE = pathToFileURL(resolvePath(ROOT, 'src/app/[locale]/signup/page.tsx')).href;
const LOGIN = pathToFileURL(resolvePath(ROOT, 'src/app/[locale]/login/page.tsx')).href;
registerHooks({
  resolve(spec, ctx, next) {
    // AppleButton.tsx too: the pages call its useAppleSignIn() (item 4f), which
    // answers null here as on the server (the effect never runs).
    if (spec === 'react' && (ctx.parentURL === PAGE || ctx.parentURL === LOGIN || ctx.parentURL?.endsWith('/src/components/auth/AppleButton.tsx'))) {
      return { url: 'data:text/javascript,' + encodeURIComponent("export * from 'react'; export function useState(v) { return [v, () => {}]; } export function use(p) { return p; } export function useEffect() {}"), shortCircuit: true };
    }
    return next(spec, ctx);
  },
});
const { default: SignupPage } = await import(PAGE);
const { default: LoginPage } = await import(LOGIN);
function findForm(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findForm(n); if (f) return f; } return null; }
  if (node.type === 'form') return node;
  return findForm(node.props?.children);
}
async function submit(platform, answer) {
  globalThis.__kfPlatform = platform;
  globalThis.__kfSignUp = { calls: 0, answer };
  const writes = [];
  globalThis.window = { location: { origin: 'https://tryknowflow.com' } };
  globalThis.document = { set cookie(v) { writes.push(v); }, get cookie() { return ''; } };
  try {
    const form = findForm(SignupPage({ params: { locale: 'en' } }));
    if (!form) return { error: 'no form' };
    await form.props.onSubmit({ preventDefault() {} });
    return { writes, calls: globalThis.__kfSignUp.calls };
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}
const OK_NO_SESSION = { data: { user: { id: USER.id }, session: null }, error: null };
const OK_SESSION = { data: { user: { id: USER.id }, session: { access_token: 'x' } }, error: null };
const REFUSED = { data: { user: null, session: null }, error: { message: 'refused' } };
for (const [why, platform, answer] of [
  ['the app, sign-up accepted, mail to confirm (no session)', 'native', OK_NO_SESSION],
  ['the app, sign-up accepted with a session', 'native', OK_SESSION],
  ['the app, sign-up refused', 'native', REFUSED],
  ['the web, sign-up accepted', 'web', OK_NO_SESSION],
]) {
  const r = await submit(platform, answer);
  check(!r.error && r.calls === 1 && r.writes.length === 0, `${why}: signUp calls ${r.calls}, no cookie written: ${JSON.stringify(r.writes ?? r.error)}`);
}

// ── 4. What the app's sign-up says (activation fix 4, owner-approved 2026-11-10) ─
// docs/copy-drafts/activation_3_signup.md, shipped: under the subtitle, in the
// slot the web gives `cta.note` (the free-plan line), the app shows the
// approved `about.subtitle`, unchanged, in both locales. The web keeps
// `cta.note` and does not show the new line. The REAL page function is
// called and its element tree read; no new key, no plan word in the app.
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { kfWording } = await load('scripts/lib/app-wording.mjs');
const plain = (s) => s.replace(/[ ⁠]/g, (c) => (c === ' ' ? ' ' : ''));
function texts(node, out = []) {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push(plain(String(node))); return out; }
  if (Array.isArray(node)) { for (const n of node) texts(n, out); return out; }
  if (typeof node === 'object') texts(node.props?.children, out);
  return out;
}
function heading(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const h = heading(n); if (h) return h; } return null; }
  if (Array.isArray(node.props?.children) && node.props.children.some((c) => c?.type === 'h1')) return node;
  return heading(node.props?.children);
}
for (const [loc, dict] of [['en', en], ['ar', ar]]) {
  for (const platform of ['native', 'web']) {
    globalThis.__kfPlatform = platform;
    const head = heading(SignupPage({ params: { locale: loc } }));
    const said = head ? texts(head) : [];
    const all = said.join(' | ');
    const app = platform === 'native';
    check(!!head, `${loc} ${platform}: the sign-up heading block is found`);
    check(said.includes(dict.auth.signupSubtitle), `${loc} ${platform}: the subtitle is still there: ${all}`);
    check(said.includes(dict.about.subtitle) === app, `${loc} ${platform}: about.subtitle ${app ? 'shown under the subtitle' : 'not shown (the web is unchanged)'}: ${all}`);
    check(said.includes(plain(dict.cta.note)) === !app, `${loc} ${platform}: cta.note ${app ? 'not shown in the app' : 'still shown on the web'}: ${all}`);
    if (app) check(kfWording(all).length === 0, `${loc} app: no plan, price, upgrade or free word in the heading: ${JSON.stringify(kfWording(all))}`);
  }
}
check(/\*\*Status: SHIPPED/.test((await import('node:fs')).readFileSync(resolvePath(ROOT, 'docs/copy-drafts/activation_3_signup.md'), 'utf8')), 'the copy draft is marked shipped');

// ── 5. The cross links, read from the real pages ────────────────────────────
// Login (everyone's first screen) holds ONE link to /<locale>/signup, worded
// `nav.createAccount` and drawn as the full-width button (data-kf-create-
// account); sign-up keeps its link to /<locale>/login. Both locales, both
// shells; the page's dir follows the locale (RTL for Arabic).
function links(node, out = []) {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) { for (const n of node) links(n, out); return out; }
  if (typeof node.props?.href === 'string') out.push({ href: node.props.href, text: texts(node.props.children).join(' ').trim(), props: node.props });
  links(node.props?.children, out);
  return out;
}
for (const [loc, dict] of [['en', en], ['ar', ar]]) {
  for (const platform of ['native', 'web']) {
    globalThis.__kfPlatform = platform;
    const login = LoginPage({ params: { locale: loc } });
    const toSignup = links(login).filter((l) => l.href === `/${loc}/signup`);
    check(toSignup.length === 1, `${loc} ${platform}: login has exactly one link to /${loc}/signup: ${toSignup.length}`);
    const c = toSignup[0];
    check(c && c.text === plain(dict.nav.createAccount), `${loc} ${platform}: ...worded nav.createAccount (${JSON.stringify(dict.nav.createAccount)}): ${JSON.stringify(c?.text)}`);
    check(c && 'data-kf-create-account' in c.props && /\bw-full\b/.test(c.props.className) && /min-h-\[3\.375rem\]/.test(c.props.className), `${loc} ${platform}: ...drawn as the full-width button: ${c?.props.className}`);
    check(c && kfWording(c.text).length === 0, `${loc} ${platform}: ...with no plan, price or free word: ${JSON.stringify(c && kfWording(c.text))}`);
    check(login.props.dir === (loc === 'ar' ? 'rtl' : 'ltr'), `${loc} ${platform}: login's dir is ${login.props.dir}`);
    const signup = SignupPage({ params: { locale: loc } });
    check(links(signup).some((l) => l.href === `/${loc}/login`), `${loc} ${platform}: sign-up keeps its link to /${loc}/login`);
  }
}

for (const f of failures) console.log(`FAIL ${f}`);
console.log(`${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
