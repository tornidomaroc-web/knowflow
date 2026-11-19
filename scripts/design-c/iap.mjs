/**
 * IN-APP PRO, THE APP HALF (iOS 1.1, item 4d) in design-c.
 *
 * WHO SEES WHAT. The paywall and its entry points exist only for the app from
 * shell 2 (`KnowFlowApp/2`; build 9 is the 1.1 submission with the camera and
 * Pro). Build 8 (`KnowFlowApp/1`) and the web keep today's screens EXACTLY.
 *
 * WHAT IS DRAWN, ar and en, light and dark:
 *   - the paywall in each of its 15 states (src/lib/iap/flow.ts,
 *     PAYWALL_STATES), at 390 x 844 and at 360 x 800;
 *   - Settings at shell 2 for a free account (the offer card), and for a Pro
 *     bought in the app (R1: the App Store card; R2: the delete card's App
 *     Store line), at 390 and 360;
 *   - Settings for that Apple Pro on the web (390 and 1280) and in build 8:
 *     the App Store line as plain text, no button, no purchase marker.
 *
 * CHECK 24 (iapCheck, EVERY render): the shell's wording rule
 * (scripts/lib/app-wording.mjs, KF_PURCHASE_SRC, run in the page):
 *   - the web and build 8: no element marked data-kf-iap at all;
 *   - shell 2: no purchase word outside data-kf-iap and no pricing, checkout,
 *     Paddle or upgrade link anywhere (this replaces the plain wording rule
 *     for shell 2, which would flag the paywall's own words);
 *   - a paywall screen: the state asked is the state drawn, the buy button
 *     exactly where the state allows it, Restore where it allows it, the
 *     3.1.2 disclosure wherever a price is shown, Terms and Privacy links at
 *     least 44 pt tall;
 *   - the offer card, the manage button and the delete line where asked.
 * iapPlant() puts "Upgrade your plan" outside data-kf-iap on a shell-2 AFTER
 * render; check 24 must flag it, or the run fails.
 *
 * THE OWNER'S RENDER REVIEW AT 69f160f (2026-11-18) adds:
 *   - CHECK 25 (priceCheck): StoreKit's displayPrice one isolate, exactly
 *     the price, in reading order, on one line, in the per-month line and the
 *     disclosure of every paywall state that draws a price; four more
 *     storefront shapes in the ready state (PRICE_SHAPES). pricePlant()
 *     unwraps the isolate on Arabic renders of a letterless price ("$9.99",
 *     "9,99 €"), as 69f160f drew it, and must be flagged, or the run fails.
 *   - check 24's split-button rule: a flex button or link in the paywall or a
 *     data-kf-iap part holds ONE flex item (69f160f's manage button had the
 *     text and the "App Store" isolate as two, and gap-2 between them);
 *     splitPlant() unwraps the manage button's span and must be flagged.
 *   - the "See Pro" button under a refusal Pro lifts (daily-limit,
 *     ai-allowance-used) on Ask, the summary, the quiz, the drop zone and the
 *     camera, at shell 2 at 390 and 360: the route's 429 is answered in the
 *     page (refusalMock) and reached through the real controls (refusalAct);
 *     the camera's send is off in previews, so its refusal is a frozen view.
 *     Shell 1 and the web at 390 (no camera there) must be the same picture
 *     as main (check 22).
 *   - "من App Store" in KEEP_TOGETHER, so pr4.mjs's phrase check guards it.
 *
 * CHECK 22, WIDENED: every screen drawn with build 8 or the web that existed
 * before this change must be the same picture before and after (camera.mjs,
 * sameCheck), not only the drop-zone screens.
 *
 * CHECK 26 (the owner's render review of #338's merge, design-c 44420154517):
 * on every paywall render, no phrase of KEEP_TOGETHER_PAYWALL
 * (src/lib/keep-together.ts: "بـ24 ساعة", "سجّل الدخول", "Apple Account",
 * "Try again") spans two lines inside [data-kf-iap="paywall"] (pr4.mjs's
 * phraseChecks, scoped). keepPlant() forces each phrase present on an AFTER
 * paywall render onto two lines (its no-break space made a space, a <br>
 * after it); each must be flagged, and each phrase must be caught on at least
 * one render, or the run fails.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { A360 } from './android360.mjs';

const STATES = ['loading', 'unavailable', 'ready', 'purchasing', 'pending', 'success', 'failed', 'verify-failed', 'restoring', 'restore-none', 'restore-failed', 'other-account', 'not-this-account', 'pro-apple', 'pro-web'];

/** The preview's own price, StoreKit's US shape. */
export const DEFAULT_PRICE = '$9.99';
/** Other storefronts' displayPrice shapes (check 25), drawn in the ready paywall. */
export const PRICE_SHAPES = [['eur', '9,99 €'], ['us-prefix', 'US$9.99'], ['sar', '٣٫٦٧ ر.س.'], ['mad', 'MAD 99.00']];
/** The states that draw a price (the per-month line and the 3.1.2 disclosure). */
// 'success' draws the Pro status card, not the price card (design-c 44380662481 flagged it when listed here).
const PRICE_STATES = STATES.filter((s) => !['loading', 'unavailable', 'success', 'pro-apple', 'pro-web'].includes(s));

