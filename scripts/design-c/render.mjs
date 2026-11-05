/**
 * DESIGN "C": THE BEFORE AND AFTER, IN ONE RUN (.github/workflows/design-c.yml).
 * PR 1 was the tokens, the home and the tab bar; PR 2 (the owner-approved
 * artboards Landing.dc.html, Login.dc.html, Prefs.dc.html) is the landing,
 * sign-in and sign-up, Settings' two choices and the subject header.
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
 * WHAT IS SHOT (PR 2), 390 x 844 pt at 2x unless named, the whole page,
 * Arabic and English, light and dark:
 *   - the landing on the web at 390 and at 1280 x 800 (1x, a desk), and the
 *     app's request for it, which the middleware answers with the sign-in
 *     page (the landing has no app twin: Apple 3.1.1(a));
 *   - sign-in and sign-up, on the web and in the app;
 *   - Settings in the app and on the web; a subject in the app;
 *   - the full home in the app (PR 1's screen, as a regression, with its
 *     homeChecks) and the web's About page (it shares the site header and
 *     footer this PR restyles);
 *   - the DEFAULT (no theme asked, no cookie) of the landing, the app's
 *     sign-in and the app's Settings, which must be light on both sides.
 * Each AFTER render is audited in the page (scripts/redesign-built/audit.mjs:
 * text contrast, control edges, 44 pt targets on every phone-width screen,
 * Arabic shaping, the shadow budget, no filter or backdrop-filter); every
 * page's text blocks by lineChecks() (no line of one word, no line that
 * starts with a separator); every page, the home included, by tileChecks()
 * (in a row of tiles the descriptions' first lines at one y within 2 px, no
 * parenthesised group split across lines, the hero title one line per
 * sentence); every app render by appChecks() (no Apple and no
 * Google button) and the app's wording rule (no plan, price, upgrade or free
 * word); the home by homeChecks(). A finding on AFTER fails the run; BEFORE
 * is reported.
 *
 * PR 3 (the subjects, the subject page with its upload tile and material
 * cards, Settings' other sections and About) adds, 390 x 844 at 2x unless
 * named, both languages, both themes, FULL data and EMPTY data where the
 * screen has data:
 *   - the subjects list in the app and on the web, full and empty, and on
 *     the web at 1280 x 800 (a desk), full and empty;
 *   - the subject page in the app and on the web, full and empty: the upload
 *     tile is its idle upload control (the owner's ruling of 2026-11-05: no
 *     one-choice sheet in 1.0, so "the sheet open" is the tile on the page);
 *   - About in the app (its native twin) and on the web, and at 1280;
 *   - Settings as before (the full page, in the app and on the web).
 * Each of them is also read by pr3Checks(): the study buttons ("Summarize
 * this material", "Quiz me on this material", the Arabic pair) one line
 * each; the upload tile there, at least 44 x 44, its title and line one line
 * each, and ONE tap on it opening the file picker once (pickerCheck(), after
 * the shot); no dashed border; no hairline inside a card but the controls'
 * own edges (fields, segmented tracks, the reminder clock) and the delete
 * card's red one, which must be there; no outline (lucide) icon in the parts
 * PR 3 redrew; every Settings section title starts with a clay picture.
 * The PR 2 exception for "Summarize" alone on its line is gone: that button
 * now has a row of its own on a phone and must pass.
 *
 * PR 3, the owner's review of #303, on EVERY page by reviewChecks(): a stat
 * tile's icon is never narrower than 12 px (it was squeezed to 2 px beside
 * "Summarised"); a study kit (label and two chips) is one row that does not
 * wrap or overflow; in a material card's action group the Delete control
 * sits at the row's inline start (left in English, right in Arabic); the web
 * sidebar's nav icons are the clay tab glyphs, no outline icon. The
 * selectors also match main's markup, so BEFORE shows the defects the checks
 * catch (a witness that they are not blind).
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
const DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

// `native`: the app's user agent, so the app's gates apply (appChecks and the
// wording rule). `targets`: the 44 pt rule applies (every phone-width page).
const SCREENS = [];
const add = (key, path, q, ua, opts = {}) => SCREENS.push({ key, path, q, ua, view: PHONE, targets: true, native: ua === APP, ...opts });
add('landing', '', {}, SAFARI);
add('landing-desk', '', {}, DESK, { view: DESKTOP, targets: false });
add('landing-app', '', {}, APP, { lands: 'login' });
add('login-web', 'login', {}, SAFARI);
add('login-app', 'login', {}, APP);
add('signup-web', 'signup', {}, SAFARI);
add('signup-app', 'signup', {}, APP);
add('settings-app', 'preview/settings', { platform: 'native' }, APP);
add('settings-web', 'preview/settings', { platform: 'web' }, SAFARI);
add('subject-app', 'preview/subject', { platform: 'native' }, APP);
add('home-full', 'preview/student-home', { platform: 'native', state: 'full' }, APP);
// PR 3: About's body is now in "C", so every line of it is read.
add('about-web', 'about', {}, SAFARI, { pr3: true });
add('about-app', 'about', {}, APP, { pr3: true });
add('about-desk', 'about', {}, DESK, { view: DESKTOP, targets: false, pr3: true });
// PR 3: the subjects list and the subject page, full and empty, app and web.
add('subjects-app', 'preview/subjects', { platform: 'native' }, APP, { pr3: true });
add('subjects-app-empty', 'preview/subjects', { platform: 'native', state: 'zero' }, APP, { pr3: true });
add('subjects-web', 'preview/subjects', { platform: 'web' }, SAFARI, { pr3: true });
add('subjects-web-empty', 'preview/subjects', { platform: 'web', state: 'zero' }, SAFARI, { pr3: true });
add('subjects-desk', 'preview/subjects', { platform: 'web' }, DESK, { view: DESKTOP, targets: false, pr3: true });
add('subjects-desk-empty', 'preview/subjects', { platform: 'web', state: 'zero' }, DESK, { view: DESKTOP, targets: false, pr3: true });
add('subject-app-empty', 'preview/subject', { platform: 'native', view: 'empty' }, APP, { pr3: true });
add('subject-web', 'preview/subject', { platform: 'web' }, SAFARI, { pr3: true });
add('subject-web-empty', 'preview/subject', { platform: 'web', view: 'empty' }, SAFARI, { pr3: true });
for (const k of ['settings-app', 'settings-web', 'subject-app']) byKeyEarly(k).pr3 = true;
const byKey = (k) => SCREENS.find((x) => x.key === k);
function byKeyEarly(k) { return SCREENS.find((x) => x.key === k); }

// KNOWN, NAMED AND REPORTED, NOT FAILED: a finding in a part of a screen this
// PR may not touch. Each is printed and written to the report under `known`,
// with its reason; nothing else is let through.
// PR 3: the one PR 2 exception (the Summary section's "Summarize" alone on
// its line at 390 pt) is fixed and removed; nothing is let through.
const KNOWN = [];

const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['light', 'dark']) for (const s of SCREENS) JOBS.push({ locale, theme, s, name: `${locale}-${theme}-${s.key}` });
// The default: no ?theme=, no cookie (a fresh browser context per job). Light
// on both sides since PR 1 (main has had it since #299).
for (const locale of ['ar', 'en']) for (const k of ['landing', 'login-app', 'settings-app']) JOBS.push({ locale, theme: null, s: byKey(k), name: `${locale}-default-${k}` });

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

/**
 * EVERY TEXT BLOCK OF THE PAGE (PR 2, the owner's rule of 2026-11-04 for the
 * home, now on every screen): no line of one word when the block wraps, and
 * no line that starts with a separator, judged by the logical first word and
 * by the visual leading word (RTL aware). The same rule as homeChecks() 7.
 * A student's own text (a subject or file name, `[data-username]`) is not
 * read: three words of a name at the large title's size cannot always avoid
 * a word alone, and the page does not choose them. Self-contained: it runs
 * in the page; `scope` limits it to the elements a selector names.
 */
