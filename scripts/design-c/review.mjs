/**
 * IN-APP RATING (iOS 1.1, big item 4h, PR 1) in design-c.
 *
 * WHO SEES WHAT. The Settings row "Rate KnowFlow" exists only in the app from
 * shell 2 (`KnowFlowApp/2`) AND only where the KnowFlowReview plugin answers
 * (src/lib/review/bridge.ts). A runner has no native shell, so the plugin is
 * a stub (`rateStubSrc`): `window.Capacitor` defined before the page loads,
 * answering `isPluginAvailable('KnowFlowReview')` and `available` the way
 * KnowFlowReview.swift (PR 2) will. It records every call; `request` must
 * never be one of them (in a CI simulator a call would show Apple's sheet).
 * The same stub is given to shell 1 and to the web (a forged bridge in a
 * browser): neither may draw the row.
 *
 * WHAT IS DRAWN, ar and en:
 *   Settings (preview/settings) at shell 2 with the stub, light and dark, at
 *     390 x 844 and 360 x 800: the row present, the last of Help and legal;
 *   the gate, at 390, light: Settings at shell 2 WITHOUT the stub, at shell 1
 *     with it, on the web with it; no row in any, and each the same picture
 *     as main (check 22);
 *   the quiz result screen (PR 4's quiz-result act, preview/subject) in the
 *     same three gate variants, the same picture as main, and no
 *     data-kf-review reading (nothing runs where the bridge is null);
 *   the quiz result at shell 2 WITH the stub: the trigger runs (no record on
 *     a fresh browser, so it reads `storage`), draws nothing (the same
 *     picture as main) and calls no `request`.
 *
 * CHECK 31 (rateCheck, every rating screen, AFTER):
 *   - one row exactly where expected, or none anywhere (no write-review link);
 *   - its href is WRITE_REVIEW_URL, read from src/lib/review/bridge.ts, with
 *     no target;
 *   - the last row of Help and legal, after Support;
 *   - the label on one line; the tile at least 56 px tall;
 *   - no 3.1.3(f) word (kfWording) in the row;
 *   - in Arabic, "KnowFlow" and "App Store" each inside a left-to-right
 *     isolate (bdi dir="ltr");
 *   - the label and its line at least 4.5:1 against the tile, drawn in the
 *     colours of the Support row;
 *   - the stub was asked `available` only, never `request`;
 *   - on a quiz screen, the root's data-kf-review is the expected reading.
 *   - the description's lines (fix 2 of #345, the owner's render review of
 *     design-c 44865033100): rateLineRules() over the words each line holds.
 *     No line ends on "a", "or", "the", "on", nor on the Arabic value's 3rd
 *     word (the conjunction) or 6th (the preposition); "write a review",
 *     "App Store" and the Arabic 4th+5th words never split across lines; no
 *     line holds a single word; the lines' words are the approved value.
 * ratePlant() then forces, on every AFTER render where it applies: a second
 * row (count), another href (href), a target (target), the row moved above
 * Support (last), the label squeezed onto two lines (lines), the tile cut to
 * 40 px (height), " Pro" added to the label (wording), an isolate taken
 * away in Arabic (isolate), the label in the tile's colour (contrast), a row
 * planted where none may be (planted), a wrong reading on the quiz root
 * (reading), a `request` call recorded by the stub (request), and three line
 * breaks forced into the description with a <br>: after "a" / the Arabic 3rd
 * word (dangle), inside "App Store" / between the Arabic 4th and 5th words
 * (split), after the first word (single). Each of the last three must be
 * flagged by ITS rule, not merely by some finding. Check 31
 * must flag every one, on every render it ran on, or the run fails.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { A360 } from './android360.mjs';

/** WRITE_REVIEW_URL, read from the source RateRow links to. */
export function rateHref(root) {
  const src = readFileSync(join(root, 'src/lib/review/bridge.ts'), 'utf8');
  const m = /export const WRITE_REVIEW_URL = '([^']+)'/.exec(src);
  if (!m) throw new Error('check 31: no WRITE_REVIEW_URL in src/lib/review/bridge.ts');
  return m[1];
}

/** Every kind ratePlant() forces; each must run somewhere and be caught everywhere it runs. */
export const RATE_KINDS = ['count', 'href', 'target', 'last', 'lines', 'height', 'wording', 'isolate', 'contrast', 'planted', 'reading', 'request', 'dangle', 'split', 'single'];

