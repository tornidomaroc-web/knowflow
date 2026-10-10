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
const FORBIDDEN = /—|–|\$|\bfree\b|\bpro\b|\bplan\b|upgrade|price|مجان|الترقية|باقة|سعر/i;

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
.caption { position: absolute; top: 216px; left: 90px; right: 90px; text-align: center; font-weight: 700; font-size: 112px; line-height: 1.12; letter-spacing: ${rtl ? '0' : '-1.5px'}; }
.caption b { font-weight: 700; color: #d4a548; }
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
<h1 class="caption">${esc(a)}<b>${esc(gold)}</b>${esc(b)}</h1>
<div class="phone"><div class="screen"><img src="${shot}" alt=""></div></div>
</div>
</body>
</html>`;
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
    console.log(`rendered ${key} -> ${out.split(sep).slice(-4).join('/')}`);
    n++;
  }
}
if (!n) throw new Error('nothing rendered');
