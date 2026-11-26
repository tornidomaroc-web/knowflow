/**
 * Executable proof for item 4j, tap feedback: a tap changes the screen at once,
 * and a button that starts server work cannot start it twice.
 *
 *   1. THE LOADING SCREENS. Each of the five segments that wait on the server
 *      (the home, the subjects list, a subject, Ask, Settings) has a
 *      loading.tsx that draws ITS skeleton, and no other loading.tsx exists
 *      under the dashboard. A loading.tsx on `dashboard/` or `knowledge/`
 *      would also wrap the segments that have none (new subject, the
 *      paywall), so the student would see the wrong screen's shape there;
 *      that is why the home and the list live in route groups. Forced cases:
 *      a planted `dashboard/loading.tsx`, a planted `knowledge/loading.tsx`, a
 *      listed segment without one, and one drawing another screen's skeleton
 *      must each be flagged.
 *   2. THE SKELETONS draw no text and no spinner: no string child, no label
 *      prop, no `t.`, no animate-spin or Loader in the file; every screen has
 *      its `data-kf-skeleton` region and `aria-busy`. (design-c check 32
 *      reads the rendered pages in both languages and themes.)
 *   3. ONE PRESS, ONE REQUEST: singleFlight() (src/lib/single-flight.ts) run
 *      in Node. Two calls in one task run the work once; a call while the
 *      first is pending is refused; after it settles a call runs again; a
 *      throw releases the flag and reaches the caller; two handlers sharing a
 *      flag (Ask's send and its suggestions) cannot overlap. Forced case: the
 *      same two calls on an unguarded handler run twice, so the counter can
 *      see a double.
 *   4. EVERY LISTED BUTTON IS WRAPPED: each handler that starts server work is
 *      `once(...)` from useSingleFlight in its component, and its button still
 *      carries its existing `disabled` and loading text. Forced case: each
 *      file with its `once(` taken out must be flagged.
 *   5. THE TAB BAR: the tapped tab is the active one from the tap (the
 *      pending href), the old one is not; with no pending tap the pathname
 *      rules; the Link calls start() from onNavigate in both chromes.
 *   6. THE SUBJECT PAGE keeps its skeleton until its first browser read
 *      settles (it used to say "no materials" for a subject that has them).
 *
 * Tier 0: no network, no credential, no database, no browser.
 * Usage: node --experimental-strip-types scripts/verify-tap-feedback.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let failures = 0;
let passes = 0;
const check = (ok, msg) => {
  if (ok) { passes++; console.log(`ok   ${msg}`); } else { failures++; console.log(`FAIL ${msg}`); }
};

// ── 1. The loading screens ──────────────────────────────────────────────────
const DASH = 'src/app/[locale]/dashboard';
export const SEGMENTS = {
  [`${DASH}/(home)/loading.tsx`]: 'HomeSkeleton',
  [`${DASH}/knowledge/(list)/loading.tsx`]: 'SubjectsSkeleton',
  [`${DASH}/knowledge/[id]/loading.tsx`]: 'SubjectSkeleton',
  [`${DASH}/agent/loading.tsx`]: 'AskSkeleton',
  [`${DASH}/settings/loading.tsx`]: 'SettingsSkeleton',
};
/** The pages each listed segment wraps, so a route move cannot leave one behind. */
const PAGES = {
  [`${DASH}/(home)/loading.tsx`]: `${DASH}/(home)/page.tsx`,
  [`${DASH}/knowledge/(list)/loading.tsx`]: `${DASH}/knowledge/(list)/page.tsx`,
  [`${DASH}/knowledge/[id]/loading.tsx`]: `${DASH}/knowledge/[id]/page.tsx`,
  [`${DASH}/agent/loading.tsx`]: `${DASH}/agent/page.tsx`,
  [`${DASH}/settings/loading.tsx`]: `${DASH}/settings/page.tsx`,
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(ROOT, p).replace(/\\/g, '/'));
  }
  return out;
}

