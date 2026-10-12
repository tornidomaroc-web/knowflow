/**
 * Renders the designed App Store screenshots (docs/store/screenshots-designed):
 * for each entry of captions.json, a static HTML page is written with the raw
 * capture from docs/store/screenshots inside a frame drawn in CSS, a caption
 * above it in Rubik (the app's own font, OFL, docs/store/screenshots-designed/
 * fonts/rubik), on the brand ground (#14110d, the gold #d4a548 as the glow
 * and the highlighted words), and Chrome headless photographs it at exactly
 * 1320 x 2868. Chrome's --screenshot writes an 8-bit RGB PNG with no alpha
 * channel; scripts/store-shots/check.py refuses anything else.
 *
 * The frame is drawn here, not borrowed: a plain rounded slab with a thin edge
 * and no button, switch, notch or sensor housing, so it imitates no Apple
 * hardware detail (Apple's marketing guidelines forbid those on generic device
 * illustrations). The status bar inside the capture is the app's own screen.
 *
 * Usage:
 *   node scripts/store-shots/render.mjs [--only en/04-quiz.png,ar/04-ask.png] [--out DIR]
 * Env: CHROME = path to the Chrome or Chromium binary (default: google-chrome).
 * Tier 0: no network, no credential, no app server.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'docs', 'store', 'screenshots');
const DESIGNED = join(ROOT, 'docs', 'store', 'screenshots-designed');
const FONT = join(DESIGNED, 'fonts', 'rubik', 'Rubik[wght].ttf');
const W = 1320, H = 2868;

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = (opt('--only') || '').split(',').filter(Boolean);
const outRoot = opt('--out') ? resolve(opt('--out')) : DESIGNED;
const chrome = process.env.CHROME || 'google-chrome';

const captions = JSON.parse(readFileSync(join(DESIGNED, 'captions.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FORBIDDEN = /@|—|–|\$|\bfree\b|\bpro\b|\bplan\b|upgrade|price|مجان|الترقية|باقة|سعر/i;

function page(locale, entry) {
  const rtl = locale === 'ar';
  const [a, gold, b] = entry.caption.split('|');
  if (gold === undefined || b === undefined) throw new Error(`caption needs two | markers: ${entry.caption}`);
  if (FORBIDDEN.test(entry.caption)) throw new Error(`forbidden word or dash in caption: ${entry.caption}`);
  const shot = pathToFileURL(join(RAW, locale, entry.file)).href;
  const font = pathToFileURL(FONT).href;
  return `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "Rubik"; src: url("${font}") format("truetype"); font-weight: 300 900; font-display: block; }
html, body { margin: 0; padding: 0; overflow: hidden; }
.canvas { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
body { width: ${W}px; height: ${H}px; overflow: hidden; background: #14110d; font-family: "Rubik", sans-serif; font-synthesis: none; color: #f5f0e8; position: relative; }
.glow { position: absolute; inset: 0; background:
  radial-gradient(900px 700px at ${rtl ? '18%' : '82%'} 4%, rgba(212,165,72,0.30), rgba(212,165,72,0) 70%),
  radial-gradient(1100px 900px at ${rtl ? '92%' : '8%'} 92%, rgba(183,156,255,0.14), rgba(183,156,255,0) 70%),
  linear-gradient(180deg, #1a1611 0%, #14110d 55%, #0f0d0a 100%); }
.ring { position: absolute; width: 1700px; height: 1700px; border-radius: 50%; border: 2px solid rgba(212,165,72,0.10); ${rtl ? 'right' : 'left'}: -620px; top: 1500px; }
.ring2 { position: absolute; width: 1100px; height: 1100px; border-radius: 50%; border: 2px solid rgba(245,240,232,0.05); ${rtl ? 'left' : 'right'}: -420px; top: -300px; }
.mark { position: absolute; top: 132px; left: 0; right: 0; text-align: center; font-weight: 600; font-size: 46px; letter-spacing: 0.5px; color: rgba(245,240,232,0.70); }
.mark b { font-weight: 700; color: #d4a548; }
/* The caption band is centred on y 416.5, where the approved two-line samples
   sit, so a one-line caption lands mid-band instead of hugging the mark. */
