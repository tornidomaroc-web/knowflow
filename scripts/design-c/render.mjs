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
 * backdrop-filter), and every home render also by homeChecks() below (the
 * owner's six home points of 2026-11-04, measured in the page). A finding on
 * AFTER fails the run; BEFORE is reported.
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

/**
 * THE HOME'S LAYOUT, ASSERTED (the owner's review of PR #299, 2026-11-04).
 * Run in the page on every home render; a finding on AFTER fails the run.
 *   1. the allowance: three meters in ONE row of equal columns, each caption
 *      one line and inside its column;
 *   2. the ask card: no line of one word in its title or its description;
 *   3. the two-up row: the icon boxes, the titles and the lines at the same
 *      height and size in both cards, each card one description;
 *   4. no outline (lucide) icon left on the home but the plan pill's spark;
 *   5. the recent-activity list without a border or a divider;
 *   6. the greeting's button: a 44 pt avatar with one letter, named;
 *   7. (round 3) in EVERY text block of the home, full and empty: no line of
 *      one word, no line starting with a separator; no outline illustration;
 *      the empty recent-activity well a clay inset without a border.
 */
function homeChecks() {
  const out = [];
  // BEFORE (main) has no markers: the checks then read main's home root by its
  // class, so the before report shows what the line checks catch there (a
  // witness that they are not vacuous). Only AFTER is gated.
  const marked = document.querySelector('[data-kf-home]');
  const home = marked || document.querySelector('main div.max-w-6xl');
  if (!home) return ['no home root'];
  if (!marked) out.push('no [data-kf-home] (main): read by class');
  const r = (el) => el.getBoundingClientRect();
  const near = (a, b) => Math.abs(a - b) <= 1;
  // 1
  const meters = [...home.querySelectorAll('[data-kf-meter]')];
  if (meters.length !== 3) out.push(`allowance: ${meters.length} meters, want 3`);
  else {
    const rs = meters.map(r);
    if (!rs.every((x) => near(x.top, rs[0].top))) out.push(`allowance: meters not in one row (tops ${rs.map((x) => x.top.toFixed(0)).join(', ')})`);
    if (!rs.every((x) => near(x.width, rs[0].width))) out.push(`allowance: columns not equal (${rs.map((x) => x.width.toFixed(0)).join(', ')})`);
    for (const m of meters) {
      const c = m.querySelector('[data-kf-caption]');
      const lh = parseFloat(getComputedStyle(c).lineHeight);
      if (r(c).height > lh * 1.5) out.push(`allowance: caption "${c.textContent}" on more than one line`);
      if (c.scrollWidth > m.clientWidth + 0.5 || r(c).width > r(m).width + 0.5) out.push(`allowance: caption "${c.textContent}" wider than its column (${c.scrollWidth} > ${m.clientWidth})`);
    }
  }
  // 2
  for (const sel of ['[data-kf-ask-title]', '[data-kf-ask-desc]']) {
    const el = home.querySelector(sel);
    if (!el) { out.push(`ask: no ${sel}`); continue; }
    const lines = new Map();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /\S+/g;
      for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const top = Math.round(range.getClientRects()[0]?.top ?? -1);
        const key = [...lines.keys()].find((k) => Math.abs(k - top) <= 3) ?? top;
        lines.set(key, [...(lines.get(key) || []), m[0]]);
      }
    }
    const ls = [...lines.values()];
    if (ls.length > 1 && ls.some((l) => l.length === 1)) out.push(`ask: a line of one word in ${sel}: ${ls.map((l) => l.join(' ')).join(' / ')}`);
  }
  // 3
  const cards = [...home.querySelectorAll('[data-kf-twoup]')];
  if (cards.length !== 2) out.push(`two-up: ${cards.length} cards, want 2`);
  else {
    for (const part of ['icon', 'title', 'line']) {
      const [a, b] = cards.map((c) => c.querySelector(`[data-kf-twoup-${part}]`));
      if (!a || !b) { out.push(`two-up: no ${part} in a card`); continue; }
      if (!near(r(a).top, r(b).top)) out.push(`two-up: ${part} tops differ (${r(a).top.toFixed(1)} vs ${r(b).top.toFixed(1)})`);
      if (part !== 'title' && !near(r(a).height, r(b).height)) out.push(`two-up: ${part} heights differ (${r(a).height.toFixed(1)} vs ${r(b).height.toFixed(1)})`);
    }
    const pads = cards.map((c) => getComputedStyle(c).paddingTop);
    if (pads[0] !== pads[1]) out.push(`two-up: top padding ${pads.join(' vs ')}`);
    for (const c of cards) if (c.querySelectorAll('p').length !== 2) out.push(`two-up: a card has ${c.querySelectorAll('p').length} paragraphs (a title and one line wanted)`);
  }
  // 4
  const outline = [...home.querySelectorAll('svg.lucide')].filter((s) => !s.classList.contains('lucide-sparkles'));
  if (outline.length) out.push(`icons: ${outline.length} outline icon(s): ${[...new Set(outline.map((s) => [...s.classList].find((c) => c.startsWith('lucide-')) || 'lucide'))].join(', ')}`);
  // 5
  const list = home.querySelector('[data-kf-activity]');
  if (list) {
    for (const el of [list, ...list.children]) {
      const cs = getComputedStyle(el);
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`border${s}Width`]) || 0);
      if (bw.some((w) => w > 0)) out.push(`recent activity: a border on ${el.tagName.toLowerCase()} (${bw.join('/')})`);
    }
  }
  const well = home.querySelector('[data-kf-activity-empty]');
  if (well) {
    const cs = getComputedStyle(well);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`border${s}Width`]) || 0);
    if (bw.some((w) => w > 0)) out.push(`recent activity: the empty well has a border (${bw.join('/')})`);
    if (!/inset/.test(cs.boxShadow)) out.push('recent activity: the empty well is not a clay inset');
  }
  // 4b. no outline spot illustration (illustrations/index.tsx) left on the home
  const drawn = [...home.querySelectorAll('[data-illustration]')].map((e) => e.getAttribute('data-illustration'));
  if (drawn.length) out.push(`icons: outline illustration(s) ${drawn.join(', ')}`);
  // 7. EVERY text block of the home (round 3, 2026-11-04): no line of one word
  //    when the block wraps, and no line that starts with a separator, judged
  //    by the logical first word and by the visual leading word (RTL aware).
  const SEP = /^[·•]/;
  // Each text node belongs to its NEAREST block (the first ancestor whose
  // display is not inline-something), so a block's lines hold only its own
  // words, never those of a block nested inside it.
  const blocks = new Map();
  const tw = document.createTreeWalker(home, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (el.closest('svg, .sr-only, [aria-hidden="true"]')) continue;
    let b = el;
    while (b !== home && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
    blocks.set(b, [...(blocks.get(b) || []), n]);
  }
  for (const [b, nodes] of blocks) {
    const words = [];
    for (const n of nodes) {
      const re = /\S+/g;
      for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const rc = range.getClientRects()[0];
        if (rc && rc.width > 0) words.push({ w: m[0], top: rc.top, bottom: rc.bottom, left: rc.left, right: rc.right, mid: (rc.top + rc.bottom) / 2 });
      }
    }
    // Lines by vertical overlap (a 19 pt number and its 12 pt "of 10" share a line).
    const lines = [];
    for (const w of words) {
      const line = lines.find((l) => w.mid >= l.top && w.mid <= l.bottom);
      if (line) { line.words.push(w); line.top = Math.min(line.top, w.top); line.bottom = Math.max(line.bottom, w.bottom); }
      else lines.push({ top: w.top, bottom: w.bottom, words: [w] });
    }
    const rtl = getComputedStyle(b).direction === 'rtl';
    const name = `${b.tagName.toLowerCase()} "${b.textContent.trim().slice(0, 40)}"`;
    if (lines.length > 1) {
      for (const l of lines) if (l.words.length === 1) out.push(`lines: one word alone ("${l.words[0].w}") in ${name}`);
    }
    for (const l of lines) {
      const visual = [...l.words].sort((a, c) => (rtl ? c.right - a.right : a.left - c.left))[0];
      if (SEP.test(l.words[0].w) || SEP.test(visual.w)) out.push(`lines: a line starts with a separator in ${name}`);
    }
  }
  // 6
  const av = home.querySelector('header a[href$="/dashboard/settings"]');
  if (!av) out.push('avatar: no Settings link in the greeting');
  else {
    const b = r(av);
    if (!(near(b.width, 44) && near(b.height, 44))) out.push(`avatar: ${b.width.toFixed(0)} x ${b.height.toFixed(0)}, want 44 x 44`);
    if (!/^\S$/u.test(av.textContent.trim())) out.push(`avatar: text "${av.textContent.trim()}", want one letter`);
    if (!av.getAttribute('aria-label')) out.push('avatar: no aria-label');
    if (av.querySelector('svg')) out.push('avatar: still draws an icon');
  }
  return out;
}

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
  // Finite animations are finished. An INFINITE one (a processing spinner,
  // Tailwind's `animate-spin`, which reduced motion does not stop: it is the
  // state itself) is paused at its first frame, the same on both sides, and
  // named in the report. Anything still running after that fails the run.
  const anim = await tab.evaluate(async () => {
    const paused = [];
    for (const a of document.getAnimations()) {
      try {
        if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish();
        else { a.pause(); a.currentTime = 0; paused.push(a.animationName || a.id || 'anonymous'); }
      } catch {}
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.id || 'anonymous'), paused };
  });
  const theme = await tab.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const a = await tab.evaluate(audit);
  const home = job.s.key.startsWith('home') ? await tab.evaluate(homeChecks) : [];
  // The whole page as ONE tall viewport, not a stitched fullPage capture: a
  // stitched capture paints the fixed tab bar where the first viewport ended,
  // over the content (the first run of this step). With the viewport as tall
  // as the document, fixed bars sit at the page's real bottom.
  const file = join(out, side, `${job.name}.png`);
  const tall = await tab.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await tab.setViewport({ width: 390, height: Math.max(844, tall), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.screenshot({ path: file });
  await ctx.close();
  return { url, status: res.status(), fonts, anim, theme, a, home };
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
      ...(r.anim.running.length ? [`animations still running: ${r.anim.running.join(', ')}`] : []),
      ...(job.theme === null ? (r.theme === (side === 'after' ? 'light' : 'dark') ? [] : [`default theme is ${r.theme} on ${side}`]) : (r.theme === job.theme ? [] : [`theme is ${r.theme}, asked ${job.theme}`])),
      ...r.a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
      ...r.a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
      ...(job.s.app ? r.a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`) : []),
      ...(job.locale === 'ar' ? r.a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
      ...(r.a.cost.maxLayers > 3 ? [`${r.a.cost.maxLayers} shadow layers on ${r.a.cost.heaviest}`] : []),
      ...r.a.cost.filters.map((f) => `filter or backdrop-filter on ${f}`),
      ...(job.s.app && job.s.q.platform === 'native' && words.length ? [`wording ${JSON.stringify(words)}`] : []),
      ...r.home.map((h) => `home layout: ${h}`),
    ];
    fontSets.add(JSON.stringify(r.fonts.weightsLoaded));
    if (side === 'after') failures += bad.length;
    const tmin = Math.min(...r.a.text.map((t) => t.got));
    row.sides[side] = { url: r.url, theme: r.theme, findings: bad, textWorst: Number(tmin.toFixed(2)), text: r.a.text.length, targets: r.a.targets.length, fonts: r.fonts.loaded.length, pausedAnimations: r.anim.paused, shadowsMax: r.a.cost.maxLayers };
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