/**
 * THE REFUSALS PRO LIFTS (#338 review): where they are drawn, which code the
 * route sends, and the route's own sentence. The sentences are what
 * src/lib/limit-messages.ts (dailyLimitMessage, a free account, at
 * 2026-11-18T19:00Z, so "about 5 hours") and src/lib/ai-allowance.ts
 * (aiAllowanceRefusalMessage) return; scripts/verify-iap-app.mjs compares
 * each one with those functions, so a change there fails that proof first.
 * `native` is what the routes send to the app (shell 1 and 2), `web` to a
 * browser.
 */
export const REFUSAL_SURFACES = ['ask', 'summary', 'quiz', 'upload', 'camera'];
export const REFUSAL_CODES = [['daily', 'daily-limit'], ['allowance', 'ai-allowance-used']];
const KIND = { ask: 'query', summary: 'summary', quiz: 'quiz', upload: 'upload', camera: 'upload' };
export const REFUSALS = {
  ar: {
    native: {
      query: 'بلغت حدك اليومي من الأسئلة: 10. يتجدد الحد بعد نحو 5 ساعات.',
      upload: 'بلغت حدك اليومي من الملفات المرفوعة: 5. يتجدد الحد بعد نحو 5 ساعات.',
      summary: 'بلغت حدك اليومي من الملخصات: 5. يتجدد الحد بعد نحو 5 ساعات.',
      quiz: 'بلغت حدك اليومي من الاختبارات: 5. يتجدد الحد بعد نحو 5 ساعات.',
    },
    web: {
      query: 'بلغت حدك اليومي من الأسئلة: 10. يتجدد الحد بعد نحو 5 ساعات. الباقة الاحترافية تتيح حدودًا أعلى.',
      upload: 'بلغت حدك اليومي من الملفات المرفوعة: 5. يتجدد الحد بعد نحو 5 ساعات. الباقة الاحترافية تتيح حدودًا أعلى.',
      summary: 'بلغت حدك اليومي من الملخصات: 5. يتجدد الحد بعد نحو 5 ساعات. الباقة الاحترافية تتيح حدودًا أعلى.',
      quiz: 'بلغت حدك اليومي من الاختبارات: 5. يتجدد الحد بعد نحو 5 ساعات. الباقة الاحترافية تتيح حدودًا أعلى.',
    },
    allowance: 'وصلت إلى حد استخدام الذكاء الاصطناعي المتاح لحسابك خلال آخر 30 يومًا. لم يُرسَل شيء. يعود الرفع والأسئلة والملخصات والاختبارات تدريجيًا كلما مضى 30 يومًا على استخدامك السابق.',
  },
  en: {
    native: {
      query: "You've reached today's limit of 10 questions. It resets in about 5 hours.",
      upload: "You've reached today's limit of 5 uploads. It resets in about 5 hours.",
      summary: "You've reached today's limit of 5 summaries. It resets in about 5 hours.",
      quiz: "You've reached today's limit of 5 quizzes. It resets in about 5 hours.",
    },
    web: {
      query: "You've reached today's limit of 10 questions. It resets in about 5 hours. Pro has higher limits.",
      upload: "You've reached today's limit of 5 uploads. It resets in about 5 hours. Pro has higher limits.",
      summary: "You've reached today's limit of 5 summaries. It resets in about 5 hours. Pro has higher limits.",
      quiz: "You've reached today's limit of 5 quizzes. It resets in about 5 hours. Pro has higher limits.",
    },
    allowance: 'You have reached the AI use available to your account in the last 30 days. Nothing was sent. Uploading, asking, summaries and quizzes come back gradually as your earlier use passes 30 days.',
  },
};