function lineChecks(scope) {
  const out = [];
  for (const root of scope ? [...document.querySelectorAll(scope)] : [document.body]) out.push(...linesIn(root));
  return out;
  function linesIn(root) {
  const out = [];
  const SEP = /^[·•]/;
  const blocks = new Map();
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, script, style, noscript, .sr-only, [aria-hidden="true"], [hidden], [data-username]')) continue;
    let b = el;
    while (b !== root && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
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
    const lines = [];
    for (const w of words) {
      const line = lines.find((l) => w.mid >= l.top && w.mid <= l.bottom);
      if (line) { line.words.push(w); line.top = Math.min(line.top, w.top); line.bottom = Math.max(line.bottom, w.bottom); }
      else lines.push({ top: w.top, bottom: w.bottom, words: [w] });
    }
    const rtl = getComputedStyle(b).direction === 'rtl';
    const name = `${b.tagName.toLowerCase()} "${b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
    if (lines.length > 1) for (const l of lines) if (l.words.length === 1) out.push(`one word alone ("${l.words[0].w}") in ${name}`);
    for (const l of lines) {
      const visual = [...l.words].sort((a, c) => (rtl ? c.right - a.right : a.left - c.left))[0];
      if (SEP.test(l.words[0].w) || SEP.test(visual.w)) out.push(`a line starts with a separator in ${name}`);
    }
  }
  return out;
  }
}

/**
 * ROWS, GROUPS AND THE HERO (the owner's review of PR 2, 2026-11-05), on
 * EVERY page of the run, the home included. Self-contained: it runs in the
 * page and returns { findings, measured } so the report states what it read
 * even when nothing fails.
 *   1. ROWS: a tile or card is a child of a grid or a row flexbox that holds
 *      a heading (h1 to h6) and, after it, a paragraph (its description).
 *      Children are grouped into rows by their top (2 px); in each row of two
 *      or more tiles, the description's FIRST LINE starts at the same y in
 *      every tile, within 2 px.
 *   2. GROUPS: in every text block (the blocks lineChecks() reads, the same
 *      exclusions), a parenthesised group "( ... )" never splits across two
 *      lines.
 *   3. THE HERO TITLE (where the page has one, `[data-kf-hero-title]`): one
 *      line per sentence, each sentence on its own line.
 */
function tileChecks() {
  const findings = [];
  const measured = { rows: 0, tiles: 0, groups: 0, heroLines: null };
  const SKIP = 'svg, script, style, noscript, .sr-only, [aria-hidden="true"], [hidden], [data-username]';
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const firstLineTop = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    return rects.length ? Math.min(...rects.map((r) => r.top)) : null;
  };
  // The distinct lines a range covers: rects grouped by their vertical middle.
  const linesOf = (range) => {
    const lines = [];
    for (const r of range.getClientRects()) {
      if (!(r.width > 0 && r.height > 0)) continue;
      const mid = (r.top + r.bottom) / 2;
      const l = lines.find((x) => mid >= x.top && mid <= x.bottom);
      if (l) { l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); } else lines.push({ top: r.top, bottom: r.bottom });
    }
    return lines.length;
  };
  const label = (el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"`;

  // 1. Rows of tiles.
  for (const box of document.body.querySelectorAll('*')) {
    if (box.closest(SKIP)) continue;
    const cs = getComputedStyle(box);
    const isRowBox = cs.display.endsWith('grid') || (cs.display.endsWith('flex') && cs.flexDirection.startsWith('row'));
    if (!isRowBox) continue;
    const tiles = [];
    for (const child of box.children) {
      if (!visible(child)) continue;
      const heading = child.querySelector('h1, h2, h3, h4, h5, h6');
      if (!heading || !visible(heading)) continue;
      const desc = [...child.querySelectorAll('p')].find((p) => visible(p) && !p.closest(SKIP) && p.textContent.trim() && (heading.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && !heading.contains(p));
      if (!desc) continue;
      tiles.push({ top: child.getBoundingClientRect().top, desc, y: firstLineTop(desc) });
    }
    const rows = [];
    for (const t of tiles) {
      const row = rows.find((r) => Math.abs(r[0].top - t.top) <= 2);
      if (row) row.push(t); else rows.push([t]);
    }
    for (const row of rows) {
      if (row.length < 2) continue;
      measured.rows++;
      measured.tiles += row.length;
      const ys = row.map((t) => t.y).filter((y) => y !== null);
      const spread = Math.max(...ys) - Math.min(...ys);
      if (spread > 2) findings.push(`a row of ${row.length} in ${label(box)}: the descriptions' first lines start ${spread.toFixed(1)} px apart (${row.map((t) => `${label(t.desc)} at ${t.y.toFixed(1)}`).join('; ')})`);
    }
  }

  // 2. Parenthesised groups, per text block.
  const blocks = new Map();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest(SKIP)) continue;
    let b = el;
    while (b !== document.body && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
    blocks.set(b, [...(blocks.get(b) || []), n]);
  }
  for (const [b, nodes] of blocks) {
    let text = '';
    const at = [];
    for (const n of nodes) { at.push({ n, start: text.length }); text += n.data; }
    const locate = (i) => { let k = at.length - 1; while (k > 0 && at[k].start > i) k--; return [at[k].n, i - at[k].start]; };
    const re = /\([^()]*\)/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const range = document.createRange();
      range.setStart(...locate(m.index));
      range.setEnd(...locate(m.index + m[0].length - 1));
      range.setEnd(range.endContainer, range.endOffset + 1);
      measured.groups++;
      const n = linesOf(range);
      if (n > 1) findings.push(`the group "${m[0]}" splits across ${n} lines in ${label(b)}`);
    }
  }

  // 3. The hero title, one line per sentence.
  const hero = document.querySelector('[data-kf-hero-title]');
  if (hero) {
    const spans = [...hero.children];
    const range = document.createRange();
    range.selectNodeContents(hero);
    measured.heroLines = linesOf(range);
    for (const s of spans) {
      const r = document.createRange();
      r.selectNodeContents(s);
      if (linesOf(r) !== 1) findings.push(`hero title: the sentence "${s.textContent.trim()}" takes ${linesOf(r)} lines`);
    }
    if (measured.heroLines !== spans.length) findings.push(`hero title: ${measured.heroLines} lines for ${spans.length} sentences`);
  }
  return { findings, measured };
}

/**
 * PR 3, IN THE PAGE (every PR 3 screen; a finding on AFTER fails the run).
 * Self-contained; returns { findings, measured }.
 *   1. the study buttons: each one line, nothing clipped;
 *   2. the upload tile (subject screens): present, >= 44 x 44, its title and
 *      its line one line each;
 *   3. no dashed border on any visible element;
 *   4. no hairline inside a card or the About body: a visible border (any
 *      width, a colour that is not transparent) is a finding unless it is a
 *      control's own edge (input, select, textarea, a segmented track or
 *      option, the reminder clock, a switch track) or the delete card's red;
 *   5. no outline (lucide) icon in the parts PR 3 redrew: the subject cards,
 *      the empty subjects card, a material card's head and study kit, the
 *      upload tile, every Settings section title, the About body;
 *   6. Settings: every section title carries a clay picture (.section-icon
 *      with an svg), and the delete card keeps a solid red border.
 */
function pr3Checks() {
  const findings = [];
  const measured = { studyButtons: 0, uploadTile: false, sectionTitles: 0, deleteCardEdge: null };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
  const linesOf = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const ls = [];
    for (const r of range.getClientRects()) {
      if (!(r.width > 0 && r.height > 0)) continue;
      const mid = (r.top + r.bottom) / 2;
      const l = ls.find((x) => mid >= x.top && mid <= x.bottom);
      if (l) { l.top = Math.min(l.top, r.top); l.bottom = Math.max(l.bottom, r.bottom); } else ls.push({ top: r.top, bottom: r.bottom });
    }
    return ls.length;
  };
  const transparent = (c) => /rgba\([^)]*,\s*0\)$/.test(c) || c === 'transparent';
  // 1
  for (const b of document.querySelectorAll('[data-kf-study] > button')) {
    if (!vis(b)) continue;
    measured.studyButtons++;
    const n = linesOf(b);
    if (n !== 1) findings.push(`study button "${b.textContent.trim()}" takes ${n} lines`);
    if (b.scrollWidth > b.clientWidth + 1) findings.push(`study button "${b.textContent.trim()}" is clipped (${b.scrollWidth} > ${b.clientWidth})`);
  }
  // 2
  if (/\/preview\/subject(\?|$)/.test(location.pathname + location.search) || location.pathname.endsWith('/preview/subject')) {
    const tile = document.querySelector('[data-kf-upload="tile"]');
    if (!tile || !vis(tile)) findings.push('no upload tile');
    else {
      measured.uploadTile = true;
      const r = tile.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) findings.push(`upload tile ${r.width.toFixed(0)} x ${r.height.toFixed(0)} < 44 x 44`);
      for (const sel of ['[data-kf-upload-title]', '[data-kf-upload-desc]']) {
        const e = tile.querySelector(sel);
        if (!e) findings.push(`upload tile: no ${sel}`);
        else if (linesOf(e) !== 1) findings.push(`upload tile: ${sel} "${e.textContent.trim()}" takes ${linesOf(e)} lines`);
      }
    }
  }
  // 3 and 4
  const ALLOWED = 'input, select, textarea, .kf-seg, .kf-seg-opt, .kf-reminder-clock, .kf-switch-track, .kf-field, [data-kf-delete-card]';
  const scopes = [...document.querySelectorAll('main .kf-card, [data-kf-about]')];
  let dashed = 0, hair = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((x) => parseFloat(cs[`border${x}Width`]) > 0 && cs[`border${x}Style`] !== 'none' && !transparent(cs[`border${x}Color`]));
    if (!sides.length) continue;
    if (sides.some((x) => cs[`border${x}Style`] === 'dashed') && dashed++ < 6) findings.push(`dashed border on ${label(el)}`);
    if (scopes.some((sc) => sc === el || sc.contains(el)) && !el.matches(ALLOWED) && hair++ < 6) findings.push(`hairline (${sides.map((x) => cs[`border${x}Width`]).join('/')}) on ${label(el)}`);
  }
  // 5
  const REDRAWN = '[data-kf-subject-card], [data-kf-subjects-empty], [data-kf-material] > div:first-child, [data-kf-material] .kf-well, [data-kf-upload="tile"], main h2:has(> .section-icon), [data-kf-about], [data-kf-files-empty]';
  const outline = [...document.querySelectorAll(REDRAWN)].flatMap((r) => [...r.querySelectorAll('svg.lucide')]);
  const names = [...new Set(outline.map((x) => [...x.classList].find((c) => c.startsWith('lucide-') && c !== 'lucide') || 'lucide'))];
  if (outline.length) findings.push(`outline icon(s) in redrawn parts: ${names.join(', ')}`);
  // 6
  if (/\/settings/.test(location.pathname)) {
    for (const h of document.querySelectorAll('main h2')) {
      if (!vis(h)) continue;
      measured.sectionTitles++;
      const ic = h.querySelector('.section-icon');
      if (!ic || !ic.querySelector('svg') || ic.querySelector('svg.lucide')) findings.push(`Settings section "${h.textContent.trim().slice(0, 30)}" has no clay picture`);
    }
    const del = document.querySelector('[data-kf-delete-card]');
    if (!del) findings.push('no delete card');
    else {
      const cs = getComputedStyle(del);
      measured.deleteCardEdge = `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`;
      if (!(parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle === 'solid')) findings.push(`the delete card lost its red border (${measured.deleteCardEdge})`);
    }
  }
  return { findings, measured };
}

