/**
 * SIGN IN WITH APPLE (iOS 1.1, big item 4f, PR 1) in design-c.
 *
 * WHO SEES WHAT. The Apple button exists only in the app from shell 2
 * (`KnowFlowApp/2`) AND only where the KnowFlowApple plugin answers
 * (src/lib/auth/apple-bridge.ts). A runner has no native shell, so the plugin
 * is a stub (`appleStubSrc`): `window.Capacitor` defined before the page
 * loads, answering `isPluginAvailable('KnowFlowApple')` and `available` the
 * way KnowFlowApple.swift (PR 2) will. The same stub is given to shell 1 and
 * to the web (a forged bridge in a browser): neither may draw the button.
 *
 * WHAT IS DRAWN, ar and en, light and dark:
 *   /login and /signup at shell 2 with the stub, at 390 x 844 and 360 x 800:
 *     the Apple button FIRST, then the "or", then the email card;
 *   the gate, at 390, light (both languages): shell 2 WITHOUT the stub,
 *     shell 1 with it, the web with it; no button in any, and each the same
 *     picture as main (check 22);
 *   the delete card of an Apple account (preview/settings?account=apple):
 *     open at shell 2 with the stub (the Apple step, no email field, 390 and
 *     360); open on the web (the typed email, as before); Apple's refusal
 *     (the line and the email field); and the line shown when Apple's access
 *     was not ended, with Done (shell 2 at 390 and 360, the web).
 *
 * CHECK 30 (appleCheck, every Apple screen, AFTER):
 *   - the button exactly where expected (one, above every other provider
 *     button and above the email card, the "or" shown) or nowhere;
 *   - Apple's own logo path (its first command) in a 39 x 44 frame, the
 *     label on one line, the button at least 44 tall and the form's width;
 *   - the HIG fill: pure #000 with #FFF on light, #FFF with #000 on dark;
 *     title contrast at least 4.5:1 (it is 21:1) and the button against the
 *     page at least 3:1, in both themes;
 *   - the delete card's state per view (step, email, fallback, done);
 *   - no KEEP_TOGETHER_APPLE phrase (src/lib/keep-together.ts) split across
 *     two lines in an Apple line.
 * applePlant() then forces, on every AFTER render where it applies: the
 * title colour put on the fill (contrast), the button removed where it must
 * be, a button planted where none may be, and each kept phrase present broken
 * by a line break. Check 30 must flag every one, or the run fails.
 *
 * CHECK 22 (camera.mjs, sameCheck), widened: the gate screens above are the
 * same picture as main.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { A360 } from './android360.mjs';

/** The first command of Apple's path (Logo - SIWA - Left-aligned - Black - Large.svg). */
export const APPLE_PATH_HEAD = 'M19.8196726,13.1384615';

export function appleScreens(add, { APP, SAFARI }) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  const c = (key, path, q, ua, opts) => add(key, path, q, ua, { native: ua === APP || ua === APP2, ...opts });
  const lightOnly = (locale, theme) => theme === 'light';
  for (const page of ['login', 'signup']) {
    c(`apple-${page}-app2`, page, {}, APP2, { apple: { stub: true, page, button: true } });
    c(`apple-${page}-app2-360`, page, {}, APP2, { view: A360, apple: { stub: true, page, button: true } });
    c(`apple-${page}-gate-app2-nostub`, page, {}, APP2, { same: true, only: lightOnly, apple: { stub: false, page, button: false } });
    c(`apple-${page}-gate-app1-stub`, page, {}, APP, { same: true, only: lightOnly, apple: { stub: true, page, button: false } });
    c(`apple-${page}-gate-web-stub`, page, {}, SAFARI, { same: true, only: lightOnly, apple: { stub: true, page, button: false } });
  }
  const S = 'preview/settings';
  const q = (platform, del) => ({ platform, account: 'apple', delete: del });
  c('apple-delete-step-app2', S, q('native', 'open'), APP2, { apple: { stub: true, page: 'settings', button: false, del: 'step' } });
  c('apple-delete-step-app2-360', S, q('native', 'open'), APP2, { view: A360, apple: { stub: true, page: 'settings', button: false, del: 'step' } });
  c('apple-delete-email-web', S, q('web', 'open'), SAFARI, { apple: { stub: true, page: 'settings', button: false, del: 'email' } });
  c('apple-delete-fallback-app2', S, q('native', 'fallback'), APP2, { apple: { stub: true, page: 'settings', button: false, del: 'fallback' } });
  c('apple-delete-done-app2', S, q('native', 'done'), APP2, { apple: { stub: true, page: 'settings', button: false, del: 'done' } });
  c('apple-delete-done-app2-360', S, q('native', 'done'), APP2, { view: A360, apple: { stub: true, page: 'settings', button: false, del: 'done' } });
  c('apple-delete-done-web', S, q('web', 'done'), SAFARI, { only: lightOnly, apple: { stub: true, page: 'settings', button: false, del: 'done' } });
}

