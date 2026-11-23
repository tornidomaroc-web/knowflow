/**
 * Item 4i, PR 2: the App Store capture's steps proved WITHOUT macOS, on the
 * preview pages of a production build served in CI (store-shots.yml; the
 * placeholder Supabase address, no session, no secret, no AI). The steps
 * are capture_steps.py's own scripts, run in Chrome as the iOS harness runs
 * them (an expression evaluated in the page), with the subject and the quiz
 * file bound to the preview fixtures. Every reading is judged by
 * check_capture.py's own rules (`--judge-rows`), and every reading rule has a
 * planted case here that must break exactly that rule.
 *
 * What runs on the real component:
 *   01  /<l>/preview/subjects?platform=native: the shot, and the subject link
 *       the nav step would press;
 *   02  /<l>/preview/subject?platform=native (KnowFlowApp/2): the shot;
 *   03  the same page: the upload tile, the sheet's camera tile, the three
 *       committed page JPEGs put into the REAL input, the real re-encode and
 *       numbering, then the shot (nothing sent), then close;
 *   04  the summary well of the first card, scrolled under the top fade;
 *   05  /<l>/preview/ask?view=capture&platform=native, the speech plugin
 *       stubbed as design-c does: sources, question, microphone;
 *   06  the subject page again: the quiz button of the first card (bound
 *       name ''), the route answered here with a stored quiz (`cached`).
 * What only the real capture proves: the live pages and the two accounts'
 * content, the login, the real Ask answer and its length, the simulator's
 * WebKit (DataTransfer, the replaced click()), the app's probe (purchase
 * words), the status bar, the PNG sizes.
 *
 * Usage (CI): BASE=http://127.0.0.1:3000 CHROME=... PUPPETEER_DIR=... node scripts/store-seed/prove_steps.mjs <out dir>
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceStubSrc } from '../design-c/voice.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(process.argv[2] || 'prove-steps');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const require = createRequire(join(process.env.PUPPETEER_DIR || '.', 'node_modules', 'x.js'));
const puppeteer = require('puppeteer-core');
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const APP2 = `${SAFARI} KnowFlowApp/2`;
// The Pro Max the capture runs on: 440 x 956 pt at 3x (1320 x 2868).
const PHONE = { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const py = process.platform === 'win32' ? 'python' : 'python3';
const pyRun = (args) => {
  const r = spawnSync(py, ['-I', ...args], { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout;
};
const frag = (n) => pyRun(['scripts/store-seed/capture_steps.py', '--js', n]).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A stored quiz, as /api/quiz/generate answers it for an existing quiz.
const QUIZ_BODY = (cached) => JSON.stringify({
  quiz: { id: 'q-proof', document_id: 'd1', lang: 'en', is_partial: false },
  items: [1, 2, 3].map((n) => ({ id: `i${n}`, position: n - 1, question: `Question ${n} of the proof quiz`, options: ['One', 'Two', 'Three', 'Four'] })),
  is_partial: false,
  ...(cached ? { cached: true } : {}),
});

mkdirSync(OUT, { recursive: true });
const rows = [];
const notes = [];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });

async function open(path, { stub = false, quiz = 'cached' } = {}) {
  const tab = await browser.newPage();
  await tab.setViewport(PHONE);
  await tab.setUserAgent(APP2);
  if (stub) await tab.evaluateOnNewDocument(voiceStubSrc({ s: { voice: { view: 'idle' } } }));
  await tab.setRequestInterception(true);
  tab.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/quiz/generate' && r.method() === 'POST') {
      return r.respond({ status: 200, contentType: 'application/json', body: QUIZ_BODY(quiz === 'cached') });
    }
    // Nothing leaves the runner: the placeholder Supabase address and every
    // other host are refused.
    if (u.origin !== new URL(BASE).origin) return r.abort();
    return r.continue();
  });
  await tab.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(800);
  return tab;
}

/** The probe the app would add, as far as a page can read it. The sign-in
 * state is the app's own reading (a preview page has no session): set true. */
const PROBE = `(function(){return {signedIn:true,google:document.querySelectorAll('[fill="#4285F4"]').length,purchase:{words:[],hrefs:[],marked:document.querySelectorAll('[data-kf-iap]').length}}})()`;

