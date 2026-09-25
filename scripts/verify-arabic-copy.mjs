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
 *  6. ORDER AND PRECEDENCE. Files are named
 *     `ARABIC_STRINGS_<group>_v<N>.md` for a batch and
 *     `ARABIC_STRINGS_<group>_v<N>_fix[<M>].md` for a correction to it, and are
 *     applied in that order (group, version, then the batch before its fixes).
 *     A later row for a key SUPERSEDES the earlier one: only its value is
 *     asserted, so no key is ever asserted at two values. A superseding row is
 *     accepted only if its "old" equals the value it supersedes, so a correction
 *     cannot skip a step or be written against the wrong base. A file under
 *     docs/copy/ that looks like a batch but does not follow the naming fails
 *     the proof rather than being silently ignored.
 *
 * A new batch or correction is landed by adding its file under docs/copy/;
 * this proof picks it up with no change here.
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

// 1 + 5 + 6. The batch files, in order, with later rows superseding earlier ones.
const dir = resolvePath(ROOT, 'docs/copy');
const NAME = /^ARABIC_STRINGS_(.+)_v(\d+)(?:_fix(\d*))?\.md$/;
const candidates = readdirSync(dir).filter((f) => /^ARABIC_STRINGS_.+\.md$/.test(f) && f !== 'ARABIC_STRINGS.md');
for (const f of candidates) check(NAME.test(f), `${f}: not a batch name (ARABIC_STRINGS_<group>_v<N>[_fix[<M>]].md); it would be ignored`);
const batches = candidates
  .filter((f) => NAME.test(f))
  .map((f) => { const m = f.match(NAME); return { f, group: m[1], v: Number(m[2]), fix: m[3] === undefined ? -1 : Number(m[3] || 1) }; })
  .sort((a, b) => a.group.localeCompare(b.group) || a.v - b.v || a.fix - b.fix);
check(batches.length > 0, 'no approved batch file under docs/copy/');

// key -> { value, file } after every file is applied in order.
const approved = new Map();
let rowsTotal = 0;
let superseded = 0;
for (const { f } of batches) {
  const md = readFileSync(resolvePath(dir, f), 'utf8');
  const rows = [...md.matchAll(/^\| `([^`]+)` \| (.*?) \| (.*?) \|\s*$/gm)].map((m) => ({ key: m[1], neu: m[2], old: m[3] }));
  check(rows.length > 0, `${f}: no rows parsed`);
  rowsTotal += rows.length;
  const seen = new Set();
  for (const r of rows) {
    check(!seen.has(r.key), `${f}: ${r.key} appears twice`);
    seen.add(r.key);
    check(ph(r.neu) === ph(r.old), `${f}: ${r.key} changes its placeholders ({${ph(r.old)}} -> {${ph(r.neu)}})`);
    if (!A.has(r.key)) { check(false, `${f}: ${r.key} is not a key in ar.ts`); continue; }
    const prior = approved.get(r.key);
    if (prior) {
      superseded++;
      check(r.old === prior.value, `${f}: ${r.key} supersedes ${prior.file}, but its old value ${JSON.stringify(r.old)} is not the value that file approved, ${JSON.stringify(prior.value)}`);
    }
    approved.set(r.key, { value: r.neu, file: f });
  }
}
let wrong = 0;
for (const [key, { value, file }] of approved) {
  if (A.get(key) !== value) {
    wrong++;
    if (wrong <= 5) check(false, `${key} is ${JSON.stringify(A.get(key))}, approved ${JSON.stringify(value)} (${file})`);
  }
}
if (wrong > 5) check(false, `${wrong - 5} more keys do not hold their approved value`);
for (const { f } of batches) {
  const keys = [...approved.values()].filter((a) => a.file === f).length;
  console.error(`${f}: ${keys} keys asserted from this file`);
}
console.error(`${approved.size} keys asserted, ${superseded} earlier rows superseded, ${approved.size - wrong} hold`);

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
  console.log(`PASS: ${approved.size} approved Arabic strings hold in ar.ts (${rowsTotal} rows in ${batches.length} files, ${superseded} superseded); the key set, every placeholder and Western digits are unchanged.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