/** The sentence a refusal job's route sends. */
export function refusalText(job) {
  const { surface, code } = job.s.refusal;
  const L = REFUSALS[job.locale];
  return code === 'ai-allowance-used' ? L.allowance : L[shellOf(job.s.ua) > 0 ? 'native' : 'web'][KIND[surface]];
}

const REFUSAL_PATH = { ask: '/api/agent', summary: '/api/summarize', quiz: '/api/quiz/generate', upload: '/api/ingest' };
// A small text file for the drop zone's real path (the route is answered in the page; nothing leaves the runner).
let uploadPath = null;
function uploadFile() {
  if (!uploadPath) {
    uploadPath = join(mkdtempSync(join(tmpdir(), 'kf-iap-')), 'notes.txt');
    writeFileSync(uploadPath, 'Proof file for the design-c refusal render. Nothing is sent.\n');
  }
  return uploadPath;
}

/**
 * The route's 429, answered in the page, in the shape the route sends it:
 * the agent as text with `X-KF-Refusal`, the others as JSON with `code`.
 * The camera's refusal is a frozen preview (its send is off in previews).
 */
export function refusalMock(job, r) {
  if (r.method() !== 'POST') return false;
  const { surface, code } = job.s.refusal;
  if (new URL(r.url()).pathname !== REFUSAL_PATH[surface]) return false;
  const msg = refusalText(job);
  if (surface === 'ask') r.respond({ status: 429, contentType: 'text/plain; charset=utf-8', headers: { 'X-KF-Refusal': code }, body: msg });
  else r.respond({ status: 429, contentType: 'application/json', body: JSON.stringify({ success: false, error: msg, code }) });
  return true;
}

