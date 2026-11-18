/**
 * THE CAMERA SCREEN'S ENCODER, IN A REAL BROWSER (src/lib/page-photo-encode.ts,
 * rule 1 of src/lib/page-photos.ts): a photo as the camera stores it goes in,
 * and what comes out must be
 *   - UPRIGHT: the page's red heading band at the top and its green margin on
 *     the left, read from the output's own pixels, whatever EXIF orientation
 *     the input carried (1, 3, 6 and 8: the four a phone writes);
 *   - 2300 px on the long side (1533 x 2300 for a 2000 x 3000 page), and a
 *     small photo never enlarged;
 *   - a BASELINE JPEG (its first frame header is SOF0), the only kind the
 *     route accepts besides PNG;
 *   - WITHOUT metadata: no APP1 Exif segment (no GPS, no device, no tag left
 *     to turn it a second time).
 *
 * The inputs are made here, in the page: the upright page is drawn, then
 * turned by hand (ctx.rotate, written out per orientation below, NOT the
 * module's own transform, so a wrong transform cannot cancel itself), encoded
 * by the browser, and given an EXIF segment by this script's own bytes.
 *
 * The real module is served from memory to a page at http://kf.proof/
 * (request interception: no server, no port, no network), transpiled with the
 * project's TypeScript. Chromium through puppeteer-core, as design-c runs it.
 * WebKit is not driven here (puppeteer cannot); the module measures whether
 * the decoder applies EXIF itself and handles both answers, and this proof
 * runs BOTH paths: the browser's own on real files, and the module's own
 * transform (`encodeUpright`) on stored pixels no decoder has turned, for all
 * eight orientations.
 *
 * Usage: CHROME=<chrome> PUPPETEER_DIR=<dir with puppeteer-core> node scripts/verify-page-photo-encode.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;
const check = (ok, msg) => {
  if (ok) { passed += 1; console.log(`  OK    ${msg}`); } else { failures.push(msg); console.log(`  FAIL  ${msg}`); }
};

// The engine: Chromium through puppeteer-core (CI, as design-c), or, when
// KF_ENGINE=webkit and PLAYWRIGHT_DIR names a folder with playwright-core,
// Playwright's WebKit (closer to the phone's engine; a local extra run).
const ENGINE = process.env.KF_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const req = createRequire(join(resolve((ENGINE === 'webkit' ? process.env.PLAYWRIGHT_DIR : process.env.PUPPETEER_DIR) || '.'), 'noop.js'));
const ts = createRequire(join(ROOT, 'package.json'))('typescript');

const MODULES = ['page-reader', 'page-photos', 'page-photo-encode'];
const served = {};
for (const m of MODULES) {
  const p = join(ROOT, 'src/lib', `${m}.ts`);
  if (!existsSync(p)) { check(false, `src/lib/${m}.ts exists`); continue; }
  const out = ts.transpileModule(readFileSync(p, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  served[`/lib/${m}.js`] = out.replace(/from '@\/lib\/([a-z-]+)'/g, "from '/lib/$1.js'").replace(/import type [^;]+;/g, '');
}
// A page that loads the module and exposes a runner; `force` (when set)
// replaces the decoder-orientation answer, to run the other path.
served['/index.html'] = `<!doctype html><meta charset="utf-8"><script type="module">
import * as enc from '/lib/page-photo-encode.js';
window.__enc = enc;
window.__ready = true;
</script>`;

if (failures.length) finish();

const answer = (url) => {
  const u = new URL(url);
  if (u.host !== 'kf.proof') return null;
  const body = served[u.pathname === '/' ? '/index.html' : u.pathname];
  return body === undefined
    ? { status: 404, contentType: 'text/plain', body: 'no' }
    : { status: 200, contentType: u.pathname.endsWith('.js') ? 'text/javascript' : 'text/html', body };
};
let browser;
let page;
if (ENGINE === 'webkit') {
  const { webkit } = req('playwright-core');
  browser = await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {});
  page = await browser.newPage();
  await page.route('**/*', (route) => { const a = answer(route.request().url()); return a ? route.fulfill(a) : route.abort(); });
} else {
  const puppeteer = req('puppeteer-core');
  browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => { const a = answer(r.url()); return a ? r.respond(a) : r.abort(); });
}
try {
  page.on('pageerror', (e) => check(false, `no error in the page: ${e.message}`));
  await page.goto('http://kf.proof/index.html');
  await page.waitForFunction('window.__ready === true', { timeout: 10000 });
  const ua = await page.evaluate(() => navigator.userAgent);
  console.log(`browser: ${ua}`);

  const results = await page.evaluate(async () => {
    const enc = window.__enc;
    const blob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
    // The upright page: white, a red heading band across the top, a green
    // margin down the left below it.
    function upright(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ff0000'; x.fillRect(0, 0, w, Math.round(h * 0.1));
      x.fillStyle = '#00c000'; x.fillRect(0, Math.round(h * 0.1), Math.round(w * 0.15), h);
      return c;
    }
    // The STORED image for orientation o: the upright page turned so that a
    // viewer applying o sees it upright. Written out by hand per case.
    function stored(u, o) {
      const swap = o >= 5;
      const c = document.createElement('canvas');
      c.width = swap ? u.height : u.width;
      c.height = swap ? u.width : u.height;
      const x = c.getContext('2d');
      if (o === 3) { x.translate(c.width, c.height); x.rotate(Math.PI); }
      // 6: the viewer turns the stored image a quarter clockwise, so it is
      // stored a quarter counter-clockwise; 8 the other way.
      if (o === 6) { x.translate(0, c.height); x.rotate(-Math.PI / 2); }
      if (o === 8) { x.translate(c.width, 0); x.rotate(Math.PI / 2); }
      // The mirrored four (no camera writes them, but EXIF has them).
      if (o === 2) { x.translate(c.width, 0); x.scale(-1, 1); }
      if (o === 4) { x.translate(0, c.height); x.scale(1, -1); }
      if (o === 5) { x.rotate(Math.PI / 2); x.scale(1, -1); }
      if (o === 7) { x.translate(c.width, c.height); x.rotate(Math.PI / 2); x.scale(-1, 1); }
      x.drawImage(u, 0, 0);
      return c;
    }
    function withExif(bytes, o) {
      const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o, 0, 0, 0, 0, 0, 0, 0];
      const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
      const len = body.length + 2;
      const seg = [0xff, 0xe1, len >> 8, len & 255, ...body];
      const out = new Uint8Array(bytes.length + seg.length);
      out.set(bytes.subarray(0, 2), 0); out.set(seg, 2); out.set(bytes.subarray(2), 2 + seg.length);
      return out;
    }
    function frame(b) {
      let i = 2, exif = false, sof = 0;
      while (i + 3 < b.length) {
        if (b[i] !== 0xff) break;
        const m = b[i + 1];
        if (m === 0xda || m === 0xd9) break;
        const len = (b[i + 2] << 8) | b[i + 3];
        if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78) exif = true;
        if (!sof && m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) sof = m;
        i += 2 + len;
      }
      return { exif, sof };
    }
    async function sample(outBlob) {
      const bmp = await createImageBitmap(outBlob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d');
      x.drawImage(bmp, 0, 0);
      const at = (fx, fy) => {
        const [r, g, b] = x.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data;
        if (r > 180 && g < 90 && b < 90) return 'red';
        if (g > 140 && r < 110 && b < 110) return 'green';
        if (r > 215 && g > 215 && b > 215) return 'white';
        return `rgb(${r},${g},${b})`;
      };
      return { w: bmp.width, h: bmp.height, top: at(0.5, 0.03), topRight: at(0.97, 0.03), left: at(0.04, 0.6), right: at(0.96, 0.6), bottom: at(0.5, 0.97) };
    }
    async function run(o, w, h, type) {
      const u = upright(w, h);
      const s = stored(u, o);
      let bytes = new Uint8Array(await (await blob(s, type, 0.95)).arrayBuffer());
      if (type === 'image/jpeg' && o !== 1) bytes = withExif(bytes, o);
      const input = new Blob([bytes], { type });
      const out = await enc.reencodePagePhoto(input);
      const ob = new Uint8Array(await out.blob.arrayBuffer());
      return { o, w, h, type, inW: s.width, inH: s.height, ...frame(ob), ...(await sample(out.blob)), reported: [out.width, out.height] };
    }
    // THE OTHER PATH: pixels as stored, which no decoder has turned (a
    // canvas carries no EXIF), drawn upright by the module's own transform,
    // all eight orientations.
    async function forced(o, w, h) {
      const s = stored(upright(w, h), o);
      const out = await enc.encodeUpright({ source: s, width: s.width, height: s.height, close() {} }, o);
      const ob = new Uint8Array(await out.blob.arrayBuffer());
      return { o, w, h, type: 'forced', inW: s.width, inH: s.height, ...frame(ob), ...(await sample(out.blob)), reported: [out.width, out.height] };
    }
    const applies = await enc.decoderAppliesOrientation();
    const cases = [];
    for (const o of [1, 2, 3, 4, 5, 6, 7, 8]) cases.push(await forced(o, 2000, 3000));
    for (const o of [1, 3, 6, 8]) cases.push(await run(o, 2000, 3000, 'image/jpeg'));
    cases.push(await run(1, 2000, 3000, 'image/png'));
    cases.push(await run(6, 600, 800, 'image/jpeg'));
    return { applies, cases };
  });

  console.log(`\nthis browser's decoder applies EXIF orientation itself: ${results.applies}`);
  for (const c of results.cases) {
    const label = `${c.type === 'forced' ? 'stored pixels, the module transform,' : c.type === 'image/png' ? 'PNG' : 'JPEG'} orientation ${c.o}, stored ${c.inW} x ${c.inH}`;
    const big = c.w2 === undefined && c.h > 1000;
    check(c.top === 'red' && c.topRight === 'red' && c.left === 'green' && c.right === 'white' && c.bottom === 'white',
      `${label}: upright (top ${c.top}, top-right ${c.topRight}, left ${c.left}, right ${c.right}, bottom ${c.bottom})`);
    check(big ? c.w === 1533 && c.h === 2300 : c.w === 600 && c.h === 800, `${label}: ${c.w} x ${c.h} (${big ? 'long side 2300' : 'not enlarged'})`);
    check(c.reported[0] === c.w && c.reported[1] === c.h, `${label}: the size the module reports is the file's`);
    check(c.sof === 0xc0, `${label}: baseline JPEG (first frame header 0x${c.sof.toString(16)})`);
    check(c.exif === false, `${label}: no EXIF segment in the output`);
  }
} finally {
  await browser.close();
}
finish();

function finish() {
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  ! ${f}`);
    process.exit(1);
  }
  process.exit(0);
}
