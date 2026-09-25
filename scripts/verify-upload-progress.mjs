/**
 * Executable proof for register #113: a long upload shows something moving and
 * says something true the whole time.
 *
 * The REAL things under test:
 *   - `src/lib/upload-progress.ts`: the estimate is the measured rate (4 MB in
 *     80.5 s on production, #50) with a floor for small files; the sentence
 *     changes with the elapsed time; the processing bar never claims more than
 *     90% before the server answers.
 *   - `DropZone.tsx`, read from source: it sends with `XMLHttpRequest` (the
 *     only transport that reports upload progress) and reads
 *     `upload.onprogress`; it renders the filename, the elapsed seconds and a
 *     bar; and it still runs the #50 size check and the #111 type check before
 *     anything is sent.
 *   - The dictionary carries the six new sentences in both locales.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-upload-progress.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const MB = 1024 * 1024;

// 1. The estimate and the stages.
{
  const p = resolvePath(ROOT, 'src/lib/upload-progress.ts');
  check(existsSync(p), 'src/lib/upload-progress.ts does not exist');
  if (existsSync(p)) {
    const m = await load('src/lib/upload-progress.ts');
    const four = m.expectedProcessingSeconds(4 * MB);
    console.error(`expected: 4 MB -> ${four}s, 1 MB -> ${m.expectedProcessingSeconds(MB)}s, 20 KB -> ${m.expectedProcessingSeconds(20 * 1024)}s`);
    check(four >= 70 && four <= 90, `a 4 MB file should be estimated near the measured 80.5 s, got ${four}`);
    check(m.expectedProcessingSeconds(20 * 1024) >= 5, 'a tiny file still has a floor, since conversion and embedding are not free');
    check(m.expectedProcessingSeconds(MB) < four, 'the estimate must grow with the file');

    const s = (ms) => m.processingStage(ms, 4 * MB);
    check(s(0) === 'reading' && s(2000) === 'reading', 'the first moments must read "reading"');
    check(s(20000) === 'preparing', 'inside the estimate it must read "preparing"');
    check(s(four * 1000 + 5000) === 'long', 'past the estimate it must say the wait is long and the student may leave');
    check(m.processingStage(0, 20 * 1024) === 'reading', 'a small file starts at "reading" too');

    const f = (ms) => m.processingFraction(ms, 4 * MB);
    check(f(0) === 0, 'the bar starts empty');
    check(f(four * 500) > 0.3 && f(four * 500) < 0.6, 'half the estimate is near half the bar');
    check(f(four * 10000) <= 0.9 + 1e-9, 'the processing bar must never pass 90% before the server answers');
    check(m.PROCESSING_CAP === 0.9, 'PROCESSING_CAP must be 0.9');
  }
}

// 2. The component, read.
{
  const src = readFileSync(resolvePath(ROOT, 'src/components/upload/DropZone.tsx'), 'utf8');
  check(/new XMLHttpRequest\(\)/.test(src) && /upload\.onprogress/.test(src), 'DropZone does not report upload progress (XMLHttpRequest upload.onprogress)');
  check(!/fetch\('\/api\/ingest'/.test(src), 'DropZone still uploads with fetch, which cannot report progress');
  check(/processingStage\(/.test(src) && /processingFraction\(/.test(src) && /expectedProcessingSeconds\(/.test(src), 'DropZone does not use the estimate module');
  check(/isOverUploadLimit\(/.test(src) && /isAllowedFileType\(/.test(src), 'the #50 size check or the #111 type check is gone');
  check(/role="status"/.test(src) && /aria-live="polite"/.test(src), 'the progress is not announced to a screen reader');
  check(/file\.name/.test(src), 'the filename is not shown');
  check(/elapsedMs \/ 1000/.test(src), 'the elapsed seconds are not shown');
}

// 3. The dictionary.
{
  const { en } = await load('src/lib/i18n/locales/en.ts');
  const { ar } = await load('src/lib/i18n/locales/ar.ts');
  for (const [name, d] of [['en', en], ['ar', ar]]) {
    for (const k of ['reading', 'preparing', 'stillWorking', 'usuallyAbout', 'leaveNote', 'tryAnother']) {
      check(typeof d.dashboard.upload[k] === 'string' && d.dashboard.upload[k].length > 0, `${name}: upload.${k} is missing`);
    }
    check(/\{n\}/.test(d.dashboard.upload.usuallyAbout ?? ''), `${name}: usuallyAbout must carry {n}`);
  }
}

if (failures.length === 0) {
  console.log('PASS: the upload shows real bytes, then an honest estimate that never claims done, and says what to do if it runs long.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
