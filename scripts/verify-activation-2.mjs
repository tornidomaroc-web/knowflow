/**
 * Executable proof for activation fix 2 (the 2026-11-09 audit, cause #4):
 * while the student has no material, the "Three steps to your first answer"
 * card is the first card under the greeting and the Ask card comes after it;
 * from the first material on, the home keeps today's order.
 *
 * The REAL things under test:
 *   - `homeStepsFirst` (`src/lib/home-order.ts`): true exactly while step 2
 *     ("upload") is not done, the same `materials > 0` rule step 2 uses.
 *   - `StudentHome`, RENDERED with react-dom/server through
 *     `scripts/lib/tsx-hooks.mjs` from the real dictionary and the real
 *     `buildOnboarding` / `buildHomeLabels`: the order of the cards in the
 *     markup for zero subjects, one subject with no file, and one file.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-activation-2.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const has = (p) => existsSync(resolvePath(ROOT, p));

const ID = '3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c';
const CASES = [
  { name: 'zero subjects', counts: { subjects: 0, materials: 0, conversations: 0, newestSubjectId: null }, first: true },
  { name: 'one subject, zero files', counts: { subjects: 1, materials: 0, conversations: 0, newestSubjectId: ID }, first: true },
  { name: 'one subject, one file (today\'s order)', counts: { subjects: 1, materials: 1, conversations: 0, newestSubjectId: ID }, first: false },
  // All three steps done: the steps card is not drawn at all, as today.
  { name: 'files and conversations (today\'s order, no steps card)', counts: { subjects: 4, materials: 13, conversations: 61, newestSubjectId: ID }, first: false, noSteps: true },
];

const { buildOnboarding, buildHomeLabels, buildHrefs, buildQuotas } = await load('src/lib/home-props.ts');
const { useTranslation } = await load('src/lib/i18n/index.ts');

// 1. The helper.
check(has('src/lib/home-order.ts'), 'src/lib/home-order.ts does not exist (the card-order helper)');
if (has('src/lib/home-order.ts')) {
  const { homeStepsFirst } = await load('src/lib/home-order.ts');
  for (const l of ['ar', 'en']) {
    const home = useTranslation(l).dashboard.home;
    for (const c of CASES) {
      const got = homeStepsFirst(buildOnboarding(home, l, c.counts));
      check(got === c.first, `${l} ${c.name}: homeStepsFirst = ${got}, want ${c.first}`);
    }
  }
  check(homeStepsFirst([]) === false, 'no onboarding steps at all: keep today\'s order');
}

// 2. The rendered order.
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
for (const l of ['ar', 'en']) {
  const t = useTranslation(l);
  const home = t.dashboard.home;
  for (const platform of ['native', 'web']) {
    for (const c of CASES) {
      const html = renderToStaticMarkup(React.createElement(StudentHome, {
        stats: [], streak: null, ...buildHrefs(l, platform), isPro: false,
        quotas: buildQuotas(home, { query: 0, upload: 0 }, { query: 10, upload: 5 }),
        subjects: c.counts.subjects ? [{ id: ID, name: 'Biology', materials: c.counts.materials, summarised: 0 }] : [],
        subjectsUsed: c.counts.subjects, subjectsLimit: 5,
        onboarding: buildOnboarding(home, l, c.counts),
        labels: buildHomeLabels({ home, subjectsNavLabel: t.dashboard.nav.knowledge, settingsLabel: t.dashboard.nav.settings, cont: t.dashboard.continueCard, isPro: false, streakUnit: '' }),
        recentActivity: [], locale: l,
      }));
      const at = {
        greeting: html.indexOf('<header'),
        steps: html.indexOf(`>${home.startTitle}<`),
        ask: html.indexOf('data-kf-ask-title'),
        twoUp: html.indexOf('data-kf-twoup'),
        allowance: html.indexOf('data-kf-meter'),
        subjects: html.indexOf('kf-all-link'),
      };
      const where = `${l} ${platform} ${c.name}`;
      check(Object.entries(at).every(([k, i]) => (k === 'steps' && c.noSteps ? i === -1 : i >= 0)), `${where}: a card is missing from (or, with every step done, the steps card is still in) the markup ${JSON.stringify(at)}`);
      if (c.noSteps) {
        check(at.greeting < at.ask && at.ask < at.twoUp && at.twoUp < at.allowance && at.allowance < at.subjects, `${where}: today's order must hold ${JSON.stringify(at)}`);
      } else if (c.first) {
        check(at.greeting < at.steps && at.steps < at.ask, `${where}: the steps card must come right after the greeting and before the Ask card ${JSON.stringify(at)}`);
        check(at.ask < at.twoUp && at.twoUp < at.allowance && at.allowance < at.subjects, `${where}: everything after the Ask card must keep its order ${JSON.stringify(at)}`);
      } else {
        check(at.greeting < at.ask && at.ask < at.twoUp && at.twoUp < at.allowance && at.allowance < at.steps && at.steps < at.subjects, `${where}: today's order must hold (greeting, Ask, two-up, allowance, steps, subjects) ${JSON.stringify(at)}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s), ${passed} passed:`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`verify-activation-2: ${passed} checks passed, 0 failures`);
