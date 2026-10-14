/**
 * Step Store-Fix-1: the review renders of the three changed screens, committed
 * under docs/store/fix-renders/ so the owner can look at them in the repo.
 *
 * As render-redesign3.mjs (same audit, same refusal of any finding), with the
 * App Store capture's own geometry: the 6.9-inch iPhone (440 x 956 pt at 3x,
 * 1320 x 2868 px, the size of docs/store/screenshots), the app's user agent,
 * and the iPhone's safe-area insets (62 pt top, 34 pt bottom) emulated through
 * Chrome's DevTools protocol, so `env(safe-area-inset-top)` is what it is on
 * the phone and the status-bar scrim has its real height. A render whose page
 * does not read a 62 px inset fails: it would prove nothing about the scrim.
 *
 * The screens, Arabic and English, dark and light:
 *   material     the subject's material cards (item 1: titles without their
 *                extension; the type badge is there)
 *   ask          the Ask conversation scrolled as the capture scrolls ar/04
 *                (item 3: ASK_TOP from scripts/store-seed/capture_steps.py,
 *                the same string) with its source pills (item 1)
 *   summary      the summary scrolled to the top as the capture's 03 shot
 *                (SUMMARY, the same string), so the page runs under the status
 *                bar (item 2: the scrim is opaque; the pixel rows under the
 *                inset are checked by the workflow from audit.json)
 * and, Arabic only, `ask-capture`: the ask screen holding the real question
 * and answer of capture 38579234295 (ar/04), to measure whether the question,
 * the answer and its sources fit the list on this phone.
 *
 * KF_PLANT_OLD_SCRIM=1 renders the summary screens only, with the scrim's
 * gradient before this step planted back, so the workflow can show that
 * scrim_check.py fails on it (the check is not blind).
 *
 * Usage: node scripts/redesign-built/render-fix.mjs --out DIR
 * Env: BASE, CHROME, PUPPETEER_DIR (as render.mjs).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { kfWording } from '../lib/app-wording.mjs';
import { audit } from './audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || join(ROOT, 'docs', 'store', 'fix-renders'));
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const INSET = { top: 62, bottom: 34 };
const capJs = (name) => execFileSync('python3', [join(ROOT, 'scripts', 'store-seed', 'capture_steps.py'), '--js', name], { encoding: 'utf8' }).trim();
const ASK_TOP = capJs('ASK_TOP');
const SUMMARY = capJs('SUMMARY');

// The question and answer of capture 38579234295's ar/04 (the live answer of
// the +kfshots-ar account, read from its PNG and its reading), in the markup
// ReactMarkdown gives them in MessageBubble.
const CAPTURE_Q = 'ما الفرق بين التنفس الخلوي والتخمر من حيث الحصيلة الطاقية؟';
const CAPTURE_A = [
  '<h2 class="mb-2 text-base font-bold">الفرق بين التنفس الخلوي والتخمر من حيث الحصيلة الطاقية</h2>',
  '<p class="mb-2 last:mb-0"><strong class="font-semibold">التنفس الخلوي:</strong> ينتج من 36 إلى 38 جزيئة من ATP عند هدم جزيئة غلوكوز واحدة [1]</p>',
  '<p class="mb-2 last:mb-0"><strong class="font-semibold">التخمر:</strong> ينتج فقط جزيئتين من ATP لكل جزيئة غلوكوز [1]</p>',
  '<p class="mb-2 last:mb-0"><strong class="font-semibold">الفرق:</strong> التنفس الخلوي يوفر حصيلة طاقية أعلى بكثير من التخمر (حوالي 18-19 مرة أكثر)، لأن التنفس يقوم بهدم كلي للغلوكوز بينما التخمر يقوم بهدم جزئي فقط [1]</p>',
].join('');

const SCREENS = [
  { key: 'material', path: 'preview/subject', q: { platform: 'native' }, item: 1 },
  { key: 'ask', path: 'preview/ask', q: { platform: 'native', view: 'answer' }, item: 3 },
  { key: 'summary', path: 'preview/subject', q: { platform: 'native' }, item: 2 },
  { key: 'ask-capture', path: 'preview/ask', q: { platform: 'native', view: 'answer' }, item: 3, only: 'ar' },
];
const PLANT = process.env.KF_PLANT_OLD_SCRIM === '1';
const OLD_SCRIM = '.kf-clay .kf-topfade { background: linear-gradient(0deg, transparent, var(--background) 55%) !important; }';
const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) for (const s of SCREENS)
  if ((!s.only || s.only === locale) && (!PLANT || s.key === 'summary')) JOBS.push({ locale, theme, s, file: `${locale}-${theme}-${s.key}.png` });

const EXT = /\.(pdf|docx|pptx|xlsx|txt|md)$/i;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });
const results = [];
let failures = 0;
mkdirSync(out, { recursive: true });
for (const job of JOBS) {
  const tab = await browser.newPage();
  await tab.setUserAgent(APP);
  await tab.setViewport({ width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const cdp = await tab.createCDPSession();
  let insetError = null;
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: INSET.top, topMax: INSET.top, bottom: INSET.bottom, bottomMax: INSET.bottom, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
  } catch (e) {
    insetError = String(e.message || e).split('\n')[0];
  }
  const q = new URLSearchParams({ ...job.s.q, theme: job.theme }).toString();
  const url = `${BASE}/${job.locale}/${job.s.path}?${q}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  if (PLANT) await tab.addStyleTag({ content: OLD_SCRIM });
  const k = job.s.key;
  if (k === 'ask-capture') {
    // One question and its answer, as the capture's new conversation has.
    await tab.evaluate((qText, aHtml) => {
      const users = [...document.querySelectorAll('.kf-bubble-user')];
      if (users.length < 2) return;
      // Drop the first question and its answer (the list's first two rows).
      const rowOf = (el) => el.closest('.flex.justify-end, .flex.justify-start');
      const first = rowOf(users[0]);
      const firstAnswer = first?.nextElementSibling;
      first?.remove();
      firstAnswer?.remove();
      const qb = users[1];
      qb.innerHTML = `<p class="mb-2 last:mb-0">${qText}</p>`;
      const answer = rowOf(qb)?.nextElementSibling?.querySelector('.kf-card');
      if (answer) answer.innerHTML = aHtml;
    }, CAPTURE_Q, CAPTURE_A);
  }
  const a = await tab.evaluate(audit);
  const facts = await tab.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);visibility:hidden';
    document.body.appendChild(probe);
    const inset = parseFloat(getComputedStyle(probe).paddingTop);
    probe.remove();
    const scrim = document.querySelector('.kf-topfade');
    const sr = scrim?.getBoundingClientRect();
    return {
      shell: document.querySelector('[data-kf-shell]')?.getAttribute('data-kf-shell') || null,
      inset,
      scrim: scrim ? { top: Math.round(sr.top), height: Math.round(sr.height), bg: getComputedStyle(scrim).backgroundImage } : null,
      page: getComputedStyle(document.body).backgroundColor,
      cardTitles: [...document.querySelectorAll('article [data-filename]')].map((e) => e.textContent),
      pills: [...document.querySelectorAll('[data-filename]')].filter((e) => e.closest('[dir="ltr"].flex-wrap')).map((e) => e.textContent),
      typeLabels: [...document.querySelectorAll('article .kf-chip span')].map((s) => s.textContent.trim()),
    };
  });
  let reading = null;
  if (k === 'ask' || k === 'ask-capture') reading = await tab.evaluate(ASK_TOP);
  else if (k === 'summary') reading = await tab.evaluate(SUMMARY);
  else await tab.evaluate(() => { const el = document.querySelector('article'); if (el) el.scrollIntoView({ block: 'center' }); });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // What lies under the status bar after the scroll: the page must run under
  // it for the scrim's opacity to mean anything.
  const under = await tab.evaluate((h) => {
    const els = document.elementsFromPoint(window.innerWidth / 2, h / 2).filter((e) => !e.classList.contains('kf-topfade'));
    const t = els.find((e) => e.closest('main') && (e.textContent || '').trim());
    return t ? `${t.tagName.toLowerCase()} in main` : null;
  }, INSET.top);
  await tab.screenshot({ path: join(out, job.file) });

  const ar = job.locale === 'ar';
  const want = [];
  want.push([insetError === null && facts.inset === INSET.top, `the iPhone's top inset is emulated: ${facts.inset}px${insetError ? ` (${insetError})` : ''}`]);
  want.push([facts.shell === 'native', `the app's shell (data-kf-shell=${facts.shell})`]);
  want.push([!!facts.scrim && facts.scrim.top === 0 && facts.scrim.height === INSET.top + 12, `the status-bar scrim covers the inset and its fade: ${JSON.stringify(facts.scrim && { top: facts.scrim.top, height: facts.scrim.height })}`]);
  if (k === 'material') {
    want.push([facts.cardTitles.length > 0 && facts.cardTitles.every((t) => !EXT.test(t)), `card titles without their extension: ${facts.cardTitles.join(' | ')}`]);
    want.push([facts.typeLabels.length === facts.cardTitles.length, `each card keeps its type badge: ${facts.typeLabels.join(', ')}`]);
  }
  if (k === 'ask' || k === 'ask-capture') {
    want.push([facts.pills.length > 0 && facts.pills.every((t) => !EXT.test(t)), `source pills without the extension: ${facts.pills.join(' | ')}`]);
    const m = /question top (-?\d+) of list (\d+); first source bottom (-?\d+|none); all sources bottom (-?\d+|none)/.exec(reading || '');
    want.push([!!m && +m[1] >= 0 && +m[1] <= 40, `the question bubble starts the list, not cut: ${reading}`]);
    if (k === 'ask') want.push([!!m && m[3] !== 'none' && +m[3] <= +m[2], `the answer and its first source are in view: ${reading}`]);
  }
  if (k === 'summary') {
    want.push([/summary in view/.test(reading || ''), `the summary scrolled as the capture does: ${reading}`]);
    want.push([!!under, `the page runs under the status bar: ${under}`]);
  }

  const words = kfWording(a.visibleText);
  const bad = [
    ...(res.status() === 200 ? [] : [`HTTP ${res.status()}`]),
    ...want.filter(([ok]) => !ok).map(([, m]) => `item: ${m}`),
    ...a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
    ...a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
    ...a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`),
    ...(ar ? a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
    ...(a.shapingControl ? [] : ['shaping control failed']),
    ...(a.rubik ? [] : ['Rubik not loaded']),
    ...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on ${a.cost.heaviest}`] : []),
    ...a.cost.filters.map((f) => `filter on ${f}`),
    ...(words.length ? [`wording ${JSON.stringify(words)}`] : []),
  ];
  failures += bad.length;
  // `scrim`: the pixel rows the workflow checks, all the page's colour.
  results.push({ file: job.file, url, item: job.s.item, findings: bad, proved: want.map(([ok, m]) => ({ ok, m })), reading, scrim: { rows: INSET.top * 3, page: facts.page }, text: a.text.length, targets: a.targets.length, shaping: a.shaping.length });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${job.file}: ${want.map(([, m]) => m).join('; ')}`);
  for (const b of bad) console.log(`       ${b}`);
  await tab.close();
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${JOBS.length} renders`);
process.exit(failures ? 1 : 0);
