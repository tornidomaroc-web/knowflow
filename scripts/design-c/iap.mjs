/**
 * IN-APP PRO, THE APP HALF (iOS 1.1, item 4d) in design-c.
 *
 * WHO SEES WHAT. The paywall and its entry points exist only for the app from
 * shell 2 (`KnowFlowApp/2`; build 9 is the 1.1 submission with the camera and
 * Pro). Build 8 (`KnowFlowApp/1`) and the web keep today's screens EXACTLY.
 *
 * WHAT IS DRAWN, ar and en, light and dark:
 *   - the paywall in each of its 14 states (src/lib/iap/flow.ts,
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
 * CHECK 22, WIDENED: every screen drawn with build 8 or the web that existed
 * before this change must be the same picture before and after (camera.mjs,
 * sameCheck), not only the drop-zone screens.
 */
import { A360 } from './android360.mjs';

const STATES = ['loading', 'unavailable', 'ready', 'purchasing', 'pending', 'success', 'failed', 'verify-failed', 'restoring', 'restore-none', 'other-account', 'not-this-account', 'pro-apple', 'pro-web'];

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
  return APP2;
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
    const wantBuy = ['ready', 'failed', 'restore-none'].includes(expect.state);
    const wantRestore = ['ready', 'unavailable', 'failed', 'verify-failed', 'restore-none', 'pending', 'other-account', 'not-this-account'].includes(expect.state);
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
  if (expect.manage && !document.querySelector('[data-kf-iap="manage"] [data-kf-iap-manage]')) f.push('check 24: Apple Pro Settings has no App Store card with Manage');
  if (expect.deleteNote && !document.querySelector('[data-kf-iap="delete-note"]')) f.push('check 24: Apple Pro Settings has no App Store line in the delete card');
  if (expect.plain) {
    if (!document.querySelector('[data-kf-apple-manage]') || !document.querySelector('[data-kf-apple-delete-note]')) f.push('check 24: Apple Pro on the web or build 8 lacks the App Store lines');
    if (document.querySelector('[data-kf-iap-manage]')) f.push('check 24: a Manage button where the App Store sheet cannot open');
  }
  return { finding: f.length ? f.join(' | ') : null, measured };
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
