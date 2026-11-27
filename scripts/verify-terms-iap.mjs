/**
 * THE APP STORE SUBSCRIPTION TERMS (Apple 3.1.2; item 4j, store step 1): the proof.
 *
 *   1. THE LINK REACHES THE SECTION. The paywall's Terms link, as the real
 *      paywall page builds it (appStoreTermsHref), is drawn by the real
 *      Paywall; its fragment is the id of the section the real /terms page
 *      renders on the web, in both locales. The paywall page and its preview
 *      both build the link that way (source read).
 *   2. THE SECTION SAYS WHAT 3.1.2 ASKS. On the web /terms, en and ar: the
 *      title KnowFlow Pro, auto-renewable, one month, the price shown in the
 *      App Store before purchase, charged to the Apple Account at
 *      confirmation, renewal unless cancelled at least 24 hours before the
 *      period ends, managed and cancelled in the Apple Account settings,
 *      refunds by Apple, deletion does not cancel, Apple's standard EULA
 *      linked at its exact address. No price figure (the wording rule's
 *      currency pattern), no Paddle, web or pricing word inside it (3.1.1).
 *      The web's Paddle paragraph is still there, unchanged.
 *   3. BUILD 8 NEVER SEES IT. The app twin's server markup (one page for
 *      build 8 and build 9) holds no section and no "nothing is sold" line,
 *      and is clean under the wording rule for shell 1 and for shell 2.
 *   4. THE GATE. appStoreTermsMode: plain on the web, marked in the app only
 *      where the plugin answers, nothing otherwise; storeBridge() answers
 *      null without Capacitor, on Android, and on iOS without KnowFlowStore.
 *      The section drawn marked passes the shell-2 rule and fails shell 1's
 *      (a marked element in build 8), and drawn UNMARKED in the app it fails
 *      both: the reason it must never be in the twin's server markup.
 *
 * PLANTED RUN: KF_TERMS_PLANT=1 puts the section, unmarked, into the twin's
 * markup; the proof must then FAIL (typecheck.yml).
 *
 * Tier 0: no network, no credential, no app.
 * Usage: node --experimental-strip-types scripts/verify-terms-iap.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { kfPurchaseHtml, purchaseViolation, kfWording } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;
const check = (ok, msg) => {
  if (ok) { passed += 1; console.log(`  OK    ${msg}`); } else { failures.push(msg); console.log(`  FAIL  ${msg}`); }
};
const load = (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const PLANT = process.env.KF_TERMS_PLANT === '1';

installTsxHooks(ROOT, {
  '@/lib/supabase/client': 'export function createClient(){ throw new Error("no Supabase in a proof"); }',
  '@/lib/supabase/server': 'export async function createClient(){ throw new Error("no Supabase in a proof"); }',
});

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const h = React.createElement;
const { PlatformProvider } = await load('src/components/platform/PlatformProvider.tsx');
const terms = await load('src/lib/iap/terms.ts');
const AST = await load('src/components/legal/AppStoreTerms.tsx');
const PW = await load('src/components/iap/Paywall.tsx');
const { storeBridge } = await load('src/lib/iap/bridge.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const TermsPage = (await load('src/app/[locale]/(site)/terms/page.tsx')).default;

const under = (platform, el) => renderToStaticMarkup(h(PlatformProvider, { platform }, el));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const sectionOf = (html) => {
  const m = /<section data-kf-terms-app-store=""[\s\S]*?<\/section>/.exec(html);
  return m ? m[0] : null;
};

console.log('\n1. The paywall\'s Terms link reaches the section');
check(terms.APP_STORE_TERMS_ID === 'app-store-subscriptions', `the section id is ${terms.APP_STORE_TERMS_ID}`);
for (const f of ['src/app/[locale]/dashboard/pro/page.tsx', 'src/app/[locale]/preview/pro/page.tsx']) {
  const src = read(f);
  check(/termsHref=\{appStoreTermsHref\(safeLocale\)\}/.test(src), `${f} builds the Terms link with appStoreTermsHref`);
  check(!/termsHref=\{`\/\$\{safeLocale\}\/terms`\}/.test(src), `${f} no longer links the bare /terms`);
}
const webPages = {};
for (const locale of ['en', 'ar']) {
  const L = (locale === 'ar' ? ar : en).dashboard.iap;
  const href = terms.appStoreTermsHref(locale);
  check(href === `/${locale}/terms#app-store-subscriptions`, `${locale}: appStoreTermsHref is ${href}`);
  const pw = renderToStaticMarkup(h(PlatformProvider, { platform: 'native', shell: 2 }, h(PW.Paywall, {
    labels: L, figures: { subjects: 50, materials: 500, questions: 25, uploads: 500 }, userId: '0b9d4c4e-6a51-4e8e-9d1f-2b7c1a3e5f60',
    pro: null, termsHref: href, privacyHref: `/${locale}/privacy`, preview: { state: 'ready', price: '$9.99' },
  })));
  const legal = /data-kf-paywall-legal=""[\s\S]*?<\/nav>/.exec(pw)?.[0] || '';
  const link = [...legal.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).find((x) => x.startsWith(`/${locale}/terms`));
  check(link === href, `${locale}: the paywall draws its Terms link as ${link}`);
  const page = under('web', await TermsPage({ params: Promise.resolve({ locale }) }));
  webPages[locale] = page;
  const frag = (link || '').split('#')[1];
  check(!!frag && page.includes(`id="${frag}"`), `${locale}: /terms on the web has the element #${frag} the link names`);
  check(!!frag && sectionOf(page)?.includes(`id="${frag}"`), `${locale}: ...and it is the App Store section's heading`);
}

console.log('\n2. The section says what 3.1.2 asks, and nothing 3.1.1 forbids');
const CLAUSES = [
  ['heading', /App Store subscriptions/],
  ['title', /KnowFlow Pro/],
  ['auto-renewable', /auto-renewable subscription/],
  ['one month', /period of one month/],
  ['price before purchase', /App Store shows the price[^.]*before you confirm the purchase/],
  ['charged at confirmation', /charged to your Apple Account when you confirm the purchase/],
  ['renews unless cancelled 24 h before', /renews automatically[^.]*unless you cancel it at least 24 hours before the end of the current period/],
  ['managed and cancelled in Apple Account settings', /manage the subscription and turn off automatic renewal[^.]*in your Apple Account settings/],
  ['refunds by Apple', /Refunds for App Store purchases are handled by Apple, under Apple's rules/],
  ['deletion does not cancel', /Deleting your KnowFlow account does not cancel an App Store subscription/],
  ['Apple standard EULA', /Licensed Application End User License Agreement[^.]*also applies/],
];
for (const locale of ['en', 'ar']) {
  const sec = sectionOf(webPages[locale]);
  check(!!sec, `${locale}: the web /terms renders the App Store section`);
  if (!sec) continue;
  const t = text(sec);
  for (const [name, re] of CLAUSES) check(re.test(t), `${locale}: clause "${name}"`);
  check(sec.includes(`href="${terms.APPLE_STANDARD_EULA}"`) && terms.APPLE_STANDARD_EULA === 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', `${locale}: Apple's standard EULA linked at its exact address`);
  check(!kfWording(t).includes('currency'), `${locale}: no price figure typed in the section (${JSON.stringify(kfWording(t))})`);
  check(!/\d/.test(t.replace(/24 hours/g, '')), `${locale}: no figure in the section but "24 hours"`);
  check(!/paddle|pricing|website|web|browser|checkout|tryknowflow/i.test(t), `${locale}: the section names no other way to pay (3.1.1)`);
  check(!/—/.test(t), `${locale}: no em dash`);
  check(webPages[locale].includes('Subscriptions to our Pro plan are billed on a monthly basis.'), `${locale}: the web's Paddle paragraph is unchanged`);
  check(webPages[locale].indexOf('Payment Terms') < webPages[locale].indexOf('App Store subscriptions'), `${locale}: the section follows the web's payment terms`);
  const r = kfPurchaseHtml(webPages[locale], 0);
  check(r.marked === 0, `${locale}: the web page marks nothing data-kf-iap (the web and build 8 may hold no marked element)`);
}

console.log('\n3. Build 8 never sees it: the app twin\'s server markup');
for (const locale of ['en', 'ar']) {
  let twin = under('native', await TermsPage({ params: Promise.resolve({ locale }) }));
  if (PLANT) twin = twin.replace('</h2><p class="mb-6">Any payment', `</h2>${renderToStaticMarkup(h(AST.AppStoreTermsSection))}<p class="mb-6">Any payment`);
  check(!twin.includes('data-kf-terms-app-store') && !twin.includes('App Store subscriptions'), `${locale}: no App Store section in the twin's server markup`);
  check(!/Nothing is sold/i.test(twin), `${locale}: the twin no longer says nothing is sold inside the app (build 9 sells)`);
  check(twin.includes('Any payment made for a KnowFlow account is governed by the terms shown when it is made.'), `${locale}: the twin keeps its neutral payments line`);
  for (const shell of [1, 2]) {
    const r = kfPurchaseHtml(twin, shell);
    check(!purchaseViolation(r), `${locale}: the twin is clean under the shell-${shell} wording rule (${JSON.stringify({ words: r.words, hrefs: r.hrefs, marked: r.marked })})`);
  }
}

console.log('\n4. The gate');
check(AST.appStoreTermsMode(true, false) === 'plain' && AST.appStoreTermsMode(true, true) === 'plain', 'the web: plain, plugin or not');
check(AST.appStoreTermsMode(false, true) === 'marked', 'the app with the plugin (build 9): marked');
check(AST.appStoreTermsMode(false, false) === null, 'the app without the plugin (build 8, Android): nothing');
const withCap = (cap, fn) => { const prev = globalThis.Capacitor; globalThis.Capacitor = cap; try { return fn(); } finally { globalThis.Capacitor = prev; } };
check(withCap(undefined, () => storeBridge()) === null, 'storeBridge: no Capacitor (the web) -> null');
check(withCap({ isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => true, nativePromise: async () => ({}) }, () => storeBridge()) === null, 'storeBridge: Android -> null');
check(withCap({ isNativePlatform: () => true, getPlatform: () => 'ios', isPluginAvailable: () => false, nativePromise: async () => ({}) }, () => storeBridge()) === null, 'storeBridge: iOS without KnowFlowStore (build 8) -> null');
check(typeof withCap({ isNativePlatform: () => true, getPlatform: () => 'ios', isPluginAvailable: (n) => n === 'KnowFlowStore', nativePromise: async () => ({}) }, () => storeBridge()) === 'function', 'storeBridge: iOS with KnowFlowStore (build 9) -> a call');
{
  const base = under('native', await TermsPage({ params: Promise.resolve({ locale: 'en' }) }));
  const sec = renderToStaticMarkup(h(AST.AppStoreTermsSection));
  const marked = base.replace('</body>', '') + `<div data-kf-iap="terms">${sec}</div>`;
  const plain = base + sec;
  check(!purchaseViolation(kfPurchaseHtml(marked, 2)), 'the section drawn marked passes the shell-2 rule');
  check(purchaseViolation(kfPurchaseHtml(marked, 1)), 'the section drawn marked FAILS the shell-1 rule (why build 8 must never draw it)');
  check(purchaseViolation(kfPurchaseHtml(plain, 2)) && purchaseViolation(kfPurchaseHtml(plain, 1)), 'the section drawn unmarked in the app fails both rules (why it is not in the twin\'s server markup)');
}
{
  const src = read('src/components/legal/AppStoreTerms.tsx');
  check(/<div data-kf-iap="terms">\s*<AppStoreTermsSection \/>/.test(src), 'the app draws the section only inside data-kf-iap="terms"');
  check(!/navigator\.userAgent/.test(src), 'no user-agent sniffing in the client');
  const page = read('src/app/[locale]/(site)/terms/page.tsx');
  check(/<AppStoreTerms \/>/.test(page), '/terms renders <AppStoreTerms />');
  check(read('src/app/[locale]/native/(site)/terms/page.tsx').replace(/\/\/.*$/gm, '').trim() === "export { default } from '@/app/[locale]/(site)/terms/page';", 'the twin is still a bare re-export');
}

console.log(`\n${passed} passed, ${failures.length} failed${PLANT ? ' (PLANTED run: this must fail)' : ''}`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}
console.log('PASS: the paywall\'s Terms link reaches the App Store section; the web shows it, build 8 never does, build 9 only marked.');
