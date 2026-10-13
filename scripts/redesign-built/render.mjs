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
import { audit } from './audit.mjs';

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
