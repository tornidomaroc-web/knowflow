/**
 * Step Store-Fix-2: the review renders committed under docs/store/fix-renders-2/
 * and the fit measurement of the App Store capture's ar/04.
 *
 * The geometry is render-fix.mjs's: the 6.9-inch iPhone (440 x 956 pt at 3x),
 * the app's user agent, the iPhone's insets (62 pt top, 34 pt bottom) emulated
 * through Chrome's DevTools protocol.
 *
 *   answer        (ar, en; dark, light) the Ask screen of /preview/ask?view=capture:
 *                 KBSelector's card on the phone (history button, subject bar)
 *                 over the real ChatBox, holding the capture's conversation,
 *                 scrolled as the capture scrolls ar/04 (ASK_TOP, the same
 *                 string). Item 1: between two blocks of the answer there is
 *                 the block's margin (8 px) and no blank line.
 *   settings-end  (ar, en; dark) Settings scrolled to its end. Item 4, the
 *                 web half: the root element carries the page colour (the iOS
 *                 web view reads its under-page colour there) and the bottom
 *                 34 pt of the screen are that colour. The native half (the
 *                 web view's scroll view following that colour) is proven only
 *                 by the signed-in run's pixel check on the device.
 *
 * KF_PLANT_OLD_BUBBLE=1 renders the answer screens with the bubble's old
 * `whitespace-pre-wrap` planted back, so the workflow can show the gap check
 * fails on it (the check is not blind). Nothing is written to the committed set.
 *
 * THE FIT (item 5, Arabic, dark, written to fit.json). The run kept the
 * answer only as far as its PNG shows (src/app/[locale]/preview/ask/capture.ts).
 * So the stand-in tail's length is CALIBRATED: with the old bubble planted,
 * the smallest `tail` whose first source ends at or past the device's 594 px
 * below the question's top (capture 38618442205: question top 16, first
 * source bottom 610), and the one before it, whichever is closer. Then the
 * same answer is measured in the new bubble, with the run's question and with
 * plan.json's new one, and the gap is first source bottom minus list height
 * (negative: the first source is in view, with that many px to spare).
 *
 * Usage: node scripts/redesign-built/render-fix2.mjs --out DIR
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
const out = resolve(args[args.indexOf('--out') + 1] || join(ROOT, 'docs', 'store', 'fix-renders-2'));
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');

const APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const INSET = { top: 62, bottom: 34 };
const ASK_TOP = execFileSync('python3', [join(ROOT, 'scripts', 'store-seed', 'capture_steps.py'), '--js', 'ASK_TOP'], { encoding: 'utf8' }).trim();
const PLANT = process.env.KF_PLANT_OLD_BUBBLE === '1';
// The bubble before this step: pre-wrap on the answer's bubble itself.
const OLD_BUBBLE = '.flex.justify-start > div > .kf-card { white-space: pre-wrap !important; }';
// Capture 38618442205, ar/04 (the step reading).
const DEVICE = { questionTop: 16, list: 444, firstSource: 610, allSources: 662 };
const DEVICE_SPAN = DEVICE.firstSource - DEVICE.questionTop;
// The device's list was measured with 34 pt subject chips. Since #284 the chips
// are 44 pt, so the subject bar is 8 px taller and the list 8 px shorter than
// the capture's, by design; the stand-in must reproduce the device less that.
const CHIP_BAR_GROWTH = 8;
const RE = /question top (-?\d+) of list (\d+); first source bottom (-?\d+|none); all sources bottom (-?\d+|none); list at end (yes|no)/;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox', '--hide-scrollbars'] });

async function open(path, query, theme, { old = false } = {}) {
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
  const url = `${BASE}/${path}?${new URLSearchParams({ platform: 'native', ...query, theme }).toString()}`;
  const res = await tab.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await tab.evaluate(() => document.fonts.ready);
  if (old) await tab.addStyleTag({ content: OLD_BUBBLE });
  const inset = await tab.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);visibility:hidden';
    document.body.appendChild(probe);
    const v = parseFloat(getComputedStyle(probe).paddingTop);
    probe.remove();
    return v;
  });
  return { tab, url, status: res.status(), inset, insetError };
}

const settle = (tab) => tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// The gaps between consecutive blocks of each answer bubble, and whether any
// text node of the bubble itself (not inside a block) takes up a line.
const BLOCK_GAPS = () => [...document.querySelectorAll('.flex.justify-start > div > .kf-card')].map((b) => {
  const blocks = [...b.children].filter((e) => getComputedStyle(e).display !== 'inline');
  const gaps = [];
  for (let i = 1; i < blocks.length; i++) gaps.push(Math.round((blocks[i].getBoundingClientRect().top - blocks[i - 1].getBoundingClientRect().bottom) * 10) / 10);
  return { blocks: blocks.map((e) => e.tagName.toLowerCase()), gaps, whiteSpace: getComputedStyle(b).whiteSpace };
});

async function measure(query, old) {
  const o = await open(`ar/preview/ask`, { view: 'capture', ...query }, 'dark', { old });
  const reading = await o.tab.evaluate(ASK_TOP);
  const m = RE.exec(reading || '');
  await settle(o.tab);
  return { ...o, reading, m: m && { questionTop: +m[1], list: +m[2], firstSource: m[3] === 'none' ? null : +m[3], allSources: m[4] === 'none' ? null : +m[4], atEnd: m[5] === 'yes' } };
}

mkdirSync(out, { recursive: true });
const results = [];
let failures = 0;
const JOBS = [];
for (const locale of ['ar', 'en']) for (const theme of ['dark', 'light']) JOBS.push({ locale, theme, key: 'answer', file: `${locale}-${theme}-answer.png` });
if (!PLANT) for (const locale of ['ar', 'en']) JOBS.push({ locale, theme: 'dark', key: 'settings-end', file: `${locale}-dark-settings-end.png` });

for (const job of JOBS) {
  const answer = job.key === 'answer';
  const o = await open(`${job.locale}/preview/${answer ? 'ask' : 'settings'}`, answer ? { view: 'capture' } : {}, job.theme, { old: PLANT });
  const { tab } = o;
  const a = await tab.evaluate(audit);
  const want = [];
  want.push([o.insetError === null && o.inset === INSET.top, `the iPhone's top inset is emulated: ${o.inset}px${o.insetError ? ` (${o.insetError})` : ''}`]);
  let reading = null;
  let extra = {};
  if (answer) {
    reading = await tab.evaluate(ASK_TOP);
    await settle(tab);
    const bubbles = await tab.evaluate(BLOCK_GAPS);
    const ans = bubbles[bubbles.length - 1];
    extra = { bubble: ans };
    want.push([!!ans && ans.blocks.length >= 4, `the answer has its blocks: ${ans && ans.blocks.join(' ')}`]);
    want.push([!!ans && ans.gaps.every((g) => g >= 7 && g <= 9), `between two blocks of the answer only the 8 px margin, no blank line: gaps ${ans && ans.gaps.join(', ')} (white-space ${ans && ans.whiteSpace})`]);
    const m = RE.exec(reading || '');
    want.push([!!m && +m[1] >= 0 && (+m[1] <= 40 || m[5] === 'yes'), `the question bubble starts the list, not cut: ${reading}`]);
  } else {
    await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(tab);
    extra = await tab.evaluate(() => ({
      root: getComputedStyle(document.documentElement).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
      atEnd: Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1,
    }));
    want.push([extra.atEnd, `scrolled to the end of Settings`]);
    want.push([extra.root === extra.page && extra.page === 'rgb(20, 17, 13)', `the root element carries the page colour: html ${extra.root}, body ${extra.page}`]);
  }
  await tab.screenshot({ path: join(out, job.file) });
  const words = kfWording(a.visibleText);
  const bad = [
    ...(o.status === 200 ? [] : [`HTTP ${o.status}`]),
    ...want.filter(([ok]) => !ok).map(([, m]) => `item: ${m}`),
    ...a.text.filter((t) => !t.ok).map((t) => `text ${t.got}:1 < ${t.need}:1 ${t.el}`),
    ...a.controls.filter((c) => !c.ok).map((c) => `control ${c.got}:1 < 3:1 ${c.el}`),
    ...a.targets.filter((t) => !t.ok).map((t) => `target ${t.w} x ${t.h} < 44 x 44 ${t.el}`),
    ...(job.locale === 'ar' ? a.shaping.filter((s) => !s.ok).map((s) => `shaping not joined ${s.el}`) : []),
    ...(a.shapingControl ? [] : ['shaping control failed']),
    ...(a.rubik ? [] : ['Rubik not loaded']),
    ...(a.cost.maxLayers > 3 ? [`${a.cost.maxLayers} shadow layers on ${a.cost.heaviest}`] : []),
    ...a.cost.filters.map((f) => `filter on ${f}`),
    ...(words.length ? [`wording ${JSON.stringify(words)}`] : []),
  ];
  // Ask's subject chips were 34 pt tall here until #284 (the device's ar/04
  // shows that height), carried as a known open item. They are 44 pt now, so
  // the 44 x 44 target check above covers them like every other control: a
  // chip under 44 pt is a finding again, not a known.
  failures += bad.length;
  // `bottom`: the pixel rows bottom_check.py reads (settings-end only).
  results.push({ file: job.file, url: o.url, findings: bad, proved: want.map(([ok, m]) => ({ ok, m })), reading, ...extra, ...(answer ? {} : { bottom: { rows: INSET.bottom * 3, page: extra.page } }) });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${job.file}: ${want.map(([, m]) => m).join('; ')}`);
  for (const b of bad) console.log(`       ${b}`);
  await tab.close();
}

let fit = null;
if (!PLANT) {
  // Calibrate the stand-in tail on the old bubble against the device.
  const span = async (n) => {
    const r = await measure({ tail: String(n) }, true);
    await r.tab.close();
    return r.m && r.m.firstSource !== null ? { n, span: r.m.firstSource - r.m.questionTop, m: r.m, reading: r.reading } : { n, span: null, reading: r.reading };
  };
  const words = Number(execFileSync('node', ['-e', "const s=require('fs').readFileSync(process.argv[1],'utf8');const m=/CAPTURE_TAIL = '([^']*)'/.exec(s);console.log(m[1].split(' ').length)", join(ROOT, 'src', 'app', '[locale]', 'preview', 'ask', 'capture.ts')], { encoding: 'utf8' }).trim());
  const lo0 = await span(0);
  const hi0 = await span(words);
  let lo = 0, hi = words, calib;
  if (lo0.span === null || hi0.span === null) calib = { error: 'no reading', lo0, hi0 };
  else if (lo0.span >= DEVICE_SPAN) calib = lo0;
  else if (hi0.span < DEVICE_SPAN) calib = { ...hi0, short: true };
  else {
    // The smallest n whose span reaches the device's, by bisection.
    let hiR = hi0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const r = await span(mid);
      if (r.span >= DEVICE_SPAN) { hi = mid; hiR = r; } else lo = mid;
    }
    const loR = await span(lo);
    calib = Math.abs(hiR.span - DEVICE_SPAN) <= Math.abs(loR.span - DEVICE_SPAN) ? hiR : loR;
    calib.neighbours = { below: { n: loR.n, span: loR.span }, above: { n: hiR.n, span: hiR.span } };
  }
  fit = { device: { ...DEVICE, span: DEVICE_SPAN }, tailWords: words, calibration: calib };
  if (calib.n !== undefined && calib.span !== null) {
    const cases = { old: [{ tail: String(calib.n) }, true], new: [{ tail: String(calib.n) }, false], 'new-question': [{ tail: String(calib.n), q: 'new' }, false] };
    for (const [name, [q, old]] of Object.entries(cases)) {
      const r = await measure(q, old);
      await r.tab.screenshot({ path: join(out, `ar-dark-fit-${name}.png`) });
      await r.tab.close();
      fit[name] = { reading: r.reading, ...(r.m || {}), gap: r.m && r.m.firstSource !== null ? r.m.firstSource - r.m.list : null, sourcesRows: r.m && r.m.allSources !== null && r.m.firstSource !== null ? r.m.allSources - r.m.firstSource : null };
    }
    const okCal = Math.abs(calib.span - DEVICE_SPAN) <= 12;
    const okList = fit.old.list === DEVICE.list - CHIP_BAR_GROWTH;
    console.log(`${okCal ? 'ok  ' : 'FAIL'} the old bubble reproduces the device: span ${calib.span} px vs ${DEVICE_SPAN} at tail ${calib.n} of ${words} words`);
    console.log(`${okList ? 'ok  ' : 'FAIL'} the list is the device's height less the taller subject bar: ${fit.old.list} vs ${DEVICE.list} - ${CHIP_BAR_GROWTH}`);
    console.log(`note the sources row: ${fit.old.sourcesRows} px from the first pill's bottom to the row's (device ${DEVICE.allSources - DEVICE.firstSource})`);
    console.log(`fit: old bubble gap ${fit.old.gap} px; new bubble gap ${fit.new.gap} px; new bubble and new question gap ${fit['new-question'].gap} px (positive: the first source is that far below the list)`);
    failures += (okCal ? 0 : 1) + (okList ? 0 : 1);
  } else {
    console.log(`FAIL the calibration found no tail: ${JSON.stringify(calib).slice(0, 300)}`);
    failures += 1;
  }
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify(results, null, 2) + '\n');
if (fit) writeFileSync(join(out, 'fit.json'), JSON.stringify(fit, null, 2) + '\n');
console.log(`\n${failures} failure(s) across ${JOBS.length} renders${fit ? ' and the fit' : ''}`);
process.exit(failures ? 1 : 0);
