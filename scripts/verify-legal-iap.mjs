/**
 * /privacy AND /refund FROM BUILD 9 (item 4j, store step 2): the proof.
 *
 * Build 9 sells KnowFlow Pro through the App Store, so four sentences on the
 * two pages became false: "Nothing is paid inside this app", deletion
 * "immediately cancels any active subscription" / "stops any recurring
 * payment the account has", "Nothing is sold or charged inside this app", and
 * Paddle as "the merchant of record for every purchase". This holds the
 * corrected pages to #357's placement rule:
 *
 *   1. THE WEB (the pages App Store Connect links), en and ar: none of the
 *      false sentences; Paddle named for purchases on this website only;
 *      the App Store copy present, plain (no data-kf-iap): Apple's App Store
 *      as the processor of an App Store purchase, deletion does NOT cancel an
 *      App Store subscription (cancel it in the Apple Account settings),
 *      refunds by Apple at Apple's refund address, cancelling in the Apple
 *      Account settings; the web's Paddle refund and cancel wording kept.
 *   2. THE APP STORE PIECES name no other way to pay (3.1.1: no Paddle, web,
 *      website, browser, pricing, checkout or tryknowflow) and type no price.
 *   3. BUILD 8 AND ANDROID NEVER SEE PURCHASE WORDS (the forced check). The
 *      twins' server markup (one page for build 8, build 9 before mount, and
 *      the Android shell) holds no App Store piece, none of the false
 *      sentences, and no sentence about paying, refunds or cancelling that
 *      names the web; it is clean under the shell-1 and the shell-2 wording
 *      rule (scripts/lib/app-wording.mjs), in both locales.
 *   4. THE GATE. AppStoreOnly decides with appStoreTermsMode (#357's pure
 *      gate, unchanged): plain on the web, marked in the app only where the
 *      KnowFlowStore plugin answers, nothing otherwise. Every piece drawn
 *      marked passes the shell-2 rule and fails shell 1's; drawn UNMARKED in
 *      the twin it fails both, which is why none is in the twin's markup.
 *
 * PLANTED RUN: KF_LEGAL_PLANT=1 puts the App Store pieces, unmarked, into
 * both twins' markup; the proof must then FAIL (typecheck.yml).
 *
 * Tier 0: no network, no credential, no app.
 * Usage: node --experimental-strip-types scripts/verify-legal-iap.mjs
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
const PLANT = process.env.KF_LEGAL_PLANT === '1';

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
const PAGES = {
  privacy: (await load('src/app/[locale]/(site)/privacy/page.tsx')).default,
  refund: (await load('src/app/[locale]/(site)/refund/page.tsx')).default,
};

const under = (platform, el) => renderToStaticMarkup(h(PlatformProvider, { platform }, el));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
/** Every App Store piece in the markup, by its mark, with its whole element. */
const piecesOf = (html) => {
  const out = [];
  for (const m of html.matchAll(/<(li|p|span|div)\b[^>]*\sdata-kf-app-store-legal="([^"]+)"[^>]*>/g)) {
    const tag = m[1];
    const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'g');
    re.lastIndex = m.index + m[0].length;
    let depth = 1; let end = html.length;
    for (let t = re.exec(html); t; t = re.exec(html)) { depth += t[1] ? -1 : 1; if (depth === 0) { end = t.index + t[0].length; break; } }
    out.push({ mark: m[2], open: m[0], html: html.slice(m.index, end) });
  }
  return out;
};
const sentences = (t) => t.split(/(?<=[.!?:])\s+/);

/** The four sentences build 9 made false, and the one #357 already removed from /terms. */
const FALSE = [
  ['nothing is paid in the app', /Nothing is paid inside this app/i],
  ['nothing is sold in the app', /Nothing is sold/i],
  ['nothing to refund', /nothing to refund/i],
  ['deletion cancels any subscription', /cancels any active subscription/i],
  ['deletion stops any recurring payment the account has', /stops any recurring payment the account has/i],
  ['Paddle for every purchase', /merchant of record for every purchase/i],
  ['Paddle processes any payment', /processes any payment made for a KnowFlow account/i],
];
const WEB_WAY = /paddle|pricing|website|\bweb\b|browser|checkout|tryknowflow/i;
const EXPECTED_MARKS = { privacy: ['privacy-processor', 'privacy-delete'], refund: ['refund'] };

