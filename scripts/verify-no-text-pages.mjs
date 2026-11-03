/**
 * Executable proof for Option C (2026-11-03, no OCR): the student is told when
 * pages of a file have no text, and how to get the text out of them.
 *
 * The ingestion service counts a PDF's pages and the pages with no text
 * (services/ingestion/main.py, tested by services/ingestion/tests). This proof
 * holds the web half:
 *   1. `pagesWithoutText` (src/lib/material-text.ts): { n, total } only for a
 *      ready file where SOME pages have no text; null for every other case,
 *      including every row stored before the count (fields missing or null).
 *   2. MaterialCard, rendered (react-dom/server) with the real Arabic and
 *      English labels, in the three states: all pages have text (unchanged:
 *      ready chip, study kit, no new line); some pages (ready chip, study kit,
 *      the count line, the fix line); no text (no-text chip and line, the fix
 *      line, no study kit).
 *   3. The approved copy (app_v4, 2026-11-03; the English is held verbatim
 *      here) obeys the owner's rules: Western digits, no em dash, no price,
 *      plan, upgrade or "free" wording, and no Latin inside the Arabic except the product names Google Lens and Google Docs, each one unit.
 *   4. The wiring, from the source: the route forwards the two counts as
 *      numbers or null; the upload box reads them through pagesWithoutText,
 *      keeps a warning on screen, and offers a 44 px button to pick the next
 *      file; the subject page passes the counts to the card.
 *
 * RED ON MAIN: pagesWithoutText, the labels and the wiring do not exist there.
 *
 * Tier 0: no network, no credential, no database, no app.
 * Usage: node --experimental-strip-types scripts/verify-no-text-pages.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}
async function attempt(name, fn) {
  try { await fn(); } catch (e) { check(name, false, String(e?.message ?? e).split('\n')[0]); }
}

console.log('1. pagesWithoutText');
await attempt('pagesWithoutText loads', async () => {
  const { pagesWithoutText } = await load('src/lib/material-text.ts');
  const R = { status: 'ready', embedding_status: 'ready', chunk_count: 7 };
  const truth = [
    [{ ...R, pages_total: 12, pages_no_text: 3 }, { n: 3, total: 12 }, 'ready PDF, 3 of 12 pages without text'],
    [{ ...R, pages_total: 12, pages_no_text: 0 }, null, 'every page has text'],
    [{ ...R, chunk_count: 0, pages_total: 4, pages_no_text: 4 }, null, 'no text at all (that is hasNoText)'],
    [{ ...R, pages_total: 4, pages_no_text: 4 }, null, 'all pages counted without text'],
    [{ ...R }, null, 'a row stored before the count (fields missing)'],
    [{ ...R, pages_total: null, pages_no_text: null }, null, 'a file that is not a PDF (nulls)'],
    [{ ...R, status: 'processing', pages_total: 12, pages_no_text: 3 }, null, 'processing'],
    [{ ...R, status: 'error', pages_total: 12, pages_no_text: 3 }, null, 'failed'],
  ];
  for (const [row, want, name] of truth) {
    const got = pagesWithoutText(row);
    check(`${name}: ${JSON.stringify(want)}`, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
  }
});

console.log('2. MaterialCard, three states, Arabic and English');
await attempt('MaterialCard renders', async () => {
  const { MaterialCard } = await load('src/components/materials/MaterialCard.tsx');
  for (const loc of ['ar', 'en']) {
    const { [loc]: dict } = await load(`src/lib/i18n/locales/${loc}.ts`);
    const sd = dict.dashboard.subjectDetail;
    const labels = {
      statusReady: sd.statusReady, statusProcessing: sd.statusProcessing, statusError: sd.statusError,
      statusNoText: sd.statusNoText, noTextLine: sd.noTextLine, someNoTextLine: sd.someNoTextLine, noTextFix: sd.noTextFix,
      checklist: sd.checklist, summaryDone: sd.summaryDone, summaryTodo: sd.summaryTodo, quizDone: sd.quizDone,
      quizTodo: sd.quizTodo, added: sd.added, fileTypes: sd.fileTypes,
    };
    const card = (props) => renderToStaticMarkup(React.createElement(MaterialCard, {
      filename: 'x.pdf', fileType: 'pdf', status: 'ready', addedAt: '2026-11-03', locale: loc, hasSummary: false, hasQuiz: false, labels, ...props,
    }));
    const count = sd.someNoTextLine.replace('{n}', '3').replace('{total}', '12');
    const all = card({});
    check(`${loc} all pages: ready chip and study kit, no new line`, all.includes(`>${sd.statusReady}<`) && all.includes(sd.checklist) && !all.includes('data-kf-text-fix') && !all.includes('data-kf-some-no-text'));
    const some = card({ pagesNoText: { n: 3, total: 12 } });
    check(`${loc} some pages: "${count}" and the fix line`, some.includes(count) && some.includes(sd.noTextFix) && some.includes('data-kf-some-no-text'));
    check(`${loc} some pages: keeps the ready chip and the study kit`, some.includes(`>${sd.statusReady}<`) && some.includes(sd.checklist) && !some.includes(`>${sd.statusNoText}<`));
    const none = card({ noText: true, pagesNoText: null });
    check(`${loc} no text: chip, line and the fix line, no study kit`, none.includes(`>${sd.statusNoText}<`) && none.includes(sd.noTextLine) && none.includes(sd.noTextFix) && !none.includes(sd.checklist));
    const noneWithCounts = card({ noText: true, pagesNoText: { n: 3, total: 12 } });
    check(`${loc} no text wins over a count`, !noneWithCounts.includes('data-kf-some-no-text'));
    for (const s of ['processing', 'error']) {
      const html = card({ status: s, pagesNoText: { n: 3, total: 12 } });
      check(`${loc} ${s}: no count and no fix line`, !html.includes('data-kf-some-no-text') && !html.includes('data-kf-text-fix'));
    }
  }
});

console.log('3. The approved copy (docs/copy/ARABIC_STRINGS_app_v4.md, owner 2026-11-03)');
await attempt('copy loads', async () => {
  const { ar } = await load('src/lib/i18n/locales/ar.ts');
  const { en } = await load('src/lib/i18n/locales/en.ts');
  // The English is approved too, and no batch file asserts English, so it is
  // held here verbatim; the Arabic is held by verify-arabic-copy.mjs.
  const NB = ' ';
  check('en someNoTextLine is the approved text', en.dashboard.subjectDetail.someNoTextLine === 'Pages with no text: {n} of {total}.', en.dashboard.subjectDetail.someNoTextLine);
  check('en noTextFix is the approved text', en.dashboard.subjectDetail.noTextFix === `To get the text with your phone: photograph the page and copy its text with Google${NB}Lens, then paste it into a Google${NB}Docs document, save it as Word, and upload that file.`, JSON.stringify(en.dashboard.subjectDetail.noTextFix));
  const texts = [
    ['ar someNoTextLine', ar.dashboard.subjectDetail.someNoTextLine],
    ['ar noTextFix', ar.dashboard.subjectDetail.noTextFix],
    ['en someNoTextLine', en.dashboard.subjectDetail.someNoTextLine],
    ['en noTextFix', en.dashboard.subjectDetail.noTextFix],
  ];
  for (const [k, v] of texts) {
    check(`${k} exists`, typeof v === 'string' && v.length > 0);
    if (typeof v !== 'string') continue;
    check(`${k}: no em or en dash`, !/[—–]/.test(v), v);
    check(`${k}: no price, plan, upgrade or free wording`, !/(free|price|plan|upgrade|pro\b|\$|€|مجان|سعر|باق|اشتراك|ترقي|درهم|دولار)/i.test(v), v);
    check(`${k}: Western digits only`, !/[٠-٩۰-۹]/.test(v), v);
  }
  check('both lines keep their placeholders', ['{n}', '{total}'].every((p) => ar.dashboard.subjectDetail.someNoTextLine.includes(p) && en.dashboard.subjectDetail.someNoTextLine.includes(p)));
  for (const k of ['someNoTextLine', 'noTextFix']) {
    const latin = ar.dashboard.subjectDetail[k].replace(/Google (Lens|Docs)|{[a-z]+}/g, '').match(/[A-Za-z]+/g);
    check(`ar ${k}: no Latin except Google Lens and Google Docs`, latin === null, JSON.stringify(latin));
  }
  // A product name is one unit, joined by a no-break space, in both languages
  // (the 440 pt CI render once broke "Google | Drive" across two lines).
  for (const [loc, d] of [['ar', ar], ['en', en]]) {
    const v = d.dashboard.subjectDetail.noTextFix;
    check(`${loc} noTextFix: Google\\u00a0Lens and Google\\u00a0Docs never break`, v.includes(`Google${NB}Lens`) && v.includes(`Google${NB}Docs`) && !/Google /.test(v), JSON.stringify(v));
  }
});

console.log('4. The wiring');
{
  const route = read('src/app/api/ingest/route.ts');
  check('the route forwards pages_total and pages_no_text as numbers or null', /pages_total: pageCount\(ack\.pages_total\)/.test(route) && /pages_no_text: pageCount\(ack\.pages_no_text\)/.test(route) && /Number\.isInteger\(v\) && v >= 0 \? v : null/.test(route));
  const drop = read('src/components/upload/DropZone.tsx');
  check('the upload box reads the counts through pagesWithoutText', /pagesWithoutText\(\{[\s\S]{0,200}pages_total: data\.pages_total, pages_no_text: data\.pages_no_text/.test(drop));
  check('the upload box keeps a warning on screen (no 3 s reset)', /if \(!empty && !some\) setTimeout\(\(\) => setState\('idle'\), 3000\)/.test(drop));
  check('the upload box shows the fix line and a 44 px button for the next file', /\{warn && \([\s\S]{0,400}noTextFix[\s\S]{0,400}min-h-11/.test(drop));
  check('the new card gets the counts from the ack', /pages_total: data\.pages_total \?\? null, pages_no_text: data\.pages_no_text \?\? null/.test(drop));
  const page = read('src/app/[locale]/dashboard/knowledge/[id]/page.tsx');
  check('the subject page passes the counts to the card', /pagesNoText=\{pagesWithoutText\(doc\)\}/.test(page) && /\.select\('\*'\)/.test(page));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