/** KEEP_TOGETHER_APPLE, read from the source the card calls. */
export function keepAppleList(root) {
  const src = readFileSync(join(root, 'src/lib/keep-together.ts'), 'utf8');
  const body = /KEEP_TOGETHER_APPLE = \[([^\]]*)\]/.exec(src)?.[1] || '';
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** The expectation check 30 reads. */
export function appleExpect(job, keep) {
  return { ...job.s.apple, theme: job.theme, locale: job.locale, keep, head: APPLE_PATH_HEAD };
}

/** The plugin, stubbed before the page loads (evaluateOnNewDocument). Never opens a sheet. */
export function appleStubSrc() {
  return `(function(){
var A=window.__kfApple={calls:[]};
var prev=window.Capacitor||{};
window.Capacitor=Object.assign({},prev,{
isNativePlatform:function(){return true},
getPlatform:function(){return 'ios'},
isPluginAvailable:function(n){return n==='KnowFlowApple'||(prev.isPluginAvailable?prev.isPluginAvailable(n):false)},
nativePromise:function(p,m,o){A.calls.push(p+'.'+m);
if(p==='KnowFlowApple'&&m==='available')return Promise.resolve({available:true});
if(p==='KnowFlowApple')return new Promise(function(){});
return prev.nativePromise?prev.nativePromise(p,m,o):Promise.reject(new Error('not stubbed: '+p))}
});
})();`;
}

/**
 * CHECK 30, in the page. Self-contained (it is passed to evaluate as source).
 * Returns { finding, measured }.
 */
