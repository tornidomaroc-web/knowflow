/**
 * Executable proof for the owner's Arabic microcopy batches (register #123).
 *
 * The approved batch files live in `docs/copy/ARABIC_STRINGS_*_v*.md`, one
 * table row per key: key | new Arabic | old Arabic. This proof reads every
 * such file and holds the REAL dictionary (`src/lib/i18n/locales/ar.ts`) to it:
 *
 *  1. Every row's key exists in ar.ts and holds exactly the approved new value.
 *  2. The key set did not change: ar.ts has exactly the English keys plus the
 *     four Arabic-only plural forms (streakUnit zero/two/few/many), 380 leaves.
 *  3. Every {placeholder} survived: on every key, the Arabic placeholders are
 *     the English placeholders, as a set.
 *  4. Western digits only: no Arabic-Indic or Eastern Arabic-Indic digit
 *     anywhere in ar.ts.
 *  5. The batch files are internally sound: no key twice, no placeholder
 *     added or dropped between the old and new column.
 *
 * A new batch is landed by adding its file under docs/copy/; this proof picks
 * it up with no change here.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-arabic-copy.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');

const leaves = (o, p = [], out = new Map()) => {
  if (typeof o === 'string') out.set(p.join('.'), o);
  else if (Array.isArray(o)) o.forEach((v, i) => leaves(v, [...p, String(i)], out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) leaves(v, [...p, k], out);
  return out;
};
const A = leaves(ar);
const E = leaves(en);
const ph = (s) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');

// 1 + 5. The batch files.
const dir = resolvePath(ROOT, 'docs/copy');
const batches = readdirSync(dir).filter((f) => /^ARABIC_STRINGS_.+_v\d+\.md$/.test(f)).sort();
check(batches.length > 0, 'no approved batch file under docs/copy/');
let rowsTotal = 0;
for (const f of batches) {
  const md = readFileSync(resolvePath(dir, f), 'utf8');
  const rows = [...md.matchAll(/^\| `([^`]+)` \| (.*?) \| (.*?) \|\s*$/gm)].map((m) => ({ key: m[1], neu: m[2], old: m[3] }));
  check(rows.length > 0, `${f}: no rows parsed`);
  rowsTotal += rows.length;
  const seen = new Set();
  let wrong = 0;
  for (const r of rows) {
    check(!seen.has(r.key), `${f}: ${r.key} appears twice`);
    seen.add(r.key);
    check(ph(r.neu) === ph(r.old), `${f}: ${r.key} changes its placeholders ({${ph(r.old)}} -> {${ph(r.neu)}})`);
    if (!A.has(r.key)) { check(false, `${f}: ${r.key} is not a key in ar.ts`); continue; }
    if (A.get(r.key) !== r.neu) {
      wrong++;
      if (wrong <= 5) check(false, `${f}: ${r.key} is ${JSON.stringify(A.get(r.key))}, approved ${JSON.stringify(r.neu)}`);
    }
  }
  if (wrong > 5) check(false, `${f}: ${wrong - 5} more keys do not hold their approved value`);
  console.error(`${f}: ${rows.length} rows, ${rows.length - wrong} hold their approved value`);
}

// 2. The key set.
{
  const pluralOnly = ['dashboard.home.streakUnit.zero', 'dashboard.home.streakUnit.two', 'dashboard.home.streakUnit.few', 'dashboard.home.streakUnit.many'];
  const onlyAr = [...A.keys()].filter((k) => !E.has(k)).sort();
  const onlyEn = [...E.keys()].filter((k) => !A.has(k)).sort();
  check(onlyAr.join() === [...pluralOnly].sort().join(), `keys only in ar.ts: ${onlyAr.join(', ') || '(none)'}; expected the four plural forms`);
  check(onlyEn.length === 0, `keys missing from ar.ts: ${onlyEn.join(', ')}`);
  check(A.size === 380, `ar.ts has ${A.size} leaves, expected 380`);
}

// 3. Placeholders on every key.
{
  const diff = [...A.keys()].filter((k) => E.has(k) && ph(A.get(k)) !== ph(E.get(k)));
  check(diff.length === 0, `placeholders differ from English on: ${diff.join(', ')}`);
}

// 4. Western digits.
{
  const eastern = [...A.entries()].filter(([, v]) => /[٠-٩۰-۹]/.test(v)).map(([k]) => k);
  check(eastern.length === 0, `Eastern Arabic digits in: ${eastern.join(', ')}`);
}

if (failures.length === 0) {
  console.log(`PASS: ${rowsTotal} approved Arabic strings hold in ar.ts; the key set, every placeholder and Western digits are unchanged.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
