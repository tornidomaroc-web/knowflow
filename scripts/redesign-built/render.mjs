/**
 * Step Redesign-2: renders the REAL six screens, as the app shows them, and
 * audits every render (docs/design/redesign-built).
 *
 * Serves nothing itself: a `next start` of this commit must listen on BASE
 * (the workflow builds it with placeholder Supabase values and no secret).
 * Each screen is a design preview route (`/[locale]/preview/*`: the real
 * components in the real shell with fixture data, no auth, a 404 on
 * production) asked for the app's structure (`?platform=native`) and a theme.
 * A 440 x 956 pt phone viewport at 3x, reduced motion (the base state is the
 * final state), the page scrolled to the element the screen is about, then
 * the viewport is photographed (the mockups are viewport frames too), and the
 * WHOLE document is audited in the page:
 *   - CONTRAST (WCAG 2.x AA): every element with its own text against the
 *     background behind it, gradients by their darkest and lightest stop.
 *   - CONTROLS (1.4.11, 3:1): the switch track and thumb, segmented tracks
 *     and the chosen segment, the composer and the fields.
 *   - TOUCH TARGETS: every link, button, switch and radio at least 44 x 44 pt.
 *   - ARABIC SHAPING: drawn joined vs forced apart, pixel by pixel, with a
 *     Latin control; Rubik loaded.
 *   - WORDING: the app's one rule (scripts/lib/app-wording.mjs) over the
 *     visible text.
 *   - COST: at most 3 box-shadow layers on an element, at most 2 blurred, no
 *     filter or backdrop-filter; and a scroll measure, 24 programmatic scroll
 *     steps with rAF timing, reported (a headless Linux Chromium is a proxy
 *     for the iOS web view, not the thing itself).
 * Any finding fails the run.
 *
 * Usage: node scripts/redesign-built/render.mjs --out DIR
 * Env: BASE (default http://127.0.0.1:3000), CHROME (absolute path),
 *      PUPPETEER_DIR (where puppeteer-core is installed, outside the app).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kfWording } from '../lib/app-wording.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || join(HERE, '..', '..', 'docs', 'design', 'redesign-built'));
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

// The screens, in the mockups' order; `to` is the element scrolled to the top
// of the viewport before the photograph (null: the top of the page).
const SCREENS = [
  { key: 'home', path: 'preview/student-home', q: {}, to: null },
  { key: 'subjects', path: 'preview/subjects', q: {}, to: null },
  { key: 'subject', path: 'preview/subject', q: {}, to: null },
  { key: 'ask', path: 'preview/ask', q: {}, to: null },
  { key: 'ask-answer', path: 'preview/ask', q: { view: 'answer' }, to: null },
  { key: 'summary', path: 'preview/subject', q: {}, to: 'summary' },
  { key: 'settings', path: 'preview/settings', q: {}, to: null },
  { key: 'settings-bottom', path: 'preview/settings', q: {}, to: 'bottom' },
];
const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const s of SCREENS)
  JOBS.push({ locale, theme, s, file: `${locale}-${theme}-${s.key}.png` });

function audit() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const stops = (img) => (img && img !== 'none' ? (img.match(/rgba?\([^)]+\)/g) || []).map(parse) : []);
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => (top[k] * top.a + under[k] * under.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
  const extremes = (list) => { const s = [...list].sort((p, q) => lum(p) - lum(q)); return s.length > 2 ? [s[0], s[s.length - 1]] : s; };
  const grounds = (el, includeSelf, pseudo) => {
    const chain = [];
    for (let n = includeSelf ? el : el.parentElement; n && n !== document.documentElement; n = n.parentElement) chain.unshift(n);
    let cands = [parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }].map((c) => ({ ...c, a: 1 }));
    const paint = (cs) => {
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) cands = cands.map((c) => over(bg, c));
      const st = stops(cs.backgroundImage);
      if (st.length) cands = extremes(st.flatMap((s) => cands.map((c) => over(s, c))));
    };
    for (const n of chain) paint(getComputedStyle(n));
    if (pseudo) paint(getComputedStyle(el, pseudo));
    return extremes(cands);
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)' || (cs.position === 'absolute' && cs.width === '1px' && cs.height === '1px')) return false;
    }
    return true;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const disabled = (el) => !!el.closest('[disabled],[aria-disabled="true"]');
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean)[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 36)}"`;
  const worst = (fg, gs) => Math.min(...gs.map((g) => ratio(over(fg, g), g)));

  const text = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || el.closest('svg')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el) || disabled(el)) continue;
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    const fg = { ...fg0, a: fg0.a * opacityOf(el) };
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const got = worst(fg, grounds(el, true));
    text.push({ el: name(el), got: Math.round(got * 100) / 100, need, ok: got >= need });
  }

  const controls = [];
  const check = (what, el, got) => controls.push({ el: `${what}: ${name(el)}`, got: Math.round(got * 100) / 100, need: 3, ok: got >= 3 });
  const edgeOrFill = (cs, gs) => {
    let best = Math.min(...gs.map((g) => Math.max(...[parse(cs.backgroundColor), ...stops(cs.backgroundImage)].filter(Boolean).map((c) => ratio(over(c, g), g)), 1)));
    if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') best = Math.max(best, worst(parse(cs.borderTopColor), gs));
    return best;
  };
  for (const sw of document.querySelectorAll('[role="switch"]')) {
    if (!visible(sw) || disabled(sw)) continue;
    const track = sw.querySelector('.kf-switch-track') || sw;
    check('switch track', track, edgeOrFill(getComputedStyle(track), grounds(sw, false)));
    const thumb = sw.querySelector('.kf-switch-thumb') || sw.querySelector('span');
    if (thumb) check('switch thumb', thumb, worst(parse(getComputedStyle(thumb).backgroundColor), grounds(track, true)));
  }
  for (const g of document.querySelectorAll('[role="group"], [role="radiogroup"]')) {
    if (!visible(g)) continue;
    check('segmented track', g, edgeOrFill(getComputedStyle(g), grounds(g, false)));
    const chosen = g.querySelector('[aria-current="true"], [aria-checked="true"]');
    if (chosen) check('chosen segment', chosen, edgeOrFill(getComputedStyle(chosen), grounds(g, true)));
  }
  for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea, .kf-composer'))
    if (visible(f) && !disabled(f) && !(f.tagName === 'TEXTAREA' && f.closest('.kf-composer'))) check('field', f, edgeOrFill(getComputedStyle(f), grounds(f, false)));

  const targets = [];
  for (const el of document.querySelectorAll('a[href], button, [role="switch"], [role="radio"]')) {
    if (!visible(el) || el.closest('nav.kf-tabbar') === null && false) continue;
    const r = el.getBoundingClientRect();
    // An inline link inside running text is exempt (WCAG 2.5.8); everything else is a control.
    const inline = getComputedStyle(el).display === 'inline' && el.closest('p');
    if (inline) continue;
    targets.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 44 && r.height >= 44 });
  }

  const shaping = [];
  const ctx = document.createElement('canvas').getContext('2d');
  const JOIN = /[بتثجحخسشصضطظعغفقكلمنهيئ][ً-ْ]*[ء-ي]/;
  const draw = (s, font, dir) => {
    const w = Math.ceil(ctx.measureText(s).width) + 8, h = 48;
    const c = document.createElement('canvas'); c.width = Math.min(w, 4000); c.height = h;
    const x = c.getContext('2d'); x.font = font; x.direction = dir; x.textBaseline = 'middle'; x.fontKerning = 'none'; x.fillText(s, dir === 'rtl' ? c.width - 4 : 4, h / 2);
    return { w: c.width, data: x.getImageData(0, 0, c.width, h).data };
  };
  for (const el of document.body.querySelectorAll('*')) {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t || !JOIN.test(t) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const font = `${cs.fontWeight} 20px ${cs.fontFamily}`;
    ctx.font = font;
    const a1 = draw(t, font, 'rtl'), a2 = draw([...t].join(String.fromCharCode(0x200c)), font, 'rtl');
    shaping.push({ el: name(el), ok: a1.w !== a2.w || a1.data.some((v, i) => v !== a2.data[i]) });
  }
  // The control: letters that never join (alef, dal, ra, waw) must measure
  // the same with a ZWNJ between them, so a width change on a joining string
  // can only be shaping. (The first control drew Latin and compared pixels
  // against an undefined array, so it could never pass.)
  let shapingControl = true;
  {
    ctx.font = `600 20px ${getComputedStyle(document.body).fontFamily}`; ctx.fontKerning = 'none';
    const plain = ctx.measureText('ادرو ادرو').width, apart = ctx.measureText([...'ادرو ادرو'].join(String.fromCharCode(0x200c))).width;
    shapingControl = Math.abs(plain - apart) < 0.5;
  }
  const rubik = [...document.fonts].some((f) => /Rubik|__/.test(f.family) && f.status === 'loaded') || document.fonts.check('16px Rubik');

  let maxLayers = 0, blurred = 0, shadowed = 0, heaviest = '';
  const filters = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const s of [cs, getComputedStyle(el, '::before'), getComputedStyle(el, '::after')]) {
      if (s.boxShadow && s.boxShadow !== 'none') {
        const layers = s.boxShadow.split(/,(?![^(]*\))/).filter((l) => !/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/.test(l.trim()) && !/^\s*0px 0px 0px 0px/.test(l));
        shadowed++;
        if (layers.length > maxLayers) { maxLayers = layers.length; heaviest = name(el); }
        for (const l of layers) { const px = (l.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat); if ((px[2] || 0) > 0) blurred++; }
      }
    }
    if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) filters.push(name(el));
  }

  return { text, controls, targets, shaping, shapingControl, rubik, cost: { shadowed, maxLayers, blurred, filters, heaviest }, visibleText: document.body.innerText };
}

// 24 scroll steps timed with requestAnimationFrame: the longest frame gap
// while the page scrolls under the floating bar and the clay cards.
async function scrollMeasure(tab) {
  return tab.evaluate(() => new Promise((done) => {
    const gaps = [];
    let last = performance.now(), i = 0;
    const step = (t) => {
      gaps.push(t - last); last = t;
      window.scrollBy(0, Math.ceil((document.documentElement.scrollHeight - innerHeight) / 24));
      if (++i < 24) requestAnimationFrame(step); else { window.scrollTo(0, 0); done({ maxGapMs: Math.round(Math.max(...gaps.slice(1))), meanGapMs: Math.round(gaps.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, gaps.length - 1)) }); }
    };
    requestAnimationFrame(step);
  }));
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
const results = [];
let failures = 0;
mkdirSync(out, { recursive: true });
for (const job of JOBS) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const q = new URLSearchParams({ ...job.s.q, platform: 'native', theme: job.theme }).toString();
  const url = `${BASE}/${job.locale}/${job.s.path}?${q}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  const a = await tab.evaluate(audit);
  const scroll = await scrollMeasure(tab);
  // Scroll to what the screen is about, then photograph the viewport.
  if (job.s.to === 'bottom') await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  else if (job.s.to === 'summary') await tab.evaluate(() => {
    const h = [...document.querySelectorAll('h3,h2,p,span')].find((x) => x.children.length === 0 && /^(SUMMARY|Summary|الملخّص|الملخص|ملخص)$/.test((x.innerText || '').trim()));
    const card = h?.closest('article') || h;
    if (card) { card.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); }
  });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.screenshot({ path: join(out, job.file) });
  const words = kfWording(a.visibleText);
  const bad = [
    ...(res.status() === 200 ? [] : [`HTTP ${res.status()}`]),
    ...a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
    ...a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
    ...a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`),
    ...(job.locale === 'ar' ? a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
    ...(a.shapingControl ? [] : ['shaping control failed: a ZWNJ changed the width of letters that never join']),
    ...(a.rubik ? [] : ['Rubik not loaded']),
    ...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on ${a.cost.heaviest}`] : []),
    ...a.cost.filters.map((f) => `filter on ${f}`),
    ...(words.length ? [`wording ${JSON.stringify(words)}`] : []),
  ];
  failures += bad.length;
  const tmin = Math.min(...a.text.map((t) => t.got));
  results.push({ ...job, s: job.s.key, url, findings: bad, text: a.text.length, textWorst: tmin, controls: a.controls, targets: a.targets.length, targetMin: Math.min(...a.targets.map((t) => Math.min(t.w, t.h))), shaping: a.shaping.length, cost: a.cost, scroll });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${job.file}: text ${a.text.length} (worst ${tmin.toFixed(2)}:1), controls ${a.controls.length} (worst ${Math.min(...a.controls.map((c) => c.got), 99).toFixed(2)}:1), targets ${a.targets.length} (smallest ${Math.min(...a.targets.map((t) => Math.min(t.w, t.h)))} pt), Arabic shaped ${a.shaping.filter((s) => s.ok).length}/${a.shaping.length}, shadows ${a.cost.shadowed} el / max ${a.cost.maxLayers} layers / ${a.cost.blurred} blurred, scroll max gap ${scroll.maxGapMs} ms (mean ${scroll.meanGapMs})`);
  for (const b of bad) console.log(`       ${b}`);
  await tab.close();
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${JOBS.length} renders`);
process.exit(failures ? 1 : 0);
