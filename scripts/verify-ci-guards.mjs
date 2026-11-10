/**
 * Offline proof of two workflow guards (the follow-up to #305). Tier 0: no
 * network, no credential, no simulator, no macOS.
 *
 * (a) design-c.yml's before_ref. `isSafeRef` (scripts/design-c/check-before-ref.mjs)
 *     accepts a plain branch, tag or SHA and refuses shell text; the script run
 *     as the workflow runs it (BEFORE_REF in env) exits 1 on a refused value
 *     and writes nothing to GITHUB_OUTPUT. The workflow file itself is read:
 *     `inputs.before_ref` appears only in the env of the validating step, and
 *     the checkout's ref and the label read that step's output.
 *
 * (c) ios-signed-in.yml's login step, ONE bounded retry. The REAL step script
 *     is taken from the workflow's steps JSON and run against a scripted login
 *     page (fake form, button, clock), in three cases:
 *       1. arrived first try          -> 1 submit, retry=0
 *       2. reset, then arrived         -> 2 submits, retry=1
 *       3. reset twice                 -> 2 submits (never 3), retry=1 failed
 *     The button "resets" when it is back to its first label and enabled after
 *     it was busy; a reset before the first busy (the 100 ms before submit)
 *     never counts.
 *
 * (d) The to-login step (activation fix 3): the app opens on sign-up on a
 *     fresh device, on login once it held a session. The REAL step from the
 *     workflow runs on a scripted sign-up (en, ar) and a scripted login and
 *     must reach /login on both, judged by scripts/ios/page_steps.py's rule;
 *     the background-upload run and the App Store capture carry it byte for
 *     byte.
 *
 * Usage: node scripts/verify-ci-guards.mjs
 */
import { readFileSync, mkdtempSync, readFileSync as rf } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { isSafeRef } from './design-c/check-before-ref.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const need = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

// ── (a) ────────────────────────────────────────────────────────────────────
const SHA = 'b42326bd01c290af1385c0dbb9a8793c0c23f91f';
const good = ['main', SHA, 'd32bd5f', 'design/c-pr4-ask-quiz-summary', 'v1.0.1'];
const bad = ['main;echo x', '$(id)', '`id`', 'main && id', 'a b', "main'x", 'main"x', 'main|id', 'main>x', 'x\nid',
  '-x', '../main', 'main..x', 'a//b', 'main/', 'main.', 'x.lock', 'a@{1}', '', 'a'.repeat(101), 'main\\x'];
for (const v of good) need(isSafeRef(v), `before_ref accepted: ${JSON.stringify(v)}`);
for (const v of bad) need(!isSafeRef(v), `before_ref refused: ${JSON.stringify(v)}`);

const script = join(ROOT, 'scripts/design-c/check-before-ref.mjs');
const runCli = (v) => {
  const out = join(mkdtempSync(join(tmpdir(), 'kf-ref-')), 'out');
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, BEFORE_REF: v, GITHUB_OUTPUT: out }, encoding: 'utf8' });
  let written = '';
  try { written = rf(out, 'utf8'); } catch { /* nothing written */ }
  return { code: r.status, text: (r.stdout + r.stderr).trim(), written };
};
for (const v of ['main;echo x', '$(id)']) {
  const r = runCli(v);
  need(r.code === 1 && r.written === '', `CLI refuses ${JSON.stringify(v)}: exit ${r.code}, output file ${JSON.stringify(r.written)} | ${r.text}`);
}
for (const v of ['main', SHA]) {
  const r = runCli(v);
  need(r.code === 0 && r.written === `ref=${v}\n`, `CLI accepts ${JSON.stringify(v)}: exit ${r.code}, output ${JSON.stringify(r.written)}`);
}