/** Through the real controls: ask, press Summarize or the quiz, pick a file. Waits for the sentence (and, at shell 2, the offer). */
export async function refusalAct(tab, job, side) {
  const { surface } = job.s.refusal;
  // main has no frozen camera refusal (its preview draws the default view): nothing to wait for.
  if (surface === 'camera' && side === 'before') return { act: 'refusal-camera', before: 'no refusal view on main' };
  if (surface === 'ask') {
    await tab.evaluate(() => {
      const t = document.querySelector('[data-kf-composer] textarea');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(t, 'What is opportunity cost?');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tab.waitForFunction(() => { const b = document.querySelector('[data-kf-composer] button'); return b && !b.disabled; }, { timeout: 10000 });
    await tab.evaluate(() => document.querySelector('[data-kf-composer] button').click());
  } else if (surface === 'summary' || surface === 'quiz') {
    const ok = await tab.evaluate((s) => {
      const card = [...document.querySelectorAll('article[data-kf-material]')].find((c) => c.querySelector('[data-kf-study="summary"]'));
      if (!card) return false;
      card.setAttribute('data-kf-shot', 'todo');
      card.querySelector(`[data-kf-study="${s}"] button`).click();
      return true;
    }, surface);
    if (!ok) return { act: `refusal-${surface}`, error: 'no card with Summarize and the quiz' };
  } else if (surface === 'upload') {
    const input = await tab.$('input[type="file"][accept^=".pdf"]');
    if (!input) return { act: 'refusal-upload', error: 'no file input' };
    await input.uploadFile(uploadFile());
  }
  const head = refusalText(job).slice(0, 14);
  await tab.waitForFunction((h) => document.body.textContent.replace(/ /g, ' ').includes(h), { timeout: 15000 }, head);
  if (shellOf(job.s.ua) >= 2 && side === 'after') await tab.waitForSelector('[data-kf-iap="offer"] a', { timeout: 10000 });
  return { act: `refusal-${surface}` };
}

export function iapScreens(add, { APP, SAFARI, DESK, DESKTOP }, screens) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  // Check 22 over every screen that existed before: build 8 and the web.
  for (const s of screens) if (!/KnowFlowApp\/2/.test(s.ua)) s.same = true;
  const c = (key, path, q, ua, opts = {}) => add(key, path, q, ua, { native: ua === APP || ua === APP2, ...opts });
  for (const state of STATES) {
    c(`pro-${state}-app2`, 'preview/pro', { state }, APP2, { iap: { shell: 2, state } });
    c(`pro-${state}-app2-360`, 'preview/pro', { state }, APP2, { view: A360, iap: { shell: 2, state } });
  }
  c('settings-iap-app2', 'preview/settings', { platform: 'native' }, APP2, { iap: { shell: 2, offer: true } });
  c('settings-iap-app2-360', 'preview/settings', { platform: 'native' }, APP2, { view: A360, iap: { shell: 2, offer: true } });
  c('settings-apple-app2', 'preview/settings', { platform: 'native', plan: 'apple' }, APP2, { iap: { shell: 2, manage: true, deleteNote: true } });
  c('settings-apple-app2-360', 'preview/settings', { platform: 'native', plan: 'apple' }, APP2, { view: A360, iap: { shell: 2, manage: true, deleteNote: true } });
  c('settings-apple-app1', 'preview/settings', { platform: 'native', plan: 'apple' }, APP, { iap: { shell: 1, plain: true } });
  c('settings-apple-web', 'preview/settings', { platform: 'web', plan: 'apple' }, SAFARI, { iap: { shell: 0, plain: true } });
  c('settings-apple-desk', 'preview/settings', { platform: 'web', plan: 'apple' }, DESK, { view: DESKTOP, targets: false, iap: { shell: 0, plain: true } });
  // Check 25 (#338 review): other storefronts' displayPrice shapes in the ready paywall ("$9.99" is every price state above).
  for (const [slug, price] of PRICE_SHAPES) c(`pro-ready-app2-price-${slug}`, 'preview/pro', { state: 'ready', price }, APP2, { iap: { shell: 2, state: 'ready', price } });
  // The "See Pro" button under a refusal Pro lifts (#338 review): five surfaces x two codes,
  // shell 2 at 390 and 360; shell 1 and the web at 390, the same picture as main (check 22).
  for (const surface of REFUSAL_SURFACES) for (const [c2, code] of REFUSAL_CODES) {
    const camera = surface === 'camera';
    const path = surface === 'ask' ? 'preview/ask' : camera ? 'preview/camera' : 'preview/subject';
    const q = (platform) => ({ platform, ...(surface === 'ask' ? { view: 'app' } : {}), ...(camera ? { view: `refused-${c2}` } : {}) });
    const shot = surface === 'summary' || surface === 'quiz' ? { shot: 'todo' } : {};
    c(`refusal-${surface}-${c2}-app2`, path, q('native'), APP2, { ...shot, refusal: { surface, code }, iap: { shell: 2, refusal: surface } });
    c(`refusal-${surface}-${c2}-app2-360`, path, q('native'), APP2, { ...shot, view: A360, refusal: { surface, code }, iap: { shell: 2, refusal: surface } });
    if (camera) continue; // the camera is shell 2 only: build 8 and the web have none
    c(`refusal-${surface}-${c2}-app1`, path, q('native'), APP, { ...shot, same: true, refusal: { surface, code }, iap: { shell: 1, refusal: surface } });
    c(`refusal-${surface}-${c2}-web`, path, q('web'), SAFARI, { ...shot, same: true, refusal: { surface, code }, iap: { shell: 0, refusal: surface } });
  }
  return APP2;
}

/** Check 26's phrases, read from src/lib/keep-together.ts (KEEP_TOGETHER_PAYWALL). */
export function keepPaywallList(root) {
  const src = readFileSync(join(root, 'src', 'lib', 'keep-together.ts'), 'utf8');
  const m = /KEEP_TOGETHER_PAYWALL = \[([^\]]*)\]/.exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

/** Where check 26 reads. */
export const PAYWALL_SCOPE = '[data-kf-iap="paywall"]';

/**
 * Check 26's forced case. Self-contained; needs window.kfPhraseChecks. For
 * each phrase found in the paywall's text (its words joined by a space or a
 * no-break space, inside one text node), the joint is made a plain space with
 * a <br> after it, the scoped phrase check is run for that phrase alone, and
 * the node is put back. Returns one row per phrase found: caught or not.
 */
export function keepPlant(list, scope) {
  const root = document.querySelector(scope);
  if (!root) return null;
  const rows = [];
  for (const phrase of list) {
    const first = phrase.split(' ')[0];
    const re = new RegExp(phrase.split(' ').join('[ \u00A0]+'));
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let hit = null;
    for (let n = tw.nextNode(); n && !hit; n = tw.nextNode()) {
      const m = re.exec(n.data);
      if (m && n.parentElement && n.parentElement.getBoundingClientRect().width > 0) hit = { n, at: m.index + first.length };
    }
    if (!hit) continue;
    const { n, at } = hit;
    const keep = n.data;
    const tail = n.splitText(at + 1);
    n.data = n.data.slice(0, -1) + ' ';
    const br = document.createElement('br');
    n.after(br);
    let caught = false;
    try {
      caught = window.kfPhraseChecks([phrase], scope).findings.some((f) => f.includes(`"${phrase}"`));
    } finally {
      br.remove();
      tail.remove();
      n.data = keep;
    }
    rows.push({ phrase, caught });
  }
  return rows;
}

/** The shell a user agent names: 0 for the web. */
export function shellOf(ua) {
  const m = /KnowFlowApp\/(\d+)/.exec(ua || '');
  return m ? Number(m[1]) : 0;
}

/** CHECK 24. Self-contained: serialised into the page; needs window.kfPurchase and window.kfWording. */
export function iapCheck(expect) {
  const f = [];
  const q = (sel) => [...document.querySelectorAll(sel)];
  const r = window.kfPurchase(document, expect.shell);
  const measured = { marked: r.marked, words: r.words, hrefs: r.hrefs };
  if (expect.shell < 2) {
    if (r.marked) f.push(`check 24: shell ${expect.shell} shows ${r.marked} element(s) marked data-kf-iap`);
  } else {
    if (r.words.length) f.push(`check 24: shell 2 shows purchase words outside data-kf-iap: ${JSON.stringify(r.words)}`);
    if (r.hrefs.length) f.push(`check 24: shell 2 links to ${JSON.stringify(r.hrefs)}`);
  }
  if (expect.state) {
    const root = document.querySelector('[data-kf-paywall]');
    const got = root && root.getAttribute('data-kf-paywall');
    measured.state = got;
    if (got !== expect.state) f.push(`check 24: the paywall drew "${got}", asked "${expect.state}"`);
    const buy = !!document.querySelector('[data-kf-paywall-buy]');
    const restore = !!document.querySelector('[data-kf-paywall-restore]');
    const price = !!document.querySelector('[data-kf-paywall-price]');
    const disclosure = !!document.querySelector('[data-kf-paywall-disclosure]');
    const wantBuy = ['ready', 'failed', 'restore-none', 'restore-failed'].includes(expect.state);
    const wantRestore = ['ready', 'unavailable', 'failed', 'verify-failed', 'restore-none', 'restore-failed', 'pending', 'other-account', 'not-this-account'].includes(expect.state);
    if (buy !== wantBuy) f.push(`check 24: buy button ${buy ? 'shown' : 'missing'} in ${expect.state}`);
    if (restore !== wantRestore) f.push(`check 24: Restore ${restore ? 'shown' : 'missing'} in ${expect.state}`);
    if (price !== disclosure) f.push('check 24: a price without the 3.1.2 disclosure, or the reverse');
    if (expect.state === 'pro-apple' && !document.querySelector('[data-kf-iap-manage]')) f.push('check 24: Apple Pro without Manage');
    if (expect.state === 'pro-web' && (buy || restore || document.querySelector('[data-kf-iap-manage]'))) f.push('check 24: Pro from the web shows a purchase or manage control');
    const legal = q('[data-kf-paywall-legal] a');
    measured.legal = legal.map((a) => Math.round(a.getBoundingClientRect().height));
    if (legal.length !== 2) f.push(`check 24: ${legal.length} legal link(s), want Terms and Privacy`);
    for (const a of legal) if (a.getBoundingClientRect().height < 44) f.push(`check 24: the legal link "${a.textContent}" is ${a.getBoundingClientRect().height.toFixed(1)} pt tall`);
    const rows = q('[data-kf-paywall-figure]');
    if (rows.length !== 4) f.push(`check 24: ${rows.length} figure row(s), want 4`);
  }
  if (expect.offer && !document.querySelector('[data-kf-iap="plan"] a[href$="/dashboard/pro"]')) f.push('check 24: shell 2 free Settings has no offer card linking to the paywall');
  // #338 review: the "See Pro" button under a refusal Pro lifts, at shell 2 only (shell 1 and the web: no data-kf-iap, above).
  if (expect.refusal && expect.shell >= 2) {
    const offers = q('[data-kf-iap="offer"] a[href$="/dashboard/pro"]');
    measured.offers = offers.length;
    if (offers.length !== 1) f.push(`check 24: the ${expect.refusal} refusal shows ${offers.length} "See Pro" link(s) to the paywall, want 1`);
  }
  // #338 review (the double gap): a flex button or link in the paywall or a data-kf-iap part holds ONE flex
  // item. A text node beside LatinText's "App Store" isolate makes two, and the button's gap widens the space.
  // 3e40b56 (design-c 44380662481): "من Store App". Two Latin isolates side by side, nothing but spaces
  // between them, are one Latin phrase cut in two; the Arabic line orders them right to left. Every shell.
  const pairs = window.kfAdjacentIsolates();
  measured.adjacentIsolates = pairs.length;
  if (pairs.length) f.push(`check 24: Latin phrase(s) cut into two isolates, drawn in reverse: ${JSON.stringify(pairs)}`);
  if (expect.shell >= 2) {
    const split = window.kfSplitButtons();
    measured.splitButtons = split.length;
    if (split.length) f.push(`check 24: flex control(s) with more than one item beside a Latin isolate (a gap inside the words): ${JSON.stringify(split)}`);
  }
  if (expect.manage && !document.querySelector('[data-kf-iap="manage"] [data-kf-iap-manage]')) f.push('check 24: Apple Pro Settings has no App Store card with Manage');
  if (expect.deleteNote && !document.querySelector('[data-kf-iap="delete-note"]')) f.push('check 24: Apple Pro Settings has no App Store line in the delete card');
  if (expect.plain) {
    if (!document.querySelector('[data-kf-apple-manage]') || !document.querySelector('[data-kf-apple-delete-note]')) f.push('check 24: Apple Pro on the web or build 8 lacks the App Store lines');
    if (document.querySelector('[data-kf-iap-manage]')) f.push('check 24: a Manage button where the App Store sheet cannot open');
  }
  return { finding: f.length ? f.join(' | ') : null, measured };
}

/**
 * Self-contained, set on window as kfSplitButtons: every flex `button` or `a`
 * inside [data-kf-paywall] or [data-kf-iap] whose direct children include a
 * LatinText isolate (bdi[data-kf-latin]) AND anything else that is not empty.
 */
export function splitButtons() {
  const out = [];
  for (const el of document.querySelectorAll('[data-kf-paywall] button, [data-kf-paywall] a, [data-kf-iap] button, [data-kf-iap] a')) {
    if (!getComputedStyle(el).display.includes('flex')) continue;
    const items = [...el.childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()));
    if (items.length > 1 && items.some((n) => n.nodeType === 1 && n.matches('bdi[data-kf-latin]'))) out.push(el.textContent.trim().slice(0, 40));
  }
  return out;
}

