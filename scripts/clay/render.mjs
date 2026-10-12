/**
 * Step Clay-1: renders the clay prototype and audits every render.
 *
 * Serves nothing itself: a `next start` of this commit must be listening on
 * BASE (the workflow builds it with placeholder Supabase values, no secret).
 * For each screen (the three preview routes, fixture data, no auth) it opens
 * a 440 x 956 phone viewport at 2x with reduced motion (the base state is the
 * final state), waits for Rubik, then in the page:
 *   - CONTRAST: every element with its own visible text is measured against
 *     its composited background (ancestors' fills alpha-blended down to the
 *     page), WCAG 2.x: 4.5:1, or 3:1 for large text (24px, or 18.66px bold).
 *     Disabled controls are exempt, as WCAG exempts inactive components.
 *   - CONTROLS (WCAG 1.4.11, 3:1): the switch track, its thumb, every text
 *     input and select, and each segmented track must show a boundary or fill
 *     at 3:1 against what is behind it; the chosen segment's edge or fill must
 *     reach 3:1 against its track.
 *   - COST: box-shadow layers per element (max), blurred layers, and any
 *     filter or backdrop-filter.
 *   - WORDS: no price, plan, upgrade or free wording and no em dash in the
 *     visible text.
 * Then a full-page screenshot. A clay render fails on any contrast, control,
 * cost (more than 3 layers, or any filter) or word finding; the BEFORE renders
 * (look=current) are measured and reported, never failed, because they show
 * the live design as it is.
 *
 * Usage: node scripts/clay/render.mjs --out DIR
 * Env: BASE (default http://127.0.0.1:3000), CHROME, PUPPETEER_DIR (where
 * puppeteer-core is installed, outside the app's package.json).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || 'docs/design/clay-prototype');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const SCREENS = [
  { key: 'subjects', path: 'preview/subjects', q: {} },
  { key: 'subject', path: 'preview/subject', q: {} },
  // The app's own build (platform=native): a free student sees no plan card there.
  { key: 'settings', path: 'preview/settings', q: { platform: 'native' } },
];
const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const s of SCREENS)
  JOBS.push({ look: 'clay', locale, theme, s, file: `${locale}-${theme}-${s.key}.png` });
for (const s of SCREENS) JOBS.push({ look: 'current', locale: 'ar', theme: 'dark', s, file: `before/ar-dark-${s.key}.png` });

function audit() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
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
  const page = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const root = { ...page, a: 1 };
  // The colour behind an element: its own fill (optional) and every ancestor's,
  // composited from the page up.
  const behind = (el, includeSelf) => {
    const chain = [];
    for (let n = includeSelf ? el : el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) chain.push(c);
    }
    let acc = root;
    for (let i = chain.length - 1; i >= 0; i--) acc = over(chain[i], acc);
    return acc;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return false;
    }
    return true;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const disabled = (el) => !!el.closest('[disabled],[aria-disabled="true"]');
  const name = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`;

  const text = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg'].includes(el.tagName) || el.closest('svg')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isField = el.tagName === 'INPUT' && el.value;
    if ((!own && !isField) || !visible(el) || disabled(el)) continue;
    const cs = getComputedStyle(el);
    const bg = behind(el, true);
    const fg0 = parse(cs.color);
    const fg = over({ ...fg0, a: fg0.a * opacityOf(el) }, bg);
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    text.push({ el: name(el), got: Math.round(got * 100) / 100, need, ok: got >= need });
  }

  const controls = [];
  const edge = (el, against) => {
    const cs = getComputedStyle(el);
    const fill = over(parse(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }, against);
    let best = ratio(fill, against);
    if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') best = Math.max(best, ratio(over(parse(cs.borderTopColor), against), against));
    return best;
  };
  const control = (el, what, against) => {
    if (!el || !visible(el)) return;
    const got = edge(el, against);
    controls.push({ el: `${what}: ${name(el)}`, got: Math.round(got * 100) / 100, need: 3, ok: got >= 3 });
  };
  for (const sw of document.querySelectorAll('[role="switch"]')) {
    control(sw, 'switch track', behind(sw, false));
    const thumb = sw.querySelector('span');
    if (thumb) control(thumb, 'switch thumb', behind(thumb, false));
  }
  for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea'))
    control(f, 'field', behind(f, false));
  for (const g of document.querySelectorAll('[role="group"], [role="radiogroup"]')) {
    control(g, 'segmented track', behind(g, false));
    const chosen = g.querySelector('[aria-current="true"], [aria-checked="true"]');
    if (chosen) control(chosen, 'chosen segment', behind(chosen, false));
  }

  let maxLayers = 0, blurred = 0, shadowed = 0;
  const filters = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      const layers = cs.boxShadow.split(/,(?![^(]*\))/);
      shadowed++;
      maxLayers = Math.max(maxLayers, layers.length);
      for (const l of layers) {
        const px = (l.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        if ((px[2] || 0) > 0) blurred++;
      }
    }
    if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) filters.push(name(el));
  }

  const words = [];
  const visibleText = document.body.innerText;
  for (const re of [/—/g, /\bfree\b/gi, /\bupgrade\b/gi, /\bprices?\b/gi, /\bpricing\b/gi, /\bplans?\b/gi, /\bpro\b/gi, /مجان/g, /الترقية/g, /باقة/g, /سعر/g, /الأسعار/g])
    for (const m of visibleText.matchAll(re)) words.push(visibleText.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' | '));

  return { text, controls, cost: { shadowed, maxLayers, blurred, filters }, words, fontsOk: document.fonts.check('16px Rubik') || [...document.fonts].some((f) => f.status === 'loaded') };
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
const results = [];
let failures = 0;
for (const job of JOBS) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 440, height: 956, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const q = new URLSearchParams({ ...job.s.q, look: job.look, theme: job.theme }).toString();
  const url = `${BASE}/${job.locale}/${job.s.path}?${q}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await tab.evaluate(() => document.fonts.ready);
  const a = await tab.evaluate(audit);
  const file = join(out, job.file);
  mkdirSync(join(file, '..'), { recursive: true });
  await tab.screenshot({ path: file, fullPage: true });
  const bad = {
    status: res.status() === 200 ? [] : [`HTTP ${res.status()}`],
    text: a.text.filter((t) => !t.ok), controls: a.controls.filter((c) => !c.ok),
    cost: [...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on one element`] : []), ...a.cost.filters.map((f) => `filter on ${f}`)],
    words: a.words,
  };
  const n = bad.status.length + bad.text.length + bad.controls.length + bad.cost.length + bad.words.length;
  const counted = job.look === 'clay' ? n : 0;
  failures += counted;
  const minText = Math.min(...a.text.map((t) => t.got / t.need));
  results.push({ ...job, s: job.s.key, url, n, text: a.text.length, controls: a.controls, cost: a.cost, bad, minTextMargin: Math.round(minText * 100) / 100 });
  console.log(`${job.look === 'clay' ? (n ? 'FAIL' : 'ok  ') : 'info'} ${job.file}: ${a.text.length} text checks, ${a.controls.length} control checks, ${n} finding(s); shadows: ${a.cost.shadowed} elements, max ${a.cost.maxLayers} layers, ${a.cost.blurred} blurred layers, ${a.cost.filters.length} filters`);
  for (const t of bad.text) console.log(`       text ${t.got}:1 < ${t.need}:1  ${t.el}`);
  for (const c of bad.controls) console.log(`       control ${c.got}:1 < 3:1  ${c.el}`);
  for (const c of bad.cost) console.log(`       cost ${c}`);
  for (const w of bad.words) console.log(`       word "${w}"`);
  for (const s of bad.status) console.log(`       ${s}`);
  // Press depth: the first primary button at rest and held down, side by side.
  if (job.look === 'clay' && job.s.key === 'subjects' && job.locale === 'en') {
    const btn = await tab.$('[data-look="clay"] .pressable.bg-primary');
    if (btn) {
      await btn.scrollIntoView();
      const box = await btn.boundingBox();
      const clip = { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: box.width + 48, height: box.height + 48 };
      mkdirSync(join(out, 'press'), { recursive: true });
      await tab.screenshot({ path: join(out, `press/${job.theme}-rest.png`), clip });
      await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await tab.mouse.down();
      await tab.screenshot({ path: join(out, `press/${job.theme}-pressed.png`), clip });
      await tab.mouse.up();
    }
  }
  await tab.close();
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${JOBS.filter((j) => j.look === 'clay').length} clay renders`);
process.exit(failures ? 1 : 0);
