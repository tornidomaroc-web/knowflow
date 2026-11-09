/**
 * Executable proof for activation fix 1 (the 2026-11-09 audit, cause #1):
 * a student who has just created a subject is taken INTO it, where the
 * upload tile is, instead of back to the list; and the home's step 2
 * ("Upload your materials") leads to the newest subject while there is a
 * subject and no file.
 *
 * The REAL things under test:
 *   - `subjectCreatedPath` (`src/lib/subject-create.ts`): the page a created
 *     subject opens on, with the list as the fallback when the insert
 *     returned no usable id.
 *   - `buildOnboarding` (`src/lib/home-props.ts`): step 2's href.
 *   - The new-subject page asks the insert for the id and routes through the
 *     helper; the dashboard passes the newest subject it already loads (read
 *     from source, no new query).
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-activation-1.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const has = (p) => existsSync(resolvePath(ROOT, p));

const ID = '3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c';

// 1. Where a created subject opens.
check(has('src/lib/subject-create.ts'), 'src/lib/subject-create.ts does not exist (the redirect helper)');
if (has('src/lib/subject-create.ts')) {
  const { subjectCreatedPath } = await load('src/lib/subject-create.ts');
  for (const l of ['ar', 'en']) {
    check(subjectCreatedPath(l, ID) === `/${l}/dashboard/knowledge/${ID}`, `${l}: a created subject must open on its own page, got ${subjectCreatedPath(l, ID)}`);
    for (const bad of [undefined, null, '', 'not-a-uuid', '../settings', `${ID}/x`]) {
      check(subjectCreatedPath(l, bad) === `/${l}/dashboard/knowledge`, `${l}: id ${JSON.stringify(bad)} must fall back to the list, got ${subjectCreatedPath(l, bad)}`);
    }
  }
}

// 2. The new-subject page asks for the id and uses the helper.
{
  const src = read('src/app/[locale]/dashboard/knowledge/new/page.tsx');
  check(/\.insert\(\{[\s\S]*?\}\)\s*\.select\('id'\)\s*\.single\(\)/.test(src), "new/page.tsx: the insert must return the id (.select('id').single())");
  check(/router\.push\(subjectCreatedPath\(safeLocale,/.test(src), 'new/page.tsx: after a successful insert it must push subjectCreatedPath(safeLocale, id)');
  check(!/router\.push\(`\/\$\{safeLocale\}\/dashboard\/knowledge`\)/.test(src), 'new/page.tsx: the unconditional push to the list is still there');
  // Unchanged: the fields, the limit check and its error path.
  check(/user_id: user\.id,\s*name,\s*description,\s*language/.test(src), 'new/page.tsx: the insert fields changed');
  check(src.includes("fetch('/api/check-limit')") && src.includes('errorLimitApp'), 'new/page.tsx: the subject limit check or its error path changed');
}

// 3. The home's step 2.
{
  const { buildOnboarding, appHrefs } = await load('src/lib/home-props.ts');
  const { useTranslation } = await load('src/lib/i18n/index.ts');
  for (const l of ['ar', 'en']) {
    const home = useTranslation(l).dashboard.home;
    const h = appHrefs(l);
    const step2 = (counts) => buildOnboarding(home, l, counts).find((s) => s.key === 'upload')?.href;
    check(step2({ subjects: 1, materials: 0, conversations: 0, newestSubjectId: ID }) === `/${l}/dashboard/knowledge/${ID}`, `${l}: one subject, no file: step 2 must open the newest subject, got ${step2({ subjects: 1, materials: 0, conversations: 0, newestSubjectId: ID })}`);
    check(step2({ subjects: 3, materials: 0, conversations: 0, newestSubjectId: ID }) === `/${l}/dashboard/knowledge/${ID}`, `${l}: three subjects, no file: step 2 must open the newest subject`);
    check(step2({ subjects: 0, materials: 0, conversations: 0, newestSubjectId: null }) === h.subjectsHref, `${l}: no subject: step 2 must keep the list link`);
    check(step2({ subjects: 1, materials: 2, conversations: 0, newestSubjectId: ID }) === h.subjectsHref, `${l}: files already: step 2 must keep the list link`);
    check(step2({ subjects: 1, materials: 0, conversations: 0 }) === h.subjectsHref, `${l}: no newest id passed: step 2 must keep the list link`);
    check(step2({ subjects: 1, materials: 0, conversations: 0, newestSubjectId: '../settings' }) === h.subjectsHref, `${l}: a malformed id must keep the list link`);
    const steps = buildOnboarding(home, l, { subjects: 1, materials: 0, conversations: 0, newestSubjectId: ID });
    check(steps[0].href === h.newSubjectHref && steps[2].href === h.askHref, `${l}: steps 1 and 3 must be unchanged`);
    check(steps[0].done === true && steps[1].done === false && steps[2].done === false, `${l}: the done flags must be unchanged`);
  }
}

// 4. The dashboard passes the newest subject from the rows it already loads.
{
  const src = read('src/app/[locale]/dashboard/page.tsx');
  check(/newestSubjectId:\s*subjectRows\.data\?\.\[0\]\?\.id/.test(src), 'dashboard/page.tsx: buildOnboarding must get newestSubjectId from subjectRows (ordered newest first)');
  check(/from\('knowledge_bases'\)\.select\('id, name'\)\.order\('created_at', \{ ascending: false \}\)/.test(src), 'dashboard/page.tsx: subjectRows must stay ordered newest first');
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s), ${passed} passed:`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`verify-activation-1: ${passed} checks passed, 0 failures`);
