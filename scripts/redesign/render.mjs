/**
 * Step Redesign-1: renders the mockup pages and audits every one of them.
 *
 * Builds the pages (build.mjs) into a temporary folder and opens each from
 * file:// in headless Chrome through puppeteer-core: no server, no network.
 * Each is photographed at 440 x 956 pt and 3x (1320 x 2868 px), then audited
 * in the page. A finding of ANY kind fails the run:
 *   - CONTRAST (WCAG 2.x AA): every element with its own text, against the
 *     background behind it. Gradients count by their darkest and lightest
 *     stop, so a text passes only where the worst point of its ground passes.
 *     4.5:1, or 3:1 for large text (24 px, or 18.66 px at 700).
 *   - CONTROLS (WCAG 1.4.11, 3:1): the switch track (edge or fill) on its
 *     card, the switch thumb on its track, each segmented track's edge on its
 *     card, the chosen segment's edge on the track, the composer's edge.
 *   - TOUCH TARGETS: every link, button, switch and radio at least 44 x 44 pt.
 *   - ARABIC SHAPING: every element with Arabic text that has a joining pair
 *     must draw differently joined than with its letters forced apart (ZWNJ),
 *     compared pixel by pixel in the page's own font; Rubik must be loaded.
 *   - WORDING: no price, plan, subscription, upgrade or free word (English or
 *     Arabic) and no em or en dash in the visible text.
 *   - COST: at most 3 box-shadow layers on an element; no filter or
 *     backdrop-filter anywhere.
 *
 * Usage: node scripts/redesign/render.mjs --out DIR
 * Env: CHROME (absolute path), PUPPETEER_DIR (where puppeteer-core is installed).
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || 'docs/design/redesign-mockups');
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const pagesDir = mkdtempSync(join(tmpdir(), 'kf-redesign-'));
const pages = JSON.parse(execFileSync(process.execPath, [join(HERE, 'build.mjs'), pagesDir], { encoding: 'utf8' }));

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
  const extremes = (list) => {
    const s = [...list].sort((p, q) => lum(p) - lum(q));
    return s.length > 2 ? [s[0], s[s.length - 1]] : s;
  };
  // Every colour the ground behind `el` takes, reduced to its darkest and
  // lightest: each ancestor paints its background-color, then its gradient.
  const grounds = (el, includeSelf, pseudo) => {
    const chain = [];
    for (let n = includeSelf ? el : el.parentElement; n && n !== document.documentElement; n = n.parentElement) chain.unshift(n);
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }];
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
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight) return false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 36)}"`;
  const worst = (fg, gs) => Math.min(...gs.map((g) => ratio(over(fg, g), g)));

  const text = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el)) continue;
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
    if (parseFloat(cs.borderTopWidth) >= 1) best = Math.max(best, worst(parse(cs.borderTopColor), gs));
    return best;
  };
  for (const sw of document.querySelectorAll('[role="switch"]')) {
    if (!visible(sw)) continue;
    check('switch track', sw, edgeOrFill(getComputedStyle(sw, '::before'), grounds(sw, false)));
    const thumb = sw.querySelector('span');
    check('switch thumb', thumb, worst(parse(getComputedStyle(thumb).backgroundColor), grounds(sw, true, '::before')));
  }
  for (const seg of document.querySelectorAll('[role="radiogroup"]')) {
    if (!visible(seg)) continue;
    check('segmented track', seg, edgeOrFill(getComputedStyle(seg), grounds(seg, false)));
    const chosen = seg.querySelector('[aria-checked="true"]');
    if (chosen) check('chosen segment', chosen, worst(parse(getComputedStyle(chosen).borderTopColor), grounds(seg, true)));
  }
  for (const f of document.querySelectorAll('label.well, input, textarea')) if (visible(f)) check('field edge', f, edgeOrFill(getComputedStyle(f), grounds(f, false)));

  const targets = [];
  for (const el of document.querySelectorAll('a, button, [role="switch"], [role="radio"], label.well')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    targets.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 44 && r.height >= 44 });
  }

  const shaping = [];
  const ctx = document.createElement('canvas').getContext('2d');
  const JOIN = /[بتثجحخسشصضطظعغفقكلمنهيئ][ً-ْ]*[ء-ي]/;
  for (const el of document.body.querySelectorAll('*')) {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t || !JOIN.test(t) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // Joined and forced-apart text drawn and compared pixel by pixel: equal
    // widths can happen by chance (Rubik's medial and isolated forms of some
    // letters share an advance), identical pixels cannot when shaping works.
    const draw = (s) => {
      const w = Math.ceil(ctx.measureText(s).width) + 8, h = Math.ceil(parseFloat(cs.fontSize) * 2);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.font = ctx.font; x.direction = 'rtl'; x.textBaseline = 'middle'; x.fillText(s, w - 4, h / 2);
      return { w, data: x.getImageData(0, 0, w, h).data };
    };
    const a1 = draw(t), a2 = draw([...t].join('‌'));
    const differs = a1.w !== a2.w || a1.data.some((v, i) => v !== a2.data[i]);
    shaping.push({ el: name(el), joined: a1.w, apart: a2.w, ok: differs });
  }
  // Control: Latin has no joining, so ZWNJ must change nothing there. If it
  // did, the comparison above would pass anything and prove nothing.
  {
    const cs = getComputedStyle(document.body);
    ctx.font = `600 17px ${cs.fontFamily}`;
    const draw = (s) => { const c = document.createElement('canvas'); c.width = 200; c.height = 40; const x = c.getContext('2d'); x.font = ctx.font; x.textBaseline = 'middle'; x.fillText(s, 4, 20); return x.getImageData(0, 0, 200, 40).data; };
    const l1 = draw('Summary ready'), l2 = draw([...'Summary ready'].join('‌'));
    shaping.control = !l1.some((v, i) => v !== l2[i]);
  }
  const rubik = [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Rubik' && f.status === 'loaded');

  let maxLayers = 0;
  const filters = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const s of [cs, getComputedStyle(el, '::before')])
      if (s.boxShadow && s.boxShadow !== 'none') maxLayers = Math.max(maxLayers, s.boxShadow.split(/,(?![^(]*\))/).length);
    if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) filters.push(name(el));
  }

  const words = [];
  const vis = document.body.innerText;
  for (const re of [/[—–]/g, /\bfree\b/gi, /\bupgrade/gi, /\bprices?\b/gi, /\bpricing\b/gi, /\bplans?\b/gi, /\bpro\b/gi, /\bpremium\b/gi, /subscri/gi, /مجان/g, /ترقي/g, /باق[ةت]/g, /خط[ةت]/g, /اشتراك/g, /سعر/g, /أسعار/g, /احترافي/g, /مدفوع/g])
    for (const m of vis.matchAll(re)) words.push(vis.slice(Math.max(0, m.index - 24), m.index + 24).replace(/\n/g, ' | '));

  return { text, controls, targets, shaping, shapingControl: shaping.control, rubik, cost: { maxLayers, filters }, words };
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files'] });
const results = [];
let failures = 0;
mkdirSync(out, { recursive: true });
for (const p of pages) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await tab.goto(pathToFileURL(join(pagesDir, `${p.file}.html`)).href, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const a = await tab.evaluate(audit);
  await tab.screenshot({ path: join(out, `${p.file}.png`) });
  const bad = [
    ...a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
    ...a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
    ...a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`),
    ...(p.locale === 'ar' ? a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined (${s.joined} vs ${s.apart}) ${s.el}`) : []),
    ...(a.rubik ? [] : ['Rubik not loaded']),
    ...(a.shapingControl ? [] : ['shaping control failed: ZWNJ changed Latin pixels, so the Arabic check proves nothing']),
    ...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on one element`] : []),
    ...a.cost.filters.map((f) => `filter on ${f}`),
    ...a.words.map((w) => `wording "${w}"`),
  ];
  failures += bad.length;
  const tmin = Math.min(...a.text.map((t) => t.got));
  results.push({ ...p, findings: bad, text: a.text.length, textWorst: tmin, controls: a.controls, targets: a.targets.length, targetMin: Math.min(...a.targets.map((t) => Math.min(t.w, t.h))), shaping: a.shaping.length, maxLayers: a.cost.maxLayers });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${p.file}.png: text ${a.text.length} (worst ${tmin.toFixed(2)}:1), controls ${a.controls.length} (worst ${Math.min(...a.controls.map((c) => c.got), 99).toFixed(2)}:1), targets ${a.targets.length} (smallest ${Math.min(...a.targets.map((t) => Math.min(t.w, t.h)))} pt), Arabic shaped ${a.shaping.filter((s) => s.ok).length}/${a.shaping.length}, max ${a.cost.maxLayers} shadow layers`);
  for (const b of bad) console.log(`       ${b}`);
  await tab.close();
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${pages.length} mockups`);
process.exit(failures ? 1 : 0);
