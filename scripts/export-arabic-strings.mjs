/**
 * EXPORT EVERY ARABIC UI STRING, GROUPED BY SCREEN, WITH ITS KEY AND ITS
 * ENGLISH COUNTERPART, so the owner can rewrite the microcopy in one place.
 *
 * Reads the two REAL dictionaries (`src/lib/i18n/locales/{ar,en}.ts`) and
 * writes `docs/copy/ARABIC_STRINGS.md`: one section per top-level key (a
 * screen or a shared block), one table row per leaf. Arrays are numbered
 * (`steps[0].title`), plural forms are spelled out (`streakUnit.few`).
 * Placeholders such as `{limit}` are part of the string and must survive a
 * rewrite; the header says so. Nothing is rewritten here: the file is the
 * raw material.
 *
 * Usage: node --experimental-strip-types scripts/export-arabic-strings.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const { ar } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/i18n/locales/ar.ts')).href);
const { en } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/i18n/locales/en.ts')).href);

const SCREEN_NAMES = {
  nav: 'Site header and nav',
  landing: 'Landing (sections)',
  hero: 'Landing (hero)',
  answer: 'Landing (hero demo)',
  howItWorks: 'Landing (how it works)',
  cta: 'Landing (final call)',
  footer: 'Footer',
  pricing: 'Pricing',
  auth: 'Login, signup, password pages',
  about: 'About',
  contact: 'Contact',
  dashboard: 'Signed-in app',
};

function walk(node, path, out) {
  if (node == null) return;
  if (typeof node === 'string') { out.push({ key: path.join('.'), value: node }); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, [...path.slice(0, -1), `${path[path.length - 1]}[${i}]`], out)); return; }
  if (typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, [...path, k], out);
}
const arRows = []; walk(ar, [], arRows);
const enMap = new Map(); const enRows = []; walk(en, [], enRows); for (const r of enRows) enMap.set(r.key, r.value);

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const groups = new Map();
for (const r of arRows) {
  const top = r.key.split('.')[0];
  // The signed-in app is large: split it by its second segment (home, settings, …).
  const g = top === 'dashboard' ? `dashboard.${r.key.split('.')[1]}` : top;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(r);
}

let md = `# Every Arabic UI string, by screen

Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/export-arabic-strings.mjs\` from
\`src/lib/i18n/locales/ar.ts\` and \`en.ts\`. **${arRows.length} Arabic strings.**

How to use it: rewrite the Arabic column in a friendly voice for young
students; keep every \`{placeholder}\` exactly as it is (it is filled by the
app); keep the plural forms (\`one\`, \`two\`, \`few\`, \`many\`, \`other\`) as
separate rows; leave product names (KnowFlow, Google, Apple) and file types as
they are. When done, hand the file back and the keys go into \`ar.ts\`; this
file is not read by the app.

`;
for (const [g, rows] of groups) {
  const top = g.split('.')[0];
  const title = g.startsWith('dashboard.') ? `Signed-in app: ${g.slice('dashboard.'.length)}` : (SCREEN_NAMES[top] ?? top);
  md += `## ${title} (\`${g}\`)\n\n| Key | العربية | English |\n|---|---|---|\n`;
  for (const r of rows) md += `| \`${r.key}\` | ${cell(r.value)} | ${cell(enMap.get(r.key) ?? '')} |\n`;
  md += '\n';
}
const missing = arRows.filter((r) => !enMap.has(r.key)).map((r) => r.key);
if (missing.length) md += `\n## Keys with no English counterpart\n\n${missing.map((k) => `- \`${k}\``).join('\n')}\n`;

mkdirSync(resolvePath(ROOT, 'docs/copy'), { recursive: true });
const outPath = resolvePath(ROOT, 'docs/copy/ARABIC_STRINGS.md');
writeFileSync(outPath, md);
console.log(`wrote ${outPath}: ${arRows.length} strings in ${groups.size} groups${missing.length ? `, ${missing.length} without English` : ''}`);
