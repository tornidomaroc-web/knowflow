/**
 * Executable proof for Apple 3.1.1(a) inside the app (PIVOT_PLAN.md §8, the
 * Phase 8 gate; register #46): in the store build, no surface a signed-in
 * student sees carries a purchase link or an upgrade sentence, and on the web
 * every one of them still does.
 *
 * The REAL things under test:
 *   - `dailyLimitMessage`, `monthlyConversationMessage`, `subjectMaterialsMessage`
 *     (`src/lib/limit-messages.ts`), the three refusals the server composes,
 *     called with `platform: 'native'` and `'web'` in both locales.
 *   - `platformFromRequest` (`src/lib/platform.ts`), which is how a route
 *     learns which shell asked: a request carrying `x-kf-platform: native`.
 *   - `SettingsPanel` and `StudentHome`, RENDERED with react-dom/server from
 *     their real .tsx through the project's own TypeScript compiler
 *     (`scripts/lib/tsx-hooks.mjs`), with `upgradeHref` null as the pages pass
 *     it in the store build, and with an href as the web passes it.
 *   - The dictionary's new-subject limit copy: the upgrade sentence is its own
 *     key, so the client can leave it out.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-store-purchase-links.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, {
  '@/lib/supabase/client': `export function createClient() { return { auth: { signOut: async () => {} } }; }`,
});

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

// ── 1. The server-composed refusals.
const lm = await load('src/lib/limit-messages.ts');
const platformMod = existsSync(resolvePath(ROOT, 'src/lib/platform.ts')) ? await load('src/lib/platform.ts') : null;
check(platformMod && typeof platformMod.platformFromRequest === 'function', 'src/lib/platform.ts does not export platformFromRequest');

const UPGRADE_WORDS = { en: /\bPro\b/, ar: /الاحترافية/ };
const reset = new Date(Date.UTC(2026, 8, 26));
const now = new Date(Date.UTC(2026, 8, 25, 12));
for (const locale of ['en', 'ar']) {
  const cases = [
    ['daily', (p) => lm.dailyLimitMessage(locale, 'query', 10, 'free', reset, now, p)],
    ['monthly', (p) => lm.monthlyConversationMessage(locale, 100, 'free', reset, now, p)],
    ['materials', (p) => lm.subjectMaterialsMessage(locale, 10, 'free', p)],
  ];
  for (const [name, fn] of cases) {
    const web = fn('web');
    const native = fn('native');
    console.error(`${locale} ${name} web:    ${web}`);
    console.error(`${locale} ${name} native: ${native}`);
    check(UPGRADE_WORDS[locale].test(web), `${locale} ${name} on the web lost its upgrade sentence`);
    check(!UPGRADE_WORDS[locale].test(native), `${locale} ${name} in the store build still names Pro: "${native}"`);
    check(native.length > 0 && web.startsWith(native.slice(0, 20)), `${locale} ${name}: the native sentence is not the web sentence minus the upgrade line`);
  }
}
if (platformMod) {
  const req = (h) => ({ headers: { get: (n) => (n.toLowerCase() === 'x-kf-platform' ? h : null) } });
  check(platformMod.platformFromRequest(req('native')) === 'native', 'x-kf-platform: native is not read as native');
  check(platformMod.platformFromRequest(req(null)) === 'web', 'a request with no header must be web');
  check(platformMod.platformFromRequest(req('anything')) === 'web', 'an unknown header value must be web');
}

// ── 2. The two screens, rendered.
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
globalThis.__tsxHooksPathname = '/en/dashboard/settings';

const { SettingsPanel } = await load('src/components/dashboard/SettingsPanel.tsx');
const settingsLabels = {
  title: 'Settings', subtitle: 's', account: 'Account', email: 'Email', plan: 'Plan', free: 'Free', pro: 'Pro',
  freePlanDesc: 'f', proPlanDesc: 'p', renews: 'Renews', cancels: 'Cancels', upgrade: 'Upgrade to Pro',
  activeSubscription: 'Active', preferences: 'Preferences', language: 'Language', appearance: 'Appearance',
  themeDark: 'Dark', themeLight: 'Light', helpLegal: 'Help', privacyPolicy: 'Privacy', terms: 'Terms',
  support: 'Support', supportDesc: 'd',
};
const settings = (upgradeHref) => renderToStaticMarkup(React.createElement(SettingsPanel, {
  email: 'student@example.com', isPro: false, renewsOn: null, cancelsOn: null, upgradeHref,
  locale: 'en', pathname: '/en/dashboard/settings', privacyHref: '/en/privacy', termsHref: '/en/terms',
  supportEmail: 'support@example.com', labels: settingsLabels, deleteCard: null,
}));
{
  const web = settings('/en/pricing');
  const native = settings(null);
  check(web.includes('href="/en/pricing"') && web.includes('Upgrade to Pro'), 'Settings on the web does not offer Upgrade');
  check(!native.includes('/pricing') && !native.includes('Upgrade to Pro'), 'Settings in the store build still links to pricing');
  check(native.includes('href="/en/privacy"') && native.includes('href="/en/terms"'), 'Settings must keep the privacy and terms links (Apple 5.1.1(i))');
  check(native.includes('href="/ar/dashboard/settings"'), 'Settings has no in-app language link to the other locale');
  check(native.includes('role="radiogroup"'), 'Settings has no theme toggle');
  console.error(`settings: web ${web.length} chars with pricing; native ${native.length} chars without`);
}

const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
const homeLabels = Object.fromEntries(['welcome','askTitle','askDesc','newSubject','newSubjectDesc','subjects','streakLabel','streakUnit','streakZoneHint','recentActivity','planTitle','planName','ofWord','subjectsUsed','allSubjects','materialsWord','noSubjects','noSubjectsDesc','startTitle','whatTitle','upgradeCta','noActivity','conversation','showLess','viewAll','unknownKb'].map((k) => [k, k]));
homeLabels.whatLines = ['a', 'b', 'c'];
homeLabels.activity = { noActivity: 'n', conversation: 'c', showLess: 's', viewAll: 'v', unknownKb: 'u' };
const home = (upgradeHref) => renderToStaticMarkup(React.createElement(StudentHome, {
  stats: [], streak: null, askHref: '/en/dashboard/agent', newSubjectHref: '/en/dashboard/knowledge/new', subjectsHref: '/en/dashboard/knowledge',
  upgradeHref, isPro: false, quotas: [], subjects: [], subjectsUsed: 0, subjectsLimit: 5, onboarding: [],
  labels: homeLabels, recentActivity: [],
}));
{
  const web = home('/en/pricing');
  const native = home(null);
  check(web.includes('href="/en/pricing"'), 'StudentHome on the web does not offer Upgrade');
  check(!native.includes('/pricing'), 'StudentHome in the store build still links to pricing');
}

// ── 3. The dictionary split for the new-subject limit.
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
for (const [name, d] of [['en', en], ['ar', ar]]) {
  const k = d.dashboard.newKb;
  check(typeof k.errorLimitUpgrade === 'string' && k.errorLimitUpgrade.length > 0, `${name}: newKb.errorLimitUpgrade is missing`);
  check(!UPGRADE_WORDS[name === 'en' ? 'en' : 'ar'].test(k.errorLimitFree), `${name}: newKb.errorLimitFree still carries the upgrade sentence`);
}

if (failures.length === 0) {
  console.log('PASS: no purchase link or upgrade sentence reaches the store build, and every one of them still reaches the web.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