const dc = readFileSync(join(ROOT, '.github/workflows/design-c.yml'), 'utf8');
const inputUses = dc.split(/\r?\n/).filter((l) => /inputs\.before_ref/.test(l));
need(inputUses.length === 1 && /^\s+BEFORE_REF: \$\{\{/.test(inputUses[0]), `design-c.yml names inputs.before_ref once, in the validating step's env: ${JSON.stringify(inputUses.map((l) => l.trim()))}`);
need(/ref: \$\{\{ steps\.before\.outputs\.ref \}\}/.test(dc), 'the base checkout reads the validated output');
need(/BEFORE_LABEL: \$\{\{ github\.event\.pull_request && 'main' \|\| steps\.before\.outputs\.ref \}\}/.test(dc), 'the side-by-side label reads the validated output, through env');
need(!/run:.*\$\{\{[^}]*(inputs|before)/.test(dc.replace(/\r/g, '')), 'no run: line interpolates an input or the ref');

// ── (c) ────────────────────────────────────────────────────────────────────
const yml = readFileSync(join(ROOT, '.github/workflows/ios-signed-in.yml'), 'utf8').replace(/\r/g, '');
const block = yml.split("<<'JSON'")[1].split('\n          JSON')[0];
const steps = JSON.parse(block);
const login = steps.find((s) => s.name === 'login');
const home = steps.find((s) => s.name === 'home');
need(login && login.until === '/(en|ar)/dashboard$' && login.timeout >= 150000, `the login step waits for the dashboard long enough for one retry: timeout ${login?.timeout} ms`);
need(/retry=/.test(home?.js || ''), 'the home reading records retry=');

/**
 * Run the real step script against a scripted page. `script` lists, per
 * submit, what happens after it: [{at: ms after submit, text, disabled} |
 * {at, arrive: true}].
 */
function simulate(plan) {
  let now = 0;
  const timers = [];
  let seq = 0;
  const later = (fn, ms, every) => { const t = { id: ++seq, at: now + ms, fn, every }; timers.push(t); return t.id; };
  const cancel = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const button = { innerText: 'Sign In', disabled: false };
  const store = new Map();
  const location = { pathname: '/en/login' };
  let submits = 0;
  const form = {
    querySelector: () => button,
    requestSubmit() {
      submits++;
      const events = plan[submits - 1] || [];
      for (const ev of events) later(() => {
        if (ev.arrive) location.pathname = '/en/dashboard';
        else { button.innerText = ev.text; button.disabled = ev.disabled; }
      }, ev.at);
    },
  };
  const input = (name) => ({ name, form, value: '', dispatchEvent() {} });
  const email = input('email'), password = input('password');
  class HTMLInputElement {}
  Object.defineProperty(HTMLInputElement.prototype, 'value', { set(v) { this.value_ = v; }, configurable: true });
  const ctx = {
    document: { querySelector: (q) => (q.includes('email') ? email : q.includes('password') ? password : null) },
    HTMLInputElement, Event: class { constructor(t) { this.type = t; } },
    sessionStorage: { setItem: (k, v) => store.set(k, String(v)), getItem: (k) => store.get(k) ?? null },
    location,
    setTimeout: (fn, ms) => later(fn, ms, 0), setInterval: (fn, ms) => later(fn, ms, ms), clearInterval: cancel, clearTimeout: cancel,
  };
  // The app replaces the two bare tokens with JSON strings (MainViewController.swift).
  const js = login.js.replace('__KF_EMAIL__', '"reviewer@example.invalid"').replace('__KF_PASSWORD__', '"x"');
  const result = vm.runInNewContext(js, ctx);
  const stop = 400000; // well past the step's 180 s
  while (timers.length) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = timers.shift();
    if (t.at > stop) break;
    now = t.at;
    if (t.every) { t.at = now + t.every; timers.push(t); }
    t.fn();
  }
  const watching = timers.some((t) => t.every);
  const homeResult = vm.runInNewContext(home.js, { ...ctx, window: { scrollTo() {} } });
  return { result, submits, retry: store.get('kfLoginRetry'), arrivedAt: location.pathname, watching, homeResult };
}

const busy = { text: 'Signing in...', disabled: true };
const reset = { text: 'Sign In', disabled: false };
const cases = [
  ['arrived first try', [[{ at: 50, ...busy }, { at: 13800, arrive: true }]], { submits: 1, retry: '0', path: '/en/dashboard' }],
  ['reset, then arrived', [[{ at: 50, ...busy }, { at: 108000, ...reset }], [{ at: 50, ...busy }, { at: 14000, arrive: true }]], { submits: 2, retry: '1', path: '/en/dashboard' }],
  ['reset twice -> fail', [[{ at: 50, ...busy }, { at: 77000, ...reset }], [{ at: 50, ...busy }, { at: 40000, ...reset }], [{ at: 50, ...busy }, { at: 1000, arrive: true }]], { submits: 2, retry: '1 failed', path: '/en/login' }],
];
for (const [name, plan, want] of cases) {
  const r = simulate(plan);
  need(r.result === 'submitted' && r.submits === want.submits && r.retry === want.retry && r.arrivedAt === want.path && !r.watching,
    `login ${name}: result=${r.result} submits=${r.submits} retry=${r.retry} page=${r.arrivedAt} watcher stopped=${!r.watching} | home reads "${r.homeResult}"`);
}

// ── (d) ────────────────────────────────────────────────────────────────────
// Activation fix 3: a fresh simulator now opens on SIGN-UP (login before). The
// REAL to-login step runs on a scripted page for each first screen, and its
// reading is judged by the rule of scripts/ios/page_steps.py (left its start,
// matches `until`; the hash counts because `until` names one).
const toLogin = steps.find((s) => s.name === 'to-login');
const order = steps.map((s) => s.name);
need(toLogin && order.indexOf('to-login') >= 0 && order.indexOf('to-login') < order.indexOf('google-hint') && order.indexOf('google-hint') < order.indexOf('login'),
  `to-login runs before google-hint and login: ${order.slice(0, 4).join(', ')}`);
function firstScreen(path, links) {
  const loc = { pathname: path, search: '', get href() { return `https://tryknowflow.com${this.pathname}${this.search}${this.hash || ''}` } };
  const anchors = links.map((h) => ({ getAttribute: (n) => (n === 'href' ? h : null), click() { loc.pathname = h; loc.hash = ''; } }));
  const ctx = {
    location: loc,
    history: { state: null, replaceState(_s, _t, u) { const [p, h] = u.split('#'); loc.pathname = p; loc.hash = h ? `#${h}` : ''; } },
    document: { querySelectorAll: (q) => (q === 'a[href]' ? anchors : []) },
  };
  const start = loc.href;
  const result = vm.runInNewContext(toLogin.js, ctx);
  const until = new RegExp(toLogin.until);
  const keep = toLogin.until.includes('#');
  const bare = (u) => (keep ? u : u.split('#')[0]);
  return { result, href: loc.href, arrived: bare(loc.href) !== bare(start) && until.test(bare(loc.href)) };
}
const SIGNUP_LINKS = ['/en', '/en/login', '/en/forgot-password'];
for (const [name, path, links, want] of [
  ['new first screen (sign-up, en)', '/en/signup', SIGNUP_LINKS, 'clicked the login link on sign-up'],
  ['new first screen (sign-up, ar)', '/ar/signup', ['/ar', '/ar/login', '/ar/forgot-password'], 'clicked the login link on sign-up'],
  ['old first screen (login)', '/en/login', ['/en', '/en/forgot-password', '/en/signup'], 'already on login'],
]) {
  const r = firstScreen(path, links);
  need(r.result === want && r.arrived && /\/(en|ar)\/login(#kf-at-login)?$/.test(r.href), `to-login from the ${name}: "${r.result}" -> ${r.href} (arrived ${r.arrived})`);
}
const lost = firstScreen('/en/dashboard', []);
need(!lost.arrived && /^not on sign-up or login/.test(lost.result), `to-login on any other page reports it and does not arrive: "${lost.result}"`);
const noLink = firstScreen('/en/signup', ['/en']);
need(!noLink.arrived && noLink.result === 'no login link on sign-up', `to-login on a sign-up without the link reports it: "${noLink.result}"`);
// The same step, byte for byte, in the background-upload run and the App Store capture.
const allToLogin = [...yml.matchAll(/\{"name":"to-login"[^\n]*\}/g)].map((m) => JSON.parse(m[0]));
need(allToLogin.length === 2 && allToLogin.every((s) => s.js === toLogin.js && s.until === toLogin.until), `ios-signed-in.yml has the same to-login step in the screens and the background-upload runs: ${allToLogin.length}`);
for (const py of ['python3', 'python']) {
  const r = spawnSync(py, ['-I', join(ROOT, 'scripts/store-seed/capture_steps.py'), 'en'], { encoding: 'utf8' });
  // A missing interpreter (or Windows' Store stub for python3) is skipped.
  if (r.error || r.status !== 0) continue;
  const cap = JSON.parse(r.stdout || '[]');
  const t = cap.find((s) => s.name === 'to-login');
  const ci = cap.map((s) => s.name);
  need(t && t.js === toLogin.js && t.until === toLogin.until && ci.indexOf('to-login') < ci.indexOf('login'), `the App Store capture (capture_steps.py) runs the same to-login step before its login: ${ci.slice(0, 3).join(', ')}`);
  break;
}

console.log(`\n${fails.length} failure(s)`);
process.exit(fails.length ? 1 : 0);
