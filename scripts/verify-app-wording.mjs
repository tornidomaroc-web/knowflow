/**
 * Executable proof that the iOS app shows no plan, subscription, upgrade,
 * premium or Pro tier, price, checkout or "free" wording (Apple 3.1.3(f);
 * Step Wording-1), read with the app's one rule, scripts/lib/app-wording.mjs.
 *
 * Four parts, each a failure on its own:
 *
 *  1. THE RULE, SELF-TESTED. Every way the copy has said it (lowercase "plan",
 *     باقتك with ta, اشتراك, "Start free", مجانًا, ...) must hit; near misses
 *     ("أسئلة باقية", "مشترك", "professor", "planet") must not.
 *  2. THE PROBE RUNS THE SAME BYTES. MainViewController.swift must embed
 *     KF_WORDING_SRC verbatim (each backslash doubled for the Swift string)
 *     and put its result in `purchase.words`, which ios-signed-in.yml fails on.
 *  3. EVERY APP-REACHABLE SURFACE, RENDERED AS THE APP RENDERS IT, with the
 *     REAL dictionary in both locales, as the reviewer account sees it (no
 *     subscription row, not Pro): the app's site chrome, login, signup, the
 *     about, contact, privacy, terms and refund twins, Settings in full with
 *     the real delete card, the AI permission card and the study reminder,
 *     the home, the new-subject refusal, the server's limit refusals. The text
 *     AND the attributes a screen reader speaks (aria-label, title,
 *     placeholder, alt) are read, so nothing hidden below the fold or behind
 *     an icon escapes.
 *  4. THE DICTIONARY, WHOLE. Every key whose English or Arabic hits the rule
 *     must be in GATED below with the gate that keeps it out of the app for
 *     the reviewer; a new key with such wording fails until someone says why
 *     it never reaches the app.
 *
 * PLANTED PROOF. With KF_WORDING_PLANT=1 a planted sentence is added to the
 * rendered Settings and to the dictionary; the proof must then FAIL (the
 * workflow asserts the non-zero exit), and pass again without it.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-app-wording.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { KF_WORDING_SRC, kfWording } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const PLANT = process.env.KF_WORDING_PLANT === '1';
const PLANTED = 'Upgrade to our Pro plan · انتقل إلى باقتك';

installTsxHooks(ROOT, {
  '@/lib/supabase/client': `export function createClient() { return { auth: { signOut: async () => {}, signInWithPassword: async () => ({ error: null }), signUp: async () => ({ data: {}, error: null }), getUser: async () => ({ data: { user: null } }) } }; }`,
});

// ── 1. The rule ──────────────────────────────────────────────────────────────
const MUST_HIT = ['Your account, plan and preferences.', 'If you have an active subscription, it is cancelled immediately.', "You've reached the free plan's limit of 5 subjects.", 'Free plan · No credit card', 'Start free', 'Upgrade to Pro', 'a premium tier', 'pro tier', 'Pricing', 'price', '$49', '100 conversations/month', 'Subscribe now', 'checkout',
  'حسابك وباقتك وتفضيلاتك.', 'إن كان لديك اشتراك نشط فسيُلغى فورًا.', 'وصلت إلى حد المواد في الباقة المجانية', 'باقة مجانية', 'بباقتك', 'الباقات', 'اشتراكك', 'الاشتراك', 'اشترك الآن', 'الترقية', 'ترقية', 'ابدأ مجانًا', 'مجانا', 'مجاني', 'سعر', 'الأسعار', 'الاحترافي', 'خطتك', 'الخطة', '/شهرياً'];
const MUST_PASS = ['Your account and preferences.', "You've reached your limit of 5 subjects.", 'Create account', 'أسئلة باقية', 'رفعات باقية', 'حسابك وتفضيلاتك.', 'وصلت إلى الحد الأقصى لعدد المواد في حسابك: 5.', 'أنشئ حسابًا', 'خطأ في الطلب', 'خطوة', 'مخطط', 'الخطوط', 'مشترك بين المواد', 'ترقيم الصفحات', 'approach', 'professor', 'process', 'freedom', 'planet', 'explanation', 'Plain text', 'Nothing is sold or charged inside this app.'];
for (const s of MUST_HIT) check(kfWording(s).length > 0, `the rule misses "${s}"`);
for (const s of MUST_PASS) check(kfWording(s).length === 0, `the rule wrongly hits "${s}": ${JSON.stringify(kfWording(s))}`);

// ── 2. The in-app probe runs the same bytes ──────────────────────────────────
{
  const swift = readFileSync(resolvePath(ROOT, 'ios/App/App/MainViewController.swift'), 'utf8');
  const embedded = KF_WORDING_SRC.replace(/\\/g, '\\\\');
  check(swift.includes(embedded), 'MainViewController.swift does not embed KF_WORDING_SRC verbatim (backslashes doubled): the in-app probe and this proof would read differently');
  check(/purchase:\{words:kfWording\(T\)/.test(swift), 'the in-app probe does not report kfWording(T) as purchase.words, so ios-signed-in.yml would not fail on a hit');
}

// ── 3. Every app-reachable surface, rendered as the app renders it ───────────
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { PlatformProvider } = await load('src/components/platform/PlatformProvider.tsx');
const native = (el) => renderToStaticMarkup(React.createElement(PlatformProvider, { platform: 'native' }, el));
const readable = (html) => {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]);
  const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
  return [text, ...attrs].join(' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
};
const surfaces = [];
const scan = (name, html) => {
  const text = readable(html);
  surfaces.push(name);
  check(text.length > 20, `${name}: rendered nothing readable (${text.length} chars), so it proves nothing`);
  const hits = kfWording(text);
  check(hits.length === 0, `${name}: the app shows ${JSON.stringify(hits)}: ${context(text, hits)}`);
};
function context(text, hits) {
  for (const w of [/\b(plans?|subscri\w*|upgrad\w*|premium|pro|pric\w*|free|check-?out)\b/i, /باق|اشترا?ك|ترقي|مجان|سعر|أسعار|احتراف|خط[ةت]/]) {
    const m = w.exec(text); if (m) return `"…${text.slice(Math.max(0, m.index - 50), m.index + 40)}…"`;
  }
  return JSON.stringify(hits);
}

const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { withSupportEmail, SUPPORT_EMAIL } = await load('src/lib/site.ts');
const { SiteChrome } = await load('src/components/layout/SiteChrome.tsx');
const params = (locale) => ({ status: 'fulfilled', value: { locale }, then() {} });

for (const locale of ['en', 'ar']) {
  const t = locale === 'ar' ? ar : en;
  globalThis.__tsxHooksPathname = `/${locale}/privacy`;
  // The app's site chrome (native/(site)/layout.tsx renders it with showPricing={false}).
  scan(`site chrome ${locale}`, renderToStaticMarkup(React.createElement(SiteChrome, { locale, showPricing: false }, React.createElement('p', null, 'page body text'))));

  // The prerendered twins: async server pages, awaited, then rendered under the app's provider.
  for (const page of ['about', 'contact', 'privacy', 'terms', 'refund']) {
    const Page = (await load(`src/app/[locale]/(site)/${page}/page.tsx`)).default;
    const el = await Page({ params: Promise.resolve({ locale }) });
    scan(`${page} ${locale}`, native(el));
  }
  for (const page of ['login', 'signup']) {
    globalThis.__tsxHooksPathname = `/${locale}/${page}`;
    const Page = (await load(`src/app/[locale]/${page}/page.tsx`)).default;
    scan(`${page} ${locale}`, native(React.createElement(Page, { params: params(locale) })));
  }

  // Settings, in full, as src/app/[locale]/dashboard/settings/page.tsx builds it
  // for the reviewer inside the app: not Pro, no upgrade link, no cancellable
  // subscription, so no plan card, no cancel card and no billing line.
  globalThis.__tsxHooksPathname = `/${locale}/dashboard/settings`;
  const s = t.dashboard.settings;
  const { SettingsPanel } = await load('src/components/dashboard/SettingsPanel.tsx');
  const { DeleteAccountCard } = await load('src/components/dashboard/DeleteAccountCard.tsx');
  const { StudyReminderCard } = await load('src/components/reminder/StudyReminderCard.tsx');
  const { AiConsentCard } = await load('src/components/ai-consent/AiConsentCard.tsx');
  const { AiConsentProvider } = await load('src/components/ai-consent/AiConsentProvider.tsx');
  const settingsSrc = readFileSync(resolvePath(ROOT, 'src/app/[locale]/dashboard/settings/page.tsx'), 'utf8');
  check(/subtitle: purchaseLinksAllowed\(platform\) \? s\.subtitle : s\.subtitleApp/.test(settingsSrc), 'the Settings page no longer gives the app subtitleApp');
  check(/showBillingNote=\{await deletionWouldCancelBilling\(supabase, user\.id\)\}/.test(settingsSrc), 'the Settings page no longer gates the billing line on a cancellable subscription');
  const labels = {
    title: s.title, subtitle: s.subtitleApp, account: s.account, email: s.email, plan: s.plan, free: s.free, pro: s.pro,
    freePlanDesc: s.freePlanDesc, proPlanDesc: s.proPlanDesc, renews: s.renews, cancels: s.cancels, upgrade: s.upgrade,
    activeSubscription: s.activeSubscription, preferences: s.preferences, language: s.language, appearance: t.nav.appearance,
    themeDark: t.nav.themeDark, themeLight: t.nav.themeLight, helpLegal: s.helpLegal, privacyPolicy: s.privacyPolicy,
    terms: s.terms, support: s.support, supportDesc: s.supportDesc,
  };
  const settings = native(React.createElement(AiConsentProvider, { labels: t.dashboard.aiConsent, initialConsented: false, privacyHref: `/${locale}/privacy` },
    React.createElement(SettingsPanel, {
      email: 'reviewer@example.com', isPro: false, renewsOn: null, cancelsOn: null, upgradeHref: null, locale,
      pathname: `/${locale}/dashboard/settings`, privacyHref: `/${locale}/privacy`, termsHref: `/${locale}/terms`, supportEmail: SUPPORT_EMAIL,
      labels,
      reminderCard: React.createElement(StudyReminderCard, { labels: t.dashboard.studyReminder, locale }),
      consentCard: React.createElement(AiConsentCard),
      subscriptionCard: null,
      deleteCard: React.createElement(DeleteAccountCard, { homeHref: `/${locale}`, labels: withSupportEmail(s.deleteAccount), showBillingNote: false }),
    })));
  // The bottom of the page must be in what is scanned: the delete card, the
  // help and legal links and the AI permission card. The study reminder card
  // renders only inside the shell (it needs Capacitor), so its strings are
  // held by part 4, the whole dictionary, instead.
  const settingsText = readable(settings);
  for (const [what, needle] of [['delete card', s.deleteAccount.heading], ['help and legal', s.helpLegal], ['privacy link', s.privacyPolicy], ['AI permission card', t.dashboard.aiConsent.heading]])
    check(settingsText.includes(needle), `Settings ${locale}: the rendered page lost the ${what} ("${needle}"), so the scan would not cover it`);
  scan(`settings ${locale}`, PLANT ? settings + `<p>${PLANTED}</p>` : settings);

  // The home, as src/app/[locale]/dashboard/page.tsx builds it inside the app.
  const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
  const hp = await load('src/lib/home-props.ts');
  const home = native(React.createElement(StudentHome, {
    stats: [], streak: 3, ...hp.buildHrefs(locale, 'native'), continueCard: null, locale, isPro: false,
    quotas: hp.buildQuotas(t.dashboard.home, { query: 2, upload: 1, summary: 0, quiz: 0 }, { query: 10, upload: 5, summary: 3, quiz: 3 }),
    subjects: [], subjectsUsed: 1, subjectsLimit: 5,
    onboarding: hp.buildOnboarding(t.dashboard.home, locale, { subjects: 1, materials: 1, conversations: 0 }),
    labels: hp.buildHomeLabels({ home: t.dashboard.home, subjectsNavLabel: t.dashboard.nav.knowledge, cont: t.dashboard.continueCard, isPro: false, streakUnit: 'x' }),
    recentActivity: [],
  }));
  scan(`home ${locale}`, home);

  // The new-subject refusal the app shows, for both tiers.
  const newSrc = readFileSync(resolvePath(ROOT, 'src/app/[locale]/dashboard/knowledge/new/page.tsx'), 'utf8');
  check(/!purchaseLinksAllowed\(platform\) \? t\.dashboard\.newKb\.errorLimitApp/.test(newSrc), 'the new-subject page no longer gives the app errorLimitApp for every tier');
  scan(`new-subject refusal ${locale}`, `<p>${t.dashboard.newKb.errorLimitApp.replace('{limit}', '5')} ${t.dashboard.newKb.errorLimitApp.replace('{limit}', '50')}</p>`);

  // The server's refusals, as the app receives them.
  const lm = await load('src/lib/limit-messages.ts');
  const reset = new Date(Date.UTC(2026, 9, 13)), now = new Date(Date.UTC(2026, 9, 12, 12));
  const lines = [];
  for (const tier of ['free', 'pro']) {
    for (const kind of ['query', 'upload', 'summary', 'quiz']) lines.push(lm.dailyLimitMessage(locale, kind, 10, tier, reset, now, 'native'));
    lines.push(lm.monthlyConversationMessage(locale, 100, tier, reset, now, 'native'));
    lines.push(lm.subjectMaterialsMessage(locale, 10, tier, 'native'));
  }
  scan(`server refusals ${locale}`, `<p>${lines.join(' ')}</p>`);
}

// ── 3b. Pro only, and still no invitation to buy (Step Store-Shots-1) ────────
// The cancel card is Pro only (GATED below), so it may say "subscription": a
// paying student manages what they bought. It may NOT invite a purchase the
// app cannot sell ("you can subscribe again at any time"): the app leaves that
// line out, the web keeps it. Rendered both ways from the real .tsx in both
// locales; the web rendering must still carry the line, or this check could
// pass because the card rendered nothing. KF_WORDING_PLANT_RESUB=1 plants the
// line into the app rendering, and the proof must then fail.
const BUY_AGAIN = [/\bsubscribe again\b/i, /\bresubscrib\w*/i, /اشترا?ك[^.،]{0,12}مرة أخرى/];
const PLANT_RESUB = process.env.KF_WORDING_PLANT_RESUB === '1';
{
  const { CancelSubscriptionCard } = await load('src/components/dashboard/CancelSubscriptionCard.tsx');
  for (const [locale, d] of [['en', en], ['ar', ar]]) {
    const labels = d.dashboard.settings.cancelSubscription;
    const props = { labels, accessUntil: '1 Nov 2026', alreadyScheduled: false };
    const web = readable(renderToStaticMarkup(React.createElement(PlatformProvider, { platform: 'web' }, React.createElement(CancelSubscriptionCard, props))));
    let app = readable(native(React.createElement(CancelSubscriptionCard, props)));
    if (PLANT_RESUB) app += ' ' + labels.canResubscribe;
    surfaces.push(`cancel card ${locale}`);
    check(BUY_AGAIN.some((r) => r.test(web)), `cancel card ${locale}: the web rendering lost "${labels.canResubscribe}", so this check would pass on nothing`);
    check(app.length > 40 && app.includes(labels.noRefund), `cancel card ${locale}: the app rendering is empty or lost its body`);
    const hit = BUY_AGAIN.find((r) => r.test(app));
    check(!hit, `cancel card ${locale}: the app invites the student to subscribe again (${hit}): "${app.slice(0, 160)}…"`);
  }
}