const PIECE_CLAUSES = {
  'privacy-processor': [
    ['names the App Store', /Apple's App Store/],
    ['only for an in-app subscription', /only if you subscribe to KnowFlow Pro in the app/],
    ['Apple takes the payment, we never see the details', /Apple takes the payment and keeps your payment details, so we never see them/],
    ['the account identifier given to Apple', /gives Apple your KnowFlow account's identifier/],
    ['the record Apple sends', /Apple sends KnowFlow a signed record of the subscription/],
  ],
  'privacy-delete': [
    ['deletion does not cancel an App Store subscription', /Deleting your account does not cancel an App Store subscription/],
    ['where to cancel it', /cancel it in your Apple Account settings/],
  ],
  refund: [
    ['refunds by Apple', /Refunds for App Store purchases are requested from Apple and decided by Apple, under Apple's rules/],
    ['we cannot refund it', /We cannot refund an App Store purchase ourselves/],
    ['cancel in the Apple Account settings, 24 hours', /cancel the subscription in your Apple Account settings at least 24 hours before the end of the current period/],
    ['kept to the end of the period', /You keep KnowFlow Pro until the end of the period you have paid for/],
    ['deletion does not cancel', /Deleting your KnowFlow account does not cancel an App Store subscription/],
  ],
};

console.log('\n1. The web: the false sentences are gone, the App Store copy is there, plain');
const web = {};
for (const page of Object.keys(PAGES)) {
  for (const locale of ['en', 'ar']) {
    const html = under('web', await PAGES[page]({ params: Promise.resolve({ locale }) }));
    web[`${page}/${locale}`] = html;
    const t = text(html);
    for (const [name, re] of FALSE) check(!re.test(t), `${page} ${locale} web: no "${name}"`);
    const pieces = piecesOf(html);
    check(JSON.stringify(pieces.map((p) => p.mark)) === JSON.stringify(EXPECTED_MARKS[page]), `${page} ${locale} web: the App Store pieces ${JSON.stringify(EXPECTED_MARKS[page])} are drawn (got ${JSON.stringify(pieces.map((p) => p.mark))})`);
    check(pieces.every((p) => !/\sdata-kf-iap(=|\s|>)/.test(p.open)), `${page} ${locale} web: every App Store piece is plain (no data-kf-iap)`);
    check(kfPurchaseHtml(html, 0).marked === 0, `${page} ${locale} web: the page marks nothing data-kf-iap (the web may hold no marked element)`);
    if (page === 'privacy') {
      check(/Paddle takes the payment if you subscribe to Pro on this website\./.test(t), `privacy ${locale} web: Paddle takes the payment for a subscription on this website`);
      check(/immediately cancels a subscription paid through Paddle\./.test(t), `privacy ${locale} web: deletion cancels a Paddle subscription`);
      check(t.indexOf('Paddle takes the payment') < t.indexOf("Apple's App Store"), `privacy ${locale} web: the App Store follows Paddle in the list`);
      check(t.indexOf('nothing can be restored afterwards.') < t.indexOf('Deleting your account does not cancel an App Store subscription'), `privacy ${locale} web: the App Store deletion line follows the deletion sentence`);
    } else {
      check(/KnowFlow Pro bought on this website is sold through Paddle, which is the merchant of record for those purchases/.test(t), `refund ${locale} web: Paddle for purchases on this website only`);
      check(html.includes('href="https://paddle.net"') && html.includes('href="https://www.paddle.com/legal/refund-policy"'), `refund ${locale} web: Paddle's refund links kept`);
      check(/You can cancel a subscription bought on this website at any time from Settings in your dashboard\./.test(t), `refund ${locale} web: the website's cancel line kept`);
      check(/Section 3: App Store Purchases/.test(t) && /Section 4: Cancelling/.test(t) && /Section 5: Contact/.test(t), `refund ${locale} web: the sections are numbered 1 to 5`);
      check(pieces[0]?.html.includes(`href="${terms.APPLE_REFUND_URL}"`) && terms.APPLE_REFUND_URL === 'https://reportaproblem.apple.com/', `refund ${locale} web: Apple's refund address linked exactly`);
    }
  }
}

console.log('\n2. The App Store pieces say what they must, and nothing 3.1.1 forbids');
for (const page of Object.keys(PAGES)) {
  for (const locale of ['en', 'ar']) {
    for (const p of piecesOf(web[`${page}/${locale}`])) {
      const t = text(p.html);
      for (const [name, re] of PIECE_CLAUSES[p.mark] || []) check(re.test(t), `${p.mark} ${locale}: "${name}"`);
      check(!WEB_WAY.test(t), `${p.mark} ${locale}: names no other way to pay (3.1.1)`);
      check(!kfWording(t).includes('currency') && !/\d/.test(t.replace(/24 hours/g, '').replace(/^Section \d: /, '')), `${p.mark} ${locale}: no price and no figure but "24 hours" (and the web's section number)`);
      check(!/—/.test(t), `${p.mark} ${locale}: no em dash`);
      const hrefs = [...p.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      check(hrefs.every((x) => x.startsWith('https://reportaproblem.apple.com/')), `${p.mark} ${locale}: its only link is Apple's (${JSON.stringify(hrefs)})`);
    }
  }
}

console.log('\n3. Build 8 and Android never see purchase words: the twins\' server markup');
for (const page of Object.keys(PAGES)) {
  for (const locale of ['en', 'ar']) {
    let twin = under('native', await PAGES[page]({ params: Promise.resolve({ locale }) }));
    if (PLANT) twin = twin.replace('</h1>', `</h1>${piecesOf(web[`${page}/${locale}`]).map((p) => p.html).join('')}`);
    const t = text(twin);
    check(!twin.includes('data-kf-app-store-legal') && !/App Store/.test(t), `${page} ${locale}: no App Store piece in the twin's server markup`);
    for (const [name, re] of FALSE) check(!re.test(t), `${page} ${locale} twin: no "${name}"`);
    const pay = sentences(t).filter((s) => /pa(y|id)|refund|cancel|charge|purchase|bought|sold/i.test(s));
    const leak = pay.filter((s) => WEB_WAY.test(s.replace(/Paddle/g, '')));
    check(!leak.length, `${page} ${locale} twin: no sentence about paying, refunds or cancelling names the web (${JSON.stringify(leak)})`);
    for (const shell of [1, 2]) {
      const r = kfPurchaseHtml(twin, shell);
      check(!purchaseViolation(r), `${page} ${locale}: the twin is clean under the shell-${shell} wording rule (${JSON.stringify({ words: r.words, hrefs: r.hrefs, marked: r.marked })})`);
    }
    if (page === 'privacy') {
      check(/Paddle ?, only for a payment made through Paddle\./.test(t), `privacy ${locale} twin: Paddle disclosed, only for a payment made through it`);
      check(/stops any recurring payment made through Paddle\./.test(t), `privacy ${locale} twin: deletion stops a Paddle payment, and says nothing false about Apple`);
    } else {
      check(/Refunds Any payment made for a KnowFlow account is governed by the terms shown when it is made\./.test(t), `refund ${locale} twin: the neutral refunds line`);
      check(twin.includes(`mailto:`) || t.includes('@'), `refund ${locale} twin: the contact line kept`);
    }
  }
}

console.log('\n4. The gate');
{
  const src = read('src/components/legal/AppStoreOnly.tsx');
  check(/import \{ appStoreTermsMode \} from '@\/components\/legal\/AppStoreTerms'/.test(src) && /appStoreTermsMode\(web, storeBridge\(\) !== null\) === 'marked'/.test(src), 'AppStoreOnly decides with #357\'s appStoreTermsMode and storeBridge');
  check(/\{\.\.\.\(web \? \{\} : \{ 'data-kf-iap': mark \}\)\}/.test(src), 'AppStoreOnly marks the piece data-kf-iap in the app, never on the web');
  check(/if \(!web && !inApp\) return null;/.test(src), 'AppStoreOnly draws nothing in the app until the plugin answers');
  check(!/navigator\.userAgent/.test(src), 'no user-agent sniffing in the client');
  check(AST.appStoreTermsMode(true, false) === 'plain' && AST.appStoreTermsMode(false, true) === 'marked' && AST.appStoreTermsMode(false, false) === null, 'appStoreTermsMode: web plain, build 9 marked, build 8 and Android nothing');
  for (const page of Object.keys(PAGES)) {
    check(read(`src/app/[locale]/native/(site)/${page}/page.tsx`).replace(/\/\/.*$/gm, '').trim() === `export { default } from '@/app/[locale]/(site)/${page}/page';`, `the ${page} twin is still a bare re-export`);
    for (const locale of ['en', 'ar']) {
      const base = under('native', await PAGES[page]({ params: Promise.resolve({ locale }) }));
      const pieces = piecesOf(web[`${page}/${locale}`]).map((p) => p.html);
      const marked = base + pieces.map((x, i) => x.replace(/^<(\w+)/, `<$1 data-kf-iap="${EXPECTED_MARKS[page][i]}"`)).join('');
      const plain = base + pieces.join('');
      check(!purchaseViolation(kfPurchaseHtml(marked, 2)), `${page} ${locale}: the pieces drawn marked pass the shell-2 rule`);
      check(purchaseViolation(kfPurchaseHtml(marked, 1)), `${page} ${locale}: the pieces drawn marked FAIL the shell-1 rule (why build 8 must never draw them)`);
      check(purchaseViolation(kfPurchaseHtml(plain, 2)) && purchaseViolation(kfPurchaseHtml(plain, 1)), `${page} ${locale}: the pieces drawn unmarked in the app fail both rules`);
    }
  }
}

console.log(`\n${passed} passed, ${failures.length} failed${PLANT ? ' (PLANTED run: this must fail)' : ''}`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}
console.log('PASS: /privacy and /refund say nothing false from build 9; the web shows the App Store copy, build 8 and Android never, build 9 only marked.');
