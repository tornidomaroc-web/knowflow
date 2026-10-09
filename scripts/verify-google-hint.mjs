/**
 * Executable proof for the login line for Google-registered students
 * (docs/PROGRESS.md 2026-10-09, path A: no third-party login in the app) and
 * for two facts about the Arabic reminder copy.
 *
 * 1. The line, rendered (real component, react-dom/server) inside the app's
 *    platform context in both languages: it names the page's own forgot link
 *    by its own label and links to `/<locale>/forgot-password`. With the web's
 *    context, where the Google button is, it renders nothing.
 * 2. The login page renders it exactly once, below the forgot link.
 * 3. The copy: `{forgot}` in both languages, no price, plan, upgrade or
 *    "free" word (the in-app probe's own word list), no em dash.
 * 4. The reminder's Arabic body names a material with the app's own word,
 *    ملف (`addMaterial` "أضف ملفًا", the same accusative form), not مادة,
 *    which is the app's word for a subject.
 * 5. The Arabic strings are stored in logical order: each begins with its
 *    first spoken letter (a reversed string would begin with its last).
 *
 * Tier 0: no network, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-google-hint.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { GoogleAccountHint } = await load('src/components/auth/GoogleAccountHint.tsx');
const { PlatformProvider } = await load('src/components/platform/PlatformProvider.tsx');

const WORDS = ['Upgrade', 'Checkout', 'checkout', '/month', 'Pricing', 'Free plan', 'الترقية', 'الاحترافي', 'الأسعار', 'شهرياً', 'شهريًا', 'الباقة', 'باقة', 'مجاني'];
const hits = (t) => WORDS.filter((w) => t.includes(w)).concat(/\bPro\b/.test(t) ? ['Pro'] : [], /\bPlan\b/.test(t) ? ['Plan'] : [], /\bFree\b/i.test(t) ? ['Free'] : []);

// 1. Rendered.
for (const [dict, l] of [[en, 'en'], [ar, 'ar']]) {
  const props = { text: dict.auth.googleAccountHint, forgotLabel: dict.auth.forgotLink, forgotHref: `/${l}/forgot-password` };
  const inApp = renderToStaticMarkup(React.createElement(PlatformProvider, { platform: 'native' }, React.createElement(GoogleAccountHint, props)));
  const onWeb = renderToStaticMarkup(React.createElement(PlatformProvider, { platform: 'web' }, React.createElement(GoogleAccountHint, props)));
  check(inApp.includes('data-kf-google-hint'), `${l}: the line shows inside the app`);
  check(inApp.includes(`href="/${l}/forgot-password"`), `${l}: it links to /${l}/forgot-password`);
  check(inApp.includes(`>${dict.auth.forgotLink}</a>`), `${l}: the link carries the forgot link's own label`);
  check(!inApp.includes('{forgot}'), `${l}: the placeholder is filled`);
  check(inApp.includes('Google'), `${l}: the line names Google`);
  check(onWeb === '', `${l}: on the web, where the Google button is, it renders nothing (got ${onWeb.length} chars)`);
  check(hits(inApp.replace(/<[^>]+>/g, ' ')).length === 0, `${l}: no purchase word in the line`);
}

// 2. On the login page, once, after the forgot link.
const login = read('src/app/[locale]/login/page.tsx');
check((login.match(/<GoogleAccountHint /g) || []).length === 1, 'the login page renders the line once');
check(login.indexOf('{t.auth.forgotLink}') < login.indexOf('<GoogleAccountHint '), 'the line comes after the forgot link');
check(/forgotHref=\{`\/\$\{locale\}\/forgot-password`\}/.test(login), 'it points at the same href as the forgot link');

// 3. The copy.
for (const [dict, l] of [[en, 'en'], [ar, 'ar']]) {
  const s = dict.auth.googleAccountHint;
  check(typeof s === 'string' && (s.match(/\{forgot\}/g) || []).length === 1, `${l}: exactly one {forgot}`);
  check(hits(s).length === 0, `${l}: no purchase word: ${hits(s)}`);
  check(!/—/.test(s), `${l}: no em dash`);
}

// 4. The app's word for a material.
check(ar.dashboard.subjects.addMaterial === 'أضف ملفًا', `the app calls a material ملف ("${ar.dashboard.subjects.addMaterial}")`);
check(ar.dashboard.studyReminder.notificationBody.includes('ملفًا') && !ar.dashboard.studyReminder.notificationBody.includes('مادة'), 'the reminder body uses ملفًا, the same word and form, and not مادة');

// 5. Logical order: the first code point of each string is its first spoken letter.
const first = (s) => s.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const order = [
  [ar.dashboard.studyReminder.heading, '062A', 'تذكير المذاكرة begins with ت'],
  [ar.dashboard.studyReminder.notificationTitle, '062D', 'حان وقت المذاكرة begins with ح'],
  [ar.dashboard.studyReminder.notificationBody, '0627', 'افتح ... begins with ا'],
  [ar.auth.googleAccountHint, '0633', 'سجّلت ... begins with س'],
];
for (const [s, cp, msg] of order) check(first(s) === cp, `logical order: ${msg} (first code point U+${first(s)})`);

if (failures.length === 0) {
  console.log(`PASS: ${passes} checks. The line shows in the app only, names and links the forgot page in both languages, carries no purchase word; the Arabic reminder uses the app's word and is stored in logical order.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} of ${failures.length + passes}`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