/**
 * Self-contained, set on window as kfAdjacentIsolates: LatinText isolates
 * (bdi[data-kf-latin]) inside [data-kf-paywall] or [data-kf-iap] whose next
 * sibling, past nothing but spaces or no-break spaces, is another one.
 */
export function adjacentIsolates() {
  const out = [];
  for (const b of document.querySelectorAll('[data-kf-paywall] bdi[data-kf-latin], [data-kf-iap] bdi[data-kf-latin], [data-kf-apple-manage] bdi[data-kf-latin], [data-kf-apple-delete-note] bdi[data-kf-latin]')) {
    let n = b.nextSibling;
    while (n && n.nodeType === 3 && /^[\s ]*$/.test(n.data)) n = n.nextSibling;
    if (n && n.nodeType === 1 && n.matches('bdi[data-kf-latin]')) out.push(`${b.textContent}|${n.textContent}`);
  }
  return out;
}

/** The adjacent-isolate rule's forced case: the delete note's "App Store" cut as 3e40b56 cut it; it must be flagged. */
export function adjacentPlant() {
  const b = [...document.querySelectorAll('[data-kf-apple-delete-note] bdi[data-kf-latin]')].find((x) => x.textContent === 'App Store' || x.textContent === 'App Store');
  if (!b) return null;
  const second = b.cloneNode(false);
  second.textContent = 'Store';
  const keep = b.textContent;
  b.textContent = 'App';
  b.after(document.createTextNode(' '), second);
  let caught;
  try { caught = window.kfAdjacentIsolates().length > 0; } finally {
    second.previousSibling.remove();
    second.remove();
    b.textContent = keep;
  }
  return { forced: true, caught, finding: caught ? null : 'the adjacent-isolate rule is blind: "App" + "Store" as two isolates was not flagged' };
}

