/**
 * Executable proof for the request-time platform marker (docs/store/STORE_PATH.md
 * step a; Apple 3.1.1(a) and 4.8; src/lib/platform.ts).
 *
 * THREE CLAIMS, EACH HELD AGAINST THE REAL CODE:
 *
 *   1. THE READING, AND THE ROUTING. `platformFromHeaders` answers `native`
 *      to the user-agent token the shell appends (`KnowFlowApp/<n>`) and to
 *      `x-kf-platform: native`, and `web` to everything else, including an
 *      iPhone Safari user agent and an empty request. The middleware, driven
 *      with real NextRequests: an app request for `/<locale>` and
 *      `/<locale>/pricing` goes to the dashboard (307); an app request for a
 *      prerendered page with a twin (login, signup, the legal and marketing
 *      pages) is REWRITTEN to `/<locale>/native/<page>`, the URL unchanged; a
 *      web request is never redirected and never rewritten, so the web's
 *      cached pages are untouched; a web request straight to a `/native/` path
 *      is rewritten to a path no page claims, which the catch-all answers 404.
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
 *      hard-codes 'web' into them). The twin tree `src/app/[locale]/native/`
 *      holds exactly the pages the middleware rewrites, each a bare re-export
 *      of its web page, and nothing under it reads the request, so every twin
 *      stays prerendered; and no static web page or layout reads the request
 *      either, so the web stays on the CDN.
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
  return { status: res.status, location: res.headers.get('location'), rewrite: res.headers.get('x-middleware-rewrite') };
}
for (const locale of ['en', 'ar']) {
  for (const path of [`/${locale}`, `/${locale}/pricing`]) {
    const app = await mw(path, APP_UA);
    check(app.status === 307 && app.location === `${ORIGIN}/${locale}/dashboard`, `app request for ${path}: expected 307 to /${locale}/dashboard, got ${app.status} ${app.location}`);
    const web = await mw(path, IPHONE_UA);
    check(web.status === 200 && web.location === null && web.rewrite === null, `web request for ${path} must pass through, got ${web.status} ${web.location} ${web.rewrite}`);
  }
  for (const page of ['/login', '/signup', '/about', '/contact', '/privacy', '/terms', '/refund']) {
    const app = await mw(`/${locale}${page}`, APP_UA);
    check(app.status === 200 && app.rewrite === `${ORIGIN}/${locale}/native${page}`, `app request for /${locale}${page}: expected a rewrite to /${locale}/native${page}, got ${app.status} rewrite=${app.rewrite}`);
    const web = await mw(`/${locale}${page}`, IPHONE_UA);
    check(web.status === 200 && web.location === null && web.rewrite === null, `web request for /${locale}${page} must be served as it is (no rewrite, no redirect), got ${web.status} ${web.location} ${web.rewrite}`);
    const direct = await mw(`/${locale}/native${page}`, IPHONE_UA);
    check(direct.rewrite !== null && /native-is-not-a-page/.test(direct.rewrite), `a web visit to /${locale}/native${page} must be sent to the 404, got rewrite=${direct.rewrite}`);
  }
  for (const path of [`/${locale}/dashboard/settings`, `/${locale}/forgot-password`, `/${locale}/dashboard/knowledge/new`]) {
    const app = await mw(path, APP_UA);
    check(app.status === 200 && app.location === null && app.rewrite === null, `app request for ${path} must pass through, got ${app.status} ${app.location} ${app.rewrite}`);
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
  // The login line for Google-registered students (GoogleAccountHint) names
  // Google in words on purpose and links only to the forgot page the web
  // also links; it is cut out before the button test, and nothing else is.
  const nativeSansHint = native.replace(/<p data-kf-google-hint="[^"]*"[^>]*>[\s\S]*?<\/p>/g, '');
  check(!GOOGLE.test(nativeSansHint), `${name}: native markup carries the Google button`);
  for (const h of mustKeep) check(n.has(h), `${name}: native markup lost ${h}, which must stay`);
  console.error(`${name}: web ${web.length} chars, ${w.size} hrefs; native ${native.length} chars, ${n.size} hrefs`);
}

globalThis.__tsxHooksPathname = '/en/privacy';
// The two static layouts, rendered through the chrome they share: the web's
// (`(site)/layout.tsx`, showPricing) and the app's (`native/(site)/layout.tsx`).
const { SiteChrome } = await load('src/components/layout/SiteChrome.tsx');
for (const locale of ['en', 'ar']) {
  const body = React.createElement('p', null, 'page');
  const web = renderToStaticMarkup(React.createElement(SiteChrome, { locale, showPricing: true }, body));
  const native = renderToStaticMarkup(React.createElement(SiteChrome, { locale, showPricing: false }, body));
  check(web.includes(`href="/${locale}/pricing"`), `${locale} site chrome on the web lost its Pricing link`);
  onlyRemoves(`SiteChrome ${locale}`, web, native, { mustKeep: [`/${locale}/about`, `/${locale}/login`, `/${locale}/privacy`, `/${locale}/terms`] });
}
{
  const site = readFileSync(resolvePath(ROOT, 'src/app/[locale]/(site)/layout.tsx'), 'utf8');
  const twin = readFileSync(resolvePath(ROOT, 'src/app/[locale]/native/(site)/layout.tsx'), 'utf8');
  check(/<SiteChrome locale=\{locale\} showPricing>/.test(site), '(site)/layout.tsx no longer renders SiteChrome with showPricing');
  check(/<SiteChrome locale=\{locale\} showPricing=\{false\}>/.test(twin), 'native/(site)/layout.tsx no longer renders SiteChrome without the Pricing link');
}

const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
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
    // The "or" divider separates the provider buttons from the form; with no
    // button shown it would separate nothing (seen in the simulator, 2026-10-07).
    const orLabel = (locale === 'ar' ? ar : en).auth.orDivider;
    check(web.includes(`>${orLabel}<`), `${name} ${locale} on the web lost its "or" divider`);
    check(!native.includes(`>${orLabel}<`), `${name} ${locale} inside the app still shows the "or" divider under no button`);
    onlyRemoves(`${name} page ${locale}`, web, native);
    if (name === 'login') {
      check(native.includes('data-kf-google-hint'), `login ${locale} inside the app lost the line for Google-registered students`);
      check(!web.includes('data-kf-google-hint'), `login ${locale} on the web shows the line beside the Google button`);
    } else {
      check(!native.includes('data-kf-google-hint'), `${name} ${locale}: the line belongs to the login page only`);
    }
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
// (e) The signed-in pages, rendered per request already, read the marker
// themselves; the prerendered pages must NOT (a request read would turn them
// dynamic and take the web off the CDN), and neither may their twins.
for (const file of ['src/app/[locale]/dashboard/layout.tsx', 'src/app/[locale]/dashboard/page.tsx', 'src/app/[locale]/dashboard/settings/page.tsx']) {
  const src = readFileSync(resolvePath(ROOT, file), 'utf8');
  check(/await currentPlatform\(\)/.test(src), `${file} no longer reads the platform from the request`);
}
const REQUEST_READS = /currentPlatform|next\/headers|platform-server/;
for (const [file, src] of files) {
  const isStaticPublic = /^src\/app\/\[locale\]\/(\(site\)|native|login|signup|forgot-password|reset-password)\//.test(file) || file === 'src/components/layout/SiteChrome.tsx';
  if (isStaticPublic && REQUEST_READS.test(strip(src))) check(false, `${file} reads the request: it must stay prerendered (the web on the CDN, the twin at its own cache key)`);
}
// (f) The twin tree is exactly the middleware's list, and every twin is a bare re-export.
{
  const mwSrc = readFileSync(resolvePath(ROOT, 'src/middleware.ts'), 'utf8');
  const listed = (mwSrc.match(/const NATIVE_TWINS = new Set\(\[([^\]]*)\]\)/) || [])[1];
  check(!!listed, 'middleware.ts no longer declares NATIVE_TWINS');
  const twins = listed ? [...listed.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort() : [];
  const onDisk = files.map(([f]) => f).filter((f) => /^src\/app\/\[locale\]\/native\/.*\/page\.tsx$/.test(f))
    .map((f) => '/' + f.replace(/^src\/app\/\[locale\]\/native\//, '').replace(/^\(site\)\//, '').replace(/\/page\.tsx$/, '')).sort();
  check(JSON.stringify(twins) === JSON.stringify(onDisk), `the middleware's twin list ${JSON.stringify(twins)} differs from the pages under native/ ${JSON.stringify(onDisk)}`);
  for (const [file, src] of files) {
    if (!/^src\/app\/\[locale\]\/native\/.*\/page\.tsx$/.test(file)) continue;
    const code = strip(src).trim();
    const web = file.replace('/native/', '/');
    const expected = `export { default } from '@/app/${web.replace(/^src\/app\//, '').replace(/\/page\.tsx$/, '/page')}';`;
    check(code === expected, `${file} is not a bare re-export of its web page: ${code.slice(0, 120)}`);
    check(files.some(([f]) => f === web), `${file} has no web twin at ${web}`);
  }
  check(!/(\(site\)\/)?page\.tsx/.test(onDisk.join(' ')) && !onDisk.includes('/pricing') && !onDisk.includes('/'), 'the landing and /pricing must have no twin: the app is redirected away from them');
}

if (failures.length === 0) {
  console.log('PASS: the marker is read from the request, only removes, and every gated surface is covered.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
