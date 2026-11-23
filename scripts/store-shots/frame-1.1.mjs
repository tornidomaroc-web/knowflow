/**
 * THE iOS 1.1 FRAME (item 4i, PR 1): the App Store screenshot in design C's
 * light theme, at either size App Store Connect takes for iPhone:
 *   1320 x 2868  "iPhone with Dynamic Island (large display)" (APP_IPHONE_67)
 *   1206 x 2622  "iPhone with Dynamic Island (medium display)", the size
 *                Apple's screenshot specifications name as required.
 * Called by render.mjs --set 1.1; see its header for the flags.
 *
 * ONE TEMPLATE. Every length is the 1320-wide design times s = W / 1320. The
 * screen is screenW = round(1000 s) wide and round(screenW x 2868 / 1320)
 * tall, the capture's own shape, so a capture is scaled, never stretched; the
 * 2622 / 2868 height difference the scale leaves (1.7 px at 1206) is ground
 * under the phone.
 *
 * THE LOOK. Ground #f4ede1 (design C's light page) under a soft clay
 * gradient; caption ink #1a1611 and the gold phrase in design C's light
 * accent text #7a580e (src/app/globals.css --accent-text), 15.5:1 and 5.6:1
 * on the ground; the KnowFlow mark above. The phone is a plain light clay
 * slab with a hairline edge: no island, no notch, no button, no Apple mark.
 *
 * THE CAPTION'S CHECKS, from the layout probe in the page (all at the size
 * being drawn):
 *   - Rubik loaded; the screen image at 1320 x 2868; caption 1 or 2 lines,
 *     no overflow, ending at least 32 px above the phone; the gold phrase in
 *     one fragment; Arabic letters joined (as in the 1.0.1 set);
 *   - (i) no word alone on a line of a two-line caption;
 *   - (ii) no phrase of src/lib/keep-together.ts KEEP_TOGETHER split across
 *     two lines (its words are joined by no-break spaces, as the app does);
 *   - (iv) in an Arabic caption, every Latin run is drawn in its own
 *     left-to-right isolate (<bdi dir=ltr>, the #316 LatinText rule).
 * (iii), the contrast of the ink and the gold read from the rendered pixels,
 * is scripts/store-shots/contrast.py, from the rectangles written to
 * <out>/_layout/<locale>-<file>.json.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESIGNED = join(ROOT, 'docs', 'store', 'screenshots-designed');
const OLD_RAW = join(ROOT, 'docs', 'store', 'screenshots');
// Where PR 2's capture will put the 1.1 raw screens (1320 x 2868, Pro Max).
const RAW_11 = join(ROOT, 'docs', 'store', 'screenshots-1.1');
const FONT = join(DESIGNED, 'fonts', 'rubik', 'Rubik[wght].ttf');
const BASE_W = 1320, CAP_W = 1320, CAP_H = 2868;
export const SIZES = { '1320x2868': [1320, 2868], '1206x2622': [1206, 2622] };

export const THEME = { ground: '#f4ede1', ink: '#1a1611', gold: '#7a580e' };

// The 1.0.1 raw captures that stand in for the 1.1 screens in a layout test
// (none shows the 1.1 app: there is no camera or English Ask capture yet).
export const STAND_IN = {
  en: { '01-subjects.png': '01-subjects.png', '02-material.png': '02-material.png', '03-camera.png': '02-material.png',
        '04-summary.png': '03-summary.png', '05-ask.png': '05-settings.png', '06-quiz.png': '04-quiz.png' },
  ar: { '01-subjects.png': '01-subjects.png', '02-material.png': '02-material.png', '03-camera.png': '02-material.png',
        '04-summary.png': '03-summary.png', '05-ask.png': '04-ask.png', '06-quiz.png': '05-settings.png' },
};

export const FORBIDDEN = /@|—|–|\$|\bfree\b|\bpro\b|\bplan\b|upgrade|price|مجان|الترقية|باقة|سعر/i;
export const PLATFORM = /\b(apple|iphone|ipad|ios|google|android|play store|app store)\b/i;

/** KEEP_TOGETHER, read from the app's own file, so the frame and the app hold the same list. */
export function keepTogetherList() {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'keep-together.ts'), 'utf8');
  const m = /export const KEEP_TOGETHER = \[(.*?)\] as const/s.exec(src);
  if (!m) throw new Error('KEEP_TOGETHER not found in src/lib/keep-together.ts');
  const list = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  if (!list.length) throw new Error('KEEP_TOGETHER is empty');
  return list;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LATIN = /[A-Za-z0-9][A-Za-z0-9.&'’-]*/g;

/**
 * The caption as HTML: every word its own span (the probe measures lines by
 * word), the parts outside the gold phrase in .ink spans, the gold phrase in
 * <b>; the words of a KEEP_TOGETHER phrase joined by no-break spaces and
 * tagged data-keep; in Arabic every Latin run in <bdi dir="ltr">.
 * `plant` breaks one rule on purpose.
 */
function captionHtml(locale, caption, keep, plant) {
  const parts = caption.split('|');
  if (parts.length !== 3) throw new Error(`caption needs two | markers: ${caption}`);
  const rtl = locale === 'ar';
  let words = [];
  parts.forEach((part, pi) => {
    for (const w of part.split(' ').filter(Boolean)) words.push({ w, gold: pi === 1 });
  });
  // KEEP_TOGETHER phrases, matched on whole words (trailing punctuation
  // aside); the first word may carry a prefix, as keepTogether() allows
  // (a phrase inside a longer word is matched there too).
  const norm = (w) => w.replace(/[.,!?:;،؛؟]+$/u, '');
  keep.forEach((phrase, k) => {
    const pw = phrase.split(' ');
    for (let i = 0; i + pw.length <= words.length; i++) {
      if (pw.every((p, j) => (j === 0 ? norm(words[i + j].w).endsWith(p) : norm(words[i + j].w) === p))) {
        for (let j = 0; j < pw.length; j++) { words[i + j].keep = `${k}:${i}`; words[i + j].glue = j < pw.length - 1; }
      }
    }
  });
  const word = (x, i) => {
    // Latin runs are cut out before escaping, so an entity is never split.
    let inner = '', at = 0;
    if (rtl && plant !== 'latin') {
      for (const m of x.w.matchAll(LATIN)) { inner += esc(x.w.slice(at, m.index)) + `<bdi dir="ltr" class="latin">${esc(m[0])}</bdi>`; at = m.index + m[0].length; }
    }
    inner += esc(x.w.slice(at));
    const brk = (plant === 'orphan' && i === words.length - 1) || (plant === 'split' && x.splitBefore) ? '<br>' : '';
    return `${brk}<span class="w"${x.keep ? ` data-keep="${x.keep}"` : ''}>${inner}</span>`;
  };
  if (plant === 'split') {
    const k = words.findIndex((x, i) => x.keep && words[i + 1] && words[i + 1].keep === x.keep);
    if (k < 0) throw new Error('split plant: the caption holds no KEEP_TOGETHER phrase');
    words[k + 1].splitBefore = true; words[k].glue = false;
  }
  let html = '', open = null;
  words.forEach((x, i) => {
    const kind = x.gold ? 'gold' : 'ink';
    if (kind !== open) {
      if (open) html += open === 'gold' ? '</b>' : '</span>';
      if (i) html += ' ';
      html += kind === 'gold' ? '<b>' : '<span class="ink">';
      open = kind;
    } else if (i) html += words[i - 1].glue ? '\u00A0' : ' ';
    html += word(x, i);
  });
  html += open === 'gold' ? '</b>' : '</span>';
  return html;
}

function page11({ locale, caption, shot, W, H, plant, keep }) {
  const s = W / BASE_W;
  const px = (v) => Math.round(v * s);
  const rtl = locale === 'ar';
  const screenW = px(1000), screenH = Math.round(screenW * CAP_H / CAP_W);
  const bezel = px(16), phoneW = screenW + 2 * bezel, phoneH = screenH + 2 * bezel;
  const phoneTop = px(596), phoneLeft = Math.round((W - phoneW) / 2);
  const ink = plant === 'ink-light' ? '#b3a48e' : THEME.ink;
  const gold = plant === 'gold-old' ? '#d4a548' : THEME.gold;
  const font = pathToFileURL(FONT).href;
  const geometry = { s, screen: { x: phoneLeft + bezel, y: phoneTop + bezel, w: screenW, h: screenH, r: px(140) }, phone: { x: phoneLeft, y: phoneTop, w: phoneW, h: phoneH } };
  return { geometry, html: `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "Rubik"; src: url("${font}") format("truetype"); font-weight: 300 900; font-display: block; }
html, body { margin: 0; padding: 0; overflow: hidden; }
body { width: ${W}px; height: ${H}px; background: ${THEME.ground}; font-family: "Rubik", sans-serif; font-synthesis: none; color: ${ink}; position: relative; }
.canvas { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
.ground { position: absolute; inset: 0; background:
  radial-gradient(${px(900)}px ${px(700)}px at ${rtl ? '16%' : '84%'} 3%, rgba(235,174,53,0.16), rgba(235,174,53,0) 70%),
  radial-gradient(${px(1100)}px ${px(900)}px at ${rtl ? '92%' : '8%'} 94%, rgba(176,138,96,0.16), rgba(176,138,96,0) 70%),
  linear-gradient(180deg, #f8f2e8 0%, ${THEME.ground} 45%, #ede3d2 100%); }
.mark { position: absolute; top: ${px(132)}px; left: 0; right: 0; text-align: center; font-weight: 600; font-size: ${px(46)}px; letter-spacing: ${(0.5 * s).toFixed(2)}px; color: rgba(26,22,17,0.72); }
.mark b { font-weight: 700; color: ${THEME.gold}; }
.band { position: absolute; top: ${px(241)}px; height: ${px(351)}px; left: ${px(90)}px; right: ${px(90)}px; display: flex; align-items: center; justify-content: center; }
.caption { margin: 0; width: 100%; text-align: center; font-weight: 700; font-size: ${px(112)}px; line-height: 1.12; letter-spacing: ${rtl ? '0' : (-1.5 * s).toFixed(2) + 'px'}; text-wrap: balance; color: ${ink}; }
.caption b { font-weight: 700; color: ${gold}; white-space: nowrap; }
.caption bdi.latin { unicode-bidi: isolate; }
.phone { position: absolute; left: ${phoneLeft}px; top: ${phoneTop}px; width: ${phoneW}px; height: ${phoneH}px; border-radius: ${px(156)}px;
  background: linear-gradient(160deg, #efe6d8 0%, #e6dac8 100%);
  box-shadow: 0 0 0 ${Math.max(2, px(3))}px #d6c8b3, inset 0 ${Math.max(1, px(2))}px 0 rgba(255,255,255,0.7), 0 ${px(50)}px ${px(110)}px rgba(90,68,38,0.20); }
.screen { position: absolute; left: ${bezel}px; top: ${bezel}px; width: ${screenW}px; height: ${screenH}px; border-radius: ${px(140)}px; overflow: hidden; background: ${THEME.ground}; }
.screen img { display: block; width: ${screenW}px; height: ${screenH}px; }
</style>
</head>
<body>
<div class="canvas">
<div class="ground"></div>
<div class="mark" dir="ltr">Know<b>Flow</b></div>
<div class="band"><h1 class="caption">${captionHtml(locale, caption, keep, plant)}</h1></div>
<div class="phone"><div class="screen"><img src="${shot}" alt=""></div></div>
</div>
<script>
(async () => {
  await document.fonts.ready;
  const img = document.querySelector('.screen img');
  if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
  const cap = document.querySelector('.caption'), gold = cap.querySelector('b');
  const c = cap.getBoundingClientRect(), p = document.querySelector('.phone').getBoundingClientRect();
  const width = (t) => { const s = document.createElement('span'); s.style.font = getComputedStyle(cap).font; s.style.whiteSpace = 'nowrap'; s.style.position = 'absolute'; s.style.visibility = 'hidden'; s.textContent = t; document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
  const text = cap.textContent;
  const lh = parseFloat(getComputedStyle(cap).lineHeight);
  const rect = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  const lineOf = (r) => Math.floor((r.top + r.height / 2 - c.top) / lh);
  const words = [...cap.querySelectorAll('.w')].map((w) => { const r = w.getBoundingClientRect(); return { t: w.textContent, line: lineOf(r), keep: w.dataset.keep || null }; });
  const latin = [];
  const walk = document.createTreeWalker(cap, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!/[A-Za-z0-9]/.test(n.data)) continue;
    const el = n.parentElement;
    const st = getComputedStyle(el);
    latin.push({ t: n.data, isolated: el.tagName === 'BDI' && el.getAttribute('dir') === 'ltr' && /isolate/.test(st.unicodeBidi) && st.direction === 'ltr' });
  }
  const out = {
    rubikLoaded: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Rubik' && f.status === 'loaded'),
    imgW: img.naturalWidth, imgH: img.naturalHeight,
    capTop: c.top, capBottom: c.bottom, capLeft: c.left, capRight: c.right, phoneTop: p.top, phoneBottom: p.bottom,
    lines: Math.round(c.height / lh), overflowX: cap.scrollWidth > cap.clientWidth,
    // The gold phrase's words are spans, so <b> has one box per word: its
    // fragments are the distinct lines its words sit on.
    goldFragments: gold ? new Set([...gold.querySelectorAll('.w')].map((w) => lineOf(w.getBoundingClientRect()))).size : 0,
    joinedWidth: width(text), isolatedWidth: width([...text].join('\\u200c')),
    words, latin,
    inkRects: [...cap.querySelectorAll('.ink .w')].map((w) => rect(w.getBoundingClientRect())),
    goldRects: gold ? [...gold.querySelectorAll('.w')].map((w) => rect(w.getBoundingClientRect())) : [],
  };
  const o = document.createElement('pre'); o.id = 'layout'; o.textContent = JSON.stringify(out); document.body.appendChild(o);
})();
</script>
</body>
</html>` };
}

function chromeRun(chrome, W, H, extra, html) {
  return spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, '--virtual-time-budget=4000', ...extra, pathToFileURL(html).href],
  { encoding: 'utf8', timeout: 90000, maxBuffer: 64 << 20 });
}

