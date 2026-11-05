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
// About's own copy is outside this PR; its lines are read in the header and
// footer it shares with the landing, which this PR restyles.
add('about-web', 'about', {}, SAFARI, { lineScope: 'header, footer' });
const byKey = (k) => SCREENS.find((x) => x.key === k);

// KNOWN, NAMED AND REPORTED, NOT FAILED: a finding in a part of a screen this
// PR may not touch. Each is printed and written to the report under `known`,
// with its reason; nothing else is let through.
const KNOWN = [
  {
    screen: /-subject-app$/,
    finding: /^lines: one word alone \("Summarize"\) in div "Summarize this material"$/,
    why: "the Summary section's own button (src/components/summary/SummarySection.tsx), off limits in PR 2; three words in a 158 pt half-row cannot avoid a word alone. For PR 3 with the material cards.",
  },
];

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
  // The whole page as ONE tall viewport, not a stitched fullPage capture: a
  // stitched capture paints the fixed tab bar where the first viewport ended,
  // over the content (the first run of this step). With the viewport as tall
  // as the document, fixed bars sit at the page's real bottom.
  const file = join(out, side, `${job.name}.png`);
  const tall = await tab.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await tab.setViewport({ ...job.s.view, height: Math.max(job.s.view.height, tall) });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.screenshot({ path: file });
  await ctx.close();
  return { url, landed, status: res.status(), fonts, anim, theme, a, home, lines, gate, tiles };
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