/** dashboard.settings.rateDesc in each language, read from the dictionaries (never typed). */
export function rateDesc(root) {
  const out = {};
  for (const l of ['en', 'ar']) {
    const src = readFileSync(join(root, `src/lib/i18n/locales/${l}.ts`), 'utf8');
    const m = /\brateDesc: "([^"]+)"/.exec(src);
    if (!m) throw new Error(`check 31: no rateDesc in src/lib/i18n/locales/${l}.ts`);
    out[l] = m[1];
  }
  return out;
}

/**
 * The description's line rules (fix 2 of #345). Self-contained: render.mjs
 * passes it to the page as source and verify-review.mjs calls it in node.
 * `lines` is the words each drawn line holds, in reading order; `value` the
 * approved string. Returns a list of findings (empty when the lines pass).
 */
export function rateLineRules(lines, locale, value) {
  const f = [];
  const words = value.split(' ');
  const got = lines.flat();
  if (got.join(' ') !== words.join(' ')) {
    f.push(`the description's lines hold ${JSON.stringify(got.join(' '))}, not the approved value`);
    return f;
  }
  const lineOf = [];
  lines.forEach((ws, li) => ws.forEach(() => lineOf.push(li)));
  const ends = locale === 'ar' ? [2, 5] : words.map((w, i) => (['a', 'or', 'the', 'on'].includes(w) ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < words.length - 1; i++) {
    if (lineOf[i] !== lineOf[i + 1] && ends.includes(i)) f.push(`a line of the description ends on word ${i + 1}${locale === 'ar' ? ' (the Arabic conjunction or preposition)' : ` "${words[i]}"`}`);
  }
  const find = (seq) => { for (let i = 0; i + seq.length <= words.length; i++) if (seq.every((w, k) => words[i + k] === w)) return i; return -1; };
  const keeps = locale === 'ar'
    ? [[3, 4]]
    : [['write', 'a', 'review'], ['App', 'Store.']].map((seq) => { const i = find(seq); return i < 0 ? null : [i, i + seq.length - 1]; });
  keeps.forEach((k, n) => {
    if (!k) { f.push(`keep-together phrase ${n + 1} is not in the value`); return; }
    if (lineOf[k[0]] !== lineOf[k[1]]) f.push(`the description splits ${locale === 'ar' ? 'the Arabic 4th and 5th words' : `"${words.slice(k[0], k[1] + 1).join(' ')}"`} across lines`);
  });
  lines.forEach((ws, li) => { if (ws.length === 1) f.push(`line ${li + 1} of the description holds a single word`); });
  return f;
}

/** The text of the finding each forced line case must produce (ratePlant, verify-review.mjs). */
export const RATE_LINE_KINDS = { dangle: 'ends on word', split: 'splits', single: 'single word' };

/** Where each forced line case puts its <br>: after word index i (0-based). Self-contained. */
export function rateBreakAt(kind, locale, value) {
  const w = value.split(' ');
  if (kind === 'single') return 0;
  if (locale === 'ar') return kind === 'dangle' ? 2 : 3;
  return kind === 'dangle' ? w.indexOf('a') : w.indexOf('App');
}

export function rateScreens(add, { APP, SAFARI }) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  const c = (key, path, q, ua, opts) => add(key, path, q, ua, { native: ua === APP || ua === APP2, ...opts });
  const lightOnly = (locale, theme) => theme === 'light';
  const S = 'preview/settings';
  c('rate-settings-app2', S, { platform: 'native' }, APP2, { rate: { stub: true, row: true } });
  c('rate-settings-app2-360', S, { platform: 'native' }, APP2, { view: A360, rate: { stub: true, row: true } });
  c('rate-settings-gate-app2-nostub', S, { platform: 'native' }, APP2, { same: true, only: lightOnly, rate: { stub: false, row: false } });
  c('rate-settings-gate-app1-stub', S, { platform: 'native' }, APP, { same: true, only: lightOnly, rate: { stub: true, row: false } });
  c('rate-settings-gate-web-stub', S, { platform: 'web' }, SAFARI, { same: true, only: lightOnly, rate: { stub: true, row: false } });
  // The quiz result (pr4.mjs's quiz-result act: 1 of 3, the route answered in the page).
  const Q = 'preview/subject';
  const quiz = { pr4: 'study', act: 'quiz-result', shot: 'todo' };
  c('rate-quiz-gate-app2-nostub', Q, { platform: 'native' }, APP2, { ...quiz, same: true, only: lightOnly, rate: { stub: false, row: false, quiz: true, reading: null } });
  c('rate-quiz-gate-app1-stub', Q, { platform: 'native' }, APP, { ...quiz, same: true, only: lightOnly, rate: { stub: true, row: false, quiz: true, reading: null } });
  c('rate-quiz-gate-web-stub', Q, { platform: 'web' }, SAFARI, { ...quiz, same: true, only: lightOnly, rate: { stub: true, row: false, quiz: true, reading: null } });
  c('rate-quiz-app2-stub', Q, { platform: 'native' }, APP2, { ...quiz, same: true, only: lightOnly, rate: { stub: true, row: false, quiz: true, reading: 'storage' } });
}