function measure(chrome, W, H, html) {
  const r = chromeRun(chrome, W, H, ['--dump-dom'], html);
  const hit = /<pre id="layout">(.*?)<\/pre>/s.exec(r.stdout || '');
  if (!hit) { console.error(r.stderr); throw new Error(`no layout probe output for ${html}`); }
  return JSON.parse(hit[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
}

/** Every problem of one render, each starting with its check's name. */
export function problems11(locale, m, W) {
  const p = [];
  if (!m.rubikLoaded) p.push('font: Rubik did not load');
  if (m.imgW !== CAP_W || m.imgH !== CAP_H) p.push(`screen: capture not loaded at ${CAP_W} x ${CAP_H} (got ${m.imgW} x ${m.imgH})`);
  if (m.capBottom > m.phoneTop - 32) p.push(`clearance: caption bottom ${m.capBottom} is within 32 px of the phone (top ${m.phoneTop})`);
  if (m.capLeft < 0 || m.capRight > W || m.overflowX) p.push('overflow: caption overflows the canvas width');
  if (m.lines < 1 || m.lines > 2) p.push(`lines: caption sets on ${m.lines} lines (1 or 2 allowed)`);
  if (m.goldFragments !== 1) p.push(`gold: gold phrase in ${m.goldFragments} fragments (1 required)`);
  if (locale === 'ar' && !(m.isolatedWidth - m.joinedWidth > 0.05 * m.joinedWidth)) p.push(`joined: Arabic letters not joined (joined ${m.joinedWidth}, isolated ${m.isolatedWidth})`);
  // (i) a word alone on a line.
  const per = {};
  for (const w of m.words) per[w.line] = (per[w.line] || 0) + 1;
  const counts = Object.values(per);
  if (counts.length > 1 && counts.some((n) => n === 1)) p.push(`orphan: a word alone on a line (words per line ${JSON.stringify(per)})`);
  // (ii) a KEEP_TOGETHER phrase across two lines.
  const groups = {};
  for (const w of m.words) if (w.keep) (groups[w.keep] = groups[w.keep] || []).push(w);
  for (const g of Object.values(groups)) if (new Set(g.map((w) => w.line)).size > 1) p.push(`keep: "${g.map((w) => w.t).join(' ')}" splits across lines`);
  // (iv) Latin runs in an Arabic caption isolated.
  if (locale === 'ar') for (const l of m.latin) if (!l.isolated) p.push(`latin: "${l.t}" is not in a left-to-right isolate`);
  return p;
}

function insideRepo(dir) {
  const r = relative(ROOT, resolve(dir));
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
}

function renderOne({ chrome, tmp, outRoot, locale, entry, raw, W, H, plant, keep, layoutExtra }) {
  const shot = pathToFileURL(raw).href;
  const { html, geometry } = page11({ locale, caption: entry.caption, shot, W, H, plant, keep });
  const file = join(tmp, `${plant || 'set'}-${locale}-${entry.file}.html`);
  writeFileSync(file, html);
  const outDir = join(outRoot, locale);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, entry.file);
  const r = chromeRun(chrome, W, H, ['--run-all-compositor-stages-before-draw', `--screenshot=${out}`], file);
  if (r.status !== 0 || !existsSync(out)) { console.error(r.stdout, r.stderr); throw new Error(`Chrome did not write ${out}`); }
  const m = measure(chrome, W, H, file);
  const lay = join(outRoot, '_layout');
  mkdirSync(lay, { recursive: true });
  writeFileSync(join(lay, `${locale}-${entry.file}.json`), JSON.stringify({ set: '1.1', locale, file: entry.file, size: [W, H], raw: relative(ROOT, raw).split('\\').join('/'), ...layoutExtra, geometry, layout: m }, null, 1));
  return { m, problems: problems11(locale, m, W), out };
}

// The planted cases: each must be caught by exactly the check it names.
// Layout plants are asserted here; contrast plants by contrast.py --expect-fail.
const PLANTS = [
  { name: 'orphan', locale: 'en', from: '01-subjects.png', expect: 'orphan' },
  { name: 'split', locale: 'en', caption: 'Start from a ready question |today|', expect: 'keep', note: 'the gold <b> is nowrap, so the phrase is planted in ink' },
  { name: 'latin', locale: 'ar', from: '01-subjects.png', append: ' KnowFlow', expect: 'latin' },
  { name: 'latin-isolated', locale: 'ar', from: '01-subjects.png', append: ' KnowFlow', expect: null, note: 'positive control: the same Latin run, isolated, passes' },
  { name: 'gold-old', locale: 'en', from: '04-summary.png', expect: 'contrast' },
  { name: 'ink-light', locale: 'en', from: '04-summary.png', expect: 'contrast' },
];

export async function run11({ args, opt, chrome }) {
  const size = opt('--size') || '1320x2868';
  if (!SIZES[size]) throw new Error(`--size must be one of ${Object.keys(SIZES).join(', ')}`);
  const [W, H] = SIZES[size];
  const layoutTest = args.includes('--layout-test');
  const plants = args.includes('--plants');
  const outArg = opt('--out');
  if (!outArg) throw new Error('--set 1.1 needs --out');
  const outRoot = resolve(outArg);
  // A stand-in render shows the old app: it must never land in the repository.
  if ((layoutTest || plants) && insideRepo(outRoot)) throw new Error(`--layout-test and --plants write outside the repository (got ${outRoot})`);
  const captions = JSON.parse(readFileSync(join(DESIGNED, 'captions-1.1.json'), 'utf8'));
  const keep = keepTogetherList();
  const only = (opt('--only') || '').split(',').filter(Boolean);
  const tmp = mkdtempSync(join(tmpdir(), 'kf-shots-11-'));
  const rawOf = (locale, file) => (layoutTest || plants) ? join(OLD_RAW, locale, STAND_IN[locale][file]) : join(RAW_11, locale, file);

  if (plants) {
    let bad = 0;
    for (const pl of PLANTS) {
      const base = pl.from ? captions[pl.locale].find((e) => e.file === pl.from) : null;
      const entry = { file: `${pl.name}.png`, caption: pl.caption || (base.caption + (pl.append || '')) };
      const plant = pl.name === 'latin-isolated' ? null : pl.name;
      const raw = rawOf(pl.locale, pl.from || '01-subjects.png');
      const { problems } = renderOne({ chrome, tmp, outRoot: join(outRoot, pl.name), locale: pl.locale, entry, raw, W, H, plant, keep, layoutExtra: { plant: pl.name, expect: pl.expect } });
      if (pl.expect === 'contrast') {
        console.log(`plant ${pl.name} (${size}): rendered for contrast.py --expect-fail; layout problems ${JSON.stringify(problems)}`);
        continue;
      }
      const hit = pl.expect ? problems.some((x) => x.startsWith(pl.expect + ':')) : !problems.some((x) => x.startsWith('latin:'));
      console.log(`${hit ? 'ok  ' : 'FAIL'} plant ${pl.name} (${size}): ${pl.expect ? `caught by "${pl.expect}"` : 'passes the latin check'}: ${JSON.stringify(problems)}`);
      if (!hit) bad++;
    }
    if (bad) throw new Error(`${bad} plant(s) not caught`);
    return;
  }

  let n = 0, bad = 0;
  for (const locale of ['en', 'ar']) {
    for (const entry of captions[locale]) {
      const key = `${locale}/${entry.file}`;
      if (only.length && !only.includes(key)) continue;
      if (FORBIDDEN.test(entry.caption)) throw new Error(`forbidden word or dash in caption: ${key}`);
      if (PLATFORM.test(entry.caption)) throw new Error(`platform or store name in caption: ${key}`);
      const raw = rawOf(locale, entry.file);
      if (!existsSync(raw)) throw new Error(`no raw capture ${relative(ROOT, raw)} (PR 2's capture writes the 1.1 screens; use --layout-test until then)`);
      const { m, problems } = renderOne({ chrome, tmp, outRoot, locale, entry, raw, W, H, plant: null, keep, layoutExtra: { standIn: layoutTest } });
      console.log(`layout ${size} ${key}: lines ${m.lines}, words per line ${JSON.stringify(m.words.reduce((a, w) => ({ ...a, [w.line]: (a[w.line] || 0) + 1 }), {}))}, gold fragments ${m.goldFragments}, caption bottom ${Math.round(m.capBottom)} / phone top ${Math.round(m.phoneTop)}`);
      if (problems.length) { console.log(`FAIL ${size} ${key}: ${problems.join('; ')}`); bad++; } else console.log(`ok   ${size} ${key}${layoutTest ? ' (stand-in screen)' : ''}`);
      n++;
    }
  }
  if (!n) throw new Error('nothing rendered');
  if (bad) throw new Error(`${bad} render(s) failed a layout check`);
}
