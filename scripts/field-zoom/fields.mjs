/**
 * Guideline 4.0 (1.0 build 7): the RENDERED half of the focus-zoom gate, and
 * the before/after renders of the signed-out auth pages.
 *
 * iOS zooms the web view in when a text field under 16 px takes focus, and the
 * zoom outlives the keyboard and the next client-side navigation, clipping both
 * edges of the page (branch diag/ipad-zoom, run 40258021621: x1.143 = 16/14).
 * The app is iPhone-only, so on an iPad it runs at 375 x 667; the 6.9-inch
 * iPhone is 440 x 956. At both, with the app's user agent, Arabic and English,
 * every page reachable signed out (the four auth pages and the eight design
 * preview routes, which mount the real components with fixture data):
 *
 *   GATE    every text-entry control (an input of a text-like type, textarea,
 *           select, contenteditable), visible or not, computes a font size of
 *           16 px or more. One under 16 px fails the run.
 *   REPORT  (never fails) every tappable control whose box is under 44 x 44,
 *           inline links in running text marked as such, and every field whose
 *           placeholder is wider than the field.
 *
 * Not blind: KF_PLANT_SMALL=1 forces 14 px on every field of every page; the
 * workflow requires that run to fail.
 *
 * --render also screenshots login, signup and forgot-password at both sizes,
 * Arabic and English, dark and light, empty and with sample text typed in
 * (48 PNGs, full page) into --out.
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
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const SIZES = [
  { key: '375x667', width: 375, height: 667, dpr: 2 },
  { key: '440x956', width: 440, height: 956, dpr: 3 },
];
const AUTH = ['login', 'signup', 'forgot-password', 'reset-password'];
const PREVIEW = ['ai-consent', 'ask', 'new-subject', 'settings', 'student-home', 'subject', 'subjects', 'upload'].map((p) => `preview/${p}`);
const SHOTS = ['login', 'signup', 'forgot-password'];

// Runs in the page: the fields, the small targets and the placeholders.
function measure() {
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
  const small = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role="button"], [role="switch"], [role="radio"], [role="tab"], [role="checkbox"], [role="link"], [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    // A radio or checkbox inside its label: the label is the target.
    const lab = el.closest('label');
    if (lab && el.tagName === 'INPUT') {
      const lr = lab.getBoundingClientRect();
      if (lr.width >= 44 && lr.height >= 44) continue;
    }
    const inline = cs.display === 'inline' && !!el.closest('p, li');
    small.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height), inline });
  }
  const sw = document.documentElement.scrollWidth;
  const cw = document.documentElement.clientWidth;
  return { path: location.pathname, fields, small, overflowX: sw > cw ? `${sw}/${cw}` : null };
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
mkdirSync(out, { recursive: true });
const pages = [];
const report = [];
let under = 0;
let fieldCount = 0;

async function open(path, locale, size, theme) {
  const tab = await browser.newPage();
  await tab.setUserAgent(APP);
  await tab.setViewport({ width: size.width, height: size.height, deviceScaleFactor: size.dpr, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const q = new URLSearchParams({ platform: 'native', theme }).toString();
  const res = await tab.goto(`${BASE}/${locale}/${path}?${q}`, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  if (PLANT) await tab.addStyleTag({ content: 'input, textarea, select { font-size: 14px !important; }' });
  return { tab, status: res ? res.status() : 0 };
}

for (const size of SIZES) for (const locale of ['ar', 'en']) for (const path of [...AUTH, ...PREVIEW]) {
  const { tab, status } = await open(path, locale, size, 'dark');
  const m = await tab.evaluate(measure);
  await tab.close();
  const bad = m.fields.filter((f) => f.px < 16);
  under += bad.length;
  fieldCount += m.fields.length;
  pages.push({ size: size.key, locale, path, status, landed: m.path, ...m });
  const tag = `${size.key} ${locale} /${path}`;
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${tag} (HTTP ${status}${m.path !== `/${locale}/${path}` ? `, landed on ${m.path}` : ''}): ${m.fields.length} field(s)${m.fields.length ? ': ' + m.fields.map((f) => `${f.el} ${f.px}px${f.shown ? '' : ' (hidden)'}`).join('; ') : ''}`);
  for (const f of m.fields) if (f.placeholder && !f.placeholder.fits) report.push(`placeholder wider than its field: ${tag} ${f.el} needs ${f.placeholder.need}px, has ${f.placeholder.room}px`);
  for (const s of m.small) report.push(`under 44x44: ${tag} ${s.el} ${s.w}x${s.h}${s.inline ? ' (inline link in text, WCAG 2.5.8 exempt)' : ''}`);
  if (m.overflowX) report.push(`page wider than the screen: ${tag} scrollWidth/clientWidth ${m.overflowX}`);
}

if (RENDER) for (const size of SIZES) for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const path of SHOTS) {
  const { tab } = await open(path, locale, size, theme);
  const file = `${label}-${size.key}-${locale}-${theme}-${path}.png`;
  await tab.screenshot({ path: join(out, file), fullPage: true });
  // The same page with every field holding text, so the text's size shows.
  // Sample values typed on the runner's own build; nothing is submitted.
  const sample = { email: 'student@example.com', password: 'example-pass', text: locale === 'ar' ? 'سارة أحمد' : 'Sara Ahmed' };
  for (const el of await tab.$$('input[type=email], input[type=password], input[type=text]')) {
    const type = await el.evaluate((e) => e.type);
    await el.type(sample[type] ?? sample.text);
  }
  await tab.evaluate(() => document.activeElement?.blur());
  const filled = file.replace(/\.png$/, '-filled.png');
  await tab.screenshot({ path: join(out, filled), fullPage: true });
  await tab.close();
  console.log(`shot ${file}, ${filled}`);
}
await browser.close();

console.log(`\nREPORT (does not fail the run): ${report.length} line(s)`);
for (const r of [...new Set(report)]) console.log(`  ${r}`);
writeFileSync(join(out, `${label}-fields.json`), JSON.stringify({ label, plant: PLANT, fieldCount, under, pages, report }, null, 1));
console.log(`\n${fieldCount} text-entry controls measured on ${pages.length} page renders; ${under} under 16 px`);
if (fieldCount === 0) { console.log('FAIL no field was measured: the gate is blind'); process.exit(1); }
process.exit(under ? 1 : 0);