/** The split rule's forced case: the manage button's one span unwrapped (main's 69f160f DOM); it must be flagged. */
export function splitPlant() {
  const b = document.querySelector('[data-kf-iap-manage]');
  const span = b && [...b.children].find((x) => x.tagName === 'SPAN' && x.querySelector('bdi[data-kf-latin]'));
  if (!span) return null;
  const kids = [...span.childNodes];
  span.replaceWith(...kids);
  let caught;
  try { caught = window.kfSplitButtons().length > 0; } finally {
    const s = document.createElement('span');
    kids[0].before(s);
    s.append(...kids);
  }
  return { forced: true, caught, finding: caught ? null : 'the split-button rule is blind: the manage button unwrapped to text + isolate was not flagged' };
}

/** The price's direction, as src/components/iap/PriceText.tsx decides it (the first strong letter). */
export function priceDirOf(price) {
  for (const ch of price) {
    if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return 'rtl';
    if (/[A-Za-zÀ-ɏ]/.test(ch)) return 'ltr';
  }
  return 'ltr';
}

/** The price a paywall job must draw, or null where none is drawn. */
export function priceExpect(iap) {
  if (!iap || !iap.state || !PRICE_STATES.includes(iap.state)) return null;
  const price = iap.price || DEFAULT_PRICE;
  return { price, dir: priceDirOf(price) };
}

