/**
 * Executable proof that a subject name is shown in its own direction wherever
 * it appears. The 2026-11-03 phone test, Arabic UI: a Latin subject name was
 * cut at its START on Subjects ("…N11 PROD CHECK 2026-08-10"), and on Ask the
 * Latin name in a suggestion broke across two lines, so the sentence's full
 * stop read against the front of a Latin word (".CHECK 2026-08-10").
 *
 * WHAT IS ASSERTED, ON RENDERED MARKUP (react-dom/server), for four names (a
 * Latin code with digits, French, Arabic, mixed):
 *   1. SubjectsList, SubjectHeader, SubjectChips, RecentActivity and ChatBox's
 *      header each render the name in ONE element carrying `dir="auto"` and
 *      `data-username`, whose text is the name byte for byte.
 *   2. ChatBox's suggestions: the name sits in a `<bdi dir="auto">` laid out
 *      as an inline block (one piece, never split across lines), and the
 *      sentence's full stop is OUTSIDE it, so it keeps the sentence's direction.
 *   3. No bidi control character is in the rendered markup.
 *   4. From the source: StudentHome (subject progress, continue card) and
 *      ConversationSidebar print the name through UserName too, and no
 *      component prints a subject name raw (a screen-reader-only copy, which has
 *      no layout, is exempt).
 *
 * RED ON MAIN: UserName does not exist there and the names render in plain
 * `<h2>`/`<p>`, so assertion 1 fails on every case.
 *
 * Tier 0: no network, no credential, no database, no app.
 * Usage: node --experimental-strip-types scripts/verify-user-names.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, {
  '@/lib/supabase/client': 'export function createClient() { return { auth: {} }; }',
});
globalThis.__tsxHooksParams = { locale: 'ar' };
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

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/;

/** The element(s) whose whole text is `name`, with their opening tags. */
function nameElements(html, name) {
  const re = new RegExp(`<(\\w+)([^>]*)>${esc(name.replace(/&/g, '&amp;'))}</\\1>`, 'g');
  return [...html.matchAll(re)].map((m) => ({ tag: m[1], attrs: m[2] }));
}
const isolatedOk = (els) => els.length > 0 && els.every((e) => /\bdir="auto"/.test(e.attrs) && /data-username=""/.test(e.attrs));

const NAMES = ['ZZ N11 PROD CHECK 2026-08-10', 'Mathématiques', 'رياضيات', 'Physique الفيزياء'];
const stats = { materials: 3, ready: 3, processing: 0, failed: 0, summarised: 1, quizzed: 1, lastActivityAt: '2026-11-01T10:00:00Z', lastActivityIsAsk: true };

check('UserName exists (src/components/ui/UserName.tsx)', existsSync(resolvePath(ROOT, 'src/components/ui/UserName.tsx')));

const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { SubjectsList } = await load('src/components/dashboard/SubjectsList.tsx');
const { buildSubjectsLabels } = await load('src/lib/subjects-props.ts');
const { SubjectHeader } = await load('src/components/materials/SubjectHeader.tsx');
const { SubjectChips } = await load('src/components/agent/SubjectChips.tsx');
const { RecentActivity } = await load('src/components/dashboard/RecentActivity.tsx');
const { ChatBox } = await load('src/components/agent/ChatBox.tsx');

const h = React.createElement;
const list = renderToStaticMarkup(h(SubjectsList, {
  subjects: NAMES.map((name, i) => ({ id: `s${i}`, name, description: null, language: 'ar', href: `/ar/k/s${i}`, askHref: `/ar/a?kb=s${i}`, createdAt: '2026-09-01', stats })),
  newHref: '/ar/new', locale: 'ar', labels: buildSubjectsLabels(ar),
}));
const chips = renderToStaticMarkup(h(SubjectChips, { subjects: NAMES.map((name, i) => ({ id: `s${i}`, name })), selectedId: 's0', onPick: () => {} }));
const activity = renderToStaticMarkup(h(RecentActivity, {
  items: NAMES.map((name, i) => ({ id: `c${i}`, created_at: '2026-11-01T10:00:00Z', platform: 'web', knowledge_bases: { name } })),
  labels: { platformWeb: 'web', noActivity: 'n', conversation: 'c', showLess: 'l', viewAll: 'v', unknownKb: 'u' }, locale: 'ar',
}));

