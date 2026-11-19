/**
 * IN-APP PRO, THE APP HALF (iOS 1.1, item 4d): the proof.
 *
 *   1. The gate: iapAllowed is shell 2 on, never the web or build 8, and the
 *      paywall page and the dashboard's provider ask it.
 *   2. The purchase flow, driven with a fake plugin and a fake verify route:
 *      finish() ONLY after a 200, never on 409/403/500/no network; pending,
 *      cancelled and failed; restore with none, Pro and an expired one; the
 *      launch sync; the product read.
 *   3. The price is StoreKit's: no price is typed in the app half; the product
 *      id is the same bytes in the server rules, the client and Swift.
 *   4. What Pro gives is read from the limits code.
 *   5. The paywall drawn in every state, en and ar: its marker, the 3.1.2
 *      disclosure, Terms and Privacy, the buttons each state allows; Pro from
 *      elsewhere shows status only and never says where it was bought.
 *   6. Settings: the web and build 8 render no purchase surface; shell 2 gets
 *      the offer card only with the plugin (a provider without it renders
 *      nothing on the server); R1 (Apple-only Pro: the App Store card, no
 *      Paddle cancel card); R2 (the delete card's App Store line only with an
 *      Apple row Apple may still bill).
 *   7. The 3.1.3(f) rule in shell 2 (KF_PURCHASE_SRC / kfPurchaseHtml), with
 *      its forced cases: a purchase word outside data-kf-iap, a pricing link
 *      inside it, a marked element in shell 1.
 *   8. Entitlement sources: Apple / Paddle / Apple-may-bill, and
 *      readEntitlement's answer unchanged in shape.
 *   9. Refusal codes: `daily-limit` from the limiter, sent by the five routes,
 *      read by the five refusal surfaces.
 *  10. The native plugin: in this repository, registered in every build,
 *      listener at launch, finish() only in `finish`, no third-party package.
 *  11. The strings: both locales, no em dash, Western digits, a draft file.
 *
 * PLANTED RUN: KF_IAP_PLANT=1 puts a purchase word outside data-kf-iap on the
 * shell-2 Settings render; the proof must then FAIL (typecheck.yml).
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, join } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { kfPurchaseHtml, purchaseViolation } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const failures = [];
let passed = 0;
const check = (ok, msg) => {
  if (ok) { passed += 1; console.log(`  OK    ${msg}`); } else { failures.push(msg); console.log(`  FAIL  ${msg}`); }
};
const section = (t) => console.log(`\n${t}`);
async function load(p) {
  try { return await import(pathToFileURL(resolvePath(ROOT, p)).href); } catch (e) { check(false, `${p} loads (${String(e.message).split('\n')[0]})`); return null; }
}
const PLANT = process.env.KF_IAP_PLANT === '1';

installTsxHooks(ROOT, {
  '@/lib/supabase/client': 'export function createClient(){ throw new Error("no Supabase in a proof"); }',
  '@/lib/supabase/server': 'export async function createClient(){ throw new Error("no Supabase in a proof"); }',
});
globalThis.__tsxHooksParams = { locale: 'en' };

const UID = '0b9d4c4e-6a51-4e8e-9d1f-2b7c1a3e5f60';

// ---- 1. the gate -------------------------------------------------------------------------
section('1. The gate: in-app Pro from shell 2 on, never the web or build 8');
const platform = await load('src/lib/platform.ts');
if (platform) {
  check(typeof platform.iapAllowed === 'function', 'platform.ts exports iapAllowed');
  const a = (n) => platform.iapAllowed?.(n);
  check(a(0) === false, 'the web (shell 0) may not be offered Pro in the app');
  check(a(1) === false, 'build 8 (shell 1) may not');
  check(a(2) === true && a(3) === true && a(12) === true, 'shell 2, 3 and 12 may');
  check(a(NaN) === false && a(2.5) === false && a(-2) === false, 'a non-integer or negative reading may not');
  check(platform.IAP_SHELL_VERSION === platform.CAMERA_SHELL_VERSION, 'the gate is the camera\'s: build 9 carries both (IAP_SHELL_VERSION === CAMERA_SHELL_VERSION)');
}
{
  const page = read('src/app/[locale]/dashboard/pro/page.tsx');
  check(/if \(!iapAllowed\(await currentShellVersion\(\)\)\) notFound\(\)/.test(page), 'the paywall page answers 404 to any shell iapAllowed refuses, before it reads anything');
  const layout = read('src/app/[locale]/dashboard/layout.tsx');
  check(/iapAllowed\(shell\) \? \(\s*<IapProvider/.test(layout) && /\) : \(\s*children\s*\)\}/.test(layout), 'the dashboard mounts IapProvider only when iapAllowed(shell); otherwise the children alone, the tree as before');
  const settings = read('src/app/[locale]/dashboard/settings/page.tsx');
  check(/proOfferCard=\{iap && !isPro \?/.test(settings) && /const iap = iapAllowed\(await currentShellVersion\(\)\)/.test(settings), 'Settings hands in the offer card only for shell 2 and a free account');
  const bridge = read('src/lib/iap/bridge.ts');
  check(/isPluginAvailable\?\.\(IAP_PLUGIN\)/.test(bridge) && /getPlatform\(\) !== 'ios'/.test(bridge), 'every purchase control also needs the KnowFlowStore plugin on iOS (the Android shell sends KnowFlowApp/2 too)');
}

// ---- 2. the flow -------------------------------------------------------------------------
section('2. The purchase flow: finish() only after the server answered 200');
const flow = await load('src/lib/iap/flow.ts');
function fake({ purchase, restore = [], pending = [], products = [{ id: 'com.knowflow.app.pro.monthly', displayPrice: '$9.99' }], verify = {} }) {
  const log = [];
  const call = async (method, options) => {
    log.push(['call', method, options]);
    if (method === 'purchase') { if (purchase instanceof Error) throw purchase; return purchase; }
    if (method === 'restore') { if (restore instanceof Error) throw restore; return { transactions: restore }; }
    if (method === 'pending') return { transactions: pending };
    if (method === 'products') { if (products instanceof Error) throw products; return { products }; }
    if (method === 'finish') return { finished: true };
    return {};
  };
  const v = async (jws) => { log.push(['verify', jws]); const r = verify[jws] ?? { status: 500, body: { error: 'write-failed' } }; return r; };
  return { deps: { call, verify: v }, log, finished: () => log.filter((l) => l[0] === 'call' && l[1] === 'finish').map((l) => l[2].transactionId) };
}
const tx = (n) => ({ jws: `jws-${n}`, transactionId: String(1000 + n) });
const ok = (tier = 'pro') => ({ status: 200, body: { applied: true, tier, expiresAt: null } });
if (flow) {
  check(flow.IAP_PRODUCT_ID === 'com.knowflow.app.pro.monthly', 'the client buys com.knowflow.app.pro.monthly');
  {
    const f = fake({ purchase: { outcome: 'purchased', ...tx(1) }, verify: { 'jws-1': ok() } });
    const s = await flow.purchaseFlow(UID, f.deps);
    const p = f.log.find((l) => l[1] === 'purchase');
    check(s === 'success', `a purchase the server accepts is 'success' (${s})`);
    check(p?.[2]?.appAccountToken === UID && p?.[2]?.productId === flow.IAP_PRODUCT_ID, 'the purchase carries appAccountToken = the signed-in user id, and the Pro product');
    check(JSON.stringify(f.finished()) === '["1001"]', 'it is finished exactly once, by its transaction id');
    const iv = f.log.findIndex((l) => l[0] === 'verify'), ifi = f.log.findIndex((l) => l[1] === 'finish');
    check(iv >= 0 && ifi > iv, 'finish() comes after the verify answer, never before');
  }
  for (const [name, reply, want] of [
    ['409 other-account', { status: 409, body: { error: 'other-account' } }, 'other-account'],
    ['403 not-this-account', { status: 403, body: { error: 'not-this-account' } }, 'not-this-account'],
    ['403 environment-not-allowed', { status: 403, body: { error: 'environment-not-allowed' } }, 'verify-failed'],
    ['500 write-failed', { status: 500, body: { error: 'write-failed' } }, 'verify-failed'],
    ['401 signed out', { status: 401, body: { error: 'Unauthorized' } }, 'verify-failed'],
    ['no network (0)', { status: 0, body: null }, 'verify-failed'],
    ['400 unverified', { status: 400, body: { error: 'unverified' } }, 'verify-failed'],
  ]) {
    const f = fake({ purchase: { outcome: 'purchased', ...tx(2) }, verify: { 'jws-2': reply } });
    const s = await flow.purchaseFlow(UID, f.deps);
    check(s === want && f.finished().length === 0, `${name}: '${want}' and the transaction is NOT finished (${s}, finished ${f.finished().length})`);
  }
  for (const [outcome, want] of [[{ outcome: 'pending' }, 'pending'], [{ outcome: 'cancelled' }, 'ready'], [{ outcome: 'failed', message: 'x' }, 'failed'], [new Error('bridge'), 'failed'], [{ outcome: 'purchased', jws: '', transactionId: '1' }, 'verify-failed']]) {
    const f = fake({ purchase: outcome });
    const s = await flow.purchaseFlow(UID, f.deps);
    const label = outcome instanceof Error ? 'a thrown bridge error' : `outcome ${outcome.outcome}${outcome.outcome === 'purchased' ? ' without a JWS' : ''}`;
    check(s === want && f.finished().length === 0 && !f.log.some((l) => l[0] === 'verify' && l[1]), `${label}: '${want}', nothing verified, nothing finished (${s})`);
  }
  {
    const f = fake({ restore: [] });
    check((await flow.restoreFlow(f.deps)) === 'restore-none', 'Restore with no entitlement: \'restore-none\'');
    const g = fake({ restore: [tx(3)], verify: { 'jws-3': ok() } });
    const s = await flow.restoreFlow(g.deps);
    check(s === 'success' && JSON.stringify(g.finished()) === '["1003"]', `Restore of a live subscription: 'success', finished after its 200 (${s})`);
    const h = fake({ restore: [tx(4)], verify: { 'jws-4': ok('free') } });
    const s2 = await flow.restoreFlow(h.deps);
    check(s2 === 'restore-none' && h.finished().length === 1, `Restore of an expired one (200, tier free): 'restore-none', finished because the server recorded it (${s2})`);
    const k = fake({ restore: [tx(5)], verify: { 'jws-5': { status: 409, body: { error: 'other-account' } } } });
    check((await flow.restoreFlow(k.deps)) === 'other-account' && k.finished().length === 0, 'Restore of another account\'s subscription: \'other-account\', not finished');
    const x = fake({ restore: new Error('sync') });
    const sx = await flow.restoreFlow(x.deps);
    check(sx === 'restore-failed' && x.finished().length === 0 && !x.log.some((l) => l[0] === 'verify'), `a restore whose bridge call throws: 'restore-failed', nothing verified, nothing finished (${sx})`);
    // The purchase's own failure text ("you were not charged") never follows a restore.
    const outs = [];
    for (const r of [new Error('sync'), [], [tx(9)]]) for (const v of [ok(), ok('free'), { status: 409, body: { error: 'other-account' } }, { status: 403, body: { error: 'not-this-account' } }, { status: 500, body: { error: 'write-failed' } }, { status: 0, body: null }]) outs.push(await flow.restoreFlow(fake({ restore: r, verify: { 'jws-9': v } }).deps));
    check(outs.length === 18 && !outs.includes('failed'), `no restore outcome is the purchase's 'failed' (${[...new Set(outs)].join(', ')})`);
  }
  {
    const f = fake({ pending: [tx(6), tx(7)], verify: { 'jws-6': ok(), 'jws-7': { status: 409, body: { error: 'other-account' } } } });
    const pro = await flow.syncPending(f.deps);
    check(pro === true && JSON.stringify(f.finished()) === '["1006"]', 'the launch sync verifies every waiting transaction and finishes only the one answered 200');
    const g = fake({ pending: [tx(8)], verify: {} });
    check((await flow.syncPending(g.deps)) === false && g.finished().length === 0, 'a sync whose verify fails finishes nothing and reports no Pro');
  }
  {
    const p = await flow.loadProduct(fake({ products: [{ id: flow.IAP_PRODUCT_ID, displayPrice: '9,99 €' }] }).deps.call);
    check(p?.displayPrice === '9,99 €', 'the price shown is StoreKit\'s displayPrice, verbatim (a euro storefront stays "9,99 €")');
    check((await flow.loadProduct(fake({ products: [] }).deps.call)) === null, 'no product (agreement not active, unsupported storefront): no price, so \'unavailable\'');
    check((await flow.loadProduct(fake({ products: new Error('net') }).deps.call)) === null, 'a failed product read: no price');
  }
  check(flow.PAYWALL_STATES.length === 15, `the paywall has its 15 states (${flow.PAYWALL_STATES.join(', ')})`);
}

// ---- 3. the price and the product id -----------------------------------------------------
section('3. No price typed in the app half; one product id everywhere');
{
  const files = [];
  const walk = (d) => { if (!existsSync(d)) return; for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
  walk(resolvePath(ROOT, 'src/components/iap'));
  walk(resolvePath(ROOT, 'src/lib/iap'));
  files.push(resolvePath(ROOT, 'src/app/[locale]/dashboard/pro/page.tsx'), resolvePath(ROOT, 'ios/App/App/KnowFlowStore.swift'));
  const priced = files.filter((f) => existsSync(f) && /9[.,]99|\$\s?\d+[.,]\d{2}|\bUSD\b|\bper month\b/i.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')));
  check(files.length >= 8 && priced.length === 0, `no price in the code of the app half (${files.length} files read; with one: ${priced.map((f) => f.slice(ROOT.length + 1)).join(', ') || 'none'})`);
  const rules = await load('src/lib/apple-iap/rules.ts');
  const swift = read('ios/App/App/KnowFlowStore.swift');
  check(rules?.APPLE_PRO_PRODUCT_ID === flow?.IAP_PRODUCT_ID && swift.includes(`static let productId = "${rules?.APPLE_PRO_PRODUCT_ID}"`), 'the product id is the same bytes in the server rules, the client flow and Swift');
}

// ---- 4. the figures ----------------------------------------------------------------------
section('4. What Pro gives, read from the limits code');
const figures = await load('src/lib/iap/figures.ts');
const limits = await load('src/lib/limits.ts');
const rate = await load('src/lib/rate-limit.ts');
const F = figures?.proFigures?.();
if (F && limits && rate) {
  check(F.subjects === limits.PRO_LIMITS.knowledge_bases && F.materials === limits.PRO_LIMITS.documents, `subjects ${F.subjects} and files per subject ${F.materials} are PRO_LIMITS`);
  check(F.questions === rate.DAILY_CAPS.pro.query && F.uploads === rate.DAILY_CAPS.pro.upload, `questions ${F.questions} and uploads ${F.uploads} a day are DAILY_CAPS.pro`);
  check(F.questions > rate.DAILY_CAPS.free.query && F.uploads > rate.DAILY_CAPS.free.upload && F.subjects > limits.FREE_LIMITS.knowledge_bases && F.materials > limits.FREE_LIMITS.documents, 'each figure is more than Free gets (none offered that Free already has)');
  check(rate.DAILY_CAPS.pro.summary === rate.DAILY_CAPS.free.summary && rate.DAILY_CAPS.pro.quiz === rate.DAILY_CAPS.free.quiz, 'summaries and quizzes are equal in both tiers, so the paywall does not list them');
}

// ---- 5. the paywall ----------------------------------------------------------------------
section('5. The paywall, every state, en and ar');
const React = (await import(pathToFileURL(resolvePath(ROOT, 'node_modules/react/index.js')).href)).default;
const { renderToStaticMarkup } = await import(pathToFileURL(resolvePath(ROOT, 'node_modules/react-dom/server.node.js')).href);
const i18n = await load('src/lib/i18n/index.ts');
const PW = await load('src/components/iap/Paywall.tsx');
const PP = await load('src/components/platform/PlatformProvider.tsx');
const IP = await load('src/components/iap/IapProvider.tsx');
const h = React.createElement;
const squash = (x) => x.replace(/\s+/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const shell2 = (el, { preview = true, offer = true, locale = 'en' } = {}) =>
  h(PP.PlatformProvider, { platform: 'native', shell: 2 }, h(IP.IapProvider, { userId: UID, offer, locale, offerLabel: i18n.useTranslation(locale).dashboard.iap.offerButton, preview }, el));
if (PW && i18n && PP && IP && flow && F) {
  for (const locale of ['en', 'ar']) {
    const L = i18n.useTranslation(locale).dashboard.iap;
    for (const state of flow.PAYWALL_STATES) {
      const price = state === 'loading' || state === 'unavailable' ? null : '$9.99';
      const pro = state === 'pro-apple' ? 'apple' : state === 'pro-web' ? 'web' : null;
      const html = renderToStaticMarkup(shell2(h(PW.Paywall, { labels: L, figures: F, userId: UID, pro, termsHref: `/${locale}/terms`, privacyHref: `/${locale}/privacy`, preview: { state, price } }), { locale }));
      const t = text(html);
      const tag = `${locale} ${state}`;
      const bad = [];
      if (!new RegExp(`^<div data-kf-iap="paywall" data-kf-paywall="${state}"`).test(html)) bad.push('not wrapped in the data-kf-iap paywall element');
      if (purchaseViolation(kfPurchaseHtml(html, 2))) bad.push(`3.1.3(f) reading: ${JSON.stringify(kfPurchaseHtml(html, 2))}`);
      if (!html.includes(`href="/${locale}/terms"`) || !html.includes(`href="/${locale}/privacy"`)) bad.push('no Terms or Privacy link');
      for (const n of [F.subjects, F.materials, F.questions, F.uploads]) if (!html.includes(`data-kf-paywall-figure="${n}"`)) bad.push(`figure ${n} missing`);
      const buy = html.includes('data-kf-paywall-buy');
      const restore = html.includes('data-kf-paywall-restore');
      const manage = html.includes('data-kf-iap-manage');
      const disclosure = html.includes('data-kf-paywall-disclosure');
      const wantBuy = ['ready', 'failed', 'restore-none', 'restore-failed'].includes(state);
      if (buy !== wantBuy) bad.push(`buy button ${buy}, want ${wantBuy}`);
      const wantRestore = ['ready', 'unavailable', 'failed', 'verify-failed', 'restore-none', 'restore-failed', 'pending', 'other-account', 'not-this-account'].includes(state);
      if (restore !== wantRestore) bad.push(`restore ${restore}, want ${wantRestore}`);
      if (manage !== (state === 'pro-apple')) bad.push(`manage ${manage}`);
      if (price && !pro && state !== 'success') {
        if (!disclosure) bad.push('no 3.1.2 disclosure');
        const d = L.disclosure.split('{price}').join('$9.99');
        if (!squash(t).includes(squash(text(d)).slice(0, 40))) bad.push('the disclosure text is not shown with the StoreKit price');
        if (!t.includes(L.pricePerMonth.split('{price}')[0].trim() || '$9.99')) bad.push('no price per month');
      }
      if (!price && (html.includes('data-kf-paywall-price') || disclosure)) bad.push('a price or disclosure without a StoreKit price');
      const msgKey = { loading: 'loading', unavailable: 'unavailable', purchasing: 'purchasing', restoring: 'restoring', pending: 'pending', success: 'success', failed: 'failed', 'verify-failed': 'verifyFailed', 'restore-none': 'restoreNone', 'restore-failed': 'restoreFailed', 'other-account': 'otherAccount', 'not-this-account': 'notThisAccount' }[state];
      if (msgKey && !squash(t).includes(squash(L[msgKey]).slice(0, 30))) bad.push(`its message (${msgKey}) is not shown`);
      if (state === 'restore-failed' && squash(t).includes(squash(L.failed))) bad.push('a failed restore shows the purchase\'s failure text');
      if (state === 'restore-failed' && !/class="[^"]*text-danger[^"]*" data-kf-paywall-message="restore-failed"/.test(html)) bad.push('a failed restore is not in the error tone');
      if (state === 'pro-web') {
        if (buy || restore || manage) bad.push('Pro from the web shows a purchase or manage control');
        const where = /\b(web|website|online|paddle|app store|apple|stripe|card)\b|الموقع|الويب|متجر|بطاقة/i;
        const statusText = text(html.split('data-kf-paywall-status')[1] || '');
        if (where.test(statusText)) bad.push(`Pro from the web names where it was bought: "${statusText.slice(0, 80)}"`);
      }
      check(bad.length === 0, `${tag}: ${bad.length ? bad.join('; ') : 'marked, Terms + Privacy, figures, the right buttons and message'}`);
    }
  }
}

// ---- 5b. the price, the buttons, the kept phrase (the owner's render review at 69f160f) ----
section('5b. StoreKit price shapes as one isolate; one flex item per button; "من App Store" kept');
const PT = await load('src/components/iap/PriceText.tsx');
const DCI = await import(pathToFileURL(resolvePath(ROOT, 'scripts/design-c/iap.mjs')).href).catch((e) => { check(false, `scripts/design-c/iap.mjs loads (${String(e.message).split('\n')[0]})`); return null; });
const unescape = (x) => x.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
if (PT && DCI && PW && i18n) {
  const SHAPES = [['$9.99', 'ltr'], ['9,99 €', 'ltr'], ['US$9.99', 'ltr'], ['٣٫٦٧ ر.س.', 'rtl'], ['MAD 99.00', 'ltr']];
  check(JSON.stringify(SHAPES.slice(1).map(([p]) => p)) === JSON.stringify(DCI.PRICE_SHAPES.map(([, p]) => p)) && DCI.DEFAULT_PRICE === SHAPES[0][0], 'design-c draws the same five shapes this proof reads');
  for (const [price, dir] of SHAPES) {
    check(PT.priceDir(price) === dir && DCI.priceDirOf(price) === dir, `${JSON.stringify(price)}: direction ${dir} (the component and check 25 agree)`);
    for (const locale of ['ar', 'en']) {
      const L = i18n.useTranslation(locale).dashboard.iap;
      for (const key of ['pricePerMonth', 'disclosure']) {
        const html = renderToStaticMarkup(h(PT.PriceSentence, { template: L[key], price }));
        const iso = html.match(/<bdi[^>]*data-kf-price[^>]*>[^<]*<\/bdi>/g) || [];
        const want = `<bdi dir="${dir}" data-kf-price="" class="whitespace-nowrap">${price}</bdi>`;
        const same = unescape(html.replace(/<[^>]+>/g, '')) === L[key].split('{price}').join(price);
        check(iso.length === 1 && iso[0] === want && same, `${locale} ${key} ${JSON.stringify(price)}: one ${dir} isolate holding the price exactly, no character changed`);
      }
      const page = renderToStaticMarkup(shell2(h(PW.Paywall, { labels: L, figures: F, userId: UID, pro: null, termsHref: `/${locale}/terms`, privacyHref: `/${locale}/privacy`, preview: { state: 'ready', price } }), { locale }));
      check((page.match(/data-kf-price=""/g) || []).length === 2, `${locale} ready paywall, ${JSON.stringify(price)}: the price isolated in the per-month line and the disclosure`);
    }
  }
  // The double gap: a Button is inline-flex with gap-2, so each label is ONE flex item (a span).
  for (const locale of ['ar', 'en']) {
    const L = i18n.useTranslation(locale).dashboard.iap;
    const pro = renderToStaticMarkup(shell2(h(PW.Paywall, { labels: L, figures: F, userId: UID, pro: 'apple', termsHref: `/${locale}/terms`, privacyHref: `/${locale}/privacy`, preview: { state: 'pro-apple', price: '$9.99' } }), { locale }));
    const ready = renderToStaticMarkup(shell2(h(PW.Paywall, { labels: L, figures: F, userId: UID, pro: null, termsHref: `/${locale}/terms`, privacyHref: `/${locale}/privacy`, preview: { state: 'ready', price: '$9.99' } }), { locale }));
    const buttons = [...(pro + ready).matchAll(/<button[^>]*>([^]*?)<\/button>/g)].map((m) => m[1]);
    check(buttons.length >= 3 && buttons.every((b) => /^<span>[^]*<\/span>$/.test(b)), `${locale} paywall: every button's label is one span (${buttons.length} buttons)`);
  }
  // "من App Store" (keep-together.ts): the Arabic delete note holds it with a no-break space.
  const KT = await load('src/lib/keep-together.ts');
  const AMk = await load('src/components/iap/AppStoreManage.tsx');
  if (KT && AMk) {
    const arL = i18n.useTranslation('ar').dashboard.iap;
    check(KT.KEEP_TOGETHER.includes('من App Store'), 'keep-together lists "من App Store"');
    const note = renderToStaticMarkup(shell2(h(AMk.AppStoreDeleteNote, { labels: arL }), { locale: 'ar' }));
    // 3e40b56 drew "من Store App": the no-break space inside "App Store" cut it into two isolates (latin-groups RUN).
    // The approved v12 note (2026-11-18) no longer says "من App Store", so the real note is held to ONE
    // isolate and the keep-together guard is proved on a planted note: the approved one plus " من App Store".
    check(/<bdi dir="ltr"[^>]*>App[  ]Store<\/bdi>/.test(note) && !/<\/bdi>[\s ]*<bdi/.test(note), 'the Arabic delete note draws ONE "App Store" isolate (not two)');
    const planted = renderToStaticMarkup(shell2(h(AMk.AppStoreDeleteNote, { labels: { ...arL, deleteNote: `${arL.deleteNote} من App Store` } }), { locale: 'ar' }));
    check(/من <bdi dir="ltr"[^>]*>App[  ]Store<\/bdi>/.test(planted) && !/<\/bdi>[\s ]*<bdi/.test(planted), 'planted: a note ending "من App Store" draws "من" + no-break space + ONE "App Store" isolate (not two)');
    check(/<button[^>]*data-kf-iap-manage[^>]*><span>[^]*?<\/span><\/button>/.test(note), 'the delete note\'s Manage button: its label is one span');
  }
  // The paywall's own protected phrases (keep-together.ts, KEEP_TOGETHER_PAYWALL; the owner's render review of
  // #338's merge, design-c 44420154517): "بـ24 ساعة" (ar disclosure, 360), "سجّل الدخول" (ar other-account and
  // not-this-account, 390), "Apple Account" (en disclosure, twice), "Try again" (en unavailable, 390 and 360).
  // Each is drawn with a no-break space in every paywall state that holds it; the forced case is main's path
  // (keepTogether alone), on which each phrase keeps a breakable space and the same test must fail.
  if (KT) {
    const WANT = ['بـ24 ساعة', 'سجّل الدخول', 'Apple Account', 'Try again'];
    check(JSON.stringify([...(KT.KEEP_TOGETHER_PAYWALL || [])]) === JSON.stringify(WANT), `KEEP_TOGETHER_PAYWALL is exactly the four phrases (${JSON.stringify(KT.KEEP_TOGETHER_PAYWALL)})`);
    check(WANT.every((w) => !KT.KEEP_TOGETHER.includes(w)), 'none of the four is in KEEP_TOGETHER (that list is held on every screen; these stay inside the paywall)');
    // Where each phrase stands: [locale, state, label key].
    const AT = {
      'بـ24 ساعة': [['ar', 'ready', 'disclosure'], ['ar', 'failed', 'disclosure'], ['ar', 'restore-none', 'disclosure']],
      'سجّل الدخول': [['ar', 'other-account', 'otherAccount'], ['ar', 'not-this-account', 'notThisAccount']],
      'Apple Account': [['en', 'ready', 'disclosure'], ['en', 'pending', 'disclosure'], ['en', 'restore-none', 'restoreNone']],
      'Try again': [['en', 'unavailable', 'unavailable'], ['en', 'failed', 'failed'], ['en', 'restore-failed', 'restoreFailed']],
    };
    const words = (w) => w.split(' ');
    // Joined: every occurrence of the phrase in the drawn text has a no-break space and none a plain one.
    const joined = (txt, w) => txt.includes(words(w).join(' ')) && !txt.includes(w);
    // Tags out, spaces as drawn (text() squashes s, which holds the no-break space).
    const strip = (html) => html.replace(/<[^>]+>/g, '');
    const drawn = (locale, state, labels) => strip(renderToStaticMarkup(shell2(h(PW.Paywall, { labels, figures: F, userId: UID, pro: null, termsHref: `/${locale}/terms`, privacyHref: `/${locale}/privacy`, preview: { state, price: '$9.99' } }), { locale })));
    for (const w of WANT) {
      for (const [locale, state, key] of AT[w]) {
        const L = i18n.useTranslation(locale).dashboard.iap;
        check(L[key].includes(w), `${locale}.${key} holds "${w}" (the approved string, unchanged)`);
        check(joined(drawn(locale, state, L), w), `${locale} paywall "${state}": "${w}" is drawn with a no-break space (one line)`);
        // Forced: main's path, keepTogether alone; the phrase keeps its plain space and the test must fail.
        const old = KT.keepTogether(L[key]);
        check(!joined(old, w), `forced: main's keepTogether leaves "${w}" breakable in ${locale}.${key}, and the test flags it`);
      }
    }
    // Only the paywall: keepTogetherPaywall is imported by Paywall.tsx alone (shell 2), so the web and build 8 are unchanged.
    const users = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const q = join(d, f); if (statSync(q).isDirectory()) walk(q); else if (/\.tsx?$/.test(f) && readFileSync(q, 'utf8').includes('keepTogetherPaywall')) users.push(q.replace(/\\/g, '/').replace(/^.*?src\//, 'src/')); } };
    walk(join(ROOT, 'src'));
    check(JSON.stringify(users.sort()) === JSON.stringify(['src/components/iap/Paywall.tsx', 'src/lib/keep-together.ts']), `keepTogetherPaywall is used by Paywall.tsx alone (${JSON.stringify(users)})`);
    const pwSrc = readFileSync(join(ROOT, 'src/components/iap/Paywall.tsx'), 'utf8');
    check(/<LatinText text=\{keepTogetherPaywall\(message\[state\]!\)\} \/>/.test(pwSrc) && /<PriceSentence template=\{keepTogetherPaywall\(labels\.disclosure\)\} price=\{price\} \/>/.test(pwSrc), 'Paywall.tsx: the status message and the 3.1.2 disclosure go through keepTogetherPaywall');
    // keepTogetherPaywall adds to keepTogether, never takes away: KEEP_TOGETHER's own phrases still joined.
    check(KT.keepTogetherPaywall('عن الذكاء الاصطناعي، سجّل الدخول') === 'عن الذكاء الاصطناعي، سجّل الدخول', 'keepTogetherPaywall keeps KEEP_TOGETHER\'s phrases too');
  }
  // The refusal sentences design-c answers in the page are the routes' own (iap.mjs, REFUSALS).
  const lm2 = await load('src/lib/limit-messages.ts');
  const al2 = await load('src/lib/ai-allowance.ts');
  const rl2 = await load('src/lib/rate-limit.ts');
  if (lm2 && al2 && rl2) {
    const now = new Date('2026-11-18T19:00:00Z');
    const drift = [];
    for (const locale of ['ar', 'en']) {
      for (const platform of ['native', 'web']) for (const kind of ['query', 'upload', 'summary', 'quiz']) {
        const live = lm2.dailyLimitMessage(locale, kind, rl2.DAILY_CAPS.free[kind], 'free', lm2.nextDailyReset(now), now, platform);
        if (DCI.REFUSALS[locale][platform][kind] !== live) drift.push(`${locale}.${platform}.${kind}`);
      }
      if (DCI.REFUSALS[locale].allowance !== al2.aiAllowanceRefusalMessage(locale)) drift.push(`${locale}.allowance`);
    }
    check(drift.length === 0, `design-c's refusal sentences equal dailyLimitMessage / aiAllowanceRefusalMessage (18 of them)${drift.length ? `; drifted: ${drift.join(', ')}` : ''}`);
  }
}

// ---- 6. Settings ------------------------------------------------------------------------
section('6. Settings: web and build 8 unchanged; shell 2 offer; R1 and R2');
const SP = await load('src/components/dashboard/SettingsPanel.tsx');
const DC = await load('src/components/dashboard/DeleteAccountCard.tsx');
const CC = await load('src/components/dashboard/CancelSubscriptionCard.tsx');
const PO = await load('src/components/iap/ProOffer.tsx');
const AM = await load('src/components/iap/AppStoreManage.tsx');
const site = await load('src/lib/site.ts');
if (SP && DC && CC && PO && AM && i18n && site) {
  for (const locale of ['en', 'ar']) {
    const t = i18n.useTranslation(locale);
    const s = t.dashboard.settings;
    const iapL = t.dashboard.iap;
    const labels = Object.fromEntries(['title', 'subtitle', 'account', 'email', 'plan', 'free', 'pro', 'freePlanDesc', 'proPlanDesc', 'renews', 'cancels', 'upgrade', 'activeSubscription', 'preferences', 'language', 'helpLegal', 'privacyPolicy', 'terms', 'support', 'supportDesc'].map((k) => [k, s[k]]));
    Object.assign(labels, { appearance: t.nav.appearance, themeDark: t.nav.themeDark, themeLight: t.nav.themeLight });
    const offer = h(PO.ProOfferCard, { title: iapL.title, body: iapL.offerBody, button: iapL.offerButton });
    const panel = ({ isPro = false, upgradeHref = null, sub = null, appleNote, proOfferCard, native = true, billing = false } = {}) =>
      h(SP.SettingsPanel, {
        email: 'student@example.com', isPro, renewsOn: isPro ? '25 Oct' : null, cancelsOn: null, upgradeHref, locale, pathname: `/${locale}/dashboard/settings`,
        privacyHref: `/${locale}/privacy`, termsHref: `/${locale}/terms`, supportEmail: site.SUPPORT_EMAIL, labels: { ...labels, subtitle: native ? s.subtitleApp : s.subtitle },
        subscriptionCard: sub, proOfferCard,
        deleteCard: h(DC.DeleteAccountCard, { homeHref: `/${locale}`, labels: site.withSupportEmail(s.deleteAccount), showBillingNote: billing, appleNote }),
      });
    const web = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, panel({ upgradeHref: `/${locale}/pricing`, native: false })));
    const app1 = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'native', shell: 1 }, panel({})));
    // The page hands no offer card to shell 1 or the web (proOfferCard undefined); the panel ignores one anyway when a plan card shows.
    const webGiven = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, panel({ upgradeHref: `/${locale}/pricing`, native: false, proOfferCard: offer })));
    check(!/data-kf-iap/.test(web) && !/data-kf-iap/.test(app1), `${locale}: the web and build 8 Settings carry no data-kf-iap element`);
    check(web === webGiven, `${locale}: on the web the plan card wins: even a stray offer card changes nothing`);
    check(!purchaseViolation(kfPurchaseHtml(app1, 1)), `${locale}: build 8 Settings is clean under the strict rule: ${JSON.stringify(kfPurchaseHtml(app1, 1).words)}`);
    // Shell 2 with the plugin (preview: as if it answered).
    let app2 = renderToStaticMarkup(shell2(panel({ proOfferCard: offer }), { locale }));
    if (PLANT) app2 = app2.replace('</header>', `<p>${locale === 'ar' ? 'اشترك في الباقة الاحترافية' : 'Upgrade to the Pro plan'}</p></header>`);
    const r2 = kfPurchaseHtml(app2, 2);
    check(/data-kf-iap="plan"/.test(app2) && app2.includes(`href="/${locale}/dashboard/pro"`), `${locale}: shell 2, a free account: the offer card, marked, linking to the in-app paywall`);
    check(!purchaseViolation(r2), `${locale}: shell 2 Settings is clean outside data-kf-iap: ${JSON.stringify({ words: r2.words, hrefs: r2.hrefs })}`);
    check(!/\/pricing|checkout|paddle/i.test(app2), `${locale}: shell 2 Settings links to no pricing, checkout or Paddle page`);
    // Shell 2 WITHOUT the plugin (the Android shell, or iOS before the plugin answers): nothing on the server.
    const noPlugin = renderToStaticMarkup(shell2(panel({ proOfferCard: offer }), { locale, preview: false }));
    check(!/data-kf-iap/.test(noPlugin), `${locale}: shell 2 without the plugin renders no purchase surface on the server (Android, or before the plugin answers)`);
    // R1.
    const cancel = h(CC.CancelSubscriptionCard, { labels: site.withSupportEmail(s.cancelSubscription), accessUntil: '25 Oct', alreadyScheduled: false });
    const appleWeb = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, panel({ isPro: true, upgradeHref: `/${locale}/pricing`, native: false, sub: h(AM.AppStoreManageCard, { labels: iapL }) })));
    check(appleWeb.includes('data-kf-apple-manage') && squash(text(appleWeb)).includes(squash(text(iapL.manageWeb)).slice(0, 30)) && !appleWeb.includes('data-kf-iap-manage') && !appleWeb.includes(text(s.cancelSubscription.openButton)), `${locale}: R1 on the web, Apple-only Pro: the App Store line as plain text, no button, no Paddle cancel card`);
    const appleApp2 = renderToStaticMarkup(shell2(panel({ isPro: true, sub: h(AM.AppStoreManageCard, { labels: iapL }) }), { locale }));
    check(/data-kf-iap="manage"/.test(appleApp2) && appleApp2.includes('data-kf-iap-manage') && squash(text(appleApp2)).includes(squash(text(iapL.manageApp)).slice(0, 30)), `${locale}: R1 in shell 2: the card is marked and carries Manage in the App Store`);
    // Shell 2, a Pro account (Apple, or Paddle with its cancel card and billing line): the plan card's
    // status and the subscription cards are purchase management, marked, so the page is clean.
    for (const [who, sub] of [['Apple', h(AM.AppStoreManageCard, { labels: iapL })], ['Paddle', cancel]]) {
      const pro2 = renderToStaticMarkup(shell2(h(SP.SettingsPanel, {
        email: 'student@example.com', isPro: true, renewsOn: null, cancelsOn: null, upgradeHref: null, locale, pathname: `/${locale}/dashboard/settings`,
        privacyHref: `/${locale}/privacy`, termsHref: `/${locale}/terms`, supportEmail: site.SUPPORT_EMAIL, labels: { ...labels, subtitle: s.subtitleApp },
        subscriptionCard: sub, iapMarked: true,
        deleteCard: h(DC.DeleteAccountCard, { homeHref: `/${locale}`, labels: site.withSupportEmail(s.deleteAccount), showBillingNote: who === 'Paddle', appleNote: who === 'Apple' ? h(AM.AppStoreDeleteNote, { labels: iapL }) : undefined }),
      }), { locale }));
      const rr = kfPurchaseHtml(pro2, 2);
      check(/data-kf-iap="status"/.test(pro2) && /data-kf-iap="subscription"/.test(pro2) && !purchaseViolation(rr), `${locale}: shell 2, ${who} Pro Settings: status and subscription cards marked, nothing outside: ${JSON.stringify(rr.words)}`);
    }
    const unmarked1 = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'native', shell: 1 }, panel({ isPro: true, sub: cancel, billing: true })));
    check(!/data-kf-iap/.test(unmarked1), `${locale}: build 8 Pro Settings carries no marker (iapMarked is shell 2 only)`);
    const paddleWeb = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, panel({ isPro: true, upgradeHref: `/${locale}/pricing`, native: false, sub: cancel })));
    check(paddleWeb.includes(text(s.cancelSubscription.openButton)) && !paddleWeb.includes('data-kf-apple-manage'), `${locale}: Paddle Pro keeps the Paddle cancel card, and no App Store card`);
    // R2.
    const del = (appleNote) => renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, h(DC.DeleteAccountCard, { homeHref: `/${locale}`, labels: site.withSupportEmail(s.deleteAccount), showBillingNote: false, ...(appleNote === 'omit' ? {} : { appleNote }) })));
    check(del('omit') === del(undefined), `${locale}: R2: a delete card with no Apple line is byte-identical to the card before`);
    const withNote = del(h(AM.AppStoreDeleteNote, { labels: iapL }));
    check(withNote.includes('data-kf-apple-delete-note') && text(withNote).includes(text(iapL.deleteNote).slice(0, 30)), `${locale}: R2: with an Apple row Apple may bill, the card says deletion does not cancel the App Store subscription`);
    const noteApp2 = renderToStaticMarkup(shell2(h(DC.DeleteAccountCard, { homeHref: `/${locale}`, labels: site.withSupportEmail(s.deleteAccount), showBillingNote: false, appleNote: h(AM.AppStoreDeleteNote, { labels: iapL }) }), { locale }));
    check(/data-kf-iap="delete-note"/.test(noteApp2) && noteApp2.includes('data-kf-iap-manage'), `${locale}: R2 in shell 2: the line is marked and carries Manage in the App Store`);
    // The refusal button.
    const btn2 = renderToStaticMarkup(shell2(h(PO.ProOfferButton, {}), { locale }));
    const btnPro = renderToStaticMarkup(shell2(h(PO.ProOfferButton, {}), { locale, offer: false }));
    const btnWeb = renderToStaticMarkup(h(PP.PlatformProvider, { platform: 'web' }, h(PO.ProOfferButton, {})));
    check(/data-kf-iap="offer"/.test(btn2) && btn2.includes(`href="/${locale}/dashboard/pro"`) && btnPro === '' && btnWeb === '', `${locale}: the refusal button: shell 2 free only (empty for Pro and on the web)`);
  }
}
{
  const page = read('src/app/[locale]/dashboard/settings/page.tsx');
  check(/const appleOnly = isPro && sources\.apple && !sources\.paddle/.test(page) && /appleOnly \? \(\s*<AppStoreManageCard/.test(page), 'R1 on the live page: an Apple-only Pro gets the App Store card instead of the Paddle cancel card');
  check(/isPro && !appleOnly \? await readScheduledCancellation/.test(page), 'R1: no Paddle round trip for an Apple-only Pro (Paddle behaviour unchanged for every Paddle row)');
  check(/appleNote=\{sources\.appleBilling \? <AppStoreDeleteNote/.test(page), 'R2 on the live page: the delete card\'s App Store line exactly while Apple may bill');
}

// ---- 7. the shell-2 rule's forced cases ---------------------------------------------------
section('7. The 3.1.3(f) rule in shell 2, and its forced cases');
{
  const inside = '<main><h1>Settings</h1><div data-kf-iap="plan"><p>Get Pro for $9.99 a month</p><a href="/en/dashboard/pro">See Pro</a></div></main>';
  check(!purchaseViolation(kfPurchaseHtml(inside, 2)), 'shell 2: purchase words inside data-kf-iap are allowed');
  const outsideWord = inside.replace('<h1>Settings</h1>', '<h1>Settings</h1><p>Upgrade your plan</p>');
  check(purchaseViolation(kfPurchaseHtml(outsideWord, 2)), 'FORCED: a purchase word outside data-kf-iap in shell 2 is a violation');
  const ar = '<main><p>اشترك الآن في الباقة</p><div data-kf-iap="x">اشترك</div></main>';
  check(purchaseViolation(kfPurchaseHtml(ar, 2)), 'FORCED: an Arabic purchase word outside data-kf-iap is a violation');
  const pricingInside = inside.replace('/en/dashboard/pro', '/en/pricing');
  check(purchaseViolation(kfPurchaseHtml(pricingInside, 2)) && kfPurchaseHtml(pricingInside, 2).hrefs.includes('/en/pricing'), 'FORCED: a pricing link INSIDE data-kf-iap is still a violation');
  for (const href of ['https://checkout.paddle.com/x', '/en/upgrade', '/ar/checkout']) check(purchaseViolation(kfPurchaseHtml(`<div data-kf-iap="x"><a href="${href}">x</a></div>`, 2)), `FORCED: ${href} inside data-kf-iap is a violation`);
  check(purchaseViolation(kfPurchaseHtml('<div data-kf-iap="x"><p>hello</p></div>', 1)) && kfPurchaseHtml('<div data-kf-iap="x"></div>', 1).outside === true, 'FORCED: any data-kf-iap element in shell 1 (build 8) is a violation');
  check(purchaseViolation(kfPurchaseHtml(inside, 1)), 'FORCED: the shell-2 offer drawn in shell 1 is a violation (words and the marker)');
  check(purchaseViolation(kfPurchaseHtml('<div data-kf-iap="x"></div>', 0)), 'FORCED: and on the web (shell 0)');
  const nested = '<div data-kf-iap="a"><div><div>Pro</div></div></div><div><p>free</p></div>';
  check(purchaseViolation(kfPurchaseHtml(nested, 2)) && kfPurchaseHtml(nested, 2).words.includes('free'), 'the cut stops at the marked element\'s own closing tag (a word after it is still read)');
  const src = read('scripts/lib/app-wording.mjs');
  check(/export const KF_PURCHASE_SRC = String\.raw`function kfPurchase\(D,S\)/.test(src) && /outside:S<2&&M\.length>0/.test(src), 'KF_PURCHASE_SRC holds the same rule for the probe and the renders');
  const swift = read('ios/App/App/MainViewController.swift');
  const m = /export const KF_PURCHASE_SRC = String\.raw`([^`]*)`/.exec(src);
  check(m && swift.includes(m[1].replace(/\\/g, '\\\\')) && /purchase:kfPurchase\(document,shellN\)/.test(swift), 'the in-app probe embeds KF_PURCHASE_SRC byte for byte and reports it as purchase');
}

// ---- 8. entitlement sources ---------------------------------------------------------------
section('8. Where Pro comes from');
const ent = await load('src/lib/entitlement.ts');
check(typeof ent?.sourcesFromRows === 'function' && typeof ent?.readEntitlementDetail === 'function', 'entitlement.ts reports the sources (sourcesFromRows, readEntitlementDetail)');
if (typeof ent?.sourcesFromRows === 'function' && typeof ent?.readEntitlementDetail === 'function') {
  const future = new Date(Date.now() + 9 * 864e5).toISOString();
  const past = new Date(Date.now() - 9 * 864e5).toISOString();
  const S = (p, a) => JSON.stringify(ent.sourcesFromRows(p, a));
  check(S([], [{ status: 'active', expires_at: future }]) === '{"paddle":false,"apple":true,"appleBilling":true}', 'Apple active: apple, Apple may bill');
  check(S([{ status: 'active', current_period_end: future }], []) === '{"paddle":true,"apple":false,"appleBilling":false}', 'Paddle active: paddle only');
  check(S([], [{ status: 'billing_retry', expires_at: past }]) === '{"paddle":false,"apple":false,"appleBilling":true}', 'Apple billing_retry after its date: not Pro, but Apple may still bill (R2 shows)');
  check(S([], [{ status: 'grace_period', expires_at: future }]) === '{"paddle":false,"apple":true,"appleBilling":true}', 'Apple grace period: Pro, may bill');
  for (const st of ['expired', 'revoked', 'refunded']) check(S([], [{ status: st, expires_at: future }]) === '{"paddle":false,"apple":false,"appleBilling":false}', `Apple ${st}: neither Pro nor billable`);
  check(S(null, null) === '{"paddle":false,"apple":false,"appleBilling":false}', 'two failed reads: no source');
  const client = (paddle, apple) => ({ from: (t) => ({ select: () => ({ eq: async () => (t === 'subscriptions' ? paddle : apple) }) }) });
  const orig = console.error; console.error = () => {};
  try {
    for (const [name, p, a] of [
      ['Paddle only', { data: [{ status: 'active', current_period_end: future }], error: null }, { data: [], error: null }],
      ['Apple only', { data: [], error: null }, { data: [{ status: 'active', expires_at: future }], error: null }],
      ['both', { data: [{ status: 'active', current_period_end: past }], error: null }, { data: [{ status: 'active', expires_at: future }], error: null }],
      ['Apple read failed', { data: [{ status: 'active', current_period_end: future }], error: null }, { data: null, error: { code: 'x', message: 'x' } }],
      ['Paddle read failed', { data: null, error: { code: 'x', message: 'x' } }, { data: [{ status: 'active', expires_at: future }], error: null }],
    ]) {
      const e1 = await ent.readEntitlement(client(p, a), UID);
      const d = await ent.readEntitlementDetail(client(p, a), UID);
      check(JSON.stringify(e1) === JSON.stringify(d.entitlement) && JSON.stringify(Object.keys(e1)) === '["tier","adsEnabled","expiresAt"]', `${name}: readEntitlement answers exactly what the detail's entitlement is, in its old shape (${e1.tier})`);
    }
  } finally { console.error = orig; }
}

// ---- 9. refusal codes ---------------------------------------------------------------------
section('9. The refusals Pro lifts carry a code, and each surface reads it');
{
  const rl = read('src/lib/rate-limit.ts');
  check(/export const DAILY_LIMIT_REFUSAL = 'daily-limit'/.test(rl) && (rl.match(/code: DAILY_LIMIT_REFUSAL/g) || []).length === 2, 'the daily cap\'s refusals (questions/summaries/quizzes, uploads) carry code daily-limit');
  check(!/TOO_FAST\[locale\],\s*code/.test(rl) && /reason === 'failures' \? \{\} : \{ code: DAILY_LIMIT_REFUSAL \}/.test(rl), 'the burst guard and the failed-uploads refusal carry none (Pro does not lift them)');
  for (const r of ['ingest', 'page-read', 'quiz/generate', 'summarize']) check(/NextResponse\.json\(\{ error: limit\.error, code: limit\.code \}, \{ status: limit\.status \}\)/.test(read(`src/app/api/${r}/route.ts`)), `/api/${r} sends the limiter's code beside its message`);
  check(/'X-KF-Refusal': limit\.code/.test(read('src/app/api/agent/route.ts')), '/api/agent sends it as X-KF-Refusal (its refusal is text/plain)');
  const po = read('src/components/iap/ProOffer.tsx');
  check(/OFFER_REFUSALS: readonly string\[\] = \['daily-limit', 'ai-allowance-used'\]/.test(po), 'the offer follows daily-limit and ai-allowance-used only');
  const al = read('src/lib/ai-allowance.ts');
  check(/AI_ALLOWANCE_REFUSAL = 'ai-allowance-used'/.test(al), 'ai-allowance-used is the allowance\'s own code');
  for (const f of ['src/components/agent/ChatBox.tsx', 'src/components/summary/SummarySection.tsx', 'src/components/quiz/QuizSection.tsx', 'src/components/upload/DropZone.tsx', 'src/components/upload/CameraPages.tsx']) {
    const c = read(f);
    check(/<ProOfferButton \/>/.test(c) && /offersPro\(/.test(c) && /=== 429 && offersPro/.test(c), `${f.split('/').pop()}: the offer under a 429 whose code Pro lifts`);
  }
  const lm = await load('src/lib/limit-messages.ts');
  if (lm?.readRefusalCode) {
    const a = await lm.readRefusalCode(new Response('x', { status: 429, headers: { 'X-KF-Refusal': 'daily-limit' } }));
    const b = await lm.readRefusalCode(new Response(JSON.stringify({ error: 'x', code: 'ai-allowance-used' }), { status: 429 }));
    const c = await lm.readRefusalCode(new Response(JSON.stringify({ error: 'x' }), { status: 429 }));
    check(a === 'daily-limit' && b === 'ai-allowance-used' && c === null, 'readRefusalCode reads the header, then the JSON code, and null when there is none');
  } else check(false, 'limit-messages exports readRefusalCode');
}

// ---- 10. native --------------------------------------------------------------------------
section('10. The native plugin');
{
  const swift = read('ios/App/App/KnowFlowStore.swift');
  const main = read('ios/App/App/MainViewController.swift');
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  check(/class KnowFlowStorePlugin: CAPPlugin, CAPBridgedPlugin/.test(swift) && /jsName = "KnowFlowStore"/.test(swift), 'KnowFlowStore.swift is a Capacitor bridged plugin named KnowFlowStore');
  for (const m of ['products', 'purchase', 'restore', 'pending', 'finish', 'manageSubscriptions']) check(new RegExp(`CAPPluginMethod\\(name: "${m}"`).test(swift) && new RegExp(`@objc func ${m}\\(_ call: CAPPluginCall\\)`).test(swift), `the plugin answers ${m}`);
  check(/\.appAccountToken\(token\)/.test(swift) && /UUID\(uuidString: raw\)/.test(swift), 'purchase sets appAccountToken from the page\'s user id');
  check(/AppStore\.sync\(\)/.test(swift) && /Transaction\.currentEntitlements/.test(swift), 'restore is AppStore.sync then currentEntitlements');
  check(/AppStore\.showManageSubscriptions\(in: scene\)/.test(swift), 'manage opens the App Store\'s own sheet');
  check(/for await result in Transaction\.updates/.test(swift) && /Transaction\.unfinished/.test(swift), 'a Transaction.updates listener, and the unfinished queue');
  check(/case \.pending:/.test(swift) && /case \.userCancelled:/.test(swift) && /catch StoreKitError\.userCancelled/.test(swift), 'pending (Ask to Buy), userCancelled and failures are each answered');
  const finishes = [...swift.matchAll(/\.finish\(\)/g)].map((m) => m.index);
  const fStart = swift.indexOf('@objc func finish('), fEnd = swift.indexOf('@objc func manageSubscriptions(');
  check(finishes.length >= 1 && finishes.every((i) => i > fStart && i < fEnd), 'transaction.finish() is called ONLY inside the finish method (the page calls it after a 200)');
  check(!/tryknowflow|URLSession|URLRequest/.test(swift.replace(/\/\/[^\n]*/g, '')), 'the plugin makes no network call of its own (the page verifies with its own session)');
  const simIf = main.indexOf('#if targetEnvironment(simulator)', main.indexOf('override open func capacitorDidLoad'));
  const reg = main.indexOf('bridge?.registerPluginInstance(store)');
  check(reg > 0 && reg < simIf && /store\.startListening\(\)/.test(main), 'MainViewController registers the plugin and starts its listener at launch, in every build (before the simulator-only code)');
  check(pbx.split('\n').filter((l) => l.includes('KnowFlowStore.swift')).length === 4 && /KnowFlowStore\.swift in Sources \*\/,\s*9582B6832FE993A70072D4E8/.test(pbx), 'the Xcode project compiles KnowFlowStore.swift in the App target (file, group, build file, Sources)');
  const deps = read('package.json') + read('ios/App/CapApp-SPM/Package.swift') + read('package-lock.json').slice(0, 2_000_000);
  check(!/revenuecat|purchases-capacitor|capacitor-purchases|cordova-plugin-purchase|glassfy|adapty|qonversion/i.test(deps), 'no third-party purchase package (no RevenueCat or the like) in package.json, the lockfile or CapApp-SPM');
}

