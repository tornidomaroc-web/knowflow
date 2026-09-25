/**
 * Executable proof for register #85, part 2 of docs/design/SIGNED_IN_FEATURES.md:
 * the signed-in screens carry what the leading apps carry, computed from rows
 * the app already writes.
 *
 * The REAL things under test:
 *   - `subjectStats` (`src/lib/subject-stats.ts`): materials, summarised,
 *     quizzed, processing and last activity per subject from document, quiz and
 *     conversation rows; a failed material counts as a material and never as
 *     progress; the newest conversation beats the newest material.
 *   - `askSuggestions` (`src/lib/ask-suggestions.ts`): three questions at most,
 *     material names without extensions, a subject with no materials still
 *     gets one, both templates filled.
 *   - `SubjectsList`, `SubjectHeader` and `MaterialCard`, RENDERED with
 *     react-dom/server through `scripts/lib/tsx-hooks.mjs`: the counts, the
 *     bar, the Ask link, the study-kit checklist, the status in words.
 *   - `ChatBox` reads `materialNames` and renders the suggestions when empty;
 *     `KBSelector` honours `?kb=`; the subjects page and the agent page make
 *     the reads (read from source).
 *   - The spec exists and names its three parts.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-signed-in-features.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const has = (p) => existsSync(resolvePath(ROOT, p));

// 1. The numbers.
check(has('src/lib/subject-stats.ts'), 'src/lib/subject-stats.ts does not exist');
if (has('src/lib/subject-stats.ts')) {
  const { subjectStats, summarisedPercent } = await load('src/lib/subject-stats.ts');
  const docs = [
    { id: 'a', kb_id: 'k1', status: 'ready', summary_generated_at: '2026-09-20', created_at: '2026-09-01' },
    { id: 'b', kb_id: 'k1', status: 'ready', summary_generated_at: null, created_at: '2026-09-02' },
    { id: 'c', kb_id: 'k1', status: 'processing', summary_generated_at: null, created_at: '2026-09-03' },
    { id: 'd', kb_id: 'k1', status: 'error', summary_generated_at: '2026-09-04', created_at: '2026-09-04' },
    { id: 'e', kb_id: 'k2', status: 'ready', summary_generated_at: null, created_at: '2026-09-05' },
  ];
  const quizzes = [{ document_id: 'a' }, { document_id: 'a' }, { document_id: 'd' }];
  const convos = [{ kb_id: 'k1', created_at: '2026-09-10' }];
  const m = subjectStats(docs, quizzes, convos);
  const k1 = m.get('k1');
  console.error(`k1 = ${JSON.stringify(k1)}`);
  check(k1?.materials === 4 && k1.ready === 2 && k1.processing === 1 && k1.failed === 1, 'k1 counts are wrong');
  check(k1?.summarised === 1, 'a failed material must not count as summarised');
  check(k1?.quizzed === 1, 'two quizzes on one material count once, and a failed material never');
  check(k1?.lastActivityAt === '2026-09-10' && k1.lastActivityIsAsk === true, 'the newest conversation must win the last activity');
  const k2 = m.get('k2');
  check(k2?.lastActivityAt === '2026-09-05' && k2.lastActivityIsAsk === false, 'with no conversation the newest material is the last activity');
  check(summarisedPercent(k1) === 25 && summarisedPercent({ materials: 0, summarised: 0 }) === 0, 'summarisedPercent');
}

// 2. The suggestions.
check(has('src/lib/ask-suggestions.ts'), 'src/lib/ask-suggestions.ts does not exist');
if (has('src/lib/ask-suggestions.ts')) {
  const { askSuggestions, materialTitle } = await load('src/lib/ask-suggestions.ts');
  const { en } = await load('src/lib/i18n/locales/en.ts');
  const { ar } = await load('src/lib/i18n/locales/ar.ts');
  check(en.dashboard.suggestions && ar.dashboard.suggestions, 'the suggestion templates are missing from a dictionary');
  if (en.dashboard.suggestions && ar.dashboard.suggestions) {
  check(materialTitle('Chapter 3.pdf') === 'Chapter 3' && materialTitle('مبادئ-الاقتصاد.md') === 'مبادئ-الاقتصاد', 'materialTitle strips the extension');
  // Materials are objects since #121: a name and the summary's first sentence.
  const mat = (filename, lead = null) => ({ filename, lead });
  const s = askSuggestions(en.dashboard.suggestions, 'Statistics', [mat('Lecture 1.pdf'), mat('Problem set.docx'), mat('Extra.txt')]);
  console.error(`en suggestions: ${JSON.stringify(s)}`);
  check(s.length === 3, 'three suggestions with materials');
  check(s[0].includes('Lecture 1') && !s[0].includes('.pdf'), 'the first suggestion names the first material without its extension');
  check(s[1].includes('Statistics'), 'the second names the subject');
  check(s.every((q) => !/\{(subject|material)\}/.test(q)), 'every placeholder is filled');
  const none = askSuggestions(en.dashboard.suggestions, 'Statistics', []);
  check(none.length >= 2 && none.every((q) => q.includes('Statistics')), 'a subject with no materials still gets questions about itself');
  const arS = askSuggestions(ar.dashboard.suggestions, 'الإحصاء', [mat('محاضرة 1.pdf')]);
  check(arS.length >= 2 && arS[0].includes('محاضرة 1'), 'Arabic templates fill the same way');
  }
}

// 3. The screens, rendered.
{
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  check(has('src/components/dashboard/SubjectsList.tsx'), 'SubjectsList missing');
  const { SubjectsList } = await load('src/components/dashboard/SubjectsList.tsx');
  const hasNew = has('src/components/materials/SubjectHeader.tsx') && has('src/components/materials/MaterialCard.tsx');
  check(hasNew, 'SubjectHeader or MaterialCard missing');
  if (hasNew) {
  const labels = { title: 'Subjects', subtitle: 's', newSubject: 'New', emptyTitle: 'e', emptyPrompt: 'p', materials: 'Materials', summarised: 'Summarised', quizzed: 'Quizzed', processing: 'still processing', noMaterials: 'No materials yet', lastAsked: 'Last asked', lastAdded: 'Last added', created: 'Created', ask: 'Ask', addMaterial: 'Add material' };
  const stats = { materials: 8, ready: 7, processing: 1, failed: 0, summarised: 6, quizzed: 3, lastActivityAt: '2026-09-24T21:40:00Z', lastActivityIsAsk: true };
  const html = renderToStaticMarkup(React.createElement(SubjectsList, {
    subjects: [
      { id: 's1', name: 'Micro', description: null, language: 'ar', href: '/en/dashboard/knowledge/s1', askHref: '/en/dashboard/agent?kb=s1', createdAt: '2026-09-01', stats },
      { id: 's2', name: 'Empty', description: null, language: 'en', href: '/en/dashboard/knowledge/s2', askHref: '/en/dashboard/agent?kb=s2', createdAt: '2026-09-01', stats: { materials: 0, ready: 0, processing: 0, failed: 0, summarised: 0, quizzed: 0, lastActivityAt: null, lastActivityIsAsk: false } },
    ],
    newHref: '/en/dashboard/knowledge/new', locale: 'en', labels,
  }));
  check(html.includes('href="/en/dashboard/agent?kb=s1"'), 'the subject card has no Ask link with ?kb=');
  // The progress is a ring since the visual language (VISUAL_LANGUAGE.md rule 2): the percent sits inside it.
  check(/>75%<\/span>/.test(html), 'the summarised ring is not 6 of 8 (75%)');
  check(html.includes('Last asked'), 'the last activity is not shown');
  check(html.includes('No materials yet') && !html.includes('href="/en/dashboard/agent?kb=s2"'), 'an empty subject must say so and offer no Ask');
  check(html.includes('1 still processing'), 'processing materials are not shown');

  const { SubjectHeader } = await load('src/components/materials/SubjectHeader.tsx');
  const hh = renderToStaticMarkup(React.createElement(SubjectHeader, { name: 'Micro', description: null, stats, askHref: '/en/dashboard/agent?kb=s1', labels: { materials: 'Materials', summarised: 'Summarised', quizzed: 'Quizzed', stillProcessing: 'still processing', askAbout: 'Ask about this subject' } }));
  check(hh.includes('Ask about this subject') && hh.includes('href="/en/dashboard/agent?kb=s1"'), 'the subject header has no Ask action');

  const { MaterialCard } = await load('src/components/materials/MaterialCard.tsx');
  const cl = { chunks: 'chunks', statusReady: 'Ready', statusProcessing: 'Processing', statusError: 'Failed', checklist: 'Study kit', summaryDone: 'Summary ready', summaryTodo: 'No summary yet', quizDone: 'Quiz ready', quizTodo: 'No quiz yet', added: 'Added' };
  const c1 = renderToStaticMarkup(React.createElement(MaterialCard, { filename: 'a.pdf', fileType: 'pdf', chunkCount: 12, status: 'ready', addedAt: '2026-09-01', locale: 'en', hasSummary: true, hasQuiz: false, labels: cl }));
  check(c1.includes('Summary ready') && c1.includes('No quiz yet') && c1.includes('Ready') && !c1.includes('>ready<'), 'the material card checklist or status is wrong');
  const c2 = renderToStaticMarkup(React.createElement(MaterialCard, { filename: 'b.pdf', fileType: 'pdf', chunkCount: 0, status: 'processing', addedAt: '2026-09-01', locale: 'en', hasSummary: false, hasQuiz: false, labels: cl }));
  check(c2.includes('Processing') && !c2.includes('Study kit'), 'a processing material must not show a study kit yet');
  }
}

// 4. The wiring, read.
{
  const chat = read('src/components/agent/ChatBox.tsx');
  check(/materials/.test(chat) && /askSuggestions\(/.test(chat), 'ChatBox does not render suggestions');
  const sel = read('src/components/agent/KBSelector.tsx');
  check(/searchParams\.get\('kb'\)/.test(sel), 'KBSelector does not honour ?kb=');
  const agentPage = read('src/app/[locale]/dashboard/agent/page.tsx');
  check(/from\('documents'\)/.test(agentPage) && /materials=/.test(agentPage), 'the agent page does not load material names');
  const subjectsPage = read('src/app/[locale]/dashboard/knowledge/page.tsx');
  check(/subjectStats\(/.test(subjectsPage) && /from\('quizzes'\)/.test(subjectsPage) && /from\('conversations'\)/.test(subjectsPage), 'the subjects page does not compute the stats');
  const home = read('src/components/dashboard/StudentHome.tsx');
  check(/continueCard/.test(home), 'the home has no Continue card');
  const spec = has('docs/design/SIGNED_IN_FEATURES.md') ? read('docs/design/SIGNED_IN_FEATURES.md') : '';
  check(/## 1\./.test(spec) && /## 2\./.test(spec) && /## 3\./.test(spec), 'docs/design/SIGNED_IN_FEATURES.md must exist with its three parts');
}

if (failures.length === 0) {
  console.log('PASS: the subjects, subject, ask and home screens carry progress, a study kit, suggested questions and a way back, from rows the app already writes.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
