/**
 * DESIGN "C", PR 1: THE BEFORE AND AFTER, IN ONE RUN (.github/workflows/design-c.yml).
 *
 * Two builds serve side by side on the runner: BEFORE is the PR's base
 * (main), AFTER is this commit. Both are `next start` of a `next build` with
 * placeholder Supabase values, and every signed-in screen is a design preview
 * route (the real components in the real shell, fixture data, no auth, a 404
 * on production). Nothing is deployed and no production data is read.
 *
 * SAME FONTS, ASSERTED. Both sides render with the SAME static per-weight
 * Rubik files (@fontsource/rubik 5.2.5, weights 400 to 800, installed outside
 * the app): a stylesheet added to each page points `--font-rubik`, the
 * variable the app's type reads, at them, every weight is loaded before the
 * shot, and the run fails unless each page shows the same ten-or-more loaded
 * faces and the body's computed font is the static family. The app itself
 * keeps its next/font Rubik; this pins the renders so a before/after
 * difference can only be the change.
 *
 * ANIMATIONS ENDED. Reduced motion is emulated (the base state is the final
 * state, VISUAL_LANGUAGE.md rule 5), any finite animation still present is
 * finished, and the run fails if one is still running at the shot.
 *
 * WHAT IS SHOT, 390 x 844 pt at 2x, the whole page:
 *   - home: the app (?platform=native, the app's user agent), zero and full
 *     data, Arabic and English, light and dark; the web shell's home, full;
 *     and the DEFAULT (no theme asked, no cookie), which must be dark before
 *     and light after;
 *   - the regression screens the token change reaches: subjects, a subject,
 *     ask, settings (app, Arabic and English, light and dark);
 *   - the landing and the app's sign-in, which the new default reaches first.
 * Each AFTER render is audited in the page (scripts/redesign-built/audit.mjs:
 * text contrast, control edges, 44 pt targets on the app's screens, Arabic
 * shaping, the app's wording rule, the shadow budget, no filter or
 * backdrop-filter). A finding on AFTER fails the run; BEFORE is reported.
 *
 * Usage: node scripts/design-c/render.mjs --out DIR
 * Env: BEFORE (default http://127.0.0.1:3001), AFTER (default
 *      http://127.0.0.1:3000), CHROME, PUPPETEER_DIR, FONT_DIR (the
 *      @fontsource/rubik package folder).
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { kfWording } from '../lib/app-wording.mjs';
import { audit } from '../redesign-built/audit.mjs';

const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || 'design-c-renders');
const SIDES = { before: process.env.BEFORE || 'http://127.0.0.1:3001', after: process.env.AFTER || 'http://127.0.0.1:3000' };
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');
const FONT_DIR = resolve(process.env.FONT_DIR || '.');

// ── The static fonts: the package's own @font-face rules, renamed and re-pointed.
const FAMILY = 'KF Rubik Static';
const FONT_HOST = 'https://kf-fonts.invalid/';
const WEIGHTS = [400, 500, 600, 700, 800];
const fontFiles = new Map();
let fontCss = '';
for (const w of WEIGHTS) {
  const css = readFileSync(join(FONT_DIR, `${w}.css`), 'utf8');
  fontCss += css
    .replace(/font-family:\s*'Rubik'/g, `font-family: '${FAMILY}'`)
    .replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => { fontFiles.set(f, null); return `url(${FONT_HOST}${f})`; })
    .replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '');
}
for (const f of fontFiles.keys()) {
  const p = join(FONT_DIR, 'files', f);
  if (existsSync(p)) fontFiles.set(f, readFileSync(p));
}
const fontHashes = Object.fromEntries([...fontFiles].filter(([, b]) => b).map(([f, b]) => [f, createHash('sha256').update(b).digest('hex').slice(0, 16)]));
const PIN = `${fontCss}\nhtml { --font-rubik: '${FAMILY}' !important; }`;

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const APP = `${SAFARI} KnowFlowApp/1`;

const SCREENS = [];
const add = (key, path, q, ua, opts = {}) => SCREENS.push({ key, path, q, ua, ...opts });
add('home', 'preview/student-home', { platform: 'native' }, APP, { app: true });
add('home-full', 'preview/student-home', { platform: 'native', state: 'full' }, APP, { app: true });
add('home-web', 'preview/student-home', { platform: 'web', state: 'full' }, SAFARI, { app: true });
add('subjects', 'preview/subjects', { platform: 'native' }, APP, { app: true });
add('subject', 'preview/subject', { platform: 'native' }, APP, { app: true });
add('ask', 'preview/ask', { platform: 'native' }, APP, { app: true });
add('settings', 'preview/settings', { platform: 'native' }, APP, { app: true });
add('landing', '', {}, SAFARI, { app: false });
add('login', 'login', {}, APP, { app: false });

const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['light', 'dark']) for (const s of SCREENS) JOBS.push({ locale, theme, s, name: `${locale}-${theme}-${s.key}` });
// The default: no ?theme=, no cookie (a fresh browser context per job).
for (const locale of ['ar', 'en']) JOBS.push({ locale, theme: null, s: SCREENS[1], name: `${locale}-default-home-full` });

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'] });
mkdirSync(join(out, 'before'), { recursive: true });
mkdirSync(join(out, 'after'), { recursive: true });
const results = [];
let failures = 0;
const fontSets = new Set();

async function shoot(side, job) {
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  await tab.setUserAgent(job.s.ua);
  await tab.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await tab.setRequestInterception(true);
  tab.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(FONT_HOST)) {
      const body = fontFiles.get(u.slice(FONT_HOST.length));
      return body ? r.respond({ status: 200, contentType: 'font/woff2', body, headers: { 'access-control-allow-origin': '*' } }) : r.respond({ status: 404, body: '' });
    }
    r.continue();
  });
  const q = new URLSearchParams({ ...job.s.q, ...(job.theme ? { theme: job.theme } : {}) }).toString();
  const url = `${SIDES[side]}/${job.locale}${job.s.path ? '/' + job.s.path : ''}${q ? '?' + q : ''}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.addStyleTag({ content: PIN });
  const fonts = await tab.evaluate(async (family, weights) => {
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px "${family}"`, 'اب ab')));
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((f) => f.family.replace(/"/g, '') === family && f.status === 'loaded').map((f) => `${f.weight}/${f.unicodeRange.slice(0, 18)}`).sort();
    return { loaded, body: getComputedStyle(document.body).fontFamily, weightsLoaded: [...new Set([...document.fonts].filter((f) => f.family.replace(/"/g, '') === family && f.status === 'loaded').map((f) => Number(f.weight)))].sort() };
  }, FAMILY, WEIGHTS);
  const anim = await tab.evaluate(async () => {
    for (const a of document.getAnimations()) { try { if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish(); } catch {} }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.id || 'anonymous');
  });
  const theme = await tab.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const a = await tab.evaluate(audit);
  const file = join(out, side, `${job.name}.png`);
  await tab.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return { url, status: res.status(), fonts, anim, theme, a };
}

for (const job of JOBS) {
  const row = { name: job.name, sides: {} };
  for (const side of ['before', 'after']) {
    const r = await shoot(side, job);
    const words = kfWording(r.a.visibleText);
    const bad = [
      ...(r.status === 200 ? [] : [`HTTP ${r.status}`]),
      ...(r.fonts.weightsLoaded.join(',') === WEIGHTS.join(',') ? [] : [`static Rubik weights loaded ${r.fonts.weightsLoaded.join(',')}`]),
      ...(r.fonts.body.includes(FAMILY) ? [] : [`body font is ${r.fonts.body}`]),
      ...(r.anim.length ? [`animations still running: ${r.anim.join(', ')}`] : []),
      ...(job.theme === null ? (r.theme === (side === 'after' ? 'light' : 'dark') ? [] : [`default theme is ${r.theme} on ${side}`]) : (r.theme === job.theme ? [] : [`theme is ${r.theme}, asked ${job.theme}`])),
      ...r.a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
      ...r.a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
      ...(job.s.app ? r.a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`) : []),
      ...(job.locale === 'ar' ? r.a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
      ...(r.a.cost.maxLayers > 3 ? [`${r.a.cost.maxLayers} shadow layers on ${r.a.cost.heaviest}`] : []),
      ...r.a.cost.filters.map((f) => `filter or backdrop-filter on ${f}`),
      ...(job.s.app && job.s.q.platform === 'native' && words.length ? [`wording ${JSON.stringify(words)}`] : []),
    ];
    fontSets.add(JSON.stringify(r.fonts.weightsLoaded));
    if (side === 'after') failures += bad.length;
    const tmin = Math.min(...r.a.text.map((t) => t.got));
    row.sides[side] = { url: r.url, theme: r.theme, findings: bad, textWorst: Number(tmin.toFixed(2)), text: r.a.text.length, targets: r.a.targets.length, fonts: r.fonts.loaded.length, shadowsMax: r.a.cost.maxLayers };
    console.log(`${side === 'after' && bad.length ? 'FAIL' : 'ok  '} ${side.padEnd(6)} ${job.name}: theme ${r.theme}, ${r.fonts.loaded.length} static faces, text worst ${tmin.toFixed(2)}:1, ${bad.length} finding(s)`);
    for (const b of bad) console.log(`       ${side}: ${b}`);
  }
  results.push(row);
}
await browser.close();
if (fontSets.size !== 1) { console.log(`FAIL the pages loaded different static font sets: ${[...fontSets].join(' | ')}`); failures++; }
writeFileSync(join(out, 'report.json'), JSON.stringify({ fonts: { family: FAMILY, package: '@fontsource/rubik@5.2.5', weights: WEIGHTS, files: fontHashes }, results }, null, 2) + '\n');
console.log(`\nfonts: one static set on every page (${[...fontSets][0]}), ${Object.keys(fontHashes).length} files hashed`);
console.log(`${failures} failure(s) on AFTER across ${JOBS.length} screens (${JOBS.length * 2} renders)`);
process.exit(failures ? 1 : 0);