function reviewChecks() {
  const findings = [];
  const measured = { statIcons: 0, narrowestStatIcon: null, kits: 0, deletes: 0, navIcons: 0 };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  // 1. Stat icons (this head marks them; main's subjects and header tiles are read by structure).
  const icons = new Set([...document.querySelectorAll('[data-kf-stat-icon] svg, .kf-tile dt > svg')]);
  for (const svg of icons) {
    // A hidden icon measures 0 x 0; a squeezed one keeps its height, so it is read.
    const rr = svg.getBoundingClientRect();
    if (rr.height === 0) continue;
    const w = rr.width;
    measured.statIcons++;
    measured.narrowestStatIcon = measured.narrowestStatIcon === null ? w : Math.min(measured.narrowestStatIcon, w);
    if (w < 12) findings.push(`a stat icon is ${w.toFixed(1)} px wide (< 12) beside "${txt(svg.closest('dt, div') || svg.parentElement)}"`);
  }
  // 2. Study kits: one row, no overflow.
  const kits = new Set([...document.querySelectorAll('[data-kf-kit], article .kf-well.flex-wrap')]);
  for (const k of kits) {
    if (!vis(k)) continue;
    measured.kits++;
    const kids = [...k.children].filter(vis).map((c) => c.getBoundingClientRect());
    // One row = every child's vertical middle within 2 px (the label line and
    // the 28 pt chips are centred on one row, so their tops differ).
    const mids = kids.map((r) => (r.top + r.bottom) / 2);
    if (mids.length && Math.max(...mids) - Math.min(...mids) > 2) findings.push(`a study kit wraps: its label and chips sit at ${mids.map((t) => t.toFixed(0)).join(', ')} ("${txt(k)}")`);
    if (k.scrollWidth > k.clientWidth + 1) findings.push(`a study kit overflows its well (${k.scrollWidth} > ${k.clientWidth}): "${txt(k)}"`);
  }
  // 3. Delete at the start of its row in the action group.
  for (const d of document.querySelectorAll('[data-kf-actions] > [data-kf-action="delete"]')) {
    if (!vis(d)) continue;
    measured.deletes++;
    const box = d.parentElement.getBoundingClientRect();
    const cs = getComputedStyle(d.parentElement);
    const r = d.getBoundingClientRect();
    const rtl = cs.direction === 'rtl';
    const off = rtl ? (box.right - parseFloat(cs.paddingRight)) - r.right : r.left - (box.left + parseFloat(cs.paddingLeft));
    if (Math.abs(off) > 2) findings.push(`Delete is not at the start of its row (${rtl ? 'right' : 'left'} edge off by ${off.toFixed(1)} px)`);
  }
  // 4. The web sidebar's nav: clay glyphs only.
  for (const a of document.querySelectorAll('aside nav a')) {
    if (!vis(a)) continue;
    measured.navIcons++;
    if (a.querySelector('svg.lucide')) findings.push(`the sidebar entry "${txt(a)}" still draws an outline icon`);
  }
  return { findings, measured };
}