/**
 * CHECK 25 (the owner's review of #338 at 69f160f: "9.99$" in the Arabic
 * disclosure). Self-contained; set on window as kfPriceCheck. In the per-month
 * line and in the 3.1.2 disclosure:
 *   (a) ONE price isolate ([data-kf-price], a bdi) whose text is exactly the
 *       displayPrice asked and whose dir is the price's own;
 *   (b) the price's glyphs in reading order, measured from where each one is
 *       drawn (per character Range rects): left to right, every visible
 *       character right of the one before; right to left (an Arabic-script
 *       price), each digit group and each other character left of the one
 *       before, the digits inside a group left to right;
 *   (c) the price on one line.
 * (b) and (c) read the paragraph's text, not the isolate, so they also judge
 * a price drawn with no isolate (the forced case).
 */
export function priceCheck(want, onlyOrder) {
  const f = [];
  const measured = {};
  const blocks = [['per-month', '[data-kf-paywall-price]'], ['disclosure', '[data-kf-paywall-disclosure]']];
  for (const [name, sel] of blocks) {
    const p = document.querySelector(sel);
    if (!p) { f.push(`check 25: no ${name} line`); continue; }
    if (!onlyOrder) {
      const iso = p.querySelectorAll('[data-kf-price]');
      if (iso.length !== 1) f.push(`check 25: ${iso.length} price isolate(s) in the ${name} line, want 1`);
      else {
        if (iso[0].textContent !== want.price) f.push(`check 25: the ${name} isolate holds ${JSON.stringify(iso[0].textContent)}, want ${JSON.stringify(want.price)}`);
        if (iso[0].tagName !== 'BDI' || iso[0].getAttribute('dir') !== want.dir) f.push(`check 25: the ${name} isolate is <${iso[0].tagName.toLowerCase()} dir=${iso[0].getAttribute('dir')}>, want <bdi dir=${want.dir}>`);
      }
    }
    // The price inside the paragraph's text.
    const at = [];
    let s = '';
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) for (let i = 0; i < n.data.length; i++) { at.push([n, i]); s += n.data[i]; }
    const k = s.indexOf(want.price);
    if (k < 0) { f.push(`check 25: the ${name} line does not hold ${JSON.stringify(want.price)} exactly`); continue; }
    const chars = [];
    for (let i = 0; i < want.price.length; i++) {
      const ch = want.price[i];
      if (/\s/.test(ch)) continue;
      const r = document.createRange();
      r.setStart(at[k + i][0], at[k + i][1]);
      r.setEnd(at[k + i][0], at[k + i][1] + 1);
      const rect = [...r.getClientRects()].find((x) => x.width > 0);
      if (rect) chars.push({ i, ch, x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2, h: rect.height });
    }
    const visual = [...chars].sort((a, b) => a.x - b.x).map((c) => c.ch).join('');
    measured[name] = visual;
    const ys = chars.map((c) => c.y);
    if (chars.length && Math.max(...ys) - Math.min(...ys) > chars[0].h / 2) f.push(`check 25: the price breaks across lines in the ${name} line`);
    let bad = false;
    if (want.dir === 'ltr') {
      for (let j = 1; j < chars.length; j++) if (chars[j].x <= chars[j - 1].x) bad = true;
    } else {
      const DIGIT = /[0-9٠-٩۰-۹]/;
      const SEP = /[.,٫٬]/;
      const groups = [];
      for (const c of chars) {
        const last = groups[groups.length - 1];
        const digitish = DIGIT.test(c.ch) || (SEP.test(c.ch) && last && last.digits && DIGIT.test(want.price[c.i + 1] || ''));
        if (digitish && last && last.digits && last.end === c.i - 1) { last.chars.push(c); last.end = c.i; }
        else groups.push({ digits: DIGIT.test(c.ch), chars: [c], end: c.i });
      }
      for (const g of groups) for (let j = 1; j < g.chars.length; j++) if (g.chars[j].x <= g.chars[j - 1].x) bad = true;
      const mid = groups.map((g) => g.chars.reduce((a, c) => a + c.x, 0) / g.chars.length);
      for (let j = 1; j < mid.length; j++) if (mid[j] >= mid[j - 1]) bad = true;
    }
    if (bad) { measured.orderBad = true; f.push(`check 25: the ${name} line draws ${JSON.stringify(want.price)} as ${JSON.stringify(visual)} (left to right), not in reading order`); }
  }
  return { finding: f.length ? f.join(' | ') : null, orderBad: !!measured.orderBad, measured };
}