for (const name of NAMES) {
  console.log(`\n${name}`);
  check('SubjectsList title: dir="auto", data-username, text is the name', isolatedOk(nameElements(list, name).filter((e) => e.tag === 'h2')),
    JSON.stringify(nameElements(list, name)));
  const header = renderToStaticMarkup(h(SubjectHeader, { name, description: null, stats, askHref: '/ar/a', labels: { materials: 'm', summarised: 's', quizzed: 'q', stillProcessing: 'p', askAbout: 'a' } }));
  check('SubjectHeader h1: dir="auto", data-username', isolatedOk(nameElements(header, name).filter((e) => e.tag === 'h1')), JSON.stringify(nameElements(header, name)));
  check('SubjectChips (Ask subject bar): dir="auto", data-username', isolatedOk(nameElements(chips, name)), JSON.stringify(nameElements(chips, name)));
  check('RecentActivity: dir="auto", data-username', isolatedOk(nameElements(activity, name)), JSON.stringify(nameElements(activity, name)));

  const chat = renderToStaticMarkup(h(ChatBox, { kbId: 's', kbName: name, materials: [] }));
  check('ChatBox header: dir="auto", data-username', isolatedOk(nameElements(chat, name).filter((e) => e.tag === 'h2')), JSON.stringify(nameElements(chat, name)));
  const inSentence = nameElements(chat, name).filter((e) => e.tag === 'bdi');
  check('Ask suggestions: the name is a <bdi dir="auto"> inline block in each of the two',
    inSentence.length === 2 && inSentence.every((e) => /dir="auto"/.test(e.attrs) && /\binline-block\b/.test(e.attrs) && /\bmax-w-full\b/.test(e.attrs)),
    JSON.stringify(inSentence));
  const hardest = ar.dashboard.suggestions.hardest; // "… في {subject}."
  const after = hardest.split('{subject}')[1];
  check(`Ask suggestions: the sentence's "${after}" follows the isolate, outside it`,
    new RegExp(`${esc(name.replace(/&/g, '&amp;'))}</bdi>${esc(after)}`).test(chat));
  for (const [where, html] of [['list', list], ['chat', chat], ['header', header]]) {
    check(`no bidi control character in the ${where} markup`, !BIDI_CONTROLS.test(decode(html)));
  }
}

console.log('\nmaterial topics');
{
  // A topic (a summary's first sentence) sits inside quotes and may be long:
  // it stays a plain isolate that can wrap, as before. A one-piece box there
  // left the opening quote alone at a line's end (redesign-built, en-*-ask).
  const lead = 'The chapter explains elasticity of demand and its factors. More follows.';
  const chat = renderToStaticMarkup(h(ChatBox, { kbId: 's', kbName: 'Microeconomics', materials: [{ filename: 'a.pdf', lead }] }));
  const topic = 'The chapter explains elasticity of demand and its factors';
  const m = chat.match(new RegExp(`<bdi([^>]*)>${esc(topic)}</bdi>`));
  check('a material topic is a plain <bdi> (no inline block, can wrap)', !!m && !/inline-block|data-username/.test(m[1]), m ? m[0] : 'topic not found');
  check('the subject in the same suggestions is still UserName inline',
    /<bdi dir="auto" class="inline-block max-w-full" data-username="">Microeconomics<\/bdi>/.test(chat));
}

console.log('\nsource');
const home = read('src/components/dashboard/StudentHome.tsx');
check('StudentHome: subject progress name through UserName', /<UserName as="p"[^>]*>\{s\.name\}<\/UserName>/.test(home));
check('StudentHome: continue card subject through UserName inline', /<UserName inline[^>]*>\{continueCard\.subject\}<\/UserName>/.test(home));
const side = read('src/components/agent/ConversationSidebar.tsx');
check('ConversationSidebar: subject name through UserName', /<UserName as="p"[^>]*>\s*\{conv\.knowledge_bases\?\.name/.test(side));
const RAW = /<(p|h1|h2|span|bdi)\b(?![^>]*sr-only)[^>]*>\s*\{(s\.name|kb\.name|kbName|name|conv\.knowledge_bases\?\.name[^}]*|continueCard\.subject)\}/;
for (const f of ['src/components/dashboard/SubjectsList.tsx', 'src/components/dashboard/StudentHome.tsx', 'src/components/agent/ChatBox.tsx',
  'src/components/agent/ConversationSidebar.tsx', 'src/components/dashboard/RecentActivity.tsx', 'src/components/materials/SubjectHeader.tsx', 'src/components/agent/SubjectChips.tsx']) {
  const m = read(f).match(RAW);
  check(`${f}: no subject name printed outside UserName`, !m, m?.[0]);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