/** The expectation check 31 reads. */
export function rateExpect(job, href, desc) {
  return { ...job.s.rate, locale: job.locale, theme: job.theme, href, desc: desc ? desc[job.locale] : null };
}

/** The plugin, stubbed before the page loads (evaluateOnNewDocument). Records every call; never shows a sheet. */
export function rateStubSrc() {
  return `(function(){
var R=window.__kfReview={calls:[]};
var prev=window.Capacitor||{};
window.Capacitor=Object.assign({},prev,{
isNativePlatform:function(){return true},
getPlatform:function(){return 'ios'},
isPluginAvailable:function(n){return n==='KnowFlowReview'||(prev.isPluginAvailable?prev.isPluginAvailable(n):false)},
nativePromise:function(p,m,o){
if(p==='KnowFlowReview'){R.calls.push(m);
if(m==='available')return Promise.resolve({available:true,version:'1.1'});
return Promise.resolve({asked:false,reason:'design-c'})}
return prev.nativePromise?prev.nativePromise(p,m,o):Promise.reject(new Error('not stubbed: '+p))}
});
})();`;
}

/**
 * CHECK 31, in the page. Self-contained (it is passed to evaluate as source;
 * kfWording is defined in the page by render.mjs). Returns { finding, measured }.
 */
export function rateCheck(expect) {
  const f = [];
  const m = {};
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
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

  const stub = window.__kfReview;
  m.calls = stub ? stub.calls.slice() : null;
  if (stub && stub.calls.some((c) => c !== 'available')) f.push(`the page called KnowFlowReview ${stub.calls.filter((c) => c !== 'available').join(', ')} (only "available" may be called on a design-c screen)`);

  const rows = [...document.querySelectorAll('[data-kf-link="rate"]')].filter(visible);
  const links = [...document.querySelectorAll('a[href]')].filter((a) => visible(a) && /action=write-review/.test(a.getAttribute('href') || ''));
  m.rows = rows.length;
  m.links = links.length;
  if (!expect.row) {
    if (rows.length || links.length) f.push(`a rating row where none may be (${rows.length} marked, ${links.length} write-review link(s))`);
  } else if (rows.length !== 1 || links.length !== 1) {
    f.push(`expected exactly one rating row, found ${rows.length} marked and ${links.length} write-review link(s)`);
  } else {
    const li = rows[0];
    const a = li.querySelector('a');
    m.href = a ? a.getAttribute('href') : null;
    if (m.href !== expect.href) f.push(`the row links to ${JSON.stringify(m.href)}, want ${expect.href}`);
    if (a && a.hasAttribute('target')) f.push(`the row has target="${a.getAttribute('target')}"`);
    const ul = li.parentElement;
    const items = ul ? [...ul.children].filter(visible) : [];
    const at = items.indexOf(li);
    const sup = items.findIndex((x) => x.querySelector('a[href^="mailto:"]'));
    m.position = `${at + 1} of ${items.length}`;
    if (at !== items.length - 1) f.push(`the row is not the last of Help and legal (${m.position})`);
    if (sup < 0 || sup > at) f.push('the row is not after Support');
    const label = a && a.querySelector('span.min-w-0 > span');
    const desc = label && label.nextElementSibling;
    m.labelLines = label ? lineCount(label) : 0;
    if (m.labelLines !== 1) f.push(`the label takes ${m.labelLines} line(s)`);
    const h = a ? a.getBoundingClientRect().height : 0;
    m.height = Math.round(h * 10) / 10;
    if (h < 56) f.push(`the tile is ${m.height} px tall, under 56`);
    m.text = (li.innerText || '').replace(/\s+/g, ' ').trim();
    const words = typeof window.kfWording === 'function' ? window.kfWording(m.text) : ['(kfWording not defined in the page)'];
    if (words.length) f.push(`a 3.1.3(f) word in the row: ${words.join(', ')}`);
    if (expect.locale === 'ar') {
      m.isolates = [...li.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent);
      for (const name of ['KnowFlow', 'App Store']) {
        if (!m.text.includes(name)) f.push(`"${name}" is not in the Arabic row`);
        else if (!m.isolates.some((t) => (t || '').includes(name))) f.push(`"${name}" is not a left-to-right isolate in the Arabic row`);
      }
    }
    const tone = (el, what) => {
      if (!el) { f.push(`no ${what} in the row`); return; }
      const r = ratio(rgb(getComputedStyle(el).color), bgOf(el));
      m[what] = Math.round(r * 100) / 100;
      if (r < 4.5) f.push(`the ${what} is ${m[what]}:1, under 4.5`);
    };
    // The description's lines (fix 2): each word's line, read from its own range.
    if (desc && expect.desc) {
      const nodes = [];
      const tw = document.createTreeWalker(desc, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n);
      let text = '';
      const starts = nodes.map((n) => { const at = text.length; text += n.data; return at; });
      const pos = (off) => { for (let k = nodes.length - 1; k >= 0; k--) if (off >= starts[k]) return [nodes[k], off - starts[k]]; return [nodes[0], 0]; };
      const tops = [];
      const ws = [];
      for (const mm of text.matchAll(/\S+/g)) {
        const r = document.createRange();
        const [sn, so] = pos(mm.index);
        const [en, eo] = pos(mm.index + mm[0].length - 1);
        r.setStart(sn, so);
        r.setEnd(en, eo + 1);
        const rect = [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0);
        const top = rect ? rect.top : -1;
        let li = tops.findIndex((t) => Math.abs(t - top) < 4);
        if (li < 0) { tops.push(top); li = tops.length - 1; }
        ws.push({ w: mm[0], top: tops[li] });
      }
      const order = [...new Set(ws.map((x) => x.top))].sort((p, q) => p - q);
      const lines = order.map((t) => ws.filter((x) => x.top === t).map((x) => x.w));
      m.descLines = lines.map((l) => l.join(' '));
      m.descWidth = Math.round(desc.getBoundingClientRect().width * 10) / 10;
      m.descUnits = [...desc.querySelectorAll('[data-kf-rate-unit]')].map((u) => Math.round(u.getBoundingClientRect().width * 10) / 10);
      const rules = typeof window.rateLineRules === 'function' ? window.rateLineRules(lines, expect.locale, expect.desc) : ['(rateLineRules not defined in the page)'];
      for (const x of rules) f.push(x);
    } else if (!desc) f.push('no description under the label');
    tone(label, 'label contrast');
    tone(desc, 'line contrast');
    const supLabel = sup >= 0 ? items[sup].querySelector('a span.min-w-0 > span') : null;
    const supDesc = supLabel && supLabel.nextElementSibling;
    if (supLabel && label && getComputedStyle(label).color !== getComputedStyle(supLabel).color) f.push(`the label is ${getComputedStyle(label).color}, Support's ${getComputedStyle(supLabel).color}`);
    if (supDesc && desc && getComputedStyle(desc).color !== getComputedStyle(supDesc).color) f.push(`the line is ${getComputedStyle(desc).color}, Support's ${getComputedStyle(supDesc).color}`);
    if (supLabel && a && getComputedStyle(a).backgroundColor !== getComputedStyle(supLabel.closest('a')).backgroundColor) f.push('the tile is not drawn as the Support tile');
  }
  if (expect.quiz) {
    const root = document.querySelector('[data-kf-quiz]');
    m.reading = root ? root.getAttribute('data-kf-review') : '(no quiz root)';
    if (!root) f.push('no quiz root on the quiz screen');
    else if (m.reading !== expect.reading) f.push(`the quiz root reads data-kf-review=${JSON.stringify(m.reading)}, want ${JSON.stringify(expect.reading)}`);
  }
  return { finding: f.join('; ') || null, measured: m };
}

