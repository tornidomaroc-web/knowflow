/**
 * Executable proof for two defects the App Store screenshots showed on
 * 2026-10-09 (docs/PROGRESS.md), in the real SummarySection rendered inside
 * the real MaterialCard grid (react-dom/server):
 *
 * 1. A stored summary spans the card's whole action row. The grid widens only
 *    a child that holds a <div> ([&>*:has(>div)]:col-span-full); the summary
 *    block holds none, so on a phone it sat at half width beside an empty cell.
 * 2. The summary text takes its own direction (dir="auto", text-start): it is
 *    in the material's language, and an English summary on the Arabic page
 *    took the page's right-to-left and moved its full stops to the line
 *    starts. Arabic and English pages, Arabic and English summaries.
 *
 * Tier 0: no network, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-summary-layout.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { SummarySection } = await load('src/components/summary/SummarySection.tsx');

const summaries = {
  en: 'Photosynthesis is the process by which green plants convert light energy into chemical energy.',
  ar: 'البناء الضوئي عملية تحوّل فيها النباتات الخضراء طاقة الضوء إلى طاقة كيميائية.',
};
for (const page of ['en', 'ar']) {
  globalThis.__tsxHooksParams = { locale: page };
  for (const [lang, text] of Object.entries(summaries)) {
    const doc = { id: 'd', status: 'ready', summary: text, summary_is_partial: false };
    const html = renderToStaticMarkup(React.createElement(SummarySection, { doc }));
    const root = /^<div class="([^"]*)"/.exec(html)?.[1] ?? '';
    check(root.split(' ').includes('col-span-full'), `${page} page, ${lang} summary: the block spans the card's row (root classes: ${root})`);
    const p = /<p dir="auto" class="([^"]*)">([\s\S]*?)<\/p>/.exec(html);
    check(Boolean(p), `${page} page, ${lang} summary: the text carries dir="auto"`);
    check(Boolean(p) && p[1].split(' ').includes('text-start'), `${page} page, ${lang} summary: aligned to its own start`);
    check(Boolean(p) && p[2] === text, `${page} page, ${lang} summary: the text is unchanged`);
  }
}

// Without a summary the block is the generate button, a single grid cell, as before.
globalThis.__tsxHooksParams = { locale: 'en' };
const none = renderToStaticMarkup(React.createElement(SummarySection, { doc: { id: 'd', status: 'ready', summary: null, summary_is_partial: false } }));
check(!/col-span-full/.test(none), 'with no summary the generate button keeps its one cell');

if (failures.length === 0) {
  console.log(`PASS: ${passes} checks. A stored summary spans the card's row and reads in its own direction on both pages.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} of ${failures.length + passes}`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
