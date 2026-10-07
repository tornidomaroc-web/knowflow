/**
 * Executable proof for the request-time platform marker (docs/store/STORE_PATH.md
 * step a; Apple 3.1.1(a) and 4.8; src/lib/platform.ts).
 *
 * THREE CLAIMS, EACH HELD AGAINST THE REAL CODE:
 *
 *   1. THE READING. `platformFromHeaders` answers `native` to the user-agent
 *      token the shell appends (`KnowFlowApp/<n>`) and to `x-kf-platform:
 *      native`, and `web` to everything else, including an iPhone Safari user
 *      agent and an empty request. The middleware, driven with real
 *      NextRequests, sends an app request for `/<locale>` and `/<locale>/pricing`
 *      to the dashboard (307) and lets every other path through; a web request
 *      is never redirected.
 *
 *   2. THE MARKER ONLY REMOVES. Every gated surface is RENDERED twice from its
 *      real .tsx (react-dom/server through the project's own TypeScript, the
 *      way the other proofs do): the site header, the Google button, the login
 *      and signup pages, Settings, the student home. For each, the native
 *      markup carries no purchase link, no upgrade word and no Google button,
 *      the web markup carries them as today, and EVERY href in the native
 *      markup is also in the web markup. A forged marker can hide; it cannot
 *      show, grant or redirect anywhere the web could not go.
 *
 *   3. NOTHING ROTS. A source scan over src/: every line that links /pricing,
 *      passes an upgrade href, or starts a Google sign-in is in a file this
 *      script knows and gates, and the gating expression is on the line or in
 *      the file. A new upgrade link, pricing link or Google button that does
 *      not go through `purchaseLinksAllowed(platform)` / `googleSignInAllowed`
 *      fails CI here. The build-time flag is gone: no `NEXT_PUBLIC_KF_PLATFORM`
 *      anywhere in src/, and the two predicates take a platform argument
 *      (`tsc` enforces the signature; this script enforces that nobody
 *      hard-codes 'web' into them).
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-platform-gate.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

installTsxHooks(ROOT, {
  // `src/middleware.ts` imports the bare specifier; node's resolver wants the file.
  'next/server': `export * from 'next/server.js';`,
  '@/lib/supabase/client': `export function createClient() { return { auth: { signOut: async () => {}, signInWithPassword: async () => ({ error: null }), signUp: async () => ({ data: {}, error: null }), getUser: async () => ({ data: { user: null } }) } }; }`,
  // The middleware's session half is register #135's (verify-session-cookies);
  // here it is a pass-through so the platform redirect is what is under test.
  '@/lib/supabase/middleware': `import { NextResponse } from 'next/server'; export async function updateSession(request) { return NextResponse.next({ request }); }`,
});

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const APP_UA = `${IPHONE_UA} KnowFlowApp/1`;

// ── 1. The reading, and the middleware ─────────────────────────────────────────
const platform = await load('src/lib/platform.ts');
const hdr = (map) => (name) => map[name.toLowerCase()] ?? null;
check(platform.platformFromHeaders(hdr({ 'user-agent': APP_UA })) === 'native', 'the app user agent is not read as native');
check(platform.platformFromHeaders(hdr({ 'user-agent': IPHONE_UA })) === 'web', 'a plain iPhone Safari user agent must be web');
check(platform.platformFromHeaders(hdr({ 'user-agent': 'KnowFlowApp' })) === 'web', 'the bare token without a version must not count');
check(platform.platformFromHeaders(hdr({ 'x-kf-platform': 'native' })) === 'native', 'x-kf-platform: native is not read as native');
check(platform.platformFromHeaders(hdr({ 'x-kf-platform': 'anything' })) === 'web', 'an unknown header value must be web');
check(platform.platformFromHeaders(hdr({})) === 'web', 'an empty request must be web');
check(platform.platformFromRequest({}) === 'web' && platform.platformFromRequest({ headers: new Headers({ 'user-agent': APP_UA }) }) === 'native', 'platformFromRequest does not read the user agent');
check(platform.purchaseLinksAllowed('web') === true && platform.purchaseLinksAllowed('native') === false, 'purchaseLinksAllowed is wrong');
check(platform.googleSignInAllowed('web') === true && platform.googleSignInAllowed('native') === false, 'googleSignInAllowed is wrong');
check(!('PLATFORM' in platform), 'the build-time PLATFORM constant is back; the marker is request-time only');
check(platform.NATIVE_USER_AGENT_TOKEN === 'KnowFlowApp', `the token step b must append changed: ${platform.NATIVE_USER_AGENT_TOKEN}`);

const { NextRequest } = await import('next/server.js');
const { middleware } = await load('src/middleware.ts');
const ORIGIN = 'https://tryknowflow.com';
async function mw(path, ua) {
  const res = await middleware(new NextRequest(`${ORIGIN}${path}`, { headers: { 'user-agent': ua, accept: 'text/html' } }));
  return { status: res.status, location: res.headers.get('location') };
}
for (const locale of ['en', 'ar']) {
  for (const path of [`/${locale}`, `/${locale}/pricing`]) {
    const app = await mw(path, APP_UA);
    check(app.status === 307 && app.location === `${ORIGIN}/${locale}/dashboard`, `app request for ${path}: expected 307 to /${locale}/dashboard, got ${app.status} ${app.location}`);
    const web = await mw(path, IPHONE_UA);
    check(web.status === 200 && web.location === null, `web request for ${path} must pass through, got ${web.status} ${web.location}`);
  }
  for (const path of [`/${locale}/privacy`, `/${locale}/terms`, `/${locale}/login`, `/${locale}/dashboard/settings`, `/${locale}/about`]) {
    const app = await mw(path, APP_UA);
    check(app.status === 200 && app.location === null, `app request for ${path} must be served, got ${app.status} ${app.location}`);
  }
}
// The redirect target is the one page the web can also reach, and it is behind
// the session check: a forged marker buys a web browser nothing but a bounce.
{
  const forged = await mw('/en/pricing', 'Mozilla/5.0 KnowFlowApp/9 (forged)');
  check(forged.status === 307 && forged.location === `${ORIGIN}/en/dashboard`, 'a forged marker must behave exactly like the app: hidden, never granted');
}

// ── 2. The marker only removes: every gated surface rendered both ways ─────────
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { PlatformProvider } = await load('src/components/platform/PlatformProvider.tsx');
const under = (p, el) => renderToStaticMarkup(React.createElement(PlatformProvider, { platform: p }, el));
const hrefs = (html) => new Set([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
const UPGRADE_WORDS = /\bPro\b|\bupgrade|الاحترافي|ترقية/i;
const GOOGLE = /Google|fill="#4285F4"/;
function onlyRemoves(name, web, native, { mustKeep = [] } = {}) {
  const w = hrefs(web), n = hrefs(native);
  for (const h of n) check(w.has(h), `${name}: the native markup links ${h}, which the web markup does not: the marker added something`);
  check(![...n].some((h) => /\/pricing/.test(h)), `${name}: native markup links /pricing`);
  check(!/\/pricing/.test(native), `${name}: native markup mentions /pricing`);
  check(!GOOGLE.test(native), `${name}: native markup carries the Google button`);
  for (const h of mustKeep) check(n.has(h), `${name}: native markup lost ${h}, which must stay`);
  console.error(`${name}: web ${web.length} chars, ${w.size} hrefs; native ${native.length} chars, ${n.size} hrefs`);
}

globalThis.__tsxHooksPathname = '/en/privacy';
const { SiteHeader } = await load('src/components/layout/SiteHeader.tsx');
const headerLabels = { home: 'KnowFlow', howItWorks: 'How', pricing: 'Pricing', about: 'About', signIn: 'Sign in', getStarted: 'Start', menu: 'Menu', appearance: 'Appearance', themeDark: 'Dark', themeLight: 'Light' };
for (const locale of ['en', 'ar']) {
  const web = renderToStaticMarkup(React.createElement(SiteHeader, { locale, labels: headerLabels, showPricing: true }));
  const native = renderToStaticMarkup(React.createElement(SiteHeader, { locale, labels: headerLabels, showPricing: false }));
  check(web.includes(`href="/${locale}/pricing"`), `${locale} header on the web lost its Pricing link`);
  onlyRemoves(`SiteHeader ${locale}`, web, native, { mustKeep: [`/${locale}/about`, `/${locale}/login`] });
}

const { GoogleButton } = await load('src/components/auth/GoogleButton.tsx');
{
  const web = under('web', React.createElement(GoogleButton, { label: 'Continue with Google', errorLabel: 'failed' }));
  const native = under('native', React.createElement(GoogleButton, { label: 'Continue with Google', errorLabel: 'failed' }));
  check(GOOGLE.test(web) && web.includes('Continue with Google'), 'GoogleButton on the web does not render');
  check(native === '', `GoogleButton inside the app must render nothing, got ${native.length} chars`);
  const outside = renderToStaticMarkup(React.createElement(GoogleButton, { label: 'Continue with Google', errorLabel: 'failed' }));
  check(GOOGLE.test(outside), 'GoogleButton with no provider must fail toward the web (shown)');
}

for (const [name, path, file] of [['login', '/en/login', 'src/app/[locale]/login/page.tsx'], ['signup', '/en/signup', 'src/app/[locale]/signup/page.tsx']]) {
  globalThis.__tsxHooksPathname = path;
  const Page = (await load(file)).default;
  for (const locale of ['en', 'ar']) {
    // `use(params)` reads a fulfilled thenable synchronously; a real Promise
    // would suspend renderToStaticMarkup (the same shape the auth proofs use).
    const params = { status: 'fulfilled', value: { locale }, then() {} };
    const props = { params };
    const web = under('web', React.createElement(Page, props));
    const native = under('native', React.createElement(Page, props));
    check(GOOGLE.test(web), `${name} ${locale} on the web lost its Google button`);
    check(web.includes('type="password"') && native.includes('type="password"'), `${name} ${locale}: the email and password form must stay in both shells`);
    onlyRemoves(`${name} page ${locale}`, web, native);
  }
}

globalThis.__tsxHooksPathname = '/en/dashboard/settings';
const { SettingsPanel } = await load('src/components/dashboard/SettingsPanel.tsx');
const settingsLabels = Object.fromEntries(['title','subtitle','account','email','plan','free','pro','freePlanDesc','proPlanDesc','renews','cancels','activeSubscription','preferences','language','appearance','themeDark','themeLight','helpLegal','privacyPolicy','terms','support','supportDesc'].map((k) => [k, k]));
settingsLabels.upgrade = 'Upgrade to Pro';
const { purchaseLinksAllowed } = platform;
for (const locale of ['en', 'ar']) {
  const render = (p) => renderToStaticMarkup(React.createElement(SettingsPanel, {
    email: 'student@example.com', isPro: false, renewsOn: null, cancelsOn: null,
    upgradeHref: purchaseLinksAllowed(p) ? `/${locale}/pricing` : null,
    locale, pathname: `/${locale}/dashboard/settings`, privacyHref: `/${locale}/privacy`, termsHref: `/${locale}/terms`,
    supportEmail: 'support@example.com', labels: settingsLabels, deleteCard: null,
  }));
  const web = render('web'), native = render('native');
  check(web.includes(`href="/${locale}/pricing"`), `Settings ${locale} on the web lost Upgrade`);
  check(!UPGRADE_WORDS.test(native.replace(/freePlanDesc|proPlanDesc/g, '')) || !native.includes('Upgrade to Pro'), `Settings ${locale} in the app still offers Upgrade`);
  onlyRemoves(`Settings ${locale}`, web, native, { mustKeep: [`/${locale}/privacy`, `/${locale}/terms`] });
}

const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
const { buildHrefs } = await load('src/lib/home-props.ts');
const homeLabels = Object.fromEntries(['welcome','askTitle','askDesc','newSubject','newSubjectDesc','subjects','streakLabel','streakUnit','streakZoneHint','recentActivity','planTitle','planName','ofWord','subjectsUsed','allSubjects','materialsWord','noSubjects','noSubjectsDesc','startTitle','whatTitle','upgradeCta','noActivity','conversation','showLess','viewAll','unknownKb'].map((k) => [k, k]));
homeLabels.whatLines = ['a', 'b', 'c'];
homeLabels.activity = { noActivity: 'n', conversation: 'c', showLess: 's', viewAll: 'v', unknownKb: 'u' };
for (const locale of ['en', 'ar']) {
  const render = (p) => renderToStaticMarkup(React.createElement(StudentHome, {
    stats: [], streak: null, ...buildHrefs(locale, p), isPro: false, quotas: [], subjects: [], subjectsUsed: 0, subjectsLimit: 5, onboarding: [],
    labels: homeLabels, recentActivity: [],
  }));
  const web = render('web'), native = render('native');
  check(web.includes(`href="/${locale}/pricing"`), `StudentHome ${locale} on the web lost Upgrade`);
  onlyRemoves(`StudentHome ${locale}`, web, native, { mustKeep: [`/${locale}/dashboard/agent`, `/${locale}/dashboard/knowledge/new`] });
}

// ── 3. Nothing rots: the source scan ───────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = resolvePath(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(resolvePath(ROOT, 'src')).map((p) => [relative(ROOT, p).replace(/\\/g, '/'), readFileSync(p, 'utf8')]);
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// (a) Every pricing link, and the gate on its line.
const PRICING_OK = {
  'src/app/sitemap.ts': () => true, // the public sitemap: the web's, never served to the app's user
  'src/app/[locale]/dashboard/settings/page.tsx': (line) => /purchaseLinksAllowed\(await currentPlatform\(\)\)/.test(line),
  'src/app/[locale]/preview/settings/page.tsx': (line) => /native \? null :/.test(line),
  'src/components/layout/SiteHeader.tsx': (line) => /showPricing \?/.test(line),
  'src/lib/home-props.ts': (line) => /purchaseLinksAllowed\(platform\)/.test(line),
  'src/middleware.ts': (line) => /rest === '\/pricing'/.test(line),
};
for (const [file, src] of files) {
  for (const line of strip(src).split('\n')) {
    if (!/\/pricing/.test(line)) continue;
    const ok = PRICING_OK[file];
    check(ok && ok(line), `${file}: a /pricing reference without the platform gate on its line: ${line.trim().slice(0, 100)}`);
  }
}
// (b) Every upgrade href handed to a screen comes from the gate.
for (const [file, src] of files) {
  for (const line of strip(src).split('\n')) {
    if (!/upgradeHref[=:]/.test(line) || /upgradeHref: string|upgradeHref,$|upgradeHref\?/.test(line.trim())) continue;
    const gated = /purchaseLinksAllowed\(/.test(line) || /native \? null/.test(line);
    check(gated, `${file}: upgradeHref set without purchaseLinksAllowed(...): ${line.trim().slice(0, 100)}`);
  }
}
// (c) Google sign-in starts in exactly one component, and that component is gated.
for (const [file, src] of files) {
  const s = strip(src);
  if (/startOAuth\(\s*'google'/.test(s)) check(file === 'src/components/auth/GoogleButton.tsx', `${file}: starts a Google sign-in outside GoogleButton`);
  if (/<GoogleButton\b/.test(s)) check(['src/app/[locale]/login/page.tsx', 'src/app/[locale]/signup/page.tsx'].includes(file), `${file}: renders GoogleButton on a page this proof does not render both ways`);
}
{
  const gb = strip(readFileSync(resolvePath(ROOT, 'src/components/auth/GoogleButton.tsx'), 'utf8'));
  check(/if \(!googleSignInAllowed\(platform\)\) return null;/.test(gb), 'GoogleButton no longer returns null inside the app');
  check(/usePlatform\(\)/.test(gb), 'GoogleButton no longer reads the platform from context');
}
// (d) The predicates are never fed a literal, and the build-time flag is gone.
for (const [file, src] of files) {
  const s = strip(src);
  if (/(purchaseLinksAllowed|googleSignInAllowed)\(\s*'(web|native)'\s*\)/.test(s)) check(false, `${file}: a predicate called with a literal platform`);
  if (/(purchaseLinksAllowed|googleSignInAllowed)\(\s*\)/.test(s)) check(false, `${file}: a predicate called with no platform`);
  if (/NEXT_PUBLIC_KF_PLATFORM/.test(s)) check(false, `${file}: the build-time flag is back`);
  if (/navigator\.userAgent/.test(s)) check(false, `${file}: client code sniffs the user agent; the platform comes from the request through PlatformProvider`);
}
// (e) Every page or layout that renders a gated surface reads the request.
for (const file of ['src/app/[locale]/(site)/layout.tsx', 'src/app/[locale]/dashboard/layout.tsx', 'src/app/[locale]/dashboard/page.tsx', 'src/app/[locale]/dashboard/settings/page.tsx', 'src/app/[locale]/login/layout.tsx', 'src/app/[locale]/signup/layout.tsx']) {
  const src = readFileSync(resolvePath(ROOT, file), 'utf8');
  check(/await currentPlatform\(\)/.test(src), `${file} no longer reads the platform from the request (it would be prerendered as the web variant and cached)`);
}

if (failures.length === 0) {
  console.log('PASS: the marker is read from the request, only removes, and every gated surface is covered.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