// ---- 11. strings -------------------------------------------------------------------------
section('11. The strings');
if (i18n) {
  const en = i18n.useTranslation('en').dashboard.iap, ar = i18n.useTranslation('ar').dashboard.iap;
  check(en && ar && JSON.stringify(Object.keys(en).sort()) === JSON.stringify(Object.keys(ar).sort()), `both locales carry the same ${Object.keys(en || {}).length} keys`);
  const all = [...Object.values(en || {}), ...Object.values(ar || {})];
  check(!all.some((v) => /—/.test(v)), 'no em dash');
  check(!Object.values(ar || {}).some((v) => /[٠-٩۰-۹]/.test(v)), 'Arabic uses Western digits');
  for (const [k, v] of Object.entries(en || {})) if (/\{price\}|\{n\}/.test(v)) check((ar[k].match(/\{price\}|\{n\}/g) || []).join() === (v.match(/\{price\}|\{n\}/g) || []).join(), `${k}: the same placeholders in both locales`);
  // The owner approved the shorter set on 2026-11-18 (docs/copy/ARABIC_STRINGS_app_v12.md);
  // the earlier drafts stay on record, marked superseded.
  const draft = read('docs/copy-drafts/iap_app_v1.md');
  check(/^# .*\(SUPERSEDED\)/.test(draft) && draft.includes('docs/copy/ARABIC_STRINGS_app_v12.md'), 'docs/copy-drafts/iap_app_v1.md is marked superseded and points at the approved batch');
  const batch = read('docs/copy/ARABIC_STRINGS_app_v12.md').split(/\r?\n/);
  const enOk = Object.entries(en || {}).filter(([k, v]) => batch.includes(`- \`dashboard.iap.${k}\`: ${v}`)).length;
  const arOk = Object.entries(ar || {}).filter(([k, v]) => batch.some((l) => l.startsWith(`| \`dashboard.iap.${k}\` | ${v} | `))).length;
  check(enOk === Object.keys(en || {}).length && arOk === Object.keys(ar || {}).length, `docs/copy/ARABIC_STRINGS_app_v12.md approves every key at the dictionaries' exact value (en ${enOk}, ar ${arOk} of ${Object.keys(en || {}).length})`);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL${PLANT ? ' (planted run: this is the expected outcome)' : ''}`);
  process.exit(1);
}
console.log('PASS');
