/**
 * /privacy AND /refund FROM BUILD 9 (item 4j, store step 2) in design-c.
 *
 * WHO SEES WHAT. The App Store pieces of the two pages
 * (src/components/legal/AppStoreOnly.tsx, each `data-kf-app-store-legal`):
 * /privacy has "privacy-processor" (Apple's App Store in the processor list)
 * and "privacy-delete" (deletion does not cancel an App Store subscription);
 * /refund has "refund" (refunds by Apple, cancelling in the Apple Account
 * settings). On the web they are in the server markup, unmarked; in the app
 * only where the KnowFlowStore plugin answers (build 9), after mount, each
 * marked `data-kf-iap="<its mark>"`; never in build 8, never in the Android
 * shell. A runner has no native shell, so the plugin is terms.mjs's stub.
 *
 * WHAT IS DRAWN, ar and en, light and dark, for each page:
 *   - the web at 390 x 844, 360 x 800 and 1280 x 800: the pieces, plain;
 *   - shell 2 with the stub at 390 and 360: the pieces, marked;
 *   - shell 2 WITHOUT the stub (the Android shell, or iOS before the plugin
 *     answers) at 390, and shell 1 (build 8) at 390 and 360: no piece.
 * The two pages are the screens this change is about, so none is held to
 * main's picture; every other screen still is (check 22).
 *
 * CHECK 35 (legalCheck, every legal screen, AFTER):
 *   - exactly the expected pieces, in order, where expected; none elsewhere;
 *   - each marked with its own name in the app, under no data-kf-iap on the
 *     web (the web and build 8 may hold no marked element, check 24);
 *   - THE FORCED BUILD 8 / ANDROID RULE: where no piece may be, the whole
 *     page's text carries no purchase word (the wording rule, strict) and no
 *     element is marked; in build 9 no purchase word outside the marks;
 *   - no piece names another way to pay (3.1.1) or a price figure; the
 *     refund piece links Apple's refund address.
 * legalPlant() then forces, on every AFTER legal render, before the shot
 * (each case put back): a piece's mark taken off (build 9); a piece planted
 * where none may be, and a purchase word planted in the page (build 8 and
 * Android); a piece wrapped in a mark on the web; a purchase word planted
 * outside the marks (build 9). Check 35 must flag every one that applies, or
 * the run fails.
 */
import { A360 } from './android360.mjs';

export const LEGAL_MARKS = { privacy: ['privacy-processor', 'privacy-delete'], refund: ['refund'] };
export const APPLE_REFUND = 'https://reportaproblem.apple.com/';
export const LEGAL_KINDS = ['unmarked', 'planted', 'word', 'web-marked', 'leak'];

export function legalScreens(add, { APP, SAFARI, DESK, DESKTOP }) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  for (const page of Object.keys(LEGAL_MARKS)) {
    const c = (key, ua, opts) => add(`${page}-${key}`, page, {}, ua, { native: ua === APP || ua === APP2, ...opts, legal: { page, ...opts.legal } });
    c('web', SAFARI, { legal: { mode: 'plain', stub: false } });
    c('web-360', SAFARI, { view: A360, legal: { mode: 'plain', stub: false } });
    c('desk', DESK, { view: DESKTOP, targets: false, legal: { mode: 'plain', stub: false } });
    c('app2', APP2, { legal: { mode: 'marked', stub: true } });
    c('app2-360', APP2, { view: A360, legal: { mode: 'marked', stub: true } });
    c('app2-nostub', APP2, { legal: { mode: null, stub: false } });
    c('app1', APP, { legal: { mode: null, stub: false } });
    c('app1-360', APP, { view: A360, legal: { mode: null, stub: false } });
  }
}

export function legalExpect(job) {
  return { page: job.s.legal.page, mode: job.s.legal.mode, marks: LEGAL_MARKS[job.s.legal.page], refund: APPLE_REFUND };
}

