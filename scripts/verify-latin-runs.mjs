/**
 * Executable proof for Latin runs in right-to-left sentences
 * (src/lib/latin-groups.ts `splitLatinRuns`, drawn by
 * src/components/ui/LatinText.tsx): the drop zone's messages and the AI
 * permission sheet, after activation 5's renders showed the wrong-type
 * refusal's list broken over two lines with ".zip" drawn as "zip.", and the
 * declined sentence's "Voyage" / "AI." split.
 *
 * Pure: the helper on the REAL strings (the approved dictionaries and
 * limit-messages.ts), then the component through react-dom/server. On main
 * `splitLatinRuns` and `LatinText` do not exist, so this fails there.
 *
 * Tier 0: no network, no app, no credential.
 *
 * Usage: node --experimental-strip-types scripts/verify-latin-runs.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

const lg = await load('src/lib/latin-groups.ts');
const { uploadRefusalMessage } = await load('src/lib/limit-messages.ts');
const { useTranslation } = await load('src/lib/i18n/index.ts');
const ar = useTranslation('ar');
const en = useTranslation('en');

const split = lg.splitLatinRuns;
check(typeof split === 'function', 'latin-groups has no splitLatinRuns (main has only bracketed groups)');
const runs = (s) => (typeof split === 'function' ? split(s) : []).filter((p) => typeof p !== 'string');
const joined = (s) => (typeof split === 'function' ? split(s) : []).map((p) => (typeof p === 'string' ? p : p.run)).join('');

// 1. The wrong-type refusal: the list is ONE short run, ".zip" keeps its dot, the sentence's "." stays Arabic.
const refusal = uploadRefusalMessage('ar', 'type', 'zip');
const r1 = runs(refusal);
check(JSON.stringify(r1) === JSON.stringify([
  { run: 'KnowFlow', short: true },
  { run: 'PDF, DOCX, PPTX, XLSX, TXT, MD', short: true },
  { run: '.zip', short: true },
]), `the type refusal cuts into KnowFlow / the list / .zip, got ${JSON.stringify(r1)}`);
check(refusal.endsWith('.zip.') && joined(refusal) === refusal, 'the refusal joins back byte for byte, its final "." outside the run');

// 2. The declined sentence: "Anthropic" and "Voyage AI", the "و" before Voyage and the "." after AI stay Arabic.
const declined = ar.dashboard.aiConsent.declined;
check(JSON.stringify(runs(declined)) === JSON.stringify([{ run: 'Anthropic', short: true }, { run: 'Voyage AI', short: true }]), `declined cuts into Anthropic / Voyage AI, got ${JSON.stringify(runs(declined))}`);
check(joined(declined) === declined, 'declined joins back byte for byte');

// 3. Every Arabic string the drop zone and the sheet show joins back exactly (no copy change).
const sheet = ['title', 'intro', 'anthropic', 'voyage', 'notSent', 'withdrawHint', 'saveFailed', 'declined'].map((k) => ar.dashboard.aiConsent[k]);
const zone = [ar.dashboard.upload.error, ar.dashboard.upload.tryAnother, ar.dashboard.upload.awaitingConsent, ar.dashboard.upload.uploadFailed, ar.dashboard.subjectDetail.noTextFix, ar.dashboard.subjectDetail.noTextLine,
  ...['request', 'type', 'mime', 'session', 'nothing-saved', 'unconfirmed'].map((k) => uploadRefusalMessage('ar', k, 'zip'))];
for (const s of [...sheet, ...zone]) check(joined(s) === s, `does not join back: ${s}`);
check(JSON.stringify(runs(ar.dashboard.aiConsent.voyage)) === JSON.stringify([{ run: 'Voyage AI', short: true }]), 'the sheet\'s Voyage line holds one run');

// 4. A bracketed group is still one piece, brackets included (#310's rule), and the 30-character cap.
const mime = uploadRefusalMessage('ar', 'mime', 'zip');
check(runs(mime).some((p) => p.run === '(.zip)'), `the mime refusal keeps "(.zip)" whole, got ${JSON.stringify(runs(mime))}`);
check(runs(`أ ${'a'.repeat(30)} ب`)[0]?.short === true && runs(`أ ${'a'.repeat(31)} ب`)[0]?.short === false, 'the short cap is 30 characters');
check(runs('أ PDF، DOCX ب').length === 2, 'an Arabic comma ends a run');

// 5. The component: isolates only in a right-to-left sentence; textContent unchanged.
if (existsSync(resolvePath(ROOT, 'src/components/ui/LatinText.tsx'))) {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LatinText } = await load('src/components/ui/LatinText.tsx');
  const html = renderToStaticMarkup(createElement('p', null, createElement(LatinText, { text: refusal })));
  check(html.includes('<bdi dir="ltr" data-kf-latin="short" class="whitespace-nowrap">PDF, DOCX, PPTX, XLSX, TXT, MD</bdi>'), `the list is a nowrap isolate: ${html}`);
  check(html.includes('<bdi dir="ltr" data-kf-latin="short" class="whitespace-nowrap">.zip</bdi>.'), `".zip" is isolated, the "." after it is not: ${html}`);
  const text = html.replace(/<[^>]+>/g, '');
  check(text === refusal.replace(/&/g, '&amp;'), 'the rendered text equals the string');
  const long = `أ ${'word '.repeat(8).trim()} ب`;
  check(renderToStaticMarkup(createElement(LatinText, { text: long })).includes('<bdi dir="ltr" data-kf-latin="long">'), 'a long run is an isolate that may wrap (no nowrap)');
  const enHtml = renderToStaticMarkup(createElement(LatinText, { text: en.dashboard.aiConsent.declined }));
  check(enHtml === en.dashboard.aiConsent.declined.replace(/&/g, '&amp;'), 'an English sentence is returned as it is');
} else check(false, 'no src/components/ui/LatinText.tsx');

console.log(`\n${passes} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL ${f}`);
if (failures.length) process.exit(1);
console.log('PASS: Latin runs in the drop zone and the AI sheet are isolates, a short one whole, and every string is unchanged.');