/** Findings for a set of dashboard files ({path: source}); pure, so the forced cases can feed it. */
function loadingFindings(files) {
  const findings = [];
  const loadings = Object.keys(files).filter((p) => p.endsWith('/loading.tsx'));
  for (const [path, skeleton] of Object.entries(SEGMENTS)) {
    if (!(path in files)) { findings.push(`${path} is missing`); continue; }
    const src = files[path];
    if (!new RegExp(`<${skeleton}\\s*/>`).test(src)) findings.push(`${path} does not draw <${skeleton} />`);
    for (const other of Object.values(SEGMENTS)) if (other !== skeleton && new RegExp(`<${other}\\b`).test(src)) findings.push(`${path} draws <${other}>, another screen's shape`);
    if (!(PAGES[path] in files)) findings.push(`${PAGES[path]} is missing: ${path} wraps no page`);
  }
  for (const p of loadings) if (!(p in SEGMENTS)) findings.push(`${p} is not one of the five: it would wrap segments that are not its screen`);
  return findings;
}

const dashFiles = Object.fromEntries(walk(join(ROOT, DASH)).map((p) => [p, read(p)]));
const real = loadingFindings(dashFiles);
check(real.length === 0, `1. the five segments that wait on the server each have their loading.tsx and skeleton, and no other loading.tsx under the dashboard${real.length ? `: ${real.join('; ')}` : ''}`);
check(!existsSync(join(ROOT, DASH, 'page.tsx')) && !existsSync(join(ROOT, DASH, 'knowledge', 'page.tsx')), '1. the home and the subjects list live in route groups ((home), (list)), so their loading screens wrap nothing else');
const forced1 = [
  ['a planted dashboard/loading.tsx', { ...dashFiles, [`${DASH}/loading.tsx`]: 'export default function L() { return <HomeSkeleton /> }' }, /dashboard\/loading\.tsx is not one of the five/],
  ['a planted knowledge/loading.tsx', { ...dashFiles, [`${DASH}/knowledge/loading.tsx`]: 'export default function L() { return <SubjectsSkeleton /> }' }, /knowledge\/loading\.tsx is not one of the five/],
  ['Ask without its loading.tsx', Object.fromEntries(Object.entries(dashFiles).filter(([p]) => p !== `${DASH}/agent/loading.tsx`)), /agent\/loading\.tsx is missing/],
  ['Settings drawing the home skeleton', { ...dashFiles, [`${DASH}/settings/loading.tsx`]: 'export default function L() { return <HomeSkeleton /> }' }, /settings\/loading\.tsx does not draw <SettingsSkeleton/],
];
for (const [what, files, want] of forced1) {
  const f = loadingFindings(files);
  check(f.some((x) => want.test(x)), `1. forced case flagged: ${what} (${f.find((x) => want.test(x)) || 'NOT FLAGGED'})`);
}