.band { position: absolute; top: 241px; height: 351px; left: 90px; right: 90px; display: flex; align-items: center; justify-content: center; }
.caption { margin: 0; width: 100%; text-align: center; font-weight: 700; font-size: 112px; line-height: 1.12; letter-spacing: ${rtl ? '0' : '-1.5px'}; }
.caption { text-wrap: balance; }
.caption b { font-weight: 700; color: #d4a548; white-space: nowrap; }
.phone { position: absolute; left: 50%; top: 596px; transform: translateX(-50%); width: 1032px; height: 2241px; border-radius: 156px;
  background: #0b0a08; box-shadow: 0 0 0 3px #3a3430, 0 60px 120px rgba(0,0,0,0.65), 0 0 180px rgba(212,165,72,0.12); }
.screen { position: absolute; left: 16px; top: 16px; width: 1000px; height: 2173px; border-radius: 140px; overflow: hidden; background: #14110d; }
.screen img { display: block; width: 1000px; height: 2173px; }
</style>
</head>
<body>
<div class="canvas">
<div class="glow"></div><div class="ring"></div><div class="ring2"></div>
<div class="mark" dir="ltr">Know<b>Flow</b></div>
<div class="band"><h1 class="caption">${esc(a)}<b>${esc(gold)}</b>${esc(b)}</h1></div>
<div class="phone"><div class="screen"><img src="${shot}" alt=""></div></div>
</div>
<script>
// The layout probe, read back through --dump-dom (see measure below).
(async () => {
  await document.fonts.ready;
  const img = document.querySelector('.screen img');
  if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
  const cap = document.querySelector('.caption'), gold = cap.querySelector('b');
  const c = cap.getBoundingClientRect(), p = document.querySelector('.phone').getBoundingClientRect();
  const width = (t) => { const s = document.createElement('span'); s.style.font = getComputedStyle(cap).font; s.style.whiteSpace = 'nowrap'; s.style.position = 'absolute'; s.style.visibility = 'hidden'; s.textContent = t; document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
  const text = cap.textContent;
  const lineHeight = parseFloat(getComputedStyle(cap).lineHeight);
  const out = {
    rubikLoaded: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Rubik' && f.status === 'loaded'),
    imgW: img.naturalWidth, imgH: img.naturalHeight,
    capTop: c.top, capBottom: c.bottom, capLeft: c.left, capRight: c.right, phoneTop: p.top, phoneBottom: p.bottom,
    lines: Math.round(c.height / lineHeight), overflowX: cap.scrollWidth > cap.clientWidth,
    goldFragments: gold ? gold.getClientRects().length : 0,
    joinedWidth: width(text), isolatedWidth: width([...text].join('‌')),
  };
  const o = document.createElement('pre'); o.id = 'layout'; o.textContent = JSON.stringify(out); document.body.appendChild(o);
})();
</script>
</body>
</html>`;
}

// A second Chrome pass prints the DOM after the probe ran; the probe's JSON is
// in <pre id="layout">. Every check is about what a viewer sees at phone width.
function measure(html) {
  const r = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, '--virtual-time-budget=4000', '--dump-dom', pathToFileURL(html).href,
  ], { encoding: 'utf8', timeout: 90000, maxBuffer: 64 << 20 });
  const hit = /<pre id="layout">(.*?)<\/pre>/s.exec(r.stdout || '');
  if (!hit) { console.error(r.stderr); throw new Error(`no layout probe output for ${html}`); }
  return JSON.parse(hit[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
}

function layoutProblems(locale, m) {
  const p = [];
  if (!m.rubikLoaded) p.push('Rubik did not load');
  if (m.imgW !== W || m.imgH !== H) p.push(`raw capture not loaded at ${W} x ${H} (got ${m.imgW} x ${m.imgH})`);
  // The caption ends at least 32 px above the phone's edge, so it covers no app UI.
  if (m.capBottom > m.phoneTop - 32) p.push(`caption bottom ${m.capBottom} reaches the phone (top ${m.phoneTop})`);
  if (m.capLeft < 0 || m.capRight > W || m.overflowX) p.push('caption overflows the canvas width');
  if (m.lines < 1 || m.lines > 2) p.push(`caption sets on ${m.lines} lines (1 or 2 allowed)`);
  // The gold phrase is never broken across two lines.
  if (m.goldFragments !== 1) p.push(`gold phrase in ${m.goldFragments} fragments (1 required)`);
  if (m.phoneBottom > H) p.push('phone runs off the canvas bottom');
  // Arabic shaping: the joined caption is narrower than the same letters forced
  // apart with ZWNJ; equal widths would mean Chrome set isolated forms.
  if (locale === 'ar' && !(m.isolatedWidth - m.joinedWidth > 0.05 * m.joinedWidth)) p.push(`Arabic letters not joined (joined ${m.joinedWidth}, isolated ${m.isolatedWidth})`);
  return p;
}

const tmp = mkdtempSync(join(tmpdir(), 'kf-shots-'));
let n = 0;
for (const locale of ['en', 'ar']) {
  for (const entry of captions[locale]) {
    const key = `${locale}/${entry.file}`;
    if (only.length && !only.includes(key)) continue;
    const html = join(tmp, `${locale}-${entry.file}.html`);
    writeFileSync(html, page(locale, entry));
    const outDir = join(outRoot, locale);
    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, entry.file);
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--force-device-scale-factor=1', `--window-size=${W},${H}`,
      '--virtual-time-budget=4000', '--run-all-compositor-stages-before-draw',
      `--screenshot=${out}`, pathToFileURL(html).href,
    ], { encoding: 'utf8', timeout: 90000 });
    if (r.status !== 0 || !existsSync(out)) {
      console.error(r.stdout, r.stderr);
      throw new Error(`Chrome did not write ${out}`);
    }
    const m = measure(html);
    const problems = layoutProblems(locale, m);
    console.log(`layout ${key}: ${JSON.stringify(m)}`);
    if (problems.length) throw new Error(`${key}: ${problems.join('; ')}`);
    console.log(`rendered ${key} -> ${out.split(sep).slice(-4).join('/')}`);
    n++;
  }
}
if (!n) throw new Error('nothing rendered');