/**
 * Check 25's forced case: the disclosure's isolate unwrapped, so the price is
 * drawn as 69f160f drew it (plain text in the Arabic sentence). Run where
 * that mirrors it: Arabic, a price with no letter ("$9.99", "9,99 €").
 * (b) must flag it.
 */
export function pricePlant(want) {
  const iso = document.querySelector('[data-kf-paywall-disclosure] [data-kf-price]');
  if (!iso) return null;
  const t = document.createTextNode(iso.textContent);
  iso.replaceWith(t);
  t.parentNode.normalize();
  let r;
  try { r = window.kfPriceCheck(want, true); } finally { /* the shot is taken; the page is closed next */ }
  const caught = r.orderBad;
  return { forced: true, caught, drawn: r.measured, finding: caught ? null : `check 25 is blind: the disclosure's ${JSON.stringify(want.price)} drawn with no isolate was not flagged (${JSON.stringify(r.measured)})` };
}

/** Check 24's forced case: a purchase word outside data-kf-iap, shell 2. */
export function iapPlant() {
  const p = document.createElement('p');
  p.textContent = 'Upgrade your plan';
  document.body.appendChild(p);
  let r;
  try { r = window.kfPurchase(document, 2); } finally { p.remove(); }
  const caught = r.words.length > 0;
  return { forced: true, caught, finding: caught ? null : 'check 24 is blind: "Upgrade your plan" outside data-kf-iap was not flagged' };
}