// ── 4. The dictionary, whole ─────────────────────────────────────────────────
// Each key whose copy names a plan, a price or "free", and the gate that keeps
// it away from the reviewer inside the app. A prefix ends in a dot.
const GATED = {
  'nav.pricing': 'web only: SiteHeader shows Pricing under showPricing; the app chrome has showPricing={false}',
  'nav.getStarted': 'web only: the app chrome uses nav.createAccount (SiteChrome.tsx)',
  'landing.': 'web only: the marketing root sends the app to the dashboard (middleware.ts)',
  'hero.': 'web only: the marketing root, as above',
  'cta.': 'web only: the landing, and signup shows cta.note only where purchaseLinksAllowed',
  'pricing.': 'web only: /pricing sends the app to the dashboard (middleware.ts)',
  'about.cta': 'web only: the about twin renders nav.createAccount through PlatformText',
  'dashboard.home.planFree': 'web only: buildHrefs gives the app no upgrade link, and StudentHome hides the plan pill then',
  'dashboard.home.planPro': 'Pro only: an account with an entitling subscription',
  'dashboard.home.upgradeCta': 'web only: gated on the upgrade link',
  'dashboard.newKb.errorLimitFree': 'web only: the app shows errorLimitApp',
  'dashboard.newKb.errorLimitUpgrade': 'web only: appended where purchaseLinksAllowed',
  'dashboard.newKb.errorLimitPro': 'web only since Step Wording-1: the app shows errorLimitApp',
  'dashboard.settings.subtitle': 'web only: the app shows subtitleApp',
  'dashboard.settings.freePlanDesc': 'web only: the plan card needs isPro or an upgrade link',
  'dashboard.settings.plan': 'web, or Pro: the plan card',
  'dashboard.settings.free': 'web only: the plan card for a free student',
  'dashboard.settings.pro': 'Pro only, or the web',
  'dashboard.settings.upgrade': 'web only: the plan card button',
  'dashboard.settings.activeSubscription': 'Pro only: the plan card status line',
  'dashboard.settings.cancelSubscription.': 'Pro only: the cancel card renders under isPro',
  'dashboard.settings.deleteAccount.billingNote': 'only with a cancellable subscription row (deletionWouldCancelBilling)',
  'dashboard.settings.deleteAccount.errorBillingCanceled': 'only after a deletion that cancelled a subscription (api/account, stage orphaned)',
  'dashboard.settings.deleteAccount.errorSubscriptionElsewhere': 'only when billing rows cannot be cancelled here (api/account, stage billing-unverifiable)',
};
const gateFor = (key) => Object.entries(GATED).find(([k]) => (k.endsWith('.') ? key.startsWith(k) : key === k));
const leaves = (o, p = [], out = []) => {
  if (typeof o === 'string') out.push([p.join('.'), o]);
  else if (Array.isArray(o)) o.forEach((v, i) => leaves(v, [...p, String(i)], out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) leaves(v, [...p, k], out);
  return out;
};
let gatedSeen = 0;
for (const [name, dict] of [['en', en], ['ar', ar]]) {
  const all = leaves(dict);
  if (PLANT) all.push(['dashboard.settings.planted', PLANTED]);
  for (const [key, value] of all) {
    const hits = kfWording(value);
    if (!hits.length) continue;
    const gate = gateFor(key);
    if (gate) gatedSeen++;
    check(!!gate, `${name}: ${key} names ${JSON.stringify(hits)} ("${value.slice(0, 80)}") and no gate keeps it out of the app; add one, or say in GATED why the app never shows it`);
  }
}

if (failures.length === 0) {
  console.log(`PASS: ${MUST_HIT.length} wordings caught and ${MUST_PASS.length} near misses clean; the in-app probe runs the same rule; ${surfaces.length} app surfaces rendered in both locales show none of it; ${gatedSeen} dictionary entries carry it, each behind a stated gate.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)${PLANT ? ' (planted run: this is the expected outcome)' : ''}`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
