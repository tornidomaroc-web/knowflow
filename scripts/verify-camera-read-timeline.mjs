/**
 * THE CAMERA'S READ CARRIES ITS OWN TIMELINE (item 4j, TestFlight build 9).
 *
 * The finding: the first camera send after the photos permission showed the
 * "reading" line for 13 minutes with the app in front, and no /api/page-read
 * request reached Vercel until the student left the app; then the pages were
 * read (200) and the app said "could not confirm".
 *
 * What this proves, without a phone, a browser, a network or a credential:
 *
 *  1. WHEN THE READING LINE SHOWS, fetch() HAS BEEN CALLED. sendPageBatch
 *     calls onProgress('reading') and then read(keys) in the same turn (a
 *     microtask queued in onProgress has not run when read starts), and the
 *     screen's read callback calls fetch() before any await. So no promise on
 *     the page (the permission sheet, supabase-js's auth lock, a sheet
 *     transition) can stand between the reading line and the request: once
 *     it shows, the request is WebKit's.
 *  2. THE PERMISSION SHEET RELEASES ITS CALLER AT ONCE. accept() awaits one
 *     thing, the save to the account, and then settles the ensure() promise;
 *     the camera's next await is getSession, and the reading line comes only
 *     after it and after every upload.
 *  3. THE TIMELINE. pageReadUrl puts the phone's clock at the fetch() call and
 *     the tap-to-permission, tap-to-session and tap-to-uploaded times in the
 *     query string: whole milliseconds, digits only, nothing about the student
 *     or the pages; negative or non-finite values are 0. The screen reads
 *     /api/page-read only through it. The route never reads its query and the
 *     middleware never sees /api, so the request is the same request.
 *
 * On main this fails: pageReadUrl does not exist and the screen posts to the
 * bare path.
 *
 * Usage: node --experimental-strip-types scripts/verify-camera-read-timeline.mjs
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

installTsxHooks(ROOT, {});
const photos = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/page-photos.ts')).href).catch((e) => {
  check(false, `src/lib/page-photos.ts loads (${String(e.message).split('\n')[0]})`);
  return null;
});

const UID = '0b9d4c4e-6a51-4e8e-9d1f-2b7c1a3e5f60';
const camera = read('src/components/upload/CameraPages.tsx');
const provider = read('src/components/ai-consent/AiConsentProvider.tsx');

// ---- 1. reading shown => fetch called -------------------------------------------------------
section('1. When the reading line shows, fetch() has already been called');
if (photos?.sendPageBatch) {
  const blobs = Array.from({ length: 3 }, (_, i) => new Blob([`page ${i + 1}`], { type: 'image/jpeg' }));
  let n = 0;
  const order = [];
  let microtaskRan = null;
  let readSawMicrotask = null;
  await photos.sendPageBatch(blobs, {
    userId: UID,
    newBatchId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    upload: async () => { order.push('upload'); },
    remove: async () => { order.push('remove'); },
    read: async () => {
      readSawMicrotask = microtaskRan;
      order.push('read');
      return { status: 200, text: '{"success":true}' };
    },
    onProgress: (p) => {
      if (p.stage !== 'reading') return;
      order.push('reading');
      microtaskRan = false;
      queueMicrotask(() => { microtaskRan = true; });
    },
  });
  check(order.join(',') === 'upload,upload,upload,reading,read', `the order is every upload, then the reading line, then the read: ${order.join(',')}`);
  check(readSawMicrotask === false, 'read() starts in the same turn as onProgress(reading): a microtask queued there has not run yet');
} else {
  check(false, 'sendPageBatch is exported');
}
const readCb = camera.match(/read: async \(keys, signal, ask\) => \{([\s\S]*?)\n      \},/);
const body = readCb ? readCb[1].replace(/^\s*\/\/.*$/gm, '').trim() : '';
check(/^const res = await fetch\(/.test(body), "the screen's read callback calls fetch() first, before any await of its own");
// Item 4j: the uploading branch also re-shows the upload (a 410 uploads the photos again).
const onProgressCb = camera.match(/onProgress: \(p\) => \{\s*if \(p\.stage === 'uploading'\) \{([\s\S]*?)\} else setPhase\('reading'\);\s*\}/);
check(Boolean(onProgressCb) && !/reading/.test(onProgressCb[1]), "the reading line is set by onProgress('reading') and by nothing else");
check((camera.match(/setPhase\('reading'\)/g) || []).length === 1, "setPhase('reading') appears once in the screen");

// ---- 2. the sheet releases its caller -------------------------------------------------------
section('2. The permission sheet releases its caller as soon as the save answers');
// Item 4j: accept() may be wrapped by the one-press guard (`once(async () => {...})`, src/lib/single-flight.ts).
const accept = provider.match(/const accept = (?:once\()?async \(\) => \{([\s\S]*?)\n  \}\)?;/);
const acc = accept ? accept[1] : '';
check((acc.match(/\bawait\b/g) || []).length === 1 && /const ok = await persist\(/.test(acc), 'accept() awaits one thing, the save to the account');
check(/settle\(true\);\s*$/.test(acc.trim()), 'and then settles the waiting ensure() (settle(true) is its last step)');
const settle = provider.match(/const settle = useCallback\(\(ok: boolean\) => \{([\s\S]*?)\}, \[\]\);/);
check(Boolean(settle) && !/\bawait\b/.test(settle[1]) && /resolve\?\.\(ok\)/.test(settle[1]), 'settle() resolves the pending promise synchronously (no await)');
const sendFn = camera.match(/const send = async \(\) => \{([\s\S]*?)\n  \};/);
const send = sendFn ? sendFn[1] : '';
const awaitsBeforeBatch = send.slice(0, send.indexOf('await sendPageBatch(')).match(/await [^;]*/g) || [];
check(
  awaitsBeforeBatch.length === 2 && /ensure\(null, \{ photos: true \}\)/.test(awaitsBeforeBatch[0]) && /supabase\.auth\.getSession\(\)/.test(awaitsBeforeBatch[1]),
  `between the tap and the batch the screen awaits the permission and the session, nothing else: ${awaitsBeforeBatch.map((a) => a.slice(0, 48)).join(' | ')}`
);

