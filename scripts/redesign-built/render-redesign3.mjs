/**
 * Step Redesign-3: the review renders of the changed screens, committed under
 * docs/store/redesign3-renders/ so the owner can look at them in the repo.
 *
 * As render.mjs (same audit, same refusal of any finding), with three
 * differences: an iPhone 15 viewport (393 x 852 pt at 3x); the iOS app's user
 * agent (Safari on iPhone with `KnowFlowApp/1`, the token the shell appends,
 * src/lib/platform.ts) on every app screen, so the middleware treats the
 * request as the app's; and the web screens with the plain Safari agent.
 *
 * WHERE IT RUNS. The workflow builds THIS commit and serves it on the runner
 * with placeholder Supabase values (no secret, nothing deployed). The Vercel
 * preview of the PR serves the same build but sits behind Vercel's login, so
 * a runner cannot reach it without a bypass secret this repository does not
 * hold. The signed-in screens are the design preview routes (the real
 * components in the real shell, fixture data, no auth, 404 on production);
 * the signed-out screen is the login twin, as the app gets it.
 *
 * Usage: node scripts/redesign-built/render-redesign3.mjs --out DIR
 * Env: BASE, CHROME, PUPPETEER_DIR (as render.mjs).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kfWording } from '../lib/app-wording.mjs';
import { audit } from './audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || join(HERE, '..', '..', 'docs', 'store', 'redesign3-renders'));
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const APP = `${SAFARI} KnowFlowApp/1`;

// `to`: a selector scrolled to the middle of the viewport before the shot
// (null: the top of the page; 'bottom': the end of the page).
const SCREENS = [
  { key: 'app-ask', path: 'preview/ask', q: { platform: 'native' }, ua: APP, to: null, item: 3 },
  { key: 'app-ask-conversation', path: 'preview/ask', q: { platform: 'native', view: 'answer' }, ua: APP, to: null, item: 3 },
  { key: 'app-ask-empty', path: 'preview/ask', q: { platform: 'native', view: 'zero' }, ua: APP, to: null, item: 4 },
  { key: 'app-ask-noanswer', path: 'preview/ask', q: { platform: 'native', view: 'noanswer' }, ua: APP, to: null, item: 4 },
  { key: 'app-subject-empty', path: 'preview/subject', q: { platform: 'native', view: 'empty' }, ua: APP, to: '[data-kf-files-empty]', item: 4 },
  { key: 'app-subject-quiz-empty', path: 'preview/subject', q: { platform: 'native', view: 'quizempty' }, ua: APP, to: '[data-kf-quiz-empty]', item: 4 },
  { key: 'app-subject-files', path: 'preview/subject', q: { platform: 'native' }, ua: APP, to: 'article', item: 5 },
  { key: 'app-home-streak', path: 'preview/student-home', q: { platform: 'native', streak: '0' }, ua: APP, to: '[data-kf-streak-ring]', item: 6 },
  { key: 'app-settings-reminder', path: 'preview/settings', q: { platform: 'native', reminder: 'on' }, ua: APP, to: '[data-kf-reminder-clock]', item: 7 },
  // `platform=web` hides the preview's own toolbar; the shell is the web's.
  { key: 'web-topbar', path: 'preview/student-home', q: { platform: 'web' }, ua: SAFARI, to: null, item: 8 },
  { key: 'app-login', path: 'login', q: {}, ua: APP, to: null, item: 0 },
];
const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const s of SCREENS)
  JOBS.push({ locale, theme, s, file: `${locale}-${theme}-${s.key}.png` });

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
const results = [];
let failures = 0;
mkdirSync(out, { recursive: true });
for (const job of JOBS) {
  const tab = await browser.newPage();
  await tab.setUserAgent(job.s.ua);
  await tab.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const q = new URLSearchParams({ ...job.s.q, theme: job.theme }).toString();
  const url = `${BASE}/${job.locale}/${job.s.path}?${q}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  const a = await tab.evaluate(audit);
  // What the screen must show, read in the page (the item it proves).
  const facts = await tab.evaluate((key) => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s)?.textContent || '').trim();
    const shell = q('[data-kf-shell]')?.getAttribute('data-kf-shell') || null;
    const f = { shell, title: txt('main h1') };
    if (key.startsWith('app-ask')) {
      f.composer = (() => { const c = q('[data-kf-composer]'); if (!c) return null; const r = c.getBoundingClientRect(); const bar = q('nav.kf-tabbar')?.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: bar ? Math.round(bar.top) : null }; })();
      f.sources = [...document.querySelectorAll('p')].filter((p) => /^(Sources|المصادر)$/.test(p.textContent.trim())).length;
      f.drawn = [...document.querySelectorAll('[data-illustration]')].map((s) => s.getAttribute('data-illustration'));
    }
    if (key.startsWith('app-subject')) {
      f.drawn = [...document.querySelectorAll('[data-illustration]')].map((s) => s.getAttribute('data-illustration'));
      f.typeLabels = [...document.querySelectorAll('article .kf-chip span')].map((s) => s.textContent.trim());
    }
    if (key === 'app-home-streak') f.ring = !!q('[data-kf-streak-ring]') && !/^-$/.test(txt('[data-kf-streak-ring]'));
    if (key === 'app-settings-reminder') { f.clock = txt('[data-kf-reminder-clock]'); f.stateLine = txt('[data-kf-reminder-state] [aria-live]'); }
    if (key === 'web-topbar') { const h = q('header.kf-topbar'); f.topbar = !!h; f.topbarShadow = h ? getComputedStyle(h).boxShadow !== 'none' : false; }
    return f;
  }, job.s.key);
  if (job.s.to === 'bottom') await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  else if (job.s.to) await tab.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'center' }); }, job.s.to);
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.screenshot({ path: join(out, job.file) });

  const ar = job.locale === 'ar';
  const want = [];
  const k = job.s.key;
  if (k.startsWith('app-') && k !== 'app-login') want.push([facts.shell === 'native', `the app's shell (data-kf-shell=${facts.shell})`]);
  if (k === 'app-ask' || k === 'app-ask-conversation') {
    want.push([facts.title === (ar ? 'اسأل' : 'Ask'), `the large title reads ${JSON.stringify(facts.title)}`]);
    want.push([facts.composer && facts.composer.bottom <= (facts.composer.barTop ?? 852) && facts.composer.top > 0, `the composer is on screen above the tab bar: ${JSON.stringify(facts.composer)}`]);
  }
  if (k === 'app-ask-conversation') want.push([facts.sources === 2, `"${ar ? 'المصادر' : 'Sources'}" under each of the two answers: ${facts.sources}`]);
  if (k === 'app-ask-empty' || k === 'app-ask-noanswer') want.push([facts.drawn.includes('empty-ask'), `the drawn Ask empty state: ${facts.drawn}`]);
  if (k === 'app-subject-empty') want.push([facts.drawn.includes('empty-files'), `the drawn files empty state: ${facts.drawn}`]);
  if (k === 'app-subject-quiz-empty') want.push([facts.drawn.includes('empty-quiz'), `the drawn quiz empty state: ${facts.drawn}`]);
  if (k === 'app-subject-files') want.push([ar ? facts.typeLabels.length > 0 && facts.typeLabels.every((t) => /^[؀-ۿ ]+$/.test(t)) : facts.typeLabels.every((t) => /^[A-Z]+$/.test(t)), `file-type labels in ${ar ? 'Arabic' : 'Latin capitals'}: ${facts.typeLabels.join(', ')}`]);
  if (k === 'app-home-streak') want.push([facts.ring, 'the gold ring stands where the dash was']);
  if (k === 'app-settings-reminder') {
    const norm = (v) => v.replace(/[‎‏؜⁦-⁩]/g, '').replace(/[  ]/g, ' ');
    const want7 = ar ? '7:00 م' : '7:00 pm';
    want.push([norm(facts.clock) === want7 && norm(facts.stateLine).includes(want7), `the reminder time reads ${JSON.stringify(facts.clock)} / ${JSON.stringify(facts.stateLine)}, want ${want7}`]);
  }
  if (k === 'web-topbar') want.push([facts.topbar && facts.topbarShadow && facts.shell === 'web', `the web's phone top bar in clay: ${JSON.stringify(facts)}`]);

  const words = kfWording(a.visibleText);
  const bad = [
    ...(res.status() === 200 ? [] : [`HTTP ${res.status()}`]),
    ...want.filter(([ok]) => !ok).map(([, m]) => `item: ${m}`),
    ...a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
    ...a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
    // The login twin is rendered as context and is not changed by this step
    // (the owner's rule: sign-in pages unchanged), so its small text links
    // are recorded in audit.json as notes, not failures.
    ...(k === 'app-login' ? [] : a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`)),
    ...(ar ? a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
    ...(a.shapingControl ? [] : ['shaping control failed']),
    ...(a.rubik ? [] : ['Rubik not loaded']),
    ...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on ${a.cost.heaviest}`] : []),
    ...a.cost.filters.map((f) => `filter on ${f}`),
    // The app's wording rule holds on every app screen (the web may name its plans).
    ...(k.startsWith('app-') && words.length ? [`wording ${JSON.stringify(words)}`] : []),
  ];
  failures += bad.length;
  const tmin = Math.min(...a.text.map((t) => t.got));
  results.push({ file: job.file, url, item: job.s.item, ua: job.s.ua === APP ? 'app' : 'safari', findings: bad, notes: k === 'app-login' ? a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`) : [], proved: want.map(([ok, m]) => ({ ok, m })), text: a.text.length, textWorst: tmin, targets: a.targets.length, shaping: a.shaping.length, cost: a.cost });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${job.file}: ${want.map(([, m]) => m).join('; ') || 'renders'} | text ${a.text.length} (worst ${tmin.toFixed(2)}:1), targets ${a.targets.length}, Arabic shaped ${a.shaping.filter((s) => s.ok).length}/${a.shaping.length}`);
  for (const b of bad) console.log(`       ${b}`);
  await tab.close();
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${JOBS.length} renders`);
process.exit(failures ? 1 : 0);
