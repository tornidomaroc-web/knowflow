/**
 * Executable proof for register #121: six defects the owner saw on production
 * on 2026-09-25, each held here so it cannot come back.
 *
 *  1. Sign in with Apple is shown only when NEXT_PUBLIC_APPLE_SIGNIN=enabled
 *     (`src/lib/auth/providers.ts`); both auth pages gate the button on it.
 *  2. No dashboard canvas is centred beside the sidebar (`mx-auto max-w-*`
 *     on the five screens is gone), so RTL leaves no gap at the sidebar.
 *  3. The Continue card isolates the subject and the date in <bdi>, rendered.
 *  4. Suggestions come from the summary lead, or a title-like file name, never
 *     from an export-code file name; every topic is wrapped in FSI…PDI.
 *  5. One date format: `formatDate` exists, gives day-month-year in both
 *     locales with Western digits, and no `toLocaleDateString` remains in
 *     src; the activity list prints a translated platform label, rendered.
 *  6. The material card's actions are one grid with full-width buttons.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-production-defects.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const has = (p) => existsSync(resolvePath(ROOT, p));
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

// 1. The Apple gate.
{
  check(has('src/lib/auth/providers.ts'), 'src/lib/auth/providers.ts does not exist');
  for (const p of ['src/app/[locale]/login/page.tsx', 'src/app/[locale]/signup/page.tsx']) {
    const src = read(p);
    check(/APPLE_SIGNIN_ENABLED && <AppleButton/.test(src), `${p} shows the Apple button without the flag`);
  }
  if (has('src/lib/auth/providers.ts')) {
    const src = read('src/lib/auth/providers.ts');
    check(/NEXT_PUBLIC_APPLE_SIGNIN === 'enabled'/.test(src), 'the flag must be NEXT_PUBLIC_APPLE_SIGNIN=enabled and nothing else');
    const m = await load('src/lib/auth/providers.ts');
    check(m.APPLE_SIGNIN_ENABLED === (process.env.NEXT_PUBLIC_APPLE_SIGNIN === 'enabled'), 'APPLE_SIGNIN_ENABLED does not follow the env');
  }
}

// 2. The canvas.
for (const p of ['src/components/dashboard/StudentHome.tsx', 'src/components/dashboard/SubjectsList.tsx', 'src/components/dashboard/SettingsPanel.tsx', 'src/app/[locale]/dashboard/knowledge/[id]/page.tsx', 'src/app/[locale]/dashboard/knowledge/new/page.tsx']) {
  check(!/mx-auto max-w-/.test(read(p)), `${p} still centres its canvas beside the sidebar`);
}

// 3. The Continue card, rendered.
{
  const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
  const labels = Object.fromEntries(['welcome','askTitle','askDesc','newSubject','newSubjectDesc','subjects','streakLabel','streakUnit','streakZoneHint','recentActivity','planTitle','planName','ofWord','subjectsUsed','allSubjects','materialsWord','noSubjects','noSubjectsDesc','startTitle','whatTitle','upgradeCta','continueTitle','continueCta'].map((k) => [k, k]));
  labels.whatLines = ['a', 'b', 'c'];
  labels.activity = { platformWeb: 'الويب', noActivity: 'n', conversation: 'c', showLess: 's', viewAll: 'v', unknownKb: 'u' };
  labels.continueBody = 'كانت آخر محادثاتك في {subject}.';
  const html = renderToStaticMarkup(React.createElement(StudentHome, {
    stats: [], streak: null, askHref: '/ar/dashboard/agent', newSubjectHref: '#', subjectsHref: '#', upgradeHref: null, isPro: false,
    quotas: [], subjects: [], subjectsUsed: 0, subjectsLimit: 5, onboarding: [], labels, locale: 'ar',
    continueCard: { subject: 'Microeconomics', date: '24 سبتمبر 2026', href: '#' },
    recentActivity: [{ id: 'c1', created_at: '2026-09-24T21:40:00Z', platform: 'web', knowledge_bases: { name: 'Micro' } }],
  }));
  check(/<bdi[^>]*>Microeconomics<\/bdi>/.test(html), 'the Continue card does not isolate the subject name');
  check(/<bdi[^>]*>· 24 سبتمبر 2026<\/bdi>/.test(html), 'the Continue card does not isolate the date');
  // The label is a <bdi> since #122, so the match spans the tag.
  check(/<bdi>الويب</bdi> ·/.test(html) && !html.includes('WEB'), 'the activity list prints the platform enum instead of the translated label');
}

// 4. Suggestions.
{
  const m = await load('src/lib/ask-suggestions.ts');
  check(typeof m.materialTopic === 'function' && typeof m.summaryLead === 'function', 'materialTopic / summaryLead missing');
  if (typeof m.materialTopic === 'function') {
    check(m.materialTopic({ filename: 'xilvaroth-n11-20260810.pdf', lead: null }) === null, 'an export-code file name must not become a topic');
    check(m.materialTopic({ filename: 'Chapter 3 notes.pdf', lead: null }) === 'Chapter 3 notes', 'a title-like file name is a topic');
    check(m.materialTopic({ filename: 'مبادئ-الاقتصاد.md', lead: null }) === 'مبادئ-الاقتصاد', 'an Arabic file name is a topic');
    check(m.materialTopic({ filename: 'xilvaroth-n11-20260810.pdf', lead: 'يشرح الفصل مرونة الطلب السعرية وعواملها.' }) === 'يشرح الفصل مرونة الطلب السعرية وعواملها', 'a summary lead beats the file name (without its full stop)');
    check(m.summaryLead('First sentence here. Second one.') === 'First sentence here', 'summaryLead takes the first sentence, without its stop');
    check((m.summaryLead('x'.repeat(200)) ?? '').length <= 72, 'summaryLead is cut');
    const { ar } = await load('src/lib/i18n/locales/ar.ts');
    const qs = m.askSuggestions(ar.dashboard.suggestions, 'الاقتصاد', [{ filename: 'xilvaroth-n11-20260810.pdf', lead: null }, { filename: 'Lecture 2.pdf', lead: null }]);
    console.error(`ar suggestions: ${JSON.stringify(qs)}`);
    check(qs.every((q) => !q.includes('xilvaroth')), 'the export-code name leaked into a suggestion');
    check(qs.some((q) => q.includes('⁨Lecture 2⁩')), 'a Latin topic inside an Arabic question is not isolated with FSI…PDI');
    check(qs.every((q) => /⁨/.test(q)), 'every question must isolate its inserted names');
  }
  const chat = read('src/components/agent/ChatBox.tsx');
  check(/dir="auto"/.test(chat), 'the suggestion buttons do not set dir="auto"');
  const agent = read('src/app/[locale]/dashboard/agent/page.tsx');
  check(/summaryLead\(/.test(agent) && /select\('id, kb_id, filename, summary'\)/.test(agent), 'the agent page does not read the summary lead');
}

// 5. Dates.
{
  check(has('src/lib/format-date.ts'), 'src/lib/format-date.ts does not exist');
  if (has('src/lib/format-date.ts')) {
    const { formatDate } = await load('src/lib/format-date.ts');
    const ar = formatDate('2026-09-24T21:40:00Z', 'ar');
    const en = formatDate('2026-09-24T21:40:00Z', 'en');
    console.error(`formatDate: ar="${ar}" en="${en}"`);
    check(/2026/.test(ar) && /[؀-ۿ]/.test(ar) && !/[٠-٩]/.test(ar), 'the Arabic date must carry an Arabic month and Western digits');
    check(/^24 Sept? 2026$/.test(en), `the English date must be day-month-year, got "${en}"`);
    check(formatDate('garbage', 'en') === '', 'an invalid date must be empty, not "Invalid Date"');
  }
  const hits = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolvePath(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && e.name !== 'format-date.ts' && /toLocale(Date|Time)?String\(/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(ROOT.length + 1)); } };
  walk(resolvePath(ROOT, 'src'));
  check(hits.length === 0, `toLocale*String still used in: ${hits.join(', ')}`);
}

// 6. The action group.
{
  const card = read('src/components/materials/MaterialCard.tsx');
  check(/grid grid-cols-2 gap-2 sm:grid-cols-4/.test(card) && /:has\(>div\)\]:col-span-full/.test(card), 'the material card has no balanced action grid');
  for (const p of ['src/components/summary/SummarySection.tsx', 'src/components/quiz/QuizSection.tsx', 'src/components/materials/RenameMaterialControl.tsx', 'src/components/materials/DeleteMaterialControl.tsx']) {
    check(/w-full/.test(read(p)), `${p}'s idle button is not full width`);
  }
}

if (failures.length === 0) {
  console.log('PASS: the six production defects of 2026-09-25 are held.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
