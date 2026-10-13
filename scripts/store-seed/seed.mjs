/**
 * Step Store-Shots-1: fills ONE App Store screenshot account (the owner's
 * exception of 2026-10-13: tornido.maroc2024+kfshots-ar / +kfshots-en only)
 * with the agent's notes, through the live app's OWN pages, as a student
 * would: no API key, no service-role key, no direct database write. The only
 * credentials are the account's e-mail and password, from the GitHub
 * environment `screenshots`; neither is ever printed.
 *
 *   --mode verify   sign in, report the user id PREFIX and the AI consent, stop.
 *   --mode seed     verify, then make the account hold docs/store/screenshot-
 *                   content/plan.json[locale]: allow AI processing (Settings),
 *                   create the subjects, upload the files, one summary, one
 *                   quiz, one Ask question. Idempotent: what exists is skipped,
 *                   so a re-run after a failure spends nothing twice.
 *
 * Every POST to /api/ingest, /api/summarize, /api/quiz/generate and /api/agent
 * is counted and reported (the AI calls this run paid for). Writes are
 * refused unless the signed-in e-mail is one of the two screenshot accounts.
 *
 * Usage: node scripts/store-seed/seed.mjs --locale ar|en --mode verify|seed
 * Env: KF_SHOTS_EMAIL, KF_SHOTS_PASSWORD, CHROME, PUPPETEER_DIR, BASE
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const L = arg('--locale');
const MODE = arg('--mode', 'verify');
const BASE = process.env.BASE || 'https://tryknowflow.com';
const EMAIL = process.env.KF_SHOTS_EMAIL || '';
const PASSWORD = process.env.KF_SHOTS_PASSWORD || '';
const ALLOWED = /^tornido\.maroc2024\+kfshots-(ar|en)@gmail\.com$/;
if (!['ar', 'en'].includes(L) || !['verify', 'seed'].includes(MODE)) { console.log('usage: --locale ar|en --mode verify|seed'); process.exit(2); }
if (!EMAIL || !PASSWORD) { console.log('FAIL: the account e-mail or password secret is empty'); process.exit(1); }
const m = ALLOWED.exec(EMAIL);
if (!m || m[1] !== L) { console.log('FAIL: this script writes only to the screenshot account of its own locale'); process.exit(1); }

const plan = JSON.parse(readFileSync(join(ROOT, 'docs', 'store', 'screenshot-content', 'plan.json'), 'utf8'))[L];
const require = createRequire(join(resolve(process.env.PUPPETEER_DIR || '.'), 'noop.js'));
const puppeteer = require('puppeteer-core');
const SAFARI_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/1';
const T = L === 'ar'
  ? { summarize: 'لخّص هذا الملف', quiz: 'اختبرني في هذا الملف', ready: 'جاهز', summaryReady: 'الملخص جاهز', quizReady: 'الاختبار جاهز' }
  : { summarize: 'Summarize this material', quiz: 'Quiz me on this material', ready: 'Ready', summaryReady: 'Summary ready', quizReady: 'Quiz ready' };

const calls = { ingest: 0, summarize: 0, quiz: 0, agent: 0 };
const log = (s) => console.log(s);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent(SAFARI_APP);
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
page.on('request', (r) => {
  if (r.method() !== 'POST') return;
  const u = r.url();
  if (u.includes('/api/ingest')) calls.ingest++;
  else if (u.includes('/api/summarize')) calls.summarize++;
  else if (u.includes('/api/quiz/generate')) calls.quiz++;
  else if (u.includes('/api/agent')) calls.agent++;
});
const go = async (path) => { const r = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 90000 }); return r?.status(); };
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
// Click IN THE PAGE (element.click()), never by screen position: at phone size
// the floating tab bar covers the bottom of the viewport, and a positional
// click on a button scrolled to the bottom edge lands on the bar (seed run
// 38437948365: the consent sheet never opened). The iOS runs click this way too.
const tap = async (sel) => { await page.waitForSelector(sel, { timeout: 15000 }); await page.$eval(sel, (e) => e.click()); };
let failed = false;
const need = (ok, msg) => { log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed = true; return ok; };

// The session the browser holds, read from its own cookie: only the user id
// PREFIX and the consent record are reported, never a token.
async function session() {
  const cookies = (await page.cookies()).filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!cookies.length) return null;
  let v = cookies.map((c) => c.value).join('');
  v = decodeURIComponent(v);
  if (v.startsWith('base64-')) v = Buffer.from(v.slice(7), 'base64url').toString('utf8');
  try { const s = JSON.parse(v); const u = s.user || s.currentSession?.user; return { id: u?.id || '', email: u?.email || '', consent: u?.user_metadata?.ai_consent ?? null }; } catch { return null; }
}

// ── Sign in through the app's login twin ────────────────────────────────────
need((await go(`/${L}/login`)) === 200, `the login page opens (/${L}/login)`);
await page.type('input[name=email]', EMAIL);
await page.type('input[name=password]', PASSWORD);
// The sign-in answers in the page (Supabase), then the app routes to the
// dashboard client-side: wait for the address itself, up to 20 s.
// Only the POST: the browser's CORS preflight (OPTIONS, 200) to the same
// address arrived first and was reported as the answer (runs 38434348392, 38434925052).
const authAnswer = page.waitForResponse((r) => /\/auth\/v1\/token/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
await tap('button[type=submit]');
const auth = await authAnswer;
for (let i = 0; i < 40 && !new RegExp(`/${L}/dashboard`).test(page.url()); i++) await settle(500);
await settle(1500);
const signedIn = new RegExp(`/${L}/dashboard`).test(page.url());
need(signedIn, `signed in: landed on ${new URL(page.url()).pathname}`);
if (!signedIn) {
  // Why, without any credential: the auth answer's status and the login
  // page's own error line (the app's copy, e.g. invalid credentials).
  log(`auth answer: ${auth ? `HTTP ${auth.status()}` : 'none seen'}`);
  const err = await page.evaluate(() => [...document.querySelectorAll('[role=alert], .text-danger, .bg-danger-subtle')].map((e) => (e.textContent || '').trim()).filter(Boolean).join(' | '));
  log(`login page says: ${err.replace(/\S+@\S+/g, '[email]') || '(nothing)'}`);
}
let s = await session();
need(!!s && ALLOWED.test(s.email || ''), `the session belongs to a screenshot account (user id ${s?.id ? s.id.slice(0, 8) + '…' : 'none'})`);
if (!signedIn || !s) { await browser.close(); process.exit(1); }
log(`consent: ${s.consent ? `version ${s.consent.version}, at ${s.consent.at}` : 'not given'}`);
if (MODE === 'verify') { await browser.close(); process.exit(failed ? 1 : 0); }

// ── 1. AI processing allowed, in Settings, as the student would ─────────────
if (!s.consent) {
  await go(`/${L}/dashboard/settings`);
  await tap('[data-kf-consent=allow]');
  await page.waitForSelector('[data-kf-consent-sheet=open] [data-kf-consent=accept]', { timeout: 15000 });
  await tap('[data-kf-consent-sheet=open] [data-kf-consent=accept]');
  await settle(4000);
  await go(`/${L}/dashboard/settings`);
}
need((await page.$eval('[data-kf-consent-state]', (e) => e.getAttribute('data-kf-consent-state')).catch(() => null)) === 'on' || !!(await session())?.consent, 'AI processing is allowed on this account');

// ── 2. The subjects ─────────────────────────────────────────────────────────
async function subjectLinks() {
  await go(`/${L}/dashboard/knowledge`);
  return page.$$eval('a[href*="/dashboard/knowledge/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: (a.closest('article,li,div')?.textContent || a.textContent || '').trim() })).filter((x) => !/\/new$/.test(x.href)));
}
for (const subj of plan.subjects) {
  const have = await subjectLinks();
  if (have.some((x) => x.text.includes(subj.name))) { log(`skip subject (exists): ${subj.name}`); continue; }
  await go(`/${L}/dashboard/knowledge/new`);
  await page.type('form input[type=text]', subj.name);
  await page.type('form textarea', subj.description);
  await page.select('form select', subj.language);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null), tap('form button[type=submit]')]);
  need(/\/dashboard\/knowledge$/.test(new URL(page.url()).pathname), `subject created: ${subj.name}`);
}
const links = await subjectLinks();
const idOf = (name) => { const x = links.find((l) => l.text.includes(name)); return x ? x.href.split('/').pop().split('?')[0] : null; };

// ── 3. The files, through the drop zone's own input ─────────────────────────
async function cards() {
  return page.$$eval('article', (as) => as.map((a) => a.textContent || ''));
}
for (const subj of plan.subjects) {
  const id = idOf(subj.name);
  if (!need(!!id, `subject found: ${subj.name}`)) continue;
  for (const f of subj.files) {
    await go(`/${L}/dashboard/knowledge/${id}`);
    if ((await cards()).some((c) => c.includes(f.replace(/\.md$/, '')))) { log(`skip file (exists): ${f}`); continue; }
    const path = join(ROOT, 'docs', 'store', 'screenshot-content', L, f);
    if (!need(existsSync(path), `note on disk: ${L}/${f}`)) continue;
    const input = await page.$('input[type=file]');
    const done = page.waitForResponse((r) => r.url().includes('/api/ingest') && r.request().method() === 'POST', { timeout: 240000 });
    await input.uploadFile(path);
    const r = await done.catch(() => null);
    need(r && r.status() === 200, `uploaded ${f}: HTTP ${r ? r.status() : 'no answer'}`);
    await settle(1500);
  }
}

// ── 4. One summary and one quiz on the plan's file ──────────────────────────
async function cardHandle(subjectId, file) {
  await go(`/${L}/dashboard/knowledge/${subjectId}`);
  const arts = await page.$$('article');
  for (const a of arts) if ((await a.evaluate((e) => e.textContent || '')).includes(file.replace(/\.md$/, ''))) return a;
  return null;
}
async function clickIn(card, label) {
  const btns = await card.$$('button');
  for (const b of btns) if (((await b.evaluate((e) => e.textContent || '')).trim()) === label) { await b.evaluate((e) => e.click()); return true; }
  return false;
}
{
  const id = idOf(plan.summary.subject);
  let card = await cardHandle(id, plan.summary.file);
  if (need(!!card, `card found for the summary: ${plan.summary.file}`)) {
    const text = await card.evaluate((e) => e.textContent || '');
    if (text.includes(T.summaryReady)) log('skip summary (exists)');
    else {
      const res = page.waitForResponse((r) => r.url().includes('/api/summarize') && r.request().method() === 'POST', { timeout: 180000 });
      need(await clickIn(card, T.summarize), 'summarize button pressed');
      const r = await res.catch(() => null);
      need(r && r.status() === 200, `summary written: HTTP ${r ? r.status() : 'no answer'}`);
    }
  }
  card = await cardHandle(id, plan.quiz.file);
  if (card) {
    const text = await card.evaluate((e) => e.textContent || '');
    if (text.includes(T.quizReady)) log('skip quiz (exists)');
    else {
      const res = page.waitForResponse((r) => r.url().includes('/api/quiz/generate') && r.request().method() === 'POST', { timeout: 180000 });
      need(await clickIn(card, T.quiz), 'quiz button pressed');
      const r = await res.catch(() => null);
      need(r && r.status() === 200, `quiz written: HTTP ${r ? r.status() : 'no answer'}`);
    }
  }
}

// ── 5. One Ask question, with its sources ───────────────────────────────────
{
  // A conversation already exists if the home's recent activity is not its
  // empty line ("No activity yet" / "لا شيء هنا بعد"): the question was asked
  // on an earlier run, and asking again would spend a second call.
  await go(`/${L}/dashboard`);
  const asked = await page.evaluate((empty) => !document.body.innerText.includes(empty), L === 'ar' ? 'لا شيء هنا بعد' : 'No activity yet');
  const id = idOf(plan.ask.subject);
  await go(`/${L}/dashboard/agent?kb=${id}`);
  const before = calls.agent;
  if (asked) log('skip ask (a conversation exists)');
  else {
    await page.type('[data-kf-composer] textarea', plan.ask.question);
    const res = page.waitForResponse((r) => r.url().includes('/api/agent') && r.request().method() === 'POST', { timeout: 180000 });
    await tap('[data-kf-composer] button');
    const r = await res.catch(() => null);
    const body = r ? await r.text().catch(() => '') : '';
    const cites = r ? (r.headers()['x-citations'] ? 'with sources' : 'NO sources header') : 'no answer';
    need(r && r.status() === 200 && body.length > 40, `Ask answered (${body.length} characters, ${cites})`);
    need(calls.agent === before + 1, 'exactly one Ask call');
  }
}

// ── 6. What the account holds now ───────────────────────────────────────────
s = await session();
const holds = [];
for (const subj of plan.subjects) {
  const id = idOf(subj.name);
  if (!id) { holds.push(`${subj.name}: missing`); continue; }
  await go(`/${L}/dashboard/knowledge/${id}`);
  const cs = await cards();
  const files = subj.files.filter((f) => cs.some((c) => c.includes(f.replace(/\.md$/, ''))));
  const ready = cs.filter((c) => c.includes(T.ready)).length;
  holds.push(`${subj.name}: ${files.length}/${subj.files.length} files, ${ready} ready, summary ${cs.some((c) => c.includes(T.summaryReady)) ? 'yes' : 'no'}, quiz ${cs.some((c) => c.includes(T.quizReady)) ? 'yes' : 'no'}`);
  need(files.length === subj.files.length, `${subj.name}: every file is there`);
}
for (const h of holds) log(`holds: ${h}`);
log(`consent: ${s?.consent ? `version ${s.consent.version}, at ${s.consent.at}` : 'not given'}`);
log(`AI and upload calls this run: ingest ${calls.ingest}, summarize ${calls.summarize}, quiz ${calls.quiz}, agent ${calls.agent}`);
await browser.close();
process.exit(failed ? 1 : 0);