async function shot(tab, step, js, label, expect = null) {
  const result = await tab.evaluate(js);
  const probe = await tab.evaluate(PROBE);
  rows.push({ step, label, result, probe, expect });
  const file = join(OUT, `${label.replace(/[^a-z0-9-]+/gi, '_')}.png`);
  await tab.screenshot({ path: file });
  console.log(`${label}: ${String(result).slice(0, 300)}`);
  return result;
}

for (const L of ['en', 'ar']) {
  // The steps with the preview fixtures bound: the first subject and the first
  // card (an empty name matches the first), which holds the quiz on the preview.
  const steps = JSON.parse(pyRun(['scripts/store-seed/capture_steps.py', L, '--bind', JSON.stringify({ subject: '', quiz: '' })]));
  const S = Object.fromEntries(steps.map((s) => [s.name, s.js]));
  const other = JSON.parse(pyRun(['scripts/store-seed/capture_steps.py', '--other', L]));
  const sh = (n) => S[`shot-${L}-${n}`];

  // 01 the subjects list, and the link the nav step would press.
  let t = await open(`/${L}/preview/subjects?platform=native`);
  await shot(t, `shot-${L}-01-subjects`, sh('01-subjects'), `${L}-01-subjects`);
  const nav = await t.evaluate(`(function(){var h=null;var o=HTMLElement.prototype.click;HTMLElement.prototype.click=function(){h=this.getAttribute('href')};try{var r=${S[`nav-${L}-subject`]};return r+' -> '+h}finally{HTMLElement.prototype.click=o}})()`);
  notes.push(`${L} nav-subject: ${nav}`);
  console.log(`${L} nav-subject: ${nav}`);
  if (!/^opened .* -> \/(en|ar)\/dashboard\/knowledge\/[^/]+$/.test(nav)) rows.push({ step: `shot-${L}-01-subjects`, label: `${L}-nav-subject`, result: `no subject link: ${nav}`, probe: {}, expect: null });
  // Plants on this page, one per reading rule.
  const plant = async (label, mutate, expect, step = `shot-${L}-01-subjects`, js = sh('01-subjects')) => {
    await t.evaluate(mutate);
    await shot(t, step, js, `${L}-plant-${label}`, expect);
    await t.reload({ waitUntil: 'networkidle0' });
    await sleep(500);
  };
  await plant('theme-dark', `document.documentElement.setAttribute('data-theme','dark')`, 'theme');
  await plant('iap-element', `(function(){var d=document.createElement('div');d.setAttribute('data-kf-iap','plant');d.textContent='x';document.querySelector('main,body').appendChild(d)})()`, 'iap');
  await plant('platform-word', `(function(){var p=document.createElement('p');p.textContent='Made for iPhone';document.querySelector('main,body').appendChild(p)})()`, 'platform');
  await plant('email-text', `(function(){var p=document.createElement('p');p.textContent='student@example.com';document.querySelector('main,body').appendChild(p)})()`, 'mail');
  await plant('alert', `(function(){var p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Refused';document.querySelector('main,body').appendChild(p)})()`, 'alert');
  await plant('keyboard', `(function(){var i=document.createElement('input');i.type='text';document.querySelector('main,body').appendChild(i);i.focus()})()`, 'keyboard');
  await plant('other-account', `(function(){var p=document.createElement('p');p.textContent=${JSON.stringify(other[0])};document.querySelector('main,body').appendChild(p)})()`, 'purity');
  await t.close();

  // 02, 03, 04 and 06 on the subject page (shell 2: the camera).
  t = await open(`/${L}/preview/subject?platform=native`);
  await shot(t, `shot-${L}-02-material`, sh('02-material'), `${L}-02-material`);
  const r1 = await t.evaluate(S[`camera-${L}-open`]);
  await sleep(900);
  // Plant: the upload sheet (the two tiles) left open over a shot.
  await shot(t, `shot-${L}-02-material`, sh('02-material'), `${L}-plant-upload-sheet-open`, 'dialog');
  const r2 = await t.evaluate(S[`camera-${L}-sheet`]);
  await sleep(900);
  const r3 = await t.evaluate(S[`camera-${L}-pages`]);
  // The real re-encode is asynchronous: wait for the three thumbnails.
  let pages = '0';
  for (let i = 0; i < 40 && pages !== '3'; i++) {
    await sleep(250);
    pages = await t.evaluate(`(document.querySelector('[data-kf-camera-sheet=open]')||{getAttribute:function(){return 'none'}}).getAttribute('data-kf-camera-pages')`);
  }
  notes.push(`${L} camera: ${r1} / ${r2} / ${r3} / pages ${pages}`);
  console.log(`${L} camera: ${r1} / ${r2} / ${r3} / pages ${pages}`);
  await shot(t, `shot-${L}-03-camera`, sh('03-camera'), `${L}-03-camera`);
  const closed = await t.evaluate(S[`camera-${L}-close`]);
  await sleep(700);
  notes.push(`${L} camera close: ${closed}`);
  if (!/sent 0$/.test(closed)) rows.push({ step: `shot-${L}-03-camera`, label: `${L}-camera-close`, result: `sent after close: ${closed}`, probe: {}, expect: null });
  // Plant: the camera shot taken with the sheet closed.
  await shot(t, `shot-${L}-03-camera`, sh('03-camera'), `${L}-plant-camera-closed`, 'dialog');
  await shot(t, `shot-${L}-04-summary`, sh('04-summary'), `${L}-04-summary`);
  const q = await t.evaluate(S[`quiz-${L}-open`]);
  await sleep(1500);
  notes.push(`${L} quiz-open: ${q}`);
  await shot(t, `shot-${L}-06-quiz`, sh('06-quiz'), `${L}-06-quiz`);
  // Plant: an answer picked.
  await t.evaluate(`(function(){var l=document.querySelector('[data-kf-choice] input');if(l)l.click()})()`);
  await sleep(400);
  await shot(t, `shot-${L}-06-quiz`, sh('06-quiz'), `${L}-plant-quiz-picked`, 'quiz');
  await t.close();
  // Plant: a quiz the route made now (no `cached`): an AI call.
  t = await open(`/${L}/preview/subject?platform=native`, { quiz: 'new' });
  await t.evaluate(S[`quiz-${L}-open`]);
  await sleep(1500);
  await shot(t, `shot-${L}-06-quiz`, sh('06-quiz'), `${L}-plant-quiz-not-cached`, 'quiz-stored');
  // Plant: two pages instead of three.
  await t.evaluate(S[`camera-${L}-open`]);
  await sleep(700);
  await t.evaluate(S[`camera-${L}-sheet`]);
  await sleep(700);
  await t.evaluate(S[`camera-${L}-pages`].replace('P.forEach', 'P.slice(0,2).forEach'));
  await sleep(4000);
  await shot(t, `shot-${L}-03-camera`, sh('03-camera'), `${L}-plant-two-pages`, 'camera-pages');
  await t.close();

  // 05 Ask with its sources and the microphone (plugin stubbed).
  t = await open(`/${L}/preview/ask?view=capture&platform=native`, { stub: true });
  await sleep(1200);
  await shot(t, `shot-${L}-05-ask`, sh('05-ask'), `${L}-05-ask`);
  await t.close();
  // Plant: no plugin, so no microphone.
  t = await open(`/${L}/preview/ask?view=capture&platform=native`);
  await sleep(1200);
  await shot(t, `shot-${L}-05-ask`, sh('05-ask'), `${L}-plant-no-mic`, 'mic');
  await t.close();
  // Plant: the composer focused (the keyboard), with the plugin.
  t = await open(`/${L}/preview/ask?view=capture&platform=native`, { stub: true });
  await sleep(1200);
  await t.evaluate(`document.querySelector('[data-kf-composer] textarea').focus()`);
  await shot(t, `shot-${L}-05-ask`, sh('05-ask'), `${L}-plant-keyboard`, 'keyboard');
  // Plant: the sources pushed below the list (a long answer).
  await t.evaluate(`(function(){var b=document.querySelectorAll('[data-kf-bubble=answer]');var a=b[b.length-1];var p=document.createElement('div');p.style.height='900px';a.appendChild(p)})()`);
  await shot(t, `shot-${L}-05-ask`, sh('05-ask'), `${L}-plant-sources-below`, 'sources-in-view');
  await t.close();
}
await browser.close();

writeFileSync(join(OUT, 'rows.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(OUT, 'notes.txt'), notes.join('\n') + '\n');
const j = spawnSync(py, ['-I', 'scripts/store-seed/check_capture.py', '--judge-rows', join(OUT, 'rows.jsonl')], { encoding: 'utf8', cwd: ROOT });
process.stdout.write(j.stdout || '');
process.stderr.write(j.stderr || '');
writeFileSync(join(OUT, 'judge.txt'), j.stdout || '');
process.exit(j.status ?? 1);