/**
 * ONE TAP OPENS THE PICKER (PR 3, run AFTER the shot so it cannot change
 * it): the file input's click() is counted while the upload tile is clicked
 * once; the picker itself is the browser's, so the count is the proof.
 */
function pickerCheck() {
  const tile = document.querySelector('[data-kf-upload="tile"]');
  const input = document.querySelector('input[type="file"]');
  if (!tile || !input) return { opened: null, finding: 'no upload tile or no file input' };
  let n = 0;
  const own = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this === input) n++; };
  try { tile.click(); } finally { HTMLInputElement.prototype.click = own; }
  return { opened: n, finding: n === 1 ? null : `one tap on the upload tile opened the picker ${n} times` };
}

/**
 * THE APP'S GATES, IN THE PAGE (every render with the app's user agent): no
 * Sign in with Apple button (it ships natively in 1.1) and no Google button
 * (Google refuses OAuth in an embedded web view; the platform gate hides it).
 * A control is any visible button or link; its name is its text or label.
 * The wording rule (no plan, price, upgrade or free word) is kfWording() over
 * the page's visible text, applied by the caller.
 */
function appChecks() {
  const out = { apple: [], google: [] };
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden') continue;
    const name = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim();
    if (/\bapple\b/i.test(name)) out.apple.push(name.slice(0, 60));
    if (/\bgoogle\b/i.test(name)) out.google.push(name.slice(0, 60));
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
  await tab.setViewport(job.s.view);
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
  // A page reached through a redirect (the app's request for the landing)
  // loses its query on the way, so its theme is asked with the cookie the
  // ?theme= link would have written.
  if (job.theme && job.s.lands) await tab.setCookie({ name: 'kf-theme', value: job.theme, url: SIDES[side] });
  const q = new URLSearchParams({ ...job.s.q, ...(job.theme && !job.s.lands ? { theme: job.theme } : {}) }).toString();
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
  const landed = new URL(tab.url()).pathname;
  const a = await tab.evaluate(audit);
  const home = job.s.key.startsWith('home') ? await tab.evaluate(homeChecks) : [];
  const lines = job.s.key.startsWith('home') ? [] : await tab.evaluate(lineChecks, job.s.lineScope || null);
  const gate = job.s.native ? await tab.evaluate(appChecks) : null;
  const tiles = await tab.evaluate(tileChecks);
  const pr3 = job.s.pr3 ? await tab.evaluate(pr3Checks) : null;
  const review = await tab.evaluate(reviewChecks);
  // The whole page as ONE tall viewport, not a stitched fullPage capture: a
  // stitched capture paints the fixed tab bar where the first viewport ended,
  // over the content (the first run of this step). With the viewport as tall
  // as the document, fixed bars sit at the page's real bottom.
  const file = join(out, side, `${job.name}.png`);
  const tall = await tab.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await tab.setViewport({ ...job.s.view, height: Math.max(job.s.view.height, tall) });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.screenshot({ path: file });
  const picker = job.s.pr3 && /preview\/subject$/.test(job.s.path) ? await tab.evaluate(pickerCheck) : null;
  await ctx.close();
  return { url, landed, status: res.status(), fonts, anim, theme, a, home, lines, gate, tiles, pr3, picker, review };
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
      ...(job.theme === null ? (r.theme === 'light' ? [] : [`default theme is ${r.theme} on ${side}`]) : (r.theme === job.theme ? [] : [`theme is ${r.theme}, asked ${job.theme}`])),
      ...(job.s.lands && r.landed !== `/${job.locale}/${job.s.lands}` ? [`the app's request landed on ${r.landed}, want /${job.locale}/${job.s.lands}`] : []),
      ...r.a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
      ...r.a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
      ...(job.s.targets ? r.a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`) : []),
      ...(job.locale === 'ar' ? r.a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
      ...(r.a.cost.maxLayers > 3 ? [`${r.a.cost.maxLayers} shadow layers on ${r.a.cost.heaviest}`] : []),
      ...r.a.cost.filters.map((f) => `filter or backdrop-filter on ${f}`),
      ...(job.s.native && words.length ? [`wording ${JSON.stringify(words)}`] : []),
      ...(r.gate ? [...r.gate.apple.map((n) => `app: an Apple button "${n}"`), ...r.gate.google.map((n) => `app: a Google button "${n}"`)] : []),
      ...r.home.map((h) => `home layout: ${h}`),
      ...r.lines.map((l) => `lines: ${l}`),
      ...r.tiles.findings.map((f) => `rows: ${f}`),
      ...(r.pr3 ? r.pr3.findings.map((f) => `pr3: ${f}`) : []),
      ...(r.picker?.finding ? [`pr3: ${r.picker.finding}`] : []),
      ...r.review.findings.map((f) => `review: ${f}`),
    ];
    fontSets.add(JSON.stringify(r.fonts.weightsLoaded));
    const known = bad.filter((b) => KNOWN.some((k) => k.screen.test(job.name) && k.finding.test(b)));
    bad.splice(0, bad.length, ...bad.filter((b) => !known.includes(b)));
    if (side === 'after') failures += bad.length;
    const tmin = Math.min(...r.a.text.map((t) => t.got));
    row.sides[side] = {
      url: r.url, landed: r.landed, theme: r.theme, findings: bad,
      known: known.map((b) => ({ finding: b, why: KNOWN.find((k) => k.finding.test(b)).why })), textWorst: Number(tmin.toFixed(2)), text: r.a.text.length, targets: r.a.targets.length, fonts: r.fonts.loaded.length, pausedAnimations: r.anim.paused, shadowsMax: r.a.cost.maxLayers,
      // What tileChecks() read, so a pass says how much it measured.
      rows: r.tiles.measured,
      // What pr3Checks() and pickerCheck() read on a PR 3 screen.
      ...(r.pr3 ? { pr3: { ...r.pr3.measured, pickerOpened: r.picker ? r.picker.opened : undefined } } : {}),
      // What reviewChecks() read on this page.
      review: r.review.measured,
      // Every app render states its three gates, measured, so the report says
      // them even when they pass: no Apple button, no Google button, and no
      // plan, price, upgrade or free word.
      ...(job.s.native ? { app: { appleButtons: r.gate.apple.length, googleButtons: r.gate.google.length, purchaseWords: words } } : {}),
    };
    console.log(`${side === 'after' && bad.length ? 'FAIL' : 'ok  '} ${side.padEnd(6)} ${job.name}: theme ${r.theme}, ${r.fonts.loaded.length} static faces, text worst ${tmin.toFixed(2)}:1, ${bad.length} finding(s)`);
    for (const b of bad) console.log(`       ${side}: ${b}`);
    for (const b of known) console.log(`       ${side}: known (not failed): ${b}`);
  }
  results.push(row);
}
await browser.close();
if (fontSets.size !== 1) { console.log(`FAIL the pages loaded different static font sets: ${[...fontSets].join(' | ')}`); failures++; }
writeFileSync(join(out, 'report.json'), JSON.stringify({ fonts: { family: FAMILY, package: '@fontsource/rubik@5.2.5', weights: WEIGHTS, files: fontHashes }, results }, null, 2) + '\n');
console.log(`\nfonts: one static set on every page (${[...fontSets][0]}), ${Object.keys(fontHashes).length} files hashed`);
console.log(`${failures} failure(s) on AFTER across ${JOBS.length} screens (${JOBS.length * 2} renders)`);
process.exit(failures ? 1 : 0);