export function appleCheck(expect) {
  const f = [];
  const m = {};
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const pageBg = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c;
    }
    return [255, 255, 255];
  };
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lineCount = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && !tops.some((t) => Math.abs(t - r.top) < 4)) tops.push(r.top);
    return tops.length;
  };

  const wraps = [...document.querySelectorAll('[data-kf-apple-signin]')].filter(visible);
  const named = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((b) => visible(b) && /\bapple\b/i.test(`${b.textContent || ''} ${b.getAttribute('aria-label') || ''}`));
  m.buttons = wraps.length;
  if (!expect.button) {
    if (wraps.length || named.length) f.push(`an Apple sign-in button where none may be (${wraps.length} marked, ${named.length} named)`);
  } else if (wraps.length !== 1) {
    f.push(`expected exactly one Apple button, found ${wraps.length}`);
  } else {
    const btn = wraps[0].querySelector('button');
    const r = btn.getBoundingClientRect();
    m.height = Math.round(r.height);
    m.width = Math.round(r.width);
    if (r.height < 44) f.push(`the Apple button is ${Math.round(r.height)} tall, under 44`);
    const form = btn.closest('form');
    const card = form && form.querySelector('.kf-card');
    if (card && r.bottom > card.getBoundingClientRect().top) f.push('the Apple button is not above the email card');
    if (card && Math.abs(r.width - card.getBoundingClientRect().width) > 1) f.push(`the Apple button is ${Math.round(r.width)} wide, the card ${Math.round(card.getBoundingClientRect().width)}`);
    const others = [...(form || document).querySelectorAll('button')].filter((b) => b !== btn && visible(b) && /google/i.test(b.textContent || ''));
    if (others.some((o) => o.getBoundingClientRect().top < r.top)) f.push('a provider button sits above Apple');
    const divider = [...(form || document).querySelectorAll('[aria-hidden="true"]')].find((d) => visible(d) && d.querySelector('span') && /^(or|أو)$/.test((d.textContent || '').trim()));
    if (!divider) f.push('the Apple button is shown but the "or" divider is not');
    const path = btn.querySelector('svg path');
    const svg = btn.querySelector('svg');
    const d = path?.getAttribute('d') || '';
    m.logo = d.slice(0, 22);
    if (!d.startsWith(expect.head)) f.push(`the logo is not Apple's artwork (path starts "${d.slice(0, 22)}")`);
    if (svg && (svg.getAttribute('viewBox') !== '0 0 39 44' || Math.round(svg.getBoundingClientRect().height) !== 44)) f.push('the logo is not in Apple\'s 39 x 44 frame');
    const label = btn.querySelector('span');
    m.labelLines = label ? lineCount(label) : 0;
    if (!label || m.labelLines !== 1) f.push(`the Apple label takes ${m.labelLines} line(s)`);
    const cs = getComputedStyle(btn);
    const fill = rgb(cs.backgroundColor), ink = rgb(cs.color);
    m.fill = cs.backgroundColor;
    m.ink = cs.color;
    const want = expect.theme === 'dark' ? [[255, 255, 255], [0, 0, 0]] : [[0, 0, 0], [255, 255, 255]];
    if (fill.slice(0, 3).join() !== want[0].join() || ink.slice(0, 3).join() !== want[1].join()) f.push(`the HIG fill on ${expect.theme} is ${want[0].join(',')} with ${want[1].join(',')}; drawn ${cs.backgroundColor} with ${cs.color}`);
    m.titleContrast = Math.round(ratio(fill, ink) * 100) / 100;
    m.pageContrast = Math.round(ratio(fill, pageBg(wraps[0])) * 100) / 100;
    if (m.titleContrast < 4.5) f.push(`the Apple title contrast is ${m.titleContrast}:1, under 4.5`);
    if (m.pageContrast < 3) f.push(`the Apple button against the page is ${m.pageContrast}:1, under 3`);
  }

  if (expect.del) {
    const step = document.querySelector('[data-kf-apple-step]');
    const email = document.querySelector('#confirm-email');
    const unconfirmed = document.querySelector('[data-kf-apple-unconfirmed]');
    const done = document.querySelector('[data-kf-apple-not-revoked]');
    m.del = { step: visible(step), email: visible(email), unconfirmed: visible(unconfirmed), done: visible(done) };
    const want = { step: { step: true, email: false }, email: { step: false, email: true }, fallback: { step: false, email: true, unconfirmed: true }, done: { done: true, email: false, step: false } }[expect.del];
    for (const [k, v] of Object.entries(want)) if (m.del[k] !== v) f.push(`delete card (${expect.del}): ${k} ${v ? 'missing' : 'shown'}`);
    if (expect.del === 'done') {
      const a = done && done.parentElement.querySelector('a[href]');
      if (!a || a.getBoundingClientRect().height < 44) f.push('delete card (done): no 44-tall link home');
    }
  }

  // Kept phrases, in the Apple lines only.
  const scopes = [...document.querySelectorAll('[data-kf-apple-step], [data-kf-apple-unconfirmed], [data-kf-apple-not-revoked], [data-kf-apple-signin] span')].filter(visible);
  const re = new RegExp(expect.keep.map((p) => p.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\u2011]')).join('[ \u00A0]+')).join('|'), 'g');
  m.phrases = [];
  for (const el of scopes) {
    const nodes = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n);
    let text = '';
    const at = [];
    for (const n of nodes) { at.push({ n, start: text.length }); text += n.data; }
    const locate = (i) => { let k = at.length - 1; while (k > 0 && at[k].start > i) k--; return [at[k].n, i - at[k].start]; };
    re.lastIndex = 0;
    for (let x = re.exec(text); x; x = re.exec(text)) {
      const range = document.createRange();
      range.setStart(...locate(x.index));
      const [en, eo] = locate(x.index + x[0].length - 1);
      range.setEnd(en, eo + 1);
      const tops = [];
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && !tops.some((t) => Math.abs(t - r.top) < 4)) tops.push(r.top);
      // A <br> inside the phrase (the forced case) is a break with no rect of its own.
      const frag = range.cloneContents();
      const broken = tops.length > 1 || !!frag.querySelector?.('br');
      const phrase = x[0].replace(/\u00A0/g, ' ').replace(/\u2011/g, '-');
      m.phrases.push({ phrase, lines: tops.length, broken });
      if (broken) f.push(`the phrase "${phrase}" splits across two lines`);
    }
  }
  return { finding: f.join('; ') || null, measured: m };
}