/** CHECK 35, in the page. Self-contained (passed to evaluate as source). Needs window.kfWording and window.kfPurchase. */
export function legalCheck(expect) {
  const f = [];
  const pieces = [...document.querySelectorAll('[data-kf-app-store-legal]')];
  const got = pieces.map((p) => p.getAttribute('data-kf-app-store-legal'));
  const m = { pieces: got };
  if (expect.mode === null) {
    if (pieces.length) f.push(`check 35: ${pieces.length} App Store piece(s) where none may be (${JSON.stringify(got)})`);
    if (document.querySelector('[data-kf-iap]')) f.push('check 35: a data-kf-iap element on a legal page that may show no purchase surface');
    const words = window.kfWording((document.body && document.body.innerText) || '');
    m.words = words;
    if (words.length) f.push(`check 35: purchase words where build 8 and Android read the page: ${JSON.stringify(words)}`);
  } else {
    if (JSON.stringify(got) !== JSON.stringify(expect.marks)) f.push(`check 35: App Store pieces ${JSON.stringify(got)}, want ${JSON.stringify(expect.marks)}`);
    for (const p of pieces) {
      const name = p.getAttribute('data-kf-app-store-legal');
      const mark = p.closest('[data-kf-iap]');
      const at = mark ? mark.getAttribute('data-kf-iap') : null;
      if (expect.mode === 'marked' && (mark !== p || at !== name)) f.push(`check 35: the app's piece "${name}" is not itself marked data-kf-iap="${name}" (got ${at})`);
      if (expect.mode === 'plain' && mark) f.push(`check 35: the web's piece "${name}" sits inside data-kf-iap="${at}"`);
      const t = p.innerText || '';
      if (/paddle|pricing|website|\bweb\b|browser|checkout|tryknowflow/i.test(t)) f.push(`check 35: the piece "${name}" names another way to pay (3.1.1)`);
      if (window.kfWording(t).includes('currency')) f.push(`check 35: a price figure in the piece "${name}"`);
      if (name === 'refund' && ![...p.querySelectorAll('a[href]')].some((a) => a.getAttribute('href') === expect.refund)) f.push(`check 35: the refund piece does not link ${expect.refund}`);
    }
    if (expect.mode === 'marked') {
      const r = window.kfPurchase(document, 2);
      m.outside = r.words;
      if (r.words.length) f.push(`check 35: build 9 shows purchase words outside data-kf-iap: ${JSON.stringify(r.words)}`);
    }
  }
  return { finding: f.length ? f.join('; ') : null, measured: m };
}

/** Check 35's forced cases, before the shot, on AFTER. Self-contained; needs window.legalCheck. */
export function legalPlant(expect) {
  const rows = [];
  const flagged = (e) => !!window.legalCheck(e).finding;
  const first = document.querySelector('[data-kf-app-store-legal]');
  if (expect.mode === 'marked' && first) {
    const was = first.getAttribute('data-kf-iap');
    first.removeAttribute('data-kf-iap');
    try { rows.push({ kind: 'unmarked', caught: flagged(expect) }); } finally { if (was !== null) first.setAttribute('data-kf-iap', was); }
  }
  if (expect.mode === null) {
    const p = document.createElement('p');
    p.setAttribute('data-kf-app-store-legal', expect.marks[0]);
    p.textContent = 'Refunds for App Store purchases are requested from Apple.';
    document.body.appendChild(p);
    try { rows.push({ kind: 'planted', caught: flagged(expect) }); } finally { p.remove(); }
    // The forced build 8 / Android case: one purchase word, unmarked, in the page's own text.
    const w = document.createElement('p');
    w.textContent = 'Your subscription renews each month.';
    (document.querySelector('main') || document.body).appendChild(w);
    try { rows.push({ kind: 'word', caught: flagged(expect) }); } finally { w.remove(); }
  }
  if (expect.mode === 'plain' && first) {
    first.setAttribute('data-kf-iap', 'legal');
    try { rows.push({ kind: 'web-marked', caught: flagged(expect) }); } finally { first.removeAttribute('data-kf-iap'); }
  }
  if (expect.mode === 'marked' && first) {
    const w = document.createElement('p');
    w.textContent = 'KnowFlow Pro renews each month.';
    (document.querySelector('main') || document.body).appendChild(w);
    try { rows.push({ kind: 'leak', caught: flagged(expect) }); } finally { w.remove(); }
  }
  return rows;
}
