/**
 * THE CAMERA SCREEN ("صوّر صفحاتك"), THE CLIENT HALF: what has to hold before
 * the app may offer the camera, proved without a phone, a browser, a network
 * or a credential. The browser half (decoding and re-encoding real JPEGs) is
 * scripts/verify-page-photo-encode.mjs; the server half was proved by
 * scripts/verify-page-reader.mjs (#332).
 *
 *  1. THE GATE. Build 8 (`KnowFlowApp/1`, live on the App Store) has no
 *     NSCameraUsageDescription, and iOS ends an app that opens the camera
 *     without one. So the camera tile renders ONLY for the app at shell 2 or
 *     later: the real DropZone is rendered (react-dom/server) under the real
 *     PlatformProvider for the web, shell 1 and shell 2, and the web and shell
 *     1 markup must be byte for byte what it is with no shell at all (today's
 *     UI). The marker is read from real user agents; the shell this commit
 *     builds says 2 (capacitor.config.ts and the iOS copy) and declares the
 *     purpose string in Info.plist and both .lproj files.
 *  2. THE KEYS. Every key the screen uploads matches the INSERT policy
 *     production has (the regex and the owner test are read from
 *     supabase/migrations/20261118_storage_lockdown_production.sql, applied
 *     by the owner), is inside the DELETE policy's prefix, and passes the
 *     route's own checkPhotoKeys, in page order p1.jpg to p10.jpg.
 *  3. ONE POST PER BATCH, A RETRY IS A NEW BATCH (sendPageBatch, driven with
 *     recording fakes): a good batch is uploaded once and posted once; an
 *     upload that fails is deleted and the photos go again under a NEW batch;
 *     no batch id is ever posted twice; giving up deletes every batch it made
 *     with the student's session; a non-2xx answer or no answer deletes the
 *     batch; the photos handed in are the very ones uploaded on the retry.
 *  4. THE PERMISSION. AI_CONSENT_VERSION stays 1; /api/page-read alone needs
 *     PAGE_READ_CONSENT_VERSION (2); a version-2 grant counts everywhere; the
 *     camera asks with { photos: true } and the sheet adds the photos line.
 *  5. ORIENTATION AND SIZE, the pure half: the EXIF reader (both byte
 *     orders), the transform that turns each of the 8 orientations upright
 *     (checked by moving the stored image's corners), the 2300 px fit, the
 *     baseline test.
 *  6. THE WORDS. Every new string in both languages: no em or en dash, no
 *     price, plan, upgrade, subscription or "free" word, Western digits,
 *     placeholders the same, and "صوّر صفحاتك" rendered on one line.
 *
 * On main this fails: the modules, the gate and the strings do not exist.
 *
 * Usage: node --experimental-strip-types scripts/verify-camera-screen.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const failures = [];
let passed = 0;
const check = (ok, msg) => {
  if (ok) { passed += 1; console.log(`  OK    ${msg}`); } else { failures.push(msg); console.log(`  FAIL  ${msg}`); }
};
const section = (t) => console.log(`\n${t}`);
async function load(p) {
  try { return await import(pathToFileURL(resolvePath(ROOT, p)).href); } catch (e) { check(false, `${p} loads (${String(e.message).split('\n')[0]})`); return null; }
}

installTsxHooks(ROOT, {
  // Nothing here talks to Supabase: the render never reaches a call.
  '@/lib/supabase/client': 'export function createClient(){ throw new Error("no Supabase in a proof"); }',
});
globalThis.__tsxHooksParams = { locale: 'en' };

const UID = '0b9d4c4e-6a51-4e8e-9d1f-2b7c1a3e5f60';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

// ---- 1. the gate -------------------------------------------------------------------------
section('1. The gate: the camera only for the app at shell 2 or later');
const platform = await load('src/lib/platform.ts');
if (platform) {
  const hdr = (h) => (n) => h[n.toLowerCase()] ?? null;
  const v = (ua, extra = {}) => platform.shellVersionFromHeaders?.(hdr({ 'user-agent': ua, ...extra }));
  check(typeof platform.shellVersionFromHeaders === 'function' && typeof platform.cameraAllowed === 'function', 'platform.ts reads the shell version and answers cameraAllowed');
  check(v(IPHONE) === 0, 'the web (no marker) is shell 0');
  check(v(`${IPHONE} KnowFlowApp/1`) === 1, 'build 8 (KnowFlowApp/1) is shell 1');
  check(v(`${IPHONE} KnowFlowApp/2`) === 2, 'this shell (KnowFlowApp/2) is shell 2');
  check(v(`${IPHONE} KnowFlowApp/12`) === 12, 'a later shell keeps its number (KnowFlowApp/12 is 12, not 1)');
  check(v(IPHONE, { 'x-kf-platform': 'native' }) === 1, 'the bare native header names no version: shell 1, no camera');
  check(v(`${IPHONE} KnowFlowApp`) === 0, 'the token without a version is not a shell');
  check(platform.cameraAllowed?.(0) === false && platform.cameraAllowed?.(1) === false, 'no camera for the web or shell 1');
  check(platform.cameraAllowed?.(2) === true && platform.cameraAllowed?.(3) === true, 'the camera from shell 2 on');
  check(platform.CAMERA_SHELL_VERSION === 2, 'the camera shell is 2');
}

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const pp = await load('src/components/platform/PlatformProvider.tsx');
const dz = await load('src/components/upload/DropZone.tsx');
if (pp && dz) {
  const h = React.createElement;
  const render = (plat, shell, extra = {}) => renderToStaticMarkup(
    h(pp.PlatformProvider, shell === undefined ? { platform: plat } : { platform: plat, shell }, h(dz.DropZone, { kbId: 'k', ...extra }))
  );
  const web = render('web', 0);
  const app1 = render('native', 1);
  const app2 = render('native', 2);
  const camera = /data-kf-upload="(add|sheet-camera)"|data-kf-camera/;
  check(/data-kf-upload="tile"/.test(web) && !camera.test(web), 'web: the file tile, no camera anywhere');
  check(/data-kf-upload="tile"/.test(app1) && !camera.test(app1), 'shell 1 (build 8): the file tile, no camera anywhere');
  check(web === render('web', undefined), 'web: the markup is exactly what it is with no shell given (today\'s UI)');
  check(app1 === render('native', undefined), 'shell 1: the markup is exactly what the app rendered before the shell was read');
  check(/data-kf-upload="add"/.test(app2) && !/data-kf-upload="tile"/.test(app2), 'shell 2: ONE button that opens the upload sheet, in place of the tile');
  const sheet2 = render('native', 2, { previewCamera: { open: 'choice' } });
  check(/data-kf-upload="sheet-file"/.test(sheet2) && /data-kf-upload="sheet-camera"/.test(sheet2), 'shell 2, the sheet open: the file tile and the camera tile');
  const sheet1 = render('native', 1, { previewCamera: { open: 'choice' } });
  const sheetW = render('web', 0, { previewCamera: { open: 'choice' } });
  check(!camera.test(sheet1) && !camera.test(sheetW), 'shell 1 and the web: no sheet and no camera even when a preview asks for it');
  const ui = read('src/components/upload/CameraPages.tsx');
  check(/accept="image\/\*"/.test(ui) && /capture="environment"/.test(ui) && /\bmultiple\b/.test(ui), 'the camera is <input type="file" accept="image/*" capture="environment" multiple> (no native plugin)');
}
const layout = read('src/app/[locale]/dashboard/layout.tsx');
check(/currentShellVersion\(\)/.test(layout) && /<PlatformProvider platform=\{platform\} shell=\{shell\}>/.test(layout), 'the dashboard layout reads the shell per request and hands it to the provider');
const cap = read('capacitor.config.ts');
check((cap.match(/appendUserAgent: 'KnowFlowApp\/2'/g) || []).length === 2 && !/KnowFlowApp\/1'/.test(cap), 'capacitor.config.ts: KnowFlowApp/2 on iOS and Android');
const capIos = read('ios/App/App/capacitor.config.json');
check((capIos.match(/"appendUserAgent": "KnowFlowApp\/2"/g) || []).length === 2, 'the iOS copy of the config (what the shell reads) says KnowFlowApp/2');
const plist = read('ios/App/App/Info.plist');
const purposes = plist.match(/<key>[A-Za-z]*UsageDescription<\/key>/g) || [];
check(purposes.length === 1 && purposes[0] === '<key>NSCameraUsageDescription</key>', 'Info.plist: exactly one purpose string, the camera\'s');
check(/<key>NSCameraUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/.test(plist), 'Info.plist: the camera\'s purpose string is a sentence');
for (const l of ['en', 'ar']) {
  check(/^"NSCameraUsageDescription" = "[^"]{20,}";$/m.test(read(`ios/App/App/${l}.lproj/InfoPlist.strings`)), `${l}.lproj: the camera's purpose string in that language`);
}
const smoke = read('.github/workflows/ios-smoke.yml');
check(/L\.get\("shell"\) == "2"/.test(smoke) && !/grep -q 'UsageDescription'; then echo "FAIL: a purpose string/.test(smoke), 'ios-smoke reads shell 2 in the page and allows the camera\'s purpose string alone');
check(!/grep -q 'UsageDescription'; then echo "FAIL: a purpose string/.test(read('.github/workflows/ios-testflight.yml')), 'ios-testflight no longer refuses the camera\'s purpose string');

// ---- 2. the keys -------------------------------------------------------------------------------
section('2. The keys match the storage policy production has');
const photos = await load('src/lib/page-photos.ts');
const reader = await load('src/lib/page-reader.ts');
const sql = read('supabase/migrations/20261118_storage_lockdown_production.sql');
const insert = /create policy "Students upload camera photos only"[\s\S]*?\);\s*$/m.exec(sql)?.[0] ?? '';
const nameRe = /name ~ '([^']+)'/.exec(insert)?.[1];
const del = /create policy "Students delete own camera photos"[\s\S]*?\);/.exec(sql)?.[0] ?? '';
check(Boolean(nameRe) && /split_part\(name, '\/', 1\) = \(select auth\.uid\(\)::text\)/.test(insert), 'the INSERT policy\'s key regex and owner test are read from the applied migration');
check(/starts_with\(name, \(select auth\.uid\(\)::text\) \|\| '\/page-photos\/'\)/.test(del), 'the DELETE policy\'s prefix is read from the applied migration');
if (photos && reader && nameRe) {
  const policy = new RegExp(nameRe); // POSIX ERE here is also a valid JS regex
  for (const n of [1, 3, 10]) {
    const batch = photos.newBatchId();
    const keys = photos.batchKeys(UID, batch, n);
    check(keys.every((k) => policy.test(k)), `${n} photo(s): every key matches the INSERT policy regex`);
    check(keys.every((k) => k.split('/')[0] === UID), `${n} photo(s): every key's first segment is the student's id (the policy's owner test)`);
    check(keys.every((k) => k.startsWith(`${UID}/page-photos/`)), `${n} photo(s): every key is inside the DELETE policy's prefix (giving up can delete them)`);
    check(reader.checkPhotoKeys(UID, keys).ok === true, `${n} photo(s): the route's checkPhotoKeys accepts the batch`);
    check(JSON.stringify(keys.map((k) => k.split('/').pop())) === JSON.stringify(Array.from({ length: n }, (_, i) => `p${i + 1}.jpg`)), `${n} photo(s): named p1.jpg… in page order`);
  }
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(photos.newBatchId()), 'a batch id is a lowercase v4 UUID');
  check(photos.MAX_PAGE_PHOTOS === 10 && reader.MAX_PAGE_PHOTOS === 10, 'up to 10 pages, the route\'s own limit');
}

// ---- 3. one POST per batch ------------------------------------------------------------------------
section('3. One POST per batch; a retry is a new batch; giving up deletes it');
if (photos?.sendPageBatch) {
  const blobs = Array.from({ length: 3 }, (_, i) => new Blob([`page ${i + 1}`], { type: 'image/jpeg' }));
  let seq = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const fake = ({ failUploads = 0, readThrows = false, status = 200 } = {}) => {
    const log = { uploads: [], reads: [], removes: [] };
    let fails = failUploads;
    return {
      log,
      deps: {
        userId: UID,
        newBatchId: ids,
        upload: async (key, blob) => {
          // A batch fails on its second photo, so something of it arrived.
          if (fails > 0 && key.endsWith('/p2.jpg')) { fails -= 1; throw new Error('network'); }
          log.uploads.push({ key, blob });
        },
        read: async (keys) => { log.reads.push(keys); if (readThrows) throw new Error('network'); return { status, text: JSON.stringify({ success: status === 200 }) }; },
        remove: async (keys) => { log.removes.push(keys); },
      },
    };
  };
  const batchOf = (k) => k.split('/')[2];

  let f = fake();
  let r = await photos.sendPageBatch(blobs, f.deps);
  check(r.kind === 'answered' && r.status === 200, 'a good batch: answered 200');
  check(f.log.reads.length === 1 && f.log.uploads.length === 3 && new Set(f.log.uploads.map((u) => batchOf(u.key))).size === 1, 'a good batch: three uploads under ONE batch, ONE POST');
  check(JSON.stringify(f.log.reads[0]) === JSON.stringify(f.log.uploads.map((u) => u.key)), 'the POST names exactly the uploaded keys, in page order');
  check(f.log.removes.length === 0, 'a 200: nothing deleted by the client (the route deleted what it read)');

  f = fake({ failUploads: 1 });
  r = await photos.sendPageBatch(blobs, f.deps);
  const batches = [...new Set(f.log.uploads.map((u) => batchOf(u.key)))];
  check(r.kind === 'answered' && batches.length === 2 && f.log.reads.length === 1, 'an upload fails: the photos go again under a NEW batch, then ONE POST');
  check(f.log.reads[0].every((k) => batchOf(k) === batches[1]), 'the POST names the new batch only');
  check(f.log.removes.length === 1 && f.log.removes[0].every((k) => batchOf(k) === batches[0]), 'the failed batch is deleted with the student\'s session');
  check(f.log.uploads.filter((u) => batchOf(u.key) === batches[1]).every((u, i) => u.blob === blobs[i]), 'the retry uploads the very photos it was given (kept in memory, no new shot)');

  f = fake({ failUploads: 5 });
  r = await photos.sendPageBatch(blobs, f.deps);
  check(r.kind === 'upload-failed' && f.log.reads.length === 0, `every attempt fails (${photos.UPLOAD_ATTEMPTS}): gives up with no POST`);
  check(r.kind === 'upload-failed' && f.log.removes.length === photos.UPLOAD_ATTEMPTS && new Set(f.log.removes.map((k) => batchOf(k[0]))).size === photos.UPLOAD_ATTEMPTS, 'giving up deletes every batch it made, each under its own id');

  f = fake({ readThrows: true });
  r = await photos.sendPageBatch(blobs, f.deps);
  check(r.kind === 'unconfirmed' && f.log.reads.length === 1, 'the POST leaves and no answer comes: unconfirmed, and NOT posted again');
  check(f.log.removes.length === 1 && JSON.stringify(f.log.removes[0]) === JSON.stringify(f.log.reads[0]), '...and that batch is deleted');

  for (const status of [401, 403, 422, 429, 500, 503]) {
    f = fake({ status });
    r = await photos.sendPageBatch(blobs, f.deps);
    check(r.kind === 'answered' && r.status === status && f.log.reads.length === 1 && f.log.removes.length === 1, `${status}: answered once, the batch deleted (the route may have refused before it owned the keys)`);
  }

  // A student's retry after a failure: the same photos, sent again.
  f = fake({ status: 422 });
  const a = await photos.sendPageBatch(blobs, f.deps);
  const b = await photos.sendPageBatch(blobs, f.deps);
  const posted = f.log.reads.map((k) => batchOf(k[0]));
  check(a.batchId !== b.batchId && posted.length === 2 && new Set(posted).size === 2, '"Try again" after an answer: a new batch, and no batch id is ever posted twice');
  let threw = false;
  try { await photos.sendPageBatch([], fake().deps); } catch { threw = true; }
  let threw11 = false;
  try { await photos.sendPageBatch(Array(11).fill(blobs[0]), fake().deps); } catch { threw11 = true; }
  check(threw && threw11, 'a batch is 1 to 10 photos');
}

// ---- 4. the permission ---------------------------------------------------------------------------------
section('4. The permission: version 2 for photos, and only for page-read');
const consent = await load('src/lib/ai-consent.ts');
if (consent) {
  const u = (v) => ({ user_metadata: { ai_consent: { version: v, at: 'x' } } });
  check(consent.AI_CONSENT_VERSION === 1 && consent.PAGE_READ_CONSENT_VERSION === 2, 'AI_CONSENT_VERSION stays 1; PAGE_READ_CONSENT_VERSION is 2');
  check(consent.hasAiConsent(u(1)) === true && consent.hasAiConsent(u(1), consent.PAGE_READ_CONSENT_VERSION) === false, 'a version-1 permission: every route but page-read');
  check(consent.hasAiConsent(u(2)) === true && consent.hasAiConsent(u(2), consent.PAGE_READ_CONSENT_VERSION) === true, 'a version-2 permission counts everywhere');
  check(consent.aiConsentGrant(new Date(), 2).ai_consent.version === 2 && consent.aiConsentGrant(new Date()).ai_consent.version === 1, 'the grant writes the version of the sheet read');
}
const routes = ['agent', 'ingest', 'quiz/generate', 'summarize', 'sample'];
for (const r of routes) check(/if \(!hasAiConsent\(user\)\)/.test(read(`src/app/api/${r}/route.ts`)), `/api/${r} still requires version 1 only (nobody re-asked)`);
check(/if \(!hasAiConsent\(user, PAGE_READ_CONSENT_VERSION\)\)/.test(read('src/app/api/page-read/route.ts')), '/api/page-read requires version 2');
const provider = read('src/components/ai-consent/AiConsentProvider.tsx');
check(/ensure\(null, \{ photos: true \}\)/.test(read('src/components/upload/CameraPages.tsx')), 'the camera screen asks with { photos: true } before anything is uploaded');
check(/askPhotos && \(/.test(provider) && /labels\.photos/.test(provider) && /PAGE_READ_CONSENT_VERSION : AI_CONSENT_VERSION/.test(provider), 'the sheet adds the photos line and writes version 2 when asked for photos');
check(/initialPhotosConsented=\{hasAiConsent\(user, PAGE_READ_CONSENT_VERSION\)\}/.test(layout), 'the layout hands the provider whether the account holds version 2');
const ui = read('src/components/upload/CameraPages.tsx');
const askAt = ui.indexOf('ensure(null, { photos: true })');
const sendAt = ui.indexOf('sendPageBatch(photos');
check(askAt > 0 && sendAt > askAt, 'the permission is asked before the batch is sent');

// ---- 5. orientation and size ------------------------------------------------------------------------
section('5. Orientation and size (the pure half; the browser half is verify-page-photo-encode)');
if (photos?.readJpegOrientation) {
  const jpegWith = (o, little) => {
    const tiff = little
      ? [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o, 0, 0, 0, 0, 0, 0, 0]
      : [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0];
    const body = [...Buffer.from('Exif\0\0', 'binary'), ...tiff];
    const len = body.length + 2;
    return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, 0xff, 0xda, 0, 2]);
  };
  check([1, 2, 3, 4, 5, 6, 7, 8].every((o) => photos.readJpegOrientation(jpegWith(o, true)) === o), 'EXIF orientation read, little-endian (Intel), all eight');
  check([1, 3, 6, 8].every((o) => photos.readJpegOrientation(jpegWith(o, false)) === o), 'EXIF orientation read, big-endian (Motorola)');
  check(photos.readJpegOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2])) === 1 && photos.readJpegOrientation(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])) === 1, 'no EXIF, or not a JPEG: 1');
  // Corners: the stored image's top-left must land where each orientation
  // says (EXIF 2.32 table), on an upright canvas of the right size.
  const want = { 1: 'TL', 2: 'TR', 3: 'BR', 4: 'BL', 5: 'TL', 6: 'TR', 7: 'BR', 8: 'BL' };
  let ok = true;
  for (let o = 1; o <= 8; o++) {
    const W = 300, H = 200; // stored
    const up = photos.uprightSize(W, H, o);
    const t = photos.orientationTransform(o, up.width, up.height);
    const [a, b, c, d, e, f] = t.matrix;
    const map = (x, y) => [a * x + c * y + e, b * x + d * y + f];
    const [x0, y0] = map(0, 0);
    const corner = `${y0 === 0 ? 'T' : 'B'}${x0 === 0 ? 'L' : 'R'}`;
    const [x1, y1] = map(t.drawWidth, t.drawHeight);
    const inside = [x0, x1].every((x) => x === 0 || x === up.width) && [y0, y1].every((y) => y === 0 || y === up.height) && x0 !== x1 && y0 !== y1;
    if (corner !== want[o] || !inside || t.drawWidth !== (o >= 5 ? up.height : up.width)) { ok = false; console.log(`        orientation ${o}: top-left at ${corner}, want ${want[o]}, fills the canvas ${inside}`); }
  }
  check(ok, 'every orientation maps the stored image onto the whole upright canvas, its first pixel where EXIF says');
  check(JSON.stringify(photos.uprightSize(4032, 3024, 6)) === JSON.stringify({ width: 3024, height: 4032 }), 'orientations 5 to 8 swap the sides');
  check(JSON.stringify(photos.fitLongSide(3024, 4032)) === JSON.stringify({ width: 1725, height: 2300 }) && photos.PHOTO_LONG_SIDE === 2300, 'a 12 MP page fits to 2300 px on the long side');
  check(JSON.stringify(photos.fitLongSide(800, 600)) === JSON.stringify({ width: 800, height: 600 }), 'a small photo is never enlarged');
  const sof = (m) => Uint8Array.from([0xff, 0xd8, 0xff, m, 0, 11, 8, 0, 10, 0, 20, 3, 0, 0, 0, 0xff, 0xda, 0, 2]);
  check(photos.isBaselineJpeg(sof(0xc0)) && !photos.isBaselineJpeg(sof(0xc2)) && !photos.isBaselineJpeg(sof(0xc1)), 'baseline means SOF0: a progressive (SOF2) or extended (SOF1) file is not');
  check(photos.PHOTO_JPEG_QUALITY >= 0.75 && photos.PHOTO_JPEG_QUALITY <= 0.92, `the JPEG quality is ${photos.PHOTO_JPEG_QUALITY}`);
  check(JSON.stringify(photos.unreadPages([{ n: 1, read: true }, { n: 2, read: false, code: 'read-empty' }, { n: 3, read: false, code: 'photo-heic' }, { n: 4, read: false, code: 'read-cut-off' }, { n: 5, read: false, code: 'read-timeout' }, { n: 6, read: false, code: 'something-new' }]))
    === JSON.stringify([{ n: 2, problem: 'no-text' }, { n: 3, problem: 'open' }, { n: 4, problem: 'too-long' }, { n: 5, problem: 'not-read' }, { n: 6, problem: 'not-read' }]), 'each photo code the route sends has a sentence; an unknown one says "not read"');
  check(photos.materialName('صفحات مصوّرة', new Date(2026, 10, 8)) === 'صفحات مصوّرة 2026-11-08', 'the material\'s name: the base and the date, Western digits');
}

// ---- 6. the words ----------------------------------------------------------------------------------
section('6. The words');
const { en } = await load('src/lib/i18n/locales/en.ts') ?? {};
const { ar } = await load('src/lib/i18n/locales/ar.ts') ?? {};
const cam = { en: en?.dashboard?.upload?.camera, ar: ar?.dashboard?.upload?.camera };
check(Boolean(cam.en && cam.ar), 'dashboard.upload.camera exists in both languages');
if (cam.en && cam.ar) {
  const keys = Object.keys(cam.en);
  check(JSON.stringify(Object.keys(cam.ar)) === JSON.stringify(keys), 'ar has the same keys in the same order');
  check(cam.ar.title === 'صوّر صفحاتك' && cam.ar.desc === 'صوّر صفحات الكتاب أو الدفتر، ونقرأ نصّها.', 'the camera tile\'s two approved Arabic lines, exactly');
  const all = [...keys.map((k) => ['en', k, cam.en[k]]), ...keys.map((k) => ['ar', k, cam.ar[k]]), ['en', 'photos', en.dashboard.aiConsent.photos], ['ar', 'photos', ar.dashboard.aiConsent.photos]];
  const BAN_EN = /\b(price|pricing|plans?|upgrade|subscri\w*|free|premium|pro)\b|\$/i;
  const BAN_AR = /باق[ةت]|اشترا?ك|ترقي|مجان|سعر|أسعار|احتراف|خط[ةت]/;
  for (const [l, k, s] of all) {
    if (typeof s !== 'string' || !s.trim()) { check(false, `${l} ${k}: a string`); continue; }
    if (/[–—]/.test(s)) check(false, `${l} ${k}: no em or en dash`);
    if ((l === 'en' ? BAN_EN : BAN_AR).test(s)) check(false, `${l} ${k}: no price, plan, upgrade, subscription or free word ("${s}")`);
    if (/[٠-٩۰-۹]/.test(s)) check(false, `${l} ${k}: Western digits only`);
  }
  check(true, `${all.length} strings: no dash, no purchase word, Western digits (any failure is listed above)`);
  const ph = (s) => JSON.stringify((s.match(/\{[a-z]+\}/g) || []).sort());
  check(keys.every((k) => ph(cam.en[k]) === ph(cam.ar[k])), 'every pair has the same placeholders');
  check(read('docs/copy-drafts/camera_screen.md').includes('DRAFT') && keys.every((k) => read('docs/copy-drafts/camera_screen.md').includes(`camera.${k}\``)), 'every key is listed in docs/copy-drafts/camera_screen.md as a draft');
}
const titleSpans = (read('src/components/upload/CameraPages.tsx') + read('src/components/upload/DropZone.tsx')).match(/<span[^>]*>\{(?:cameraLabels|labels)\.title\}<\/span>/g) || [];
check(titleSpans.length >= 2 && titleSpans.every((s) => /whitespace-nowrap/.test(s)), '"صوّر صفحاتك" is rendered whitespace-nowrap wherever it is a title (the tile and the screen): never split');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}