// ── 2. The skeletons: no text, no spinner ───────────────────────────────────
const SK = read('src/components/skeleton/DashboardSkeletons.tsx');
const code = SK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function textFindings(src) {
  const f = [];
  // A JSX text child: `>` then a run with a letter before the next `<` or `{`.
  for (const m of src.matchAll(/>\s*([^<>{}]*\p{L}[^<>{}]*)</gu)) if (!/^\s*\)?\s*[;,]?\s*$/.test(m[1]) && !/=>|\(|\)|&&|\?|:/.test(m[1])) f.push(`text child "${m[1].trim().slice(0, 40)}"`);
  if (/\{\s*t\.|labels\.|useTranslation/.test(src)) f.push('reads a translation');
  if (/animate-spin|Loader2?\b|role="progressbar"/.test(src)) f.push('draws a spinner');
  return f;
}
const t2 = textFindings(code);
check(t2.length === 0, `2. the skeletons draw no text and no spinner${t2.length ? `: ${t2.join('; ')}` : ''}`);
const planted2 = textFindings(code.replace('<Bone className="h-11 w-11 shrink-0" />', '<span>Loading</span>'));
check(planted2.some((x) => /Loading/.test(x)), `2. forced case flagged: a "Loading" word planted in the home skeleton (${planted2[0] || 'NOT FLAGGED'})`);
const planted2b = textFindings(code.replace('aria-busy="true"', 'aria-busy="true"><Loader2 className="animate-spin" /'));
check(planted2b.some((x) => /spinner/.test(x)), '2. forced case flagged: a spinner planted in the region');
for (const r of ['home', 'subjects', 'subject', 'ask', 'settings']) check(new RegExp(`<Region\\s+route="${r}"`).test(code), `2. the ${r} skeleton has its data-kf-skeleton region`);
check(/data-kf-skeleton=\{route\}\s+aria-busy="true"/.test(code), '2. every region carries aria-busy');
check(/\.kf-clay \.kf-bone \{/.test(read('src/app/globals.css')) && /prefers-reduced-motion: no-preference\)\s*\{\s*\n\s*\.kf-clay \[data-kf-skeleton\]/.test(read('src/app/globals.css')), '2. the bones are clay (globals.css) and breathe only where motion is welcome');

// ── 3. singleFlight, run ────────────────────────────────────────────────────
const { singleFlight } = await import(pathToFileURL(join(ROOT, 'src/lib/single-flight.ts')).href);
const tick = () => new Promise((r) => setTimeout(r, 0));
{
  let runs = 0; let release;
  const flight = { current: false };
  const press = singleFlight(flight, () => { runs++; return new Promise((r) => { release = r; }); });
  press(); press();
  check(runs === 1, `3. two presses in one task: the work ran ${runs} time(s), want 1`);
  await tick(); press();
  check(runs === 1, `3. a press while the first is pending (a task later): ran ${runs} time(s), want 1`);
  release(); await tick(); await tick();
  check(flight.current === false, '3. the flag is released when the work settles');
  press();
  check(runs === 2, `3. a press after it settled runs again: ${runs} run(s), want 2`);
  release(); await tick();
}
{
  const flight = { current: false };
  const boom = singleFlight(flight, async () => { throw new Error('refused'); });
  let caught = null;
  try { await boom(); } catch (e) { caught = e; }
  check(caught?.message === 'refused' && flight.current === false, '3. a throw reaches the caller and releases the flag');
}
{
  const flight = { current: false };
  let runs = 0; let release;
  const work = () => { runs++; return new Promise((r) => { release = r; }); };
  const send = singleFlight(flight, work);
  const suggestion = singleFlight(flight, work);
  send(); suggestion('a preset');
  check(runs === 1, `3. two handlers sharing one flag (Ask's send and a suggestion): ${runs} run(s), want 1`);
  release(); await tick();
}
{
  let runs = 0;
  const unguarded = async () => { runs++; await new Promise(() => {}); };
  unguarded(); unguarded();
  check(runs === 2, `3. forced case: the same two presses on an unguarded handler run ${runs} time(s) (the counter sees a double)`);
}

// ── 4. Every listed button goes through once(...) ───────────────────────────
// [file, handler, what the button already shows while pending]
export const GUARDED = [
  ['src/components/summary/SummarySection.tsx', 'generate', /disabled=\{isLoading\}[\s\S]{0,200}s\.generating/],
  ['src/components/quiz/QuizSection.tsx', 'start', /disabled=\{phase === 'loading'\}/],
  ['src/components/quiz/QuizSection.tsx', 'submit', /disabled=\{phase === 'submitting'\}/],
  ['src/components/agent/ChatBox.tsx', 'handleSend', /disabled=\{isLoading \|\| !input\.trim\(\)\}/],
  ['src/components/materials/DeleteMaterialControl.tsx', 'onConfirm', /disabled=\{busy\}[\s\S]{0,80}labels\.deleting/],
  ['src/components/materials/RenameMaterialControl.tsx', 'onSave', /disabled=\{busy \|\| value\.trim\(\) === ''\}/],
  ['src/components/ai-consent/AiConsentCard.tsx', 'onWithdraw', /onClick=\{onWithdraw\} disabled=\{busy\}/],
  ['src/components/ai-consent/AiConsentProvider.tsx', 'accept', /onClick=\{accept\} disabled=\{busy\}[\s\S]{0,60}labels\.saving/],
  ['src/components/dashboard/CancelSubscriptionCard.tsx', 'onConfirm', /onClick=\{onConfirm\} disabled=\{busy\}/],
  ['src/components/dashboard/DeleteAccountCard.tsx', 'onConfirm', /onClick=\{onConfirm\} disabled=\{busy/],
  ['src/components/reminder/StudyReminderCard.tsx', 'turnOn', /disabled=\{busy\}/],
  ['src/components/reminder/StudyReminderCard.tsx', 'turnOff', /disabled=\{busy\}/],
  ['src/components/layout/SignOutButton.tsx', 'handleSignOut', /disabled=\{leaving\}/],
];
function guardFinding(src, handler, pending) {
  if (!/import \{ useSingleFlight \} from '@\/lib\/use-single-flight'/.test(src)) return 'does not import useSingleFlight';
  if (!/const once = useSingleFlight\(\);/.test(src)) return 'has no `const once = useSingleFlight();`';
  if (!new RegExp(`const ${handler} = once\\(`).test(src)) return `${handler} is not wrapped by once(...)`;
  if (!pending.test(src)) return 'its button lost its pending state (disabled / loading text)';
  return null;
}
for (const [file, handler, pending] of GUARDED) {
  const src = read(file);
  const f = guardFinding(src, handler, pending);
  check(!f, `4. ${file.split('/').pop()}: ${handler} is one press, one request${f ? `: ${f}` : ''}`);
  const unwrapped = src.replace(new RegExp(`const ${handler} = once\\(`), `const ${handler} = (`);
  check(guardFinding(unwrapped, handler, pending) !== null, `4. forced case flagged: ${file.split('/').pop()} with ${handler}'s once( removed`);
}
// The upload is single by its own states: the tile that picks is not drawn while a file uploads.
check(/\{\(state === 'idle' \|\| state === 'error'\) && \(/.test(read('src/components/upload/DropZone.tsx')), '4. the upload tile is drawn only while idle or after a refusal (no second pick while one uploads)');

// ── 5. The tab bar ──────────────────────────────────────────────────────────
const { getNavItems, isNavActive } = await import(pathToFileURL(join(ROOT, 'src/components/layout/nav-items.ts')).href);
const items = getNavItems('en', { dashboard: 'D', knowledge: 'S', agent: 'A', settings: 'T', appearance: '', themeDark: '', themeLight: '' });
const activeKeys = (current) => items.filter((i) => isNavActive(current, i)).map((i) => i.key);
const pending = (pathname, tapped) => tapped ?? pathname;
check(activeKeys(pending('/en/dashboard', '/en/dashboard/settings')).join() === 'settings', `5. a tap on Settings from Home: Settings alone is active at once (${activeKeys(pending('/en/dashboard', '/en/dashboard/settings'))})`);
check(activeKeys(pending('/en/dashboard/knowledge/abc', '/en/dashboard/agent')).join() === 'agent', '5. a tap on Ask from a subject: Ask alone is active at once');
check(activeKeys(pending('/en/dashboard/knowledge/abc', null)).join() === 'knowledge', '5. with no pending tap the pathname rules (a subject marks Subjects)');
check(activeKeys('/en/dashboard').join() !== activeKeys(pending('/en/dashboard', '/en/dashboard/knowledge')).join(), '5. forced case: without the pending href the old tab would stay active (the two differ)');
const hook = read('src/components/layout/use-pending-nav.ts');
check(/useEffect\(\(\) => \{\s*setPending\(null\);\s*\}, \[pathname\]\)/.test(hook) && /current: pending \?\? pathname/.test(hook), '5. the pending tab is dropped when the pathname commits');
for (const f of ['src/components/layout/MobileNav.tsx', 'src/components/layout/Sidebar.tsx']) {
  const s = read(f);
  check(/onNavigate=\{\(\) => start\(item\.href\)\}/.test(s) && /isNavActive\(current, item\)/.test(s) && !/prefetch=\{true\}/.test(s), `5. ${f.split('/').pop()}: the tab link marks itself on onNavigate, reads the pending tab, and keeps Next's default prefetch`);
}

// ── 6. The subject page ─────────────────────────────────────────────────────
const subject = read(`${DASH}/knowledge/[id]/page.tsx`);
check(/if \(!loaded\) return <SubjectSkeleton \/>/.test(subject) && /load\(\)\.finally\(\(\) => setLoaded\(true\)\)/.test(subject), '6. the subject page keeps its skeleton until its first read settles, and a failed read still ends the wait');

console.log(`\n${failures} failure(s), ${passes} passed`);
process.exit(failures ? 1 : 0);
