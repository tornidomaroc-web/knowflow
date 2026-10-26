/**
 * Guideline 4.0 (1.0 build 7): the RENDERED half of the focus-zoom gate, the
 * tap-area gate, and the before/after renders of the signed-out auth pages.
 *
 * iOS zooms the web view in when a text field under 16 px takes focus, and the
 * zoom outlives the keyboard and the next client-side navigation, clipping both
 * edges of the page (branch diag/ipad-zoom, run 40258021621: x1.143 = 16/14).
 * Apple's 4.0 text also names "controls that are difficult to use due to
 * size"; the HIG's minimum is 44 x 44 pt. The app is iPhone-only, so on an
 * iPad it runs at 375 x 667; the 6.9-inch iPhone is 440 x 956. At both, with
 * the app's user agent, Arabic and English, every page reachable signed out
 * (the four auth pages, login with its one notice that carries a link, and the
 * eight design preview routes, which mount the real components with fixture
 * data):
 *
 *   GATE    every text-entry control (an input of a text-like type, textarea,
 *           select, contenteditable), visible or not, computes a font size of
 *           16 px or more. One under 16 px fails the run.
 *   GATE    the TAP AREA, measured the way a finger meets it: elementFromPoint
 *           along the two lines through the control's centre, so an ::after
 *           overlay or an input laid over a border counts and a box that only
 *           looks big does not. On the auth pages every tappable control that
 *           is not a link inside running text, and the reminder's time control
 *           on /preview/settings, must be reachable at its centre and have a
 *           tap area of 44 x 44 or more; and no two tap areas on an auth page
 *           may overlap (a 2 px grid around each control, the bounding boxes
 *           of the points that land on each). One miss fails the run.
 *   REPORT  (never fails) every other tappable control whose tap area is under
 *           44 x 44, inline links in running text marked as such, and every
 *           field whose placeholder is wider than the field.
 *
 * Not blind: KF_PLANT_SMALL=1 forces 14 px on every field of every page, and
 * KF_PLANT_HIT=1 removes the tap areas (the .kf-hit overlays and the time
 * input's reach over its border); the workflow requires both runs to fail.
 *
 * --render also screenshots login, signup and forgot-password at both sizes,
 * Arabic and English, dark and light: empty, with sample text typed in, and
 * empty with every control's tap area outlined (72 PNGs, full page) into --out.
 * In the outlined PNG a solid green box is a tap area of 44 x 44 or more, a
 * solid red box one under it, and the dashed blue box the control's own box.
 *
 * Usage: node scripts/field-zoom/fields.mjs --out DIR [--render] [--label after]
 * Env: BASE (default http://127.0.0.1:3000), CHROME, PUPPETEER_DIR.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const out = resolve(opt('--out') || 'field-zoom-out');
const label = opt('--label') || 'after';
const RENDER = args.includes('--render');
const PLANT = process.env.KF_PLANT_SMALL === '1';
const PLANT_HIT = process.env.KF_PLANT_HIT === '1';
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const SIZES = [
  { key: '375x667', width: 375, height: 667, dpr: 2 },
  { key: '440x956', width: 440, height: 956, dpr: 3 },
];
const AUTH = ['login', 'login?notice=recovery_expired', 'signup', 'forgot-password', 'reset-password'];
const PREVIEW = ['ai-consent', 'ask', 'new-subject', 'settings', 'student-home', 'subject', 'subjects', 'upload'].map((p) => `preview/${p}`);
const SHOTS = ['login', 'signup', 'forgot-password'];
// Gated beyond the auth pages: the controls fixed outside them.
const GATED = { 'preview/settings': ['#kf-reminder-time'] };
const MIN = 44;

// Runs in the page: the fields, the tap areas and the placeholders.
function measure({ gatedSelectors, grid }) {
  const NON_TEXT = ['hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'range', 'color'];
  const name = (el) => {
    const t = el.tagName.toLowerCase();
    const bits = [t];
    if (el.type && t === 'input') bits.push(`[type=${el.type}]`);
    if (el.id) bits.push(`#${el.id}`);
    const txt = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return bits.join('') + (txt ? ` "${txt}"` : '');
  };
  const fields = [];
  for (const el of document.querySelectorAll('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) {
    if (el.tagName === 'INPUT' && NON_TEXT.includes(el.type)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const f = { el: name(el), px: parseFloat(cs.fontSize), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0, opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height) };
    const ph = el.getAttribute('placeholder');
    if (ph && f.shown) {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      const need = ctx.measureText(ph).width;
      f.placeholder = { text: ph.slice(0, 40), need: Math.round(need), room: Math.round(room), fits: el.tagName === 'TEXTAREA' || need <= room };
    }
    fields.push(f);
  }

  // The tap areas. A point belongs to a control when the topmost element there
  // is the control, inside it, or (a radio or checkbox) the label around it.
  const gated = new Set(gatedSelectors.flatMap((s) => [...document.querySelectorAll(s)]));
  const targets = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role="button"], [role="switch"], [role="radio"], [role="tab"], [role="checkbox"], [role="link"], [tabindex]:not([tabindex="-1"])';
  const nodes = [...document.querySelectorAll(sel)];
  // Page coordinates: each control's box before anything scrolls, so the
  // offset holds whichever element does the scrolling.
  scrollTo(0, 0);
  const home = nodes.map((n) => n.getBoundingClientRect());
  nodes.forEach((el, idx) => {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || box.width === 0 || box.height === 0) return;
    const lab = el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type) ? el.closest('label') : null;
    const own = (x, y) => {
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h) || (!!lab && (h === lab || lab.contains(h))));
    };
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getClientRects()[0] || el.getBoundingClientRect();
    const all = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const reach = own(cx, cy);
    const top = document.elementFromPoint(cx, cy);
    // Along the two lines through the centre, at half-pixel points, out to
    // 40 px past the box: the span of consecutive points that land on it.
    let L = 0, R = 0, T = 0, B = 0;
    if (reach) {
      const x0 = Math.floor(cx) + 0.5, y0 = Math.floor(cy) + 0.5;
      while (L < r.width / 2 + 40 && own(x0 - L - 1, cy)) L++;
      while (R < r.width / 2 + 40 && own(x0 + R + 1, cy)) R++;
      while (T < r.height / 2 + 40 && own(cx, y0 - T - 1)) T++;
      while (B < r.height / 2 + 40 && own(cx, y0 + B + 1)) B++;
    }
    const hw = reach ? L + R + 1 : 0;
    const hh = reach ? T + B + 1 : 0;
    // A 2 px grid around the whole control, for the overlap check.
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    if (grid) for (let y = Math.max(0.5, all.top - 30); y < Math.min(innerHeight, all.bottom + 30); y += 2) {
      for (let x = Math.max(0.5, all.left - 30); x < Math.min(innerWidth, all.right + 30); x += 2) {
        if (!own(x, y)) continue;
        gx0 = Math.min(gx0, x); gy0 = Math.min(gy0, y); gx1 = Math.max(gx1, x); gy1 = Math.max(gy1, y);
      }
    }
    const sx = home[idx].left - all.left, sy = home[idx].top - all.top;
    const inline = cs.display === 'inline' && !!el.closest('p, li');
    targets.push({
      el: name(el),
      inline,
      lines: el.getClientRects().length,
      gated: gated.has(el),
      w: Math.round(all.width), h: Math.round(all.height),
      hw, hh, reach,
      coveredBy: reach ? null : top ? name(top) : 'nothing (off screen)',
      box: { x: all.left + sx, y: all.top + sy, w: all.width, h: all.height },
      hit: reach ? { x: Math.floor(cx) - L + sx, y: Math.floor(cy) - T + sy, w: hw, h: hh } : null,
      grid: gx1 >= gx0 ? { x0: gx0 + sx, y0: gy0 + sy, x1: gx1 + sx, y1: gy1 + sy } : null,
      idx,
    });
  });
  // Overlaps: two controls whose grid boxes intersect, neither inside the other.
  const overlaps = [];
  for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
    const a = targets[i], b = targets[j];
    if (!a.grid || !b.grid) continue;
    const na = nodes[a.idx], nb = nodes[b.idx];
    if (na.contains(nb) || nb.contains(na)) continue;
    if (a.grid.x0 <= b.grid.x1 && b.grid.x0 <= a.grid.x1 && a.grid.y0 <= b.grid.y1 && b.grid.y0 <= a.grid.y1) overlaps.push(`${a.el} / ${b.el}`);
  }
  scrollTo(0, 0);
  const sw = document.documentElement.scrollWidth;
  const cw = document.documentElement.clientWidth;
  return { path: location.pathname, fields, targets, overlaps, overflowX: sw > cw ? `${sw}/${cw}` : null };
}

// Runs in the page: the tap areas measured above, drawn over it.
function outline(targets, min) {
  const layer = document.createElement('div');
  layer.style.cssText = `position:absolute;left:0;top:0;width:${document.documentElement.scrollWidth}px;height:${document.documentElement.scrollHeight}px;pointer-events:none;z-index:2147483647`;
  for (const t of targets) {
    const ok = t.hw >= min && t.hh >= min;
    const b = document.createElement('div');
    b.style.cssText = `position:absolute;left:${t.box.x}px;top:${t.box.y}px;width:${t.box.w}px;height:${t.box.h}px;outline:1px dashed #3b82f6;outline-offset:-0.5px`;
    layer.append(b);
    if (!t.hit) continue;
    const h = document.createElement('div');
    h.style.cssText = `position:absolute;left:${t.hit.x}px;top:${t.hit.y}px;width:${t.hit.w}px;height:${t.hit.h}px;outline:1.5px solid ${ok ? '#16a34a' : '#dc2626'};outline-offset:-0.75px;background:${ok ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.14)'}`;
    const tag = document.createElement('span');
    tag.textContent = `${t.hw}×${t.hh}`;
    tag.style.cssText = `position:absolute;left:0;top:0;font:600 9px/11px ui-monospace,monospace;color:#fff;background:${ok ? '#16a34a' : '#dc2626'};padding:0 2px;direction:ltr`;
    h.append(tag);
    layer.append(h);
  }
  document.body.append(layer);
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
mkdirSync(out, { recursive: true });
const pages = [];
const report = [];
const hitFails = [];
let under = 0;
let fieldCount = 0;
let gatedCount = 0;

async function open(path, locale, size, theme) {
  const tab = await browser.newPage();
  await tab.setUserAgent(APP);
  await tab.setViewport({ width: size.width, height: size.height, deviceScaleFactor: size.dpr, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const [p, extra] = path.split('?');
  const q = new URLSearchParams({ platform: 'native', theme, ...Object.fromEntries(new URLSearchParams(extra || '')) }).toString();
  const res = await tab.goto(`${BASE}/${locale}/${p}?${q}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  if (PLANT) await tab.addStyleTag({ content: 'input, textarea, select { font-size: 14px !important; }' });
  if (PLANT_HIT) await tab.addStyleTag({ content: '.kf-hit::after { display: none !important; } #kf-reminder-time { inset: 0 !important; }' });
  return { tab, status: res ? res.status() : 0 };
}

const isAuth = (path) => AUTH.includes(path);
const gatedFor = (path) => GATED[path] || [];

for (const size of SIZES) for (const locale of ['ar', 'en']) for (const path of [...AUTH, ...PREVIEW]) {
  const { tab, status } = await open(path, locale, size, 'dark');
  const m = await tab.evaluate(measure, { gatedSelectors: gatedFor(path), grid: isAuth(path) });
  await tab.close();
  const bad = m.fields.filter((f) => f.px < 16);
  under += bad.length;
  fieldCount += m.fields.length;
  const tag = `${size.key} ${locale} /${path}`;
  // The tap-area gate: every non-inline control on an auth page, and the named ones elsewhere.
  const must = m.targets.filter((t) => t.gated || (isAuth(path) && !t.inline));
  gatedCount += must.length;
  const misses = must.filter((t) => !t.reach || t.hw < MIN || t.hh < MIN);
  for (const t of misses) hitFails.push(`${tag} ${t.el}: tap area ${t.hw}x${t.hh} (box ${t.w}x${t.h})${t.reach ? '' : `, its centre lands on ${t.coveredBy}`}`);
  if (gatedFor(path).length && !m.targets.some((t) => t.gated)) hitFails.push(`${tag}: ${gatedFor(path).join(', ')} not found`);
  for (const o of m.overlaps) hitFails.push(`${tag} tap areas overlap: ${o}`);
  const { targets, path: landed, ...rest } = m;
  pages.push({ size: size.key, locale, path, status, landed, ...rest, targets: targets.map(({ idx, ...t }) => t) });
  const landedOn = m.path !== `/${locale}/${path.split('?')[0]}`;
  console.log(`${bad.length || misses.length ? 'FAIL' : 'ok  '} ${tag} (HTTP ${status}${landedOn ? `, landed on ${m.path}` : ''}): ${m.fields.length} field(s)${m.fields.length ? ': ' + m.fields.map((f) => `${f.el} ${f.px}px${f.shown ? '' : ' (hidden)'}`).join('; ') : ''}; ${must.length} gated tap area(s), ${misses.length} under ${MIN}x${MIN}`);
  for (const f of m.fields) if (f.placeholder && !f.placeholder.fits) report.push(`placeholder wider than its field: ${tag} ${f.el} needs ${f.placeholder.need}px, has ${f.placeholder.room}px`);
  for (const t of m.targets) if (!must.includes(t) && (t.hw < MIN || t.hh < MIN)) report.push(`under 44x44: ${tag} ${t.el} tap area ${t.hw}x${t.hh} (box ${t.w}x${t.h})${t.reach ? '' : `, its centre lands on ${t.coveredBy}`}${t.inline ? `, inline link in text on ${t.lines} line(s), WCAG 2.5.8 exempt` : ''}`);
  if (m.overflowX) report.push(`page wider than the screen: ${tag} scrollWidth/clientWidth ${m.overflowX}`);
}

if (RENDER) for (const size of SIZES) for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const path of SHOTS) {
  const { tab } = await open(path, locale, size, theme);
  const file = `${label}-${size.key}-${locale}-${theme}-${path}.png`;
  await tab.screenshot({ path: join(out, file), fullPage: true });
  // The same page with every tap area outlined, measured in this very tab.
  const m = await tab.evaluate(measure, { gatedSelectors: gatedFor(path), grid: false });
  await tab.evaluate(outline, m.targets, MIN);
  const hits = file.replace(/\.png$/, '-hit.png');
  await tab.screenshot({ path: join(out, hits), fullPage: true });
  await tab.close();
  // Then a fresh tab with every field holding text, so the text's size shows.
  // Sample values typed on the runner's own build; nothing is submitted.
  const { tab: tab2 } = await open(path, locale, size, theme);
  const sample = { email: 'student@example.com', password: 'example-pass', text: locale === 'ar' ? 'سارة أحمد' : 'Sara Ahmed' };
  for (const el of await tab2.$$('input[type=email], input[type=password], input[type=text]')) {
    const type = await el.evaluate((e) => e.type);
    await el.type(sample[type] ?? sample.text);
  }
  await tab2.evaluate(() => document.activeElement?.blur());
  const filled = file.replace(/\.png$/, '-filled.png');
  await tab2.screenshot({ path: join(out, filled), fullPage: true });
  await tab2.close();
  console.log(`shot ${file}, ${hits}, ${filled}`);
}
await browser.close();

console.log(`\nREPORT (does not fail the run): ${report.length} line(s)`);
for (const r of [...new Set(report)]) console.log(`  ${r}`);
console.log(`\nTAP AREAS: ${gatedCount} gated on ${pages.length} page renders; ${hitFails.length} miss(es)`);
for (const f of hitFails) console.log(`  FAIL ${f}`);
writeFileSync(join(out, `${label}-fields.json`), JSON.stringify({ label, plant: PLANT, plantHit: PLANT_HIT, fieldCount, under, gatedCount, hitFails, pages, report }, null, 1));
console.log(`\n${fieldCount} text-entry controls measured on ${pages.length} page renders; ${under} under 16 px`);
if (fieldCount === 0) { console.log('FAIL no field was measured: the gate is blind'); process.exit(1); }
if (gatedCount === 0) { console.log('FAIL no tap area was gated: the gate is blind'); process.exit(1); }
process.exit(under || hitFails.length ? 1 : 0);