/**
 * Check 30's forced cases, after the shot, on AFTER. Each one is undone
 * before the next. Returns [{ kind, caught, finding }].
 */
export function applePlant(expect) {
  const out = [];
  const run = (kind, apply, undo) => {
    apply();
    const r = window.appleCheck(expect);
    out.push({ kind, caught: !!r.finding, finding: r.finding });
    undo();
  };
  const wrap = document.querySelector('[data-kf-apple-signin]');
  if (expect.button && wrap) {
    const btn = wrap.querySelector('button');
    const before = btn.getAttribute('style');
    run('contrast', () => { btn.style.color = getComputedStyle(btn).backgroundColor; }, () => { if (before === null) btn.removeAttribute('style'); else btn.setAttribute('style', before); });
    const parent = wrap.parentElement, next = wrap.nextSibling;
    run('removed', () => wrap.remove(), () => parent.insertBefore(wrap, next));
  }
  if (!expect.button && (expect.page === 'login' || expect.page === 'signup')) {
    const form = document.querySelector('form');
    const fake = document.createElement('div');
    fake.setAttribute('data-kf-apple-signin', '');
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:block;width:100%;height:54px';
    b.textContent = 'Sign in with Apple';
    fake.appendChild(b);
    run('planted', () => form.prepend(fake), () => fake.remove());
  }
  // Each kept phrase present in an Apple line, broken after its first word.
  // The line is read as one text across its nodes (LatinText draws a Latin
  // run as its own <bdi>), the break goes into the node holding that space.
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\u2011]');
  for (const el of document.querySelectorAll('[data-kf-apple-step], [data-kf-apple-unconfirmed], [data-kf-apple-not-revoked]')) {
    for (const p of expect.keep) {
      const nodes = [];
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n);
      let text = '';
      const at = [];
      for (const n of nodes) { at.push({ n, start: text.length }); text += n.data; }
      const x = new RegExp(p.split(' ').map(esc).join('[ \u00A0]+')).exec(text);
      if (!x) continue;
      const cut = x.index + p.split(' ')[0].length;
      let k = at.length - 1;
      while (k > 0 && at[k].start > cut) k--;
      const n = at[k].n;
      const tail = n.splitText(cut - at[k].start);
      const br = document.createElement('br');
      n.parentNode.insertBefore(br, tail);
      run(`phrase:${p}`, () => {}, () => { br.remove(); n.data += tail.data; tail.remove(); });
    }
  }
  return out;
}
