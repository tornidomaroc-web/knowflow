/**
 * Executable proof for the daily study reminder (STORE_PATH.md S3(a), Apple
 * guideline 4.2) and the app's privacy manifest (ITMS-91053), the parts that
 * can be held without a simulator. The native behaviour (no prompt at launch,
 * the prompt only on request, schedule, replace, cancel) is proof 6 of
 * ios-smoke.yml; the card in the app is ios-signed-in.yml; the binary audit is
 * proof 7 (.github/scripts/ios-privacy-check.py).
 *
 * 1. The rule: only the app gets the card (`studyReminderAllowed`), and the
 *    Settings page renders it through that rule alone.
 * 2. The notification: one fixed id, a daily calendar trigger at the chosen
 *    hour and minute, the words in the student's language; times parse and
 *    format both ways.
 * 3. The card, rendered (real component, react-dom/server) off and on, in both
 *    languages: a labelled switch with its state, a time field at 19:00 by
 *    default, the sentence with the time in it.
 * 4. The permission is asked in ONE place, the switch's turn-on handler, never
 *    on load; the plugin's code is imported only inside the app.
 * 5. The copy: the same 10 keys in both languages, `{time}` in both, and no
 *    price, plan, upgrade or "free" word anywhere (3.1.3(f)), using the same
 *    word list as the in-app probe.
 * 6. The manifest: the file is in the app target's resources, declares no
 *    tracking, no required-reason API (the audit found none), and the six
 *    collected data types of the App Privacy label (docs/store/ASC_ANSWERS.md
 *    section 1); Info.plist still has no purpose string.
 *
 * Tier 0: no network, no credential, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-study-reminder.mjs
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

const R = await load('src/lib/study-reminder.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');

// 1. The rule.
check(R.studyReminderAllowed('native') === true, 'the app must get the reminder');
check(R.studyReminderAllowed('web') === false, 'the web must not get the reminder');
const settings = read('src/app/[locale]/dashboard/settings/page.tsx');
check(/reminderCard=\{\s*studyReminderAllowed\(platform\)\s*\?\s*\(\s*<StudyReminderCard/.test(settings), 'Settings must render the card only through studyReminderAllowed(platform)');
check((settings.match(/<StudyReminderCard/g) || []).length === 1, 'the card must be rendered in exactly one place');
check(/\{reminderCard\}/.test(read('src/components/dashboard/SettingsPanel.tsx')), 'the Settings panel must place the card');

// 2. The notification.
const n = R.studyReminderNotification(19, 0, { title: 'T', body: 'B' }, 'en');
check(n.id === R.STUDY_REMINDER_ID && n.id === 7001, 'one fixed id, 7001');
check(JSON.stringify(n.schedule) === JSON.stringify({ on: { hour: 19, minute: 0 }, allowWhileIdle: true }), `a daily calendar trigger at 19:00: ${JSON.stringify(n.schedule)}`);
check(n.title === 'T' && n.body === 'B' && n.extra.locale === 'en' && n.extra.hour === 19, 'words, language and time carried');
check(R.DEFAULT_REMINDER_TIME === '19:00', 'the default time is 19:00');
for (const [v, want] of [['19:00', [19, 0]], ['7:30', [7, 30]], ['00:00', [0, 0]], ['23:59', [23, 59]], ['24:00', null], ['12:60', null], ['', null], ['7.30', null]]) {
  const got = R.parseReminderTime(v);
  check(JSON.stringify(got ? [got.hour, got.minute] : null) === JSON.stringify(want), `parseReminderTime(${JSON.stringify(v)})`);
}
check(R.formatReminderTime(7, 5) === '07:05', 'formatReminderTime pads');

// 3. The card, rendered.
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { StudyReminderCard } = await load('src/components/reminder/StudyReminderCard.tsx');
const WORDS = ['Upgrade', 'Checkout', 'checkout', '/month', 'Pricing', 'Free plan', 'الترقية', 'الاحترافي', 'الأسعار', 'شهرياً', 'شهريًا', 'الباقة', 'باقة', 'مجاني'];
const purchaseHits = (t) => WORDS.filter((w) => t.includes(w)).concat(/\bPro\b/.test(t) ? ['Pro'] : [], /\bPlan\b/.test(t) ? ['Plan'] : [], /\bFree\b/i.test(t) ? ['Free'] : []);
for (const [dict, l] of [[en, 'en'], [ar, 'ar']]) {
  const c = dict.dashboard.studyReminder;
  for (const phase of ['off', 'on']) {
    const html = renderToStaticMarkup(React.createElement(StudyReminderCard, { labels: c, locale: l, preview: phase }));
    check(html.includes(`data-kf-reminder-state="${phase}"`), `${l} ${phase}: the card states its phase`);
    check(html.includes('role="switch"') && html.includes(`aria-checked="${phase === 'on'}"`) && html.includes('aria-labelledby="kf-reminder-label"'), `${l} ${phase}: a labelled switch with its state`);
    check(/type="time"[^>]*value="19:00"|value="19:00"[^>]*type="time"/.test(html), `${l} ${phase}: a time field at 19:00`);
    check(html.includes(c.heading) && html.includes(c.description), `${l} ${phase}: heading and description`);
    const sentence = phase === 'on' ? c.stateOn.replace('{time}', '19:00') : c.stateOff;
    check(html.includes(sentence), `${l} ${phase}: the sentence "${sentence}"`);
    check(purchaseHits(html.replace(/<[^>]+>/g, ' ')).length === 0, `${l} ${phase}: no purchase word: ${purchaseHits(html)}`);
  }
}

// 4. One place asks.
const card = read('src/components/reminder/StudyReminderCard.tsx');
check((card.match(/'requestPermissions'/g) || []).length === 1, 'requestPermissions must appear exactly once');
const turnOn = card.slice(card.indexOf('const turnOn = async'), card.indexOf('const turnOff = async'));
check(turnOn.includes("ln('requestPermissions')"), 'and that one is in the switch\'s turn-on handler');
const effect = card.slice(card.indexOf('useEffect('), card.indexOf('const save = useCallback'));
check(!/requestPermissions|checkPermissions/.test(effect), 'loading the card asks nothing (it only reads, and re-saves an existing reminder in the new language)');
check(/nativePromise\?:/.test(card) && /native\('LocalNotifications', method/.test(card) && !/import .*@capacitor\//.test(card), 'the card calls the shell\'s own bridge (the path ios-smoke proof 6 exercises), never a bundled Capacitor module');
check(/isPluginAvailable\?\.\('LocalNotifications'\)/.test(card), 'an app build without the plugin shows no card');
check(/data-kf-reminder-state="unavailable" data-kf-reminder-why=\{why\}/.test(card), 'a hidden card says why, for the signed-in run');

// 5. The copy.
const KEYS = Object.keys(en.dashboard.studyReminder);
check(KEYS.length === 10, `10 strings (got ${KEYS.length})`);
check(JSON.stringify(Object.keys(ar.dashboard.studyReminder)) === JSON.stringify(KEYS), 'ar has the same keys in the same order');
for (const [dict, l] of [[en, 'en'], [ar, 'ar']]) {
  const c = dict.dashboard.studyReminder;
  check(c.stateOn.includes('{time}'), `${l}: stateOn carries {time}`);
  for (const k of KEYS) {
    check(typeof c[k] === 'string' && c[k].trim() !== '', `${l}.${k} is a string`);
    check(purchaseHits(c[k]).length === 0, `${l}.${k}: no purchase word (3.1.3(f)): ${purchaseHits(c[k])}`);
    check(!/—/.test(c[k]), `${l}.${k}: no em dash`);
  }
}

// 6. The manifest.
const manifest = read('ios/App/App/PrivacyInfo.xcprivacy');
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
check(/PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile/.test(pbx), 'the manifest is a build file of the app target');
const resources = pbx.slice(pbx.indexOf('Begin PBXResourcesBuildPhase'), pbx.indexOf('End PBXResourcesBuildPhase'));
check(resources.includes('PrivacyInfo.xcprivacy in Resources'), 'and it is in the Resources phase');
check(/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(manifest), 'no tracking');
check(/<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/.test(manifest), 'no tracking domain');
check(/<key>NSPrivacyAccessedAPITypes<\/key>\s*<array\/>/.test(manifest), 'no required-reason API declared (the audit found none)');
for (const t of ['EmailAddress', 'Name', 'OtherUserContent', 'UserID', 'ProductInteraction', 'OtherDiagnosticData']) {
  check(manifest.includes(`<string>NSPrivacyCollectedDataType${t}</string>`), `collected: ${t}`);
}
check((manifest.match(/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/g) || []).length === 6, 'none of the six is used for tracking');
check((manifest.match(/<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/g) || []).length === 6, 'all six are linked to the student');
check(!/UsageDescription/.test(read('ios/App/App/Info.plist')), 'Info.plist carries no purpose string (local notifications need none)');

if (failures.length === 0) {
  console.log(`PASS: ${passes} checks. The reminder is the app's alone, off at 19:00, asks only at the switch, carries no purchase word; the manifest is in the target and declares what the audit found.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} of ${failures.length + passes}`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
