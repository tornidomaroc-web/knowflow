/**
 * Executable proof for the visual language (docs/design/VISUAL_LANGUAGE.md,
 * ruled 2026-09-25): the app reads as alive to a young student and stays
 * premium, and none of it moves for someone who asked it not to.
 *
 *  1. The supporting palette exists in all three token scopes (:root, dark,
 *     light) and in tailwind, and gold is still the only colour on a button.
 *  2. Every keyframe and transform this change added sits inside
 *     `@media (prefers-reduced-motion: no-preference)`; the older landing
 *     animations keep their reduce rule.
 *  3. The illustrations are original inline SVG under 2 KB each, carry no
 *     raster, no external reference and no text, and are used by the screens.
 *  4. The Ring renders the number inside the arc, and every quota on the home
 *     is a ring, not a sentence.
 *  5. The main screens, rendered: every section of the home has an icon or
 *     an illustration; the empty states carry an illustration; the subject
 *     cards carry a ring; the settings sections carry icons; the buttons
 *     carry the press class.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-visual-system.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, { '@/lib/supabase/client': `export function createClient() { return {}; }` });
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const has = (p) => existsSync(resolvePath(ROOT, p));
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

// 1. Tokens.
{
  const css = read('src/app/globals.css');
  const scope = (sel) => css.match(new RegExp(sel.replace(/[[\]"]/g, (c) => '\\' + c) + '\\s*\\{[\\s\\S]*?\\n\\}'))?.[0] ?? '';
  for (const s of [':root', '[data-theme="dark"]', '[data-theme="light"]']) {
    const block = scope(s);
    for (const t of ['--mint', '--mint-subtle', '--sky', '--sky-subtle', '--coral', '--coral-subtle', '--violet', '--violet-subtle']) {
      check(new RegExp(`${t}:`).test(block), `${s} lacks ${t}`);
    }
  }
  const tw = read('tailwind.config.ts');
  for (const t of ['mint', 'sky', 'coral', 'violet']) check(new RegExp(`${t}: \\{ DEFAULT: 'var\\(--${t}\\)'`).test(tw), `tailwind lacks ${t}`);
  const button = read('src/components/ui/Button.tsx');
  check(/primary: 'bg-primary text-primary-foreground/.test(button), 'the primary button must stay gold');
  check(/pressable/.test(button), 'buttons do not carry the press feedback class');
}

// 2. Motion inside the guard.
{
  const css = read('src/app/globals.css');
  const guard = css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  check(guard.length > 0, 'no prefers-reduced-motion: no-preference block');
  for (const k of ['kf-rise', 'kf-pop', 'kf-flame']) {
    check(guard.includes(`@keyframes ${k}`), `@keyframes ${k} is not inside the no-preference guard`);
  }
  check(/\.kf-ring-arc \{ transition/.test(guard) && /\.pressable:active/.test(guard) && /\.liftable:hover/.test(guard), 'the ring, press or lift rules are outside the guard');
  // No new keyframes outside the guard besides the landing pair, which has its own reduce rule.
  const outside = css.replace(guard, '');
  const keyframes = [...outside.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]);
  check(keyframes.every((k) => k.startsWith('landing-') || k.startsWith('hero-') || k.startsWith('reveal')), `keyframes outside the guard: ${keyframes.join(', ')}`);
  check(/prefers-reduced-motion: reduce\) \{[\s\S]*landing-sweep/.test(css), 'the landing animations lost their reduce rule');
}

// 3. Illustrations.
{
  const p = 'src/components/illustrations/index.tsx';
  check(has(p), 'src/components/illustrations/index.tsx does not exist');
  if (has(p)) {
    const src = read(p);
    const names = [...src.matchAll(/export function (\w+)\(/g)].map((m) => m[1]);
    check(names.length >= 7, `expected at least 7 illustrations, found ${names.length}`);
    check(!/<image|href=|<text|url\(|data:image/.test(src), 'an illustration carries a raster, a link or text');
    const m = await load(p);
    for (const n of names) {
      const html = renderToStaticMarkup(React.createElement(m[n], { size: 96 }));
      check(html.length < 2048, `${n} renders to ${html.length} bytes, over 2 KB`);
      check(/var\(--(accent|mint|sky|coral|violet|faint|muted)/.test(html), `${n} does not use the app's tokens`);
      check(/aria-hidden="true"/.test(html), `${n} is not hidden from a screen reader by default`);
    }
    const titled = renderToStaticMarkup(React.createElement(m.EmptyShelf, { title: 'Nothing yet' }));
    check(/role="img"/.test(titled) && /<title>Nothing yet<\/title>/.test(titled), 'a titled illustration is not an accessible image');
    check(statSync(resolvePath(ROOT, p)).size < 12000, 'the illustration module is over 12 KB');
  }
}

// 4. The Ring.
{
  const { Ring } = await load('src/components/ui/Ring.tsx');
  const html = renderToStaticMarkup(React.createElement(Ring, { value: 0.7, label: '7 of 10', size: 72, stroke: 7 }, React.createElement('span', null, '7')));
  check(/role="img"/.test(html) && /aria-label="7 of 10"/.test(html), 'the ring is not an accessible image');
  check(/kf-ring-arc/.test(html) && /stroke-dashoffset/.test(html), 'the ring has no drawn arc');
  check(/>7<\/span>/.test(html), 'the number is not inside the ring');
  const empty = renderToStaticMarkup(React.createElement(Ring, { value: 5, label: 'x' }));
  check(/stroke-dashoffset="0"/.test(empty), 'a value over 1 must clamp to full');
}

// 5. The screens.
{
  const { StudentHome } = await load('src/components/dashboard/StudentHome.tsx');
  const labels = Object.fromEntries(['welcome','welcomeLine','askTitle','askDesc','newSubject','newSubjectDesc','subjects','streakLabel','streakUnit','streakZoneHint','streakLit','streakUnlit','recentActivity','planTitle','planName','ofWord','subjectsUsed','allSubjects','materialsWord','noSubjects','noSubjectsDesc','startTitle','whatTitle','upgradeCta','continueTitle','continueBody','continueCta'].map((k) => [k, k]));
  labels.whatLines = ['a', 'b', 'c'];
  labels.activity = { platformWeb: 'Web', noActivity: 'n', conversation: 'c', showLess: 's', viewAll: 'v', unknownKb: 'u' };
  const base = { stats: [{ label: 'S', value: 1, desc: 'd' }], streak: 5, askHref: '#', newSubjectHref: '#', subjectsHref: '#', upgradeHref: null, isPro: false, quotas: [{ key: 'q', label: 'Questions left', remaining: 7, total: 10 }], subjectsUsed: 1, subjectsLimit: 5, onboarding: [{ key: 'a', title: 't', desc: 'd', done: false, href: '#' }], labels, recentActivity: [], locale: 'en', continueCard: null };
  const html = renderToStaticMarkup(React.createElement(StudentHome, { ...base, subjects: [] }));
  const sections = html.match(/<section/g)?.length ?? 0;
  const svgs = html.match(/<svg/g)?.length ?? 0;
  check(sections >= 6 && svgs >= sections, `the home has ${sections} sections and ${svgs} svgs; every section needs a picture`);
  check(/role="img" aria-label="7 ofWord 10 Questions left"/.test(html), 'the quota is not a ring with an accessible label');
  check(!/7 of 10 used/.test(html), 'a quota is written as a sentence');
  check(/kf-flame/.test(html), 'a lit streak has no live flame');
  check(/<title>noSubjects<\/title>/.test(html), 'the empty subjects state has no titled illustration');
  check(/rise rise-1/.test(html) && /pressable/.test(html), 'the home does not rise in or press');
  const unlit = renderToStaticMarkup(React.createElement(StudentHome, { ...base, streak: 0, subjects: [{ id: 's', name: 'Micro', materials: 4, summarised: 2 }] }));
  check(!/kf-flame/.test(unlit) && /streakUnlit/.test(unlit), 'an unlit streak still animates or lacks its line');
  check(/>50%<\/span>/.test(unlit), 'a subject on the home has no ring with its percent');

  const { SubjectsList } = await load('src/components/dashboard/SubjectsList.tsx');
  const sl = { title: 't', subtitle: 's', newSubject: 'n', emptyTitle: 'Nothing yet', emptyPrompt: 'p', materials: 'M', summarised: 'S', quizzed: 'Q', processing: 'p', noMaterials: 'none', lastAsked: 'la', lastAdded: 'ld', created: 'c', ask: 'Ask', addMaterial: 'add' };
  const stats = { materials: 8, ready: 8, processing: 0, failed: 0, summarised: 6, quizzed: 3, lastActivityAt: '2026-09-24T21:40:00Z', lastActivityIsAsk: true };
  const cards = renderToStaticMarkup(React.createElement(SubjectsList, { subjects: [{ id: 's1', name: 'Micro', description: null, language: 'ar', href: '#', askHref: '#', createdAt: '2026-09-01', stats }], newHref: '#', locale: 'en', labels: sl }));
  check(/kf-ring-arc/.test(cards) && />75%<\/span>/.test(cards), 'a subject card has no ring');
  check(/liftable/.test(cards), 'subject cards do not lift');
  const emptyCards = renderToStaticMarkup(React.createElement(SubjectsList, { subjects: [], newHref: '#', locale: 'en', labels: sl }));
  check(/<title>Nothing yet<\/title>/.test(emptyCards), 'the empty subjects screen has no titled illustration');

  const { SettingsPanel } = await load('src/components/dashboard/SettingsPanel.tsx');
  const settingsLabels = { title: 'Settings', subtitle: 's', account: 'Account', email: 'Email', plan: 'Plan', free: 'Free', pro: 'Pro', freePlanDesc: 'f', proPlanDesc: 'p', renews: 'Renews', cancels: 'Cancels', upgrade: 'Upgrade', activeSubscription: 'Active', preferences: 'Preferences', language: 'Language', appearance: 'Appearance', themeDark: 'Dark', themeLight: 'Light', helpLegal: 'Help', privacyPolicy: 'Privacy', terms: 'Terms', support: 'Support', supportDesc: 'd' };
  globalThis.__tsxHooksPathname = '/en/dashboard/settings';
  const settings = renderToStaticMarkup(React.createElement(SettingsPanel, { email: 'a@b.c', isPro: false, renewsOn: null, cancelsOn: null, upgradeHref: null, locale: 'en', pathname: '/en/dashboard/settings', privacyHref: '#', termsHref: '#', supportEmail: 's@x.y', labels: settingsLabels, deleteCard: null }));
  const headings = settings.match(/<h2/g)?.length ?? 0;
  const iconTiles = settings.match(/section-icon/g)?.length ?? 0;
  check(headings >= 4 && iconTiles >= 4, `settings has ${headings} sections and ${iconTiles} section icons`);

  const { AgentEmptyState } = await load('src/components/agent/AgentEmptyState.tsx');
  const agent = renderToStaticMarkup(React.createElement(AgentEmptyState, { newHref: '#', labels: { title: 'No subjects', prompt: 'p', cta: 'c' } }));
  check(/<svg/.test(agent) && /<title>No subjects<\/title>/.test(agent), 'the Ask empty state has no titled illustration');
}

if (failures.length === 0) {
  console.log('PASS: the visual language holds: palette in three scopes, motion behind the guard, original illustrations, rings for numbers, a picture on every panel.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