// ---- 3. the timeline -----------------------------------------------------------------------
section('3. The read carries the timeline in its query, digits only');
if (typeof photos?.pageReadUrl === 'function') {
  const u = photos.pageReadUrl({ sentAt: 1795622031009.4, consentMs: 8123.6, sessionMs: 8190.2, uploadedMs: 14000 });
  check(u === '/api/page-read?kf_t=1795622031009&kf_c=8124&kf_s=8190&kf_u=14000&kf_r=0', `the address: ${u}`);
  const z = photos.pageReadUrl({ sentAt: NaN, consentMs: -5, sessionMs: Infinity, uploadedMs: 0, ask: -1 });
  check(z === '/api/page-read?kf_t=0&kf_c=0&kf_s=0&kf_u=0&kf_r=0', `negative and non-finite values are 0: ${z}`);
  const r1 = photos.pageReadUrl({ sentAt: 1, consentMs: 2, sessionMs: 3, uploadedMs: 4, ask: 1 });
  check(r1.endsWith('&kf_r=1'), `the second ask of a send is kf_r=1 (item 4j): ${r1}`);
  const q = new URL(u, 'https://tryknowflow.com');
  check(q.pathname === '/api/page-read', 'the path is the route, unchanged');
  check([...q.searchParams.keys()].join(',') === 'kf_t,kf_c,kf_s,kf_u,kf_r' && [...q.searchParams.values()].every((v) => /^\d+$/.test(v)), 'five keys (item 4j added kf_r), each a whole number and nothing else');
} else {
  check(false, 'page-photos.ts exports pageReadUrl');
}
check(/fetch\(pageReadUrl\(\{ sentAt: Date\.now\(\), consentMs, sessionMs, uploadedMs, ask \}\)/.test(camera), 'the screen posts through pageReadUrl, the clock read at the fetch() call');
check(/if \(p\.done === p\.total\) uploadedMs = since\(\);/.test(camera), 'tap-to-uploaded is read when the last photo arrived (not at a second ask)');
check(!/fetch\('\/api\/page-read'/.test(camera), 'the screen no longer posts to the bare path');
const tapAt = send.indexOf('const tap = performance.now()');
check(tapAt >= 0 && tapAt < send.indexOf("setPhase('consent')"), 'the tap is stamped before the permission is asked');
check(/const consentMs = since\(\);/.test(send) && send.indexOf('const consentMs') > send.indexOf('await ensure('), 'tap-to-permission is read after the permission answers');
check(/const sessionMs = since\(\);/.test(send) && send.indexOf('const sessionMs') > send.indexOf('await supabase.auth.getSession()'), 'tap-to-session is read after the session');
const route = read('src/app/api/page-read/route.ts');
// Item 4j: the route now LOGS its query (one kf-page-read-arrival line), and that is
// the only use: nothing it answers depends on it.
check(route.length > 0 && (route.match(/request\.url/g) || []).length === 1 && /console\.log\(JSON\.stringify\(arrivalLine\(request\.url, startedAt\)\)\);/.test(route) && !/searchParams|nextUrl/.test(route), 'the route reads its query only to log it (arrivalLine): the request it serves is the same');
const mw = read('src/middleware.ts');
check(/\(\?!api\|/.test(mw), 'the middleware matcher excludes /api: nothing rewrites the address');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
