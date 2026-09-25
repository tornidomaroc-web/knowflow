/**
 * Executable proof for register #122: seven things the owner saw on production
 * after #205-#207, each held here.
 *
 *  1. Landing steps carry the right picture: upload → cloud, ask → pages that
 *     talk, answer → the book that sparks (rendered, read by data-illustration).
 *  2. Landing "what you get": exactly one picture per card, no icon tile.
 *  3. A 0% ring still draws a track that is not the tile's own colour.
 *  4. Arabic dates use the standard month names with Western digits.
 *  5. Ask: no shortcut in the placeholder; a hint only md-and-up and per
 *     platform; the empty state has a picture and a headline; the Arabic
 *     "try asking" heading carries its hamza; a hamza sweep over ar.ts.
 *  6. The platform label is a word ("المتصفح" / "Browser"), isolated, in an
 *     auto-direction line; no transliteration of "web" remains.
 *  7. Login and signup carry an illustration, the rise and the press.
 *  Plus: the Arabic strings export exists and covers every leaf in ar.ts.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-production-review-2.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT, { '@/lib/supabase/client': `export function createClient() { return {}; }` });
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

// 1 + 2. The landing, rendered.
{
  const { default: LandingPage } = await load('src/app/[locale]/(site)/page.tsx');
  const html = renderToStaticMarkup(await LandingPage({ params: Promise.resolve({ locale: 'en' }) }));
  const steps = html.split('<ol')[1]?.split('</ol>')[0] ?? '';
  const order = [...steps.matchAll(/data-illustration="([\w-]+)"/g)].map((m) => m[1]);
  console.error(`step illustrations: ${order.join(' > ')}`);
  check(order.join(',') === 'upload-cloud,chat-pages,spark-book', `the steps carry ${order.join(', ')}; expected cloud, pages, book`);
  const cards = html.split('<section')[3] ?? '';
  const perCard = cards.split('liftable flex flex-col').slice(1).map((c) => (c.match(/<svg/g) ?? []).length);
  console.error(`pictures per feature card: ${perCard.join(', ')}`);
  check(perCard.length === 4 && perCard.every((n) => n === 1), 'each "what you get" card must carry exactly one picture');
  check(!/lucide-quote|<svg[^>]*class="[^"]*h-5 w-5"[^>]*>[\s\S]*?<path d="M3 21c3 0 7-1 7-8/.test(cards), 'a quote-mark icon is still on a feature card');
}

// 3. The empty ring.
{
  const { Ring } = await load('src/components/ui/Ring.tsx');
  const html = renderToStaticMarkup(React.createElement(Ring, { value: 0, label: '0 of 5' }));
  const track = html.match(/<circle[^>]*>/)?.[0] ?? '';
  console.error(`ring track: ${track}`);
  check(!/var\(--raised\)/.test(track), 'the ring track is still --raised, invisible on a raised tile');
  check(/stroke="var\(--faint\)"/.test(track) && /stroke-opacity="0.45"/.test(track), 'the ring track must be --faint at 0.45');
}

// 4. Dates.
{
  const { formatDate } = await load('src/lib/format-date.ts');
  const aug = formatDate('2026-08-11T00:00:00Z', 'ar');
  const jul = formatDate('2026-07-05T00:00:00Z', 'ar');
  console.error(`ar dates: "${aug}" "${jul}"`);
  check(/أغسطس/.test(aug) && /يوليو/.test(jul), 'Arabic months must be the standard أغسطس / يوليو');
  check(!/غشت|يوليوز/.test(aug + jul), 'a Moroccan month name is still used');
  check(!/[٠-٩]/.test(aug), 'Arabic dates must keep Western digits');
}

// 5. Ask.
{
  const { ar } = await load('src/lib/i18n/locales/ar.ts');
  const { en } = await load('src/lib/i18n/locales/en.ts');
  check(!/Cmd|Ctrl|Enter/.test(ar.dashboard.agent.askPlaceholder) && !/Cmd|Ctrl|Enter/.test(en.dashboard.agent.askPlaceholder), 'the placeholder still carries a keyboard shortcut');
  check(typeof ar.dashboard.agent.sendHintMac === 'string' && typeof ar.dashboard.agent.sendHintOther === 'string', 'the per-platform hint keys are missing');
  check(ar.dashboard.suggestions.heading === 'جرّب أن تسأل', `the Arabic heading is "${ar.dashboard.suggestions.heading}", expected جرّب أن تسأل`);
  const chat = read('src/components/agent/ChatBox.tsx');
  check(/hidden text-\[11px\] text-faint md:block/.test(chat) && /navigator\.platform/.test(chat), 'the keyboard hint is not md-and-up and per platform');
  check(/emptyTitle/.test(chat) && /data-illustration|ChatPages/.test(chat), 'the Ask empty state has no headline or picture');
  // A hamza sweep: the standalone forms that are always written with one.
  const src = read('src/lib/i18n/locales/ar.ts');
  const bad = [/(^|[^ء-ي])ان([^ء-ي]|$)/, /(^|[^ء-ي])اذا([^ء-ي]|$)/, /(^|[^ء-ي])او([^ء-ي]|$)/, /(^|[^ء-ي])انشئ/, /(^|[^ء-ي])اضف([^ء-ي]|$)/, /(^|[^ء-ي])اسال/, /(^|[^ء-ي])الان([^ء-ي]|$)/, /(^|[^ء-ي])اكثر/, /(^|[^ء-ي])انت([^ء-ي]|$)/, /(^|[^ء-ي])اسئلة/, /(^|[^ء-ي])اجابة/, /(^|[^ء-ي])انشاء/, /(^|[^ء-ي])ارسال/, /(^|[^ء-ي])الغاء/];
  const hits = bad.filter((re) => re.test(src)).map((re) => re.source);
  check(hits.length === 0, `words missing a hamza in ar.ts: ${hits.join(' ; ')}`);
}

// 6. The platform label.
{
  const { ar } = await load('src/lib/i18n/locales/ar.ts');
  check(ar.dashboard.home.platformWeb === 'المتصفح', `platformWeb is "${ar.dashboard.home.platformWeb}"`);
  check(!/بيولا|الويب/.test(read('src/lib/i18n/locales/ar.ts').replace(/بريد ويب/, '')), 'a transliteration of "web" remains in ar.ts');
  const { RecentActivity } = await load('src/components/dashboard/RecentActivity.tsx');
  const html = renderToStaticMarkup(React.createElement(RecentActivity, { items: [{ id: 'c', created_at: '2026-08-11T00:00:00Z', platform: 'web', knowledge_bases: { name: 'x' } }], labels: { platformWeb: 'المتصفح', noActivity: 'n', conversation: 'c', showLess: 's', viewAll: 'v', unknownKb: 'u' }, locale: 'ar' }));
  check(/<p[^>]*dir="auto"[^>]*><bdi>المتصفح<\/bdi> · <bdi>11 أغسطس 2026<\/bdi>/.test(html), 'the activity line is not an auto-direction line with isolated parts');
}

// 7. Auth pages.
for (const p of ['src/app/[locale]/login/page.tsx', 'src/app/[locale]/signup/page.tsx']) {
  const src = read(p);
  check(/from '@\/components\/illustrations'/.test(src) && /size=\{88\}/.test(src), `${p} has no illustration`);
  check(/className="rise mb-8/.test(src) && /rise rise-1/.test(src), `${p} does not rise in`);
  check(/hero-float/.test(src), `${p} has no depth behind the form`);
}
for (const p of ['src/components/auth/GoogleButton.tsx', 'src/components/auth/AppleButton.tsx']) check(/pressable/.test(read(p)), `${p} does not press`);

// The strings export.
{
  check(existsSync(resolvePath(ROOT, 'docs/copy/ARABIC_STRINGS.md')), 'docs/copy/ARABIC_STRINGS.md does not exist');
  if (existsSync(resolvePath(ROOT, 'docs/copy/ARABIC_STRINGS.md'))) {
    const md = read('docs/copy/ARABIC_STRINGS.md');
    const { ar } = await load('src/lib/i18n/locales/ar.ts');
    let leaves = 0; const walk = (n) => { if (typeof n === 'string') leaves++; else if (n && typeof n === 'object') Object.values(n).forEach(walk); }; walk(ar);
    const rows = (md.match(/^\| `/gm) ?? []).length;
    console.error(`strings file: ${rows} rows for ${leaves} leaves`);
    check(rows === leaves, `the strings file has ${rows} rows but ar.ts has ${leaves} strings`);
    check(md.includes('| `dashboard.agent.askPlaceholder` |'), 'the strings file lacks a known key');
  }
}

if (failures.length === 0) {
  console.log('PASS: the seven review points of 2026-09-25 are held, and the Arabic strings file covers every string.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
