/**
 * Executable proof for register #124: a file name with a digit before its
 * extension reads in order on every site that shows one, and what is shown is
 * byte-identical to what is stored.
 *
 * THE DEFECT, MEASURED ON A PHONE: "تمارين محلولة - الفصل 3.pdf" on the material
 * card read "الفصل pdf.3". The Unicode bidi algorithm, in a right-to-left
 * paragraph, puts the dot on the Arabic side and the letters "pdf" to its left.
 *
 * WHAT IS ASSERTED, ON RENDERED MARKUP, NOT ON A HELPER'S RETURN VALUE:
 *   1. The split: for each case, head + tail is the name, the direction is the
 *      name's first strong letter, and the tail begins after its last
 *      right-to-left letter.
 *   2. MaterialCard, DropZone (queued file), MessageBubble (citation pills),
 *      HeroDemo (the landing's pills) each render the name through FileName:
 *      the tail sits in its own `<bdi dir="ltr">`, the wrapper carries the
 *      name's direction, and the TEXT of the rendered name is the stored name,
 *      byte for byte, with no bidi control character anywhere in the markup.
 *   3. RenameMaterialFields: the input's value is the stem byte for byte, the
 *      input keeps `dir="auto"`, the row takes the name's direction, and the
 *      extension badge is `ltr`.
 *   4. Display only: no API route imports FileName or the split, and the rename
 *      control still sends `{ name: value }` untouched.
 *   5. No other site renders a file name raw: every JSX expression that prints
 *      `filename` or `file.name` outside FileName is listed here or fails.
 *
 * RED ON MAIN: the components exist there and render the name in one `<p
 * dir="auto">`, so assertion 2 fails on the first case; FileName itself is
 * missing there, which assertion 2 also reports.
 *
 * Tier 0: no network, no credential, no database, no app.
 * Usage: node --experimental-strip-types scripts/verify-filename-display.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, {
  '@/lib/supabase/client': 'export function createClient() { return {}; }',
});
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}

const decode = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html) => decode(html.replace(/<[^>]+>/g, ''));
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

// --- 1. the split ------------------------------------------------------------
const AR_CH3 = 'تمارين محلولة - الفصل 3.pdf';
const CASES = [
  // name, head, tail, dir
  [AR_CH3,                              'تمارين محلولة - الفصل ', '3.pdf',                     'rtl', 'Arabic, digit before the extension'],
  ['الفصل 3 تمارين.pdf',                'الفصل 3 تمارين',        '.pdf',                      'rtl', 'Arabic, digits in the middle'],
  ['Solved-Exercises-Ch3.pdf',          '',                      'Solved-Exercises-Ch3.pdf',  'ltr', 'Latin'],
  ['ملخص Chapter 3.pdf',                'ملخص ',                 'Chapter 3.pdf',             'rtl', 'mixed, Arabic first'],
  ['Summary الفصل 3 (1).pdf',           'Summary الفصل ',        '3 (1).pdf',                 'ltr', 'mixed, Latin first'],
  ['ملاحظات',                           'ملاحظات',               '',                          'rtl', 'no extension, Arabic'],
  ['notes',                             '',                      'notes',                     'ltr', 'no extension, Latin'],
  ['الإصدار v1.2.final.pdf',            'الإصدار ',              'v1.2.final.pdf',            'rtl', 'multiple dots'],
  ['الفصل (1).pdf',                     'الفصل ',                '(1).pdf',                   'rtl', 'parentheses'],
  ['[مسودة] الفصل 3.pdf',               '[مسودة] الفصل ',        '3.pdf',                     'rtl', 'brackets at the start'],
  ['12345.pdf',                         '',                      '12345.pdf',                 'ltr', 'digits only'],
  ['الفصل ٣.pdf',                       'الفصل ',                '٣.pdf',                     'rtl', 'Arabic-Indic digit travels with the extension'],
  ['פרק 3.pdf',                         'פרק ',                  '3.pdf',                     'rtl', 'Hebrew'],
  ['',                                  '',                      '',                          'ltr', 'empty'],
];

console.log('the split (src/lib/file-name-display.ts):');
let split = null;
try {
  split = await load('src/lib/file-name-display.ts');
} catch (e) {
  check('src/lib/file-name-display.ts loads', false, String(e.message).split('\n')[0]);
}
if (split) {
  for (const [name, head, tail, dir, label] of CASES) {
    const r = split.splitFileNameForDisplay(name);
    check(`split: ${label}`,
      r.head === head && r.tail === tail && r.dir === dir && r.head + r.tail === name,
      `got head=${JSON.stringify(r.head)} tail=${JSON.stringify(r.tail)} dir=${r.dir}`);
  }
}

// --- 2. the sites, as rendered ----------------------------------------------------
// The name's markup: the FileName wrapper is the element carrying data-filename.
function fileNameMarkup(html, expectDir) {
  const m = html.match(/<(span|bdi) dir="(rtl|ltr)"[^>]*data-filename=""[^>]*>([\s\S]*?)<\/\1>(?![^<]*<\/bdi>)/);
  return m ? { tag: m[1], dir: m[2], inner: m[3] } : null;
}
function assertRendered(site, html, name, { inline = false } = {}) {
  const { head, tail, dir } = split ? split.splitFileNameForDisplay(name) : { head: null, tail: null, dir: null };
  const fn = fileNameMarkup(html);
  check(`${site}: renders "${name}" through FileName`, !!fn, fn ? '' : 'no element with data-filename in the markup');
  if (!fn) return;
  check(`${site}: the wrapper's direction is the name's (${dir})`, fn.dir === dir, `got ${fn.dir}`);
  const rendered = text(fn.inner);
  check(`${site}: the rendered text is the stored name, byte for byte`, rendered === name,
    `rendered ${JSON.stringify(rendered)}`);
  check(`${site}: no bidi control character in the markup`, !BIDI_CONTROLS.test(html));
  if (tail) {
    const ltr = fn.inner.match(/<bdi dir="ltr"[^>]*>([\s\S]*?)<\/bdi>/);
    check(`${site}: the tail "${tail}" is one left-to-right isolate`, !!ltr && text(ltr[1]) === tail,
      ltr ? `isolate holds ${JSON.stringify(text(ltr[1]))}` : 'no <bdi dir="ltr"> inside the name');
  }
  if (!inline) {
    check(`${site}: the block shape is a flex row (truncation per part)`, /class="[^"]*\bflex\b[^"]*"/.test(fn.inner) || /<span dir="(rtl|ltr)" class="[^"]*\bflex\b/.test(html));
  }
}

console.log('');
console.log('MaterialCard:');
const { MaterialCard } = await load('src/components/materials/MaterialCard.tsx');
const cardLabels = { chunks: 'chunks', statusReady: 'Ready', statusProcessing: 'Processing', statusError: 'Failed', checklist: 'Kit', summaryDone: 'S', summaryTodo: 's', quizDone: 'Q', quizTodo: 'q', added: 'Added' };
const card = (filename) =>
  renderToStaticMarkup(React.createElement(MaterialCard, { filename, fileType: 'pdf', chunkCount: 3, status: 'ready', addedAt: '2026-09-25T00:00:00Z', locale: 'ar', hasSummary: true, hasQuiz: false, labels: cardLabels }));
for (const [name] of CASES.filter(([n]) => n !== '')) assertRendered('MaterialCard', card(name), name);
{
  // The defect itself: on main, the card is one <p dir="auto"> holding the whole name.
  const html = card(AR_CH3);
  check('MaterialCard: no <p dir="auto"> holds the whole name (the #124 rendering)', !new RegExp(`<p[^>]*dir="auto"[^>]*>${AR_CH3}</p>`).test(html));
}

console.log('');
console.log('DropZone (queued file):');
const { DropZone } = await load('src/components/upload/DropZone.tsx');
globalThis.__tsxHooksParams = { locale: 'ar' };
for (const name of [AR_CH3, 'Solved-Exercises-Ch3.pdf', 'ملخص Chapter 3.pdf']) {
  let html = '';
  try {
    html = renderToStaticMarkup(React.createElement(DropZone, { kbId: 'k', previewFile: { name, size: 1000 } }));
  } catch (e) {
    check(`DropZone renders its ready state for "${name}"`, false, String(e.message).split('\n')[0]);
    continue;
  }
  assertRendered('DropZone', html, name);
}

console.log('');
console.log('MessageBubble (citation pills):');
const { MessageBubble } = await load('src/components/agent/MessageBubble.tsx');
for (const name of [AR_CH3, 'Solved exercises - Chapter 3.pdf', 'Summary الفصل 3 (1).pdf']) {
  const html = renderToStaticMarkup(React.createElement(MessageBubble, {
    role: 'assistant', content: 'x', citations: [{ index: 1, document_id: 'd', chunk_id: 'c', filename: name, similarity: 0.9 }],
  }));
  assertRendered('MessageBubble', html, name, { inline: true });
  check('MessageBubble: the pill row stays dir="ltr" (the [1] index left of the name)', /<div class="[^"]*flex flex-wrap gap-2 px-1" dir="ltr">/.test(html));
  const pill = html.match(/<span[^>]*title="[^"]*"[^>]*>([\s\S]*?)<\/span>/);
  check(`MessageBubble: the pill's text is "[1] ${name}"`, !!pill && text(pill[1]) === `[1] ${name}`, pill ? JSON.stringify(text(pill[1])) : 'no pill');
}

console.log('');
console.log('HeroDemo (landing pills):');
const { HeroDemo } = await load('src/components/landing/HeroDemo.tsx');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const heroFiles = ar.answer.files;
check('the Arabic landing copy still carries the chapter-number file', heroFiles.includes(AR_CH3), JSON.stringify(heroFiles));
{
  const html = renderToStaticMarkup(React.createElement(HeroDemo, { rtl: true, copy: { question: 'q', body: 'b', files: heroFiles, summaryReady: 's', quizReady: 'z' } }));
  for (const name of heroFiles) {
    const m = [...html.matchAll(/<bdi dir="(rtl|ltr)"[^>]*data-filename=""[^>]*>([\s\S]*?)<\/bdi>(?=\s*<\/span>)/g)].find((x) => text(x[2]) === name);
    check(`HeroDemo: renders "${name}" through FileName, text byte-identical`, !!m, m ? '' : 'not found as a FileName isolate');
    if (m && split) {
      const { tail, dir } = split.splitFileNameForDisplay(name);
      check(`HeroDemo: direction ${dir} and the tail "${tail}" isolated`, m[1] === dir && (!tail || new RegExp(`<bdi dir="ltr">${tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</bdi>`).test(m[2])));
    }
  }
}

// --- 3. the rename field --------------------------------------------------------------
console.log('');
console.log('RenameMaterialFields:');
const rename = await load('src/components/materials/RenameMaterialControl.tsx');
const renameLabels = { openButton: 'o', label: 'Name', hint: 'h', saveButton: 'Save', cancelButton: 'Cancel', saving: '…', errorInvalid: '', errorNotFound: '', errorConflict: '', errorContact: '', errorFailed: '' };
check('RenameMaterialFields is exported (the panel can be rendered in its editing state)', typeof rename.RenameMaterialFields === 'function');
if (typeof rename.RenameMaterialFields === 'function') {
  const { splitFilename } = await load('src/lib/material-name.ts');
  for (const [name, wantDir] of [[AR_CH3, 'rtl'], ['Solved-Exercises-Ch3.pdf', 'ltr'], ['ملخص Chapter 3.pdf', 'rtl'], ['Summary الفصل 3 (1).pdf', 'ltr'], ['12345.pdf', 'ltr']]) {
    const { stem, ext } = splitFilename(name);
    const html = renderToStaticMarkup(React.createElement(rename.RenameMaterialFields, {
      inputId: 'i', value: stem, ext, busy: false, labels: renameLabels, onChange() {}, onSave() {}, onCancel() {},
    }));
    const input = html.match(/<input[^>]*>/)?.[0] ?? '';
    const value = input.match(/value="([^"]*)"/)?.[1];
    check(`rename "${name}": the input's value is the stem, byte for byte`, value !== undefined && decode(value) === stem, `value=${JSON.stringify(value && decode(value))} stem=${JSON.stringify(stem)}`);
    check(`rename "${name}": the input keeps dir="auto" (the browser's caret and selection rules)`, /dir="auto"/.test(input));
    const row = html.match(/<div class="[^"]*" dir="(rtl|ltr)" data-rename-row="">/);
    check(`rename "${name}": the row's direction is the name's (${wantDir}), so the extension sits after the name`, !!row && row[1] === wantDir, row ? `got ${row[1]}` : 'no row');
    check(`rename "${name}": the extension badge "${ext}" is ltr`, new RegExp(`<span dir="ltr"[^>]*>${ext.replace('.', '\\.')}</span>`).test(html));
    check(`rename "${name}": no bidi control character`, !BIDI_CONTROLS.test(html));
  }
}

// --- 4. display only -------------------------------------------------------------------
console.log('');
console.log('display only:');
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = resolvePath(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}
const apiFiles = walk(resolvePath(ROOT, 'src/app/api'));
check('no API route imports FileName or the display split', !apiFiles.some((f) => /file-name-display|ui\/FileName/.test(readFileSync(f, 'utf8'))));
const renameSrc = read('src/components/materials/RenameMaterialControl.tsx');
check('the rename control still sends { name: value } untouched', /body: JSON\.stringify\(\{ name: value \}\)/.test(renameSrc));
check('the rename control does not import FileName (an input is not a label)', !/ui\/FileName/.test(renameSrc));

// --- 5. no raw file name anywhere else ---------------------------------------------------
console.log('');
console.log('the sweep (every JSX site that prints a file name):');
const srcFiles = walk(resolvePath(ROOT, 'src')).filter((f) => f.endsWith('.tsx') && !/[\\/]preview[\\/]/.test(f));
const raw = [];
for (const f of srcFiles) {
  const s = readFileSync(f, 'utf8');
  if (/ui[\\/]FileName\.tsx$/.test(f)) continue;
  for (const m of s.matchAll(/\{[^{}]*\b(filename|file\.name|c\.filename|m\.filename|doc\.filename)\b[^{}]*\}/g)) {
    const expr = m[0];
    // Props (`filename={doc.filename}`) and template pieces (`${c.filename}`)
    // carry the name as data; only a JSX text child prints it, and a text child
    // is a brace not preceded by `=` or `$`.
    const before = s[m.index - 1] ?? '';
    if (before !== '=' && before !== '$' && /^\{\s*(c|m|doc|file|d)?\.?(filename|name)\s*\}$/.test(expr)) {
      raw.push(`${f.replace(ROOT, '').replace(/\\/g, '/')}: ${expr}`);
    }
  }
}
check('no JSX text child prints a file name outside FileName', raw.length === 0, raw.join('\n      '));

console.log('');
console.log(`${pass} passed, ${failures.length} failed, ${pass + failures.length} total`);
for (const f of failures) console.log('  ! ' + f);
process.exit(failures.length === 0 ? 0 : 1);