/**
 * Check 31's forced cases, after the shot, on AFTER. Each one is undone
 * before the next. Returns [{ kind, caught, finding }].
 */
export function ratePlant(expect) {
  const out = [];
  const run = (kind, apply, undo) => {
    apply();
    const r = window.rateCheck(expect);
    out.push({ kind, caught: !!r.finding, finding: r.finding });
    undo();
  };
  const keepStyle = (el) => { const s = el.getAttribute('style'); return () => { if (s === null) el.removeAttribute('style'); else el.setAttribute('style', s); }; };
  const li = document.querySelector('[data-kf-link="rate"]');
  if (expect.row && li) {
    const a = li.querySelector('a');
    const ul = li.parentElement;
    const label = a.querySelector('span.min-w-0 > span');
    const twin = li.cloneNode(true);
    run('count', () => ul.appendChild(twin), () => twin.remove());
    const href = a.getAttribute('href');
    run('href', () => a.setAttribute('href', 'https://apps.apple.com/app/id6820418649'), () => a.setAttribute('href', href));
    run('target', () => a.setAttribute('target', '_blank'), () => a.removeAttribute('target'));
    const supLi = [...ul.children].find((x) => x.querySelector('a[href^="mailto:"]'));
    if (supLi) run('last', () => ul.insertBefore(li, supLi), () => ul.appendChild(li));
    const backLabel = keepStyle(label);
    run('lines', () => { label.style.width = '1px'; }, backLabel);
    const backA = keepStyle(a);
    run('height', () => { a.style.minHeight = '0px'; a.style.height = '40px'; a.style.paddingTop = '0px'; a.style.paddingBottom = '0px'; a.style.overflow = 'hidden'; }, backA);
    const extra = document.createTextNode(' Pro');
    run('wording', () => label.appendChild(extra), () => extra.remove());
    const bdi = expect.locale === 'ar' ? li.querySelector('bdi[dir="ltr"]') : null;
    if (bdi) {
      const parent = bdi.parentNode;
      const txt = document.createTextNode(bdi.textContent);
      run('isolate', () => parent.replaceChild(txt, bdi), () => parent.replaceChild(bdi, txt));
    }
    const tile = getComputedStyle(a).backgroundColor;
    const backTone = keepStyle(label);
    run('contrast', () => { label.style.color = tile; }, backTone);
    // The description's line rules: a <br> after word i, each caught by ITS rule.
    const desc = label.nextElementSibling;
    if (desc && expect.desc) {
      const breakAfter = (i) => {
        const nodes = [];
        const tw = document.createTreeWalker(desc, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n);
        let text = '';
        const starts = nodes.map((n) => { const at = text.length; text += n.data; return at; });
        const word = [...text.matchAll(/\S+/g)][i];
        if (!word) return () => {};
        const end = word.index + word[0].length;
        let k = nodes.length - 1;
        while (k > 0 && starts[k] >= end) k--;
        const n = nodes[k];
        const tail = n.splitText(end - starts[k]);
        const br = document.createElement('br');
        n.parentNode.insertBefore(br, tail);
        return () => { br.remove(); n.data += tail.data; tail.remove(); };
      };
      for (const kind of ['dangle', 'split', 'single']) {
        const undo = breakAfter(window.rateBreakAt(kind, expect.locale, expect.desc));
        const r = window.rateCheck(expect);
        const want = window.RATE_LINE_KINDS[kind];
        out.push({ kind, caught: !!r.finding && r.finding.includes(want), finding: r.finding });
        undo();
      }
    }
  }
  if (!expect.row && !expect.quiz) {
    const ul = document.querySelector('a[href^="mailto:"]')?.closest('ul');
    if (ul) {
      const fake = document.createElement('li');
      fake.setAttribute('data-kf-link', 'rate');
      const fa = document.createElement('a');
      fa.setAttribute('href', expect.href);
      fa.textContent = 'Rate KnowFlow';
      fa.style.cssText = 'display:block;min-height:56px';
      fake.appendChild(fa);
      run('planted', () => ul.appendChild(fake), () => fake.remove());
    }
  }
  if (expect.quiz) {
    const root = document.querySelector('[data-kf-quiz]');
    if (root) {
      const was = root.getAttribute('data-kf-review');
      run('reading', () => root.setAttribute('data-kf-review', 'ask'), () => { if (was === null) root.removeAttribute('data-kf-review'); else root.setAttribute('data-kf-review', was); });
    }
  }
  if (expect.stub && window.__kfReview) {
    const calls = window.__kfReview.calls;
    run('request', () => calls.push('request'), () => calls.pop());
  }
  return out;
}
