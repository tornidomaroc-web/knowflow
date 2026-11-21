/**
 * IN-APP RATING, PR 1 OF 2 (big item 4h): the web half, dormant until PR 2's
 * KnowFlowReview plugin ships. The study is
 * D:\Temp\kf-research\rating-study-e7948da\report.md (sha256
 * 683d3cef...450f), item 9, approved by the owner as written. No network, no
 * app, no database. Red on main: the modules below do not exist there.
 *
 *  1. THE RULES (src/lib/review/rules.ts, decide()). Every boundary: tenure
 *     day 2 vs day 3; the 1st vs the 2nd qualifying result; 2 of 5 vs 3 of 5
 *     and a 2-question quiz; the same app version vs a new one; 119 vs 120
 *     days since the last ask; a setback today vs yesterday; the device clock
 *     moved back (before the first-use day, before the last ask, a setback
 *     dated "tomorrow") asks nothing; no version asks nothing. At most ONE
 *     qualifying result counts per calendar day (lastWin, fix 1 of #345): a
 *     same-day retake reads few-wins, the next day makes wins 2, a win day
 *     after today counts nothing, a low score never touches the win day.
 *  2. THE STORE (src/lib/review/store.ts, localStorage `kf-review`). A
 *     missing record, corrupt JSON, a wrong `v`, an unknown field and a
 *     localStorage that throws each ask nothing (a bad lastWin too); the first three are
 *     rewritten as a fresh record dated today; a throwing store writes
 *     nothing. noteFirstUse() stamps once and never moves the stamp;
 *     noteSetback() dates today. Without the bridge nothing is written.
 *  3. THE GATE (src/lib/review/bridge.ts). null on the web, at shell 1, in
 *     the Android shell, at shell 2 on iOS without the plugin, for a forged
 *     `KnowFlowApp/2` with no Capacitor, and without nativePromise; with all
 *     of them it calls `KnowFlowReview` only, with `available` and `request`
 *     only. available() never throws and keeps only a sane version string.
 *  4. THE TRIGGER (src/components/review/ReviewTrigger.tsx). The sequence:
 *     the win is written before anything else; request() is called only
 *     after the 2 s wait, the live checks and a re-read; it is NOT called
 *     when the screen left the result, a sheet is open, the page lost focus,
 *     a text field has focus, the record changed underneath, or the "asked"
 *     write fails. The live checks treat a CLOSED Sheet (its panel keeps
 *     aria-modal inside an aria-hidden wrapper) as closed.
 *  5. THE SOURCES, statically: request() is called from ReviewTrigger only;
 *     no onClick (or any on* handler) reaches it; the write-review URL
 *     appears once in src; no reward, allowance, unlock or Pro word in a
 *     file with a review call; QuizSection uses the hook once at the top;
 *     noteSetback() sits on each refusal/error branch named in the study;
 *     noteFirstUse() in the dashboard's AiConsentProvider mount effect; the
 *     Settings row is the last row of Help and legal; both Settings pages
 *     pass it; RateRow renders nothing on the server, so the server markup
 *     of Settings is the same with and without it (check 22 by
 *     construction); no ios/ file and no new dependency.
 *  6. THE STRINGS: docs/copy/ARABIC_STRINGS_app_v15.md, the owner's
 *     approved set, is the dictionary's value byte for byte in both
 *     languages; no star, "stars", 5, the Arabic word for stars or a star
 *     sign in either string; no purchase word (kfWording); no dash; Western
 *     digits.
 *  7. THE DESCRIPTION'S UNITS (fix 2 of #345, the owner's review of the
 *     design-c 44865033100 renders): src/lib/review/rate-units.ts cuts the
 *     approved value by word index, English 1-3 / 4-7 / 8-11, Arabic 1-2 /
 *     3-5 / 6-8; the units joined with single spaces are the en.ts / ar.ts
 *     value byte for byte. RateRow draws each unit as a nowrap span through
 *     LatinText, breaks only between units, text-wrap: balance on the line
 *     box. Check 31's line rules (scripts/design-c/review.mjs,
 *     rateLineRules) flag the layouts 0d753e9 drew (English "write a /
 *     review", Arabic 360 split between the 4th and 5th words), pass every
 *     layout that breaks only between units, and each forced <br> trips its
 *     own rule.
 *
 * Usage: node --experimental-strip-types scripts/verify-review.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { kfWording } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
function check(ok, name, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `  -- ${detail}` : ''}`);
}
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const has = (p) => existsSync(resolvePath(ROOT, p));

installTsxHooks(ROOT, {
  '@/lib/supabase/client': `export function createClient() { return { auth: { updateUser: async () => ({ error: null }) } }; }`,
});

async function load(p) {
  try {
    return await import(pathToFileURL(resolvePath(ROOT, p)).href);
  } catch (e) {
    check(false, `${p} loads`, String(e.message).slice(0, 160));
    return null;
  }
}

// A device with the plugin (shell 2, iOS) and one without, swapped per check.
const UA0 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const UA2 = `${UA0} KnowFlowApp/2`;
const fakeCapacitor = ({ native = true, platform = 'ios', plugins = ['KnowFlowReview'], promise = true, answer = { available: true, version: '1.1' } } = {}) => {
  const calls = [];
  const C = {
    isNativePlatform: () => native,
    getPlatform: () => platform,
    isPluginAvailable: (n) => plugins.includes(n),
    nativePromise: promise
      ? (p, m, o) => {
          calls.push([p, m, o]);
          if (m === 'available') return typeof answer === 'function' ? answer() : Promise.resolve(answer);
          return Promise.resolve({ asked: true });
        }
      : undefined,
  };
  return { C, calls };
};
function withDevice(cap, ua, fn) {
  const prevC = globalThis.Capacitor;
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (cap) globalThis.Capacitor = cap;
  else delete globalThis.Capacitor;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua }, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (prevC === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = prevC;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav);
  }
}
const memStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
};
const throwingStore = () => ({ getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); } });
const at = (day, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);

// ── 1. the rules ────────────────────────────────────────────────────────────
const rules = await load('src/lib/review/rules.ts');
if (rules) {
  const { decide, THRESHOLDS, markAsked, dayOf, daysBetween } = rules;
  check(JSON.stringify(THRESHOLDS) === JSON.stringify({ minTotal: 3, minRatio: 0.6, minWins: 2, minDays: 3, gapDays: 120 }), 'THRESHOLDS are the study\'s: 3 questions, 60%, 2 wins, 3 days, 120 days', JSON.stringify(THRESHOLDS));
  check(dayOf(at('2027-01-04', 0)) === '2027-01-04' && dayOf(at('2027-01-04', 23)) === '2027-01-04', 'dayOf is the device\'s calendar day');
  check(daysBetween('2026-12-31', '2027-01-03') === 3 && daysBetween('2027-01-03', '2026-12-31') === -3 && daysBetween('2027-03-27', '2027-03-28') === 1, 'daysBetween counts calendar days, across a year end and a DST night');
  const base = { v: 1, first: '2027-01-01', wins: 1, askedVersion: null, askedAt: null, setback: null, lastWin: null };
  const good = { score: 4, total: 5 };
  const NOW = at('2027-01-10');
  const D = (s, m = good, now = NOW, v = '1.1', o) => decide({ ...base, ...s }, m, now, v, o);
  // Baseline: everything holds.
  const ok = D({});
  check(ok.ask === true && ok.reason === 'ask', 'everything holding (day 9, 2nd win, 4/5, new version, no setback) asks', JSON.stringify(ok));
  check(ok.next.wins === 2 && ok.next.askedVersion === null && ok.next.askedAt === null, 'decide() counts the win in `next` and does not mark the ask itself', JSON.stringify(ok.next));
  // Tenure: day 2 vs day 3.
  check(D({}, good, at('2027-01-03')).reason === 'too-new', 'first use 2 days ago: too-new', D({}, good, at('2027-01-03')).reason);
  check(D({}, good, at('2027-01-04')).ask === true, 'first use 3 days ago: asks', D({}, good, at('2027-01-04')).reason);
  check(D({}, good, at('2027-01-01', 23)).reason === 'too-new', 'first use today: too-new (the reviewer\'s fresh simulator)');
  // Wins: 1 vs 2 (the counter includes this result).
  check(D({ wins: 0 }).reason === 'few-wins' && D({ wins: 0 }).next.wins === 1, 'the 1st qualifying result: few-wins, counted', JSON.stringify(D({ wins: 0 })));
  check(D({ wins: 1 }).ask === true, 'the 2nd qualifying result: asks');
  // Score: 2/5 vs 3/5, total 2.
  const low = D({}, { score: 2, total: 5 });
  check(low.reason === 'low-score' && low.next.wins === 1, '2 of 5: low-score, and not counted as a win', JSON.stringify(low));
  check(D({}, { score: 3, total: 5 }).ask === true, '3 of 5 (exactly 60%): asks');
  check(D({}, { score: 2, total: 2 }).reason === 'low-score', 'a 2-question quiz (2 of 2): low-score (total under 3)');
  check(D({}, { score: 3, total: 3 }).ask === true, '3 of 3: asks');
  for (const bad of [{ score: 4, total: 3 }, { score: -1, total: 5 }, { score: 1.5, total: 5 }, { score: NaN, total: 5 }, { score: 3, total: Infinity }]) {
    check(D({}, bad).reason === 'low-score' && D({}, bad).next.wins === 1, `an impossible result ${JSON.stringify(bad)} asks nothing and counts nothing`);
  }
  // Version: same vs new.
  check(D({ askedVersion: '1.1', askedAt: '2026-06-01' }).reason === 'asked-this-version', 'asked for this version before (long ago): asked-this-version');
  check(D({ askedVersion: '1.0.1', askedAt: '2026-06-01' }).ask === true, 'asked for 1.0.1 long ago, now 1.1: asks');
  // Gap: 119 vs 120 days.
  check(D({ askedVersion: '1.0.1', askedAt: '2026-09-13' }).reason === 'too-soon', 'asked 119 days ago (other version): too-soon', `${daysBetween('2026-09-13', '2027-01-10')} days`);
  check(D({ askedVersion: '1.0.1', askedAt: '2026-09-12' }).ask === true, 'asked 120 days ago (other version): asks', `${daysBetween('2026-09-12', '2027-01-10')} days`);
  // Setback: today vs yesterday.
  check(D({ setback: '2027-01-10' }).reason === 'setback-today', 'a refusal or error today: setback-today');
  check(D({ setback: '2027-01-09' }).ask === true, 'a refusal or error yesterday: asks');
  check(D({ setback: '2027-01-10' }).next.wins === 2, 'a setback day still counts the win (the record is a count, not a mood)');
  // The clock moved back.
  check(D({}, good, at('2026-12-30')).ask === false, 'clock moved back before the first-use day: no ask', D({}, good, at('2026-12-30')).reason);
  check(D({ askedVersion: '1.0.1', askedAt: '2027-03-01' }).ask === false, 'clock moved back before the last ask: no ask', D({ askedVersion: '1.0.1', askedAt: '2027-03-01' }).reason);
  check(D({ setback: '2027-01-11' }).ask === false, 'a setback dated "tomorrow" (clock moved back): no ask', D({ setback: '2027-01-11' }).reason);
  check(D({}, good, new Date(NaN)).ask === false, 'an invalid clock: no ask');
  // One counted result per calendar day (fix 1 of #345, the reviewer's decision for the owner).
  {
    const d0 = { ...base, wins: 0, lastWin: null };
    const first = decide(d0, good, NOW, '1.1');
    check(first.next.wins === 1 && first.next.lastWin === '2027-01-10', 'a qualifying result counts and dates the win day', JSON.stringify(first.next));
    const again = decide(first.next, good, at('2027-01-10', 20), '1.1');
    check(again.next.wins === 1 && again.next.lastWin === '2027-01-10', 'two qualifying results on the same day count as one win', JSON.stringify(again.next));
    check(again.reason === 'few-wins' && again.ask === false, 'a retake the same day after one win reads few-wins', again.reason);
    const nextDay = decide(first.next, good, at('2027-01-11'), '1.1');
    check(nextDay.next.wins === 2 && nextDay.next.lastWin === '2027-01-11' && nextDay.ask === true, 'a qualifying result the next day makes wins 2 (and asks)', JSON.stringify(nextDay));
    const back = decide({ ...base, wins: 1, lastWin: '2027-01-11' }, good, NOW, '1.1');
    check(back.next.wins === 1 && back.next.lastWin === '2027-01-11' && back.ask === false, 'a clock moved back (win day after today) counts nothing', JSON.stringify(back));
    const lowNull = decide({ ...base, lastWin: null }, { score: 1, total: 5 }, NOW, '1.1');
    const lowSet = decide({ ...base, lastWin: '2027-01-05' }, { score: 1, total: 5 }, NOW, '1.1');
    check(lowNull.next.lastWin === null && lowSet.next.lastWin === '2027-01-05' && lowNull.next.wins === 1 && lowSet.next.wins === 1, 'a non-qualifying result never touches the win day or the count');
    const tooNew = decide({ ...base, first: '2027-01-09', wins: 0, lastWin: null }, good, NOW, '1.1');
    check(tooNew.reason === 'too-new' && tooNew.next.wins === 1 && tooNew.next.lastWin === '2027-01-10', 'too-new stays first, and the win is still counted and dated');
    const noCount = decide({ ...base, wins: 1, lastWin: '2027-01-05' }, good, NOW, '1.1', { count: false });
    check(noCount.next.wins === 1 && noCount.next.lastWin === '2027-01-05', 'count: false touches neither the count nor the win day');
    check(rules.freshState('2027-01-10').lastWin === null && Object.keys(rules.freshState('2027-01-10')).sort().join() === 'askedAt,askedVersion,first,lastWin,setback,v,wins', 'freshState has lastWin null and the seven fields');
  }
  // No state, no version.
  const none = decide(null, good, NOW, '1.1');
  check(none.ask === false && none.reason === 'storage' && none.next.first === '2027-01-10' && none.next.wins === 0, 'no usable record: storage, a fresh record dated today, no win counted', JSON.stringify(none));
  for (const v of ['', '  ', null, undefined, 7, 'x'.repeat(40)]) check(decide({ ...base }, good, NOW, v).ask === false && decide({ ...base }, good, NOW, v).reason === 'storage', `version ${String(JSON.stringify(v))}: storage, no ask`);
  // count: false (the re-check after the wait does not count twice).
  check(D({ wins: 2 }, good, NOW, '1.1', { count: false }).next.wins === 2 && D({ wins: 1 }, good, NOW, '1.1', { count: false }).reason === 'few-wins', 'count: false re-reads without counting again');
  // markAsked.
  const asked = markAsked({ ...base, wins: 2 }, '1.1', NOW);
  check(asked.askedVersion === '1.1' && asked.askedAt === '2027-01-10' && asked.wins === 2 && asked.first === base.first, 'markAsked writes the version and today, nothing else', JSON.stringify(asked));
  check(D({ ...asked }, good, at('2027-01-11')).reason === 'asked-this-version', 'after markAsked the same version never asks again');
  // Order: too-new wins over every other reason (CI's fresh simulator reads too-new whatever its score).
  check(D({ setback: '2027-01-01', wins: 0 }, { score: 0, total: 5 }, at('2027-01-01')).reason === 'too-new', 'too-new is read first (a fresh device reads too-new whatever its score or setback)');
}

// ── 2. the store ────────────────────────────────────────────────────────────
const store = await load('src/lib/review/store.ts');
if (store && rules) {
  const { readReview, writeReview, noteFirstUse, noteSetback, REVIEW_KEY, parseReview } = store;
  const { decide } = rules;
  check(REVIEW_KEY === 'kf-review', 'the key is kf-review');
  const NOW = at('2027-01-10');
  const askAfter = (r) => (r ? decide(r.fresh ? null : r.state, { score: 5, total: 5 }, NOW, '1.1') : { ask: false });
  const valid = JSON.stringify({ v: 1, first: '2027-01-01', wins: 5, askedVersion: null, askedAt: null, setback: null, lastWin: null });
  // Each failure mode: no ask, and the repairable ones rewritten fresh.
  for (const [name, raw] of [['missing', undefined], ['corrupt JSON', '{"v":1,'], ['wrong v', JSON.stringify({ v: 2, first: '2027-01-01', wins: 5, askedVersion: null, askedAt: null, setback: null, lastWin: null })], ['an unknown field', JSON.stringify({ v: 1, first: '2027-01-01', wins: 5, askedVersion: null, askedAt: null, setback: null, lastWin: null, user: 'x' })], ['a bad date', JSON.stringify({ v: 1, first: '2027-13-01', wins: 5, askedVersion: null, askedAt: null, setback: null, lastWin: null })], ['negative wins', JSON.stringify({ v: 1, first: '2027-01-01', wins: -1, askedVersion: null, askedAt: null, setback: null, lastWin: null })]]) {
    const s = memStore(raw === undefined ? {} : { 'kf-review': raw });
    const r = readReview(s, NOW);
    check(r && r.fresh === true && askAfter(r).ask === false, `${name}: asks nothing`, JSON.stringify(r));
    const back = s.m.get('kf-review');
    check(back && JSON.parse(back).first === '2027-01-10' && JSON.parse(back).wins === 0 && JSON.parse(back).v === 1, `${name}: rewritten as a fresh record dated today`, back);
  }
  const t = throwingStore();
  check(readReview(t, NOW) === null && askAfter(readReview(t, NOW)).ask === false, 'a throwing localStorage: no record, no ask');
  check(writeReview(t, JSON.parse(valid)) === false, 'a throwing localStorage: the write reports failure');
  check(readReview(null, NOW) === null, 'no storage at all: no record');
  const vs = memStore({ 'kf-review': valid });
  const r = readReview(vs, NOW);
  check(r && r.fresh === false && askAfter(r).ask === true, 'a valid record with 5 wins, 9 days old: reads and asks', JSON.stringify(r));
  check(parseReview(valid) !== null && parseReview('null') === null && parseReview('[]') === null && parseReview('"x"') === null, 'parseReview accepts only the record');
  const withWin = (w) => JSON.stringify({ ...JSON.parse(valid), lastWin: w });
  check(parseReview(withWin(null))?.lastWin === null && parseReview(withWin('2027-01-09'))?.lastWin === '2027-01-09', 'parseReview accepts lastWin null or a real day');
  for (const w of ['2027-13-01', '2027-02-30', 'yesterday', '', 5, true, {}]) check(parseReview(withWin(w)) === null, `parseReview refuses lastWin ${JSON.stringify(w)}`);
  const { lastWin: _dropped, ...sixOnly } = JSON.parse(valid);
  check(parseReview(JSON.stringify(sixOnly)) === null, 'parseReview refuses a record without lastWin (every field is required)');
  // Only the seven fields are written: no id, no content, no score history.
  writeReview(vs, { ...JSON.parse(valid), user: 'leak' });
  check(Object.keys(JSON.parse(vs.m.get('kf-review'))).sort().join() === 'askedAt,askedVersion,first,lastWin,setback,v,wins', 'the record holds exactly its seven fields (lastWin added), nothing else', vs.m.get('kf-review'));
  // noteFirstUse: once, never moved.
  const fs = memStore();
  noteFirstUse(fs, at('2027-01-01'));
  check(JSON.parse(fs.m.get('kf-review')).first === '2027-01-01', 'noteFirstUse stamps the first day');
  noteFirstUse(fs, at('2027-02-01'));
  check(JSON.parse(fs.m.get('kf-review')).first === '2027-01-01', 'noteFirstUse never moves the stamp');
  noteSetback(fs, at('2027-02-03'));
  check(JSON.parse(fs.m.get('kf-review')).setback === '2027-02-03' && JSON.parse(fs.m.get('kf-review')).first === '2027-01-01', 'noteSetback dates today and keeps the rest');
  let threw = false;
  try { noteFirstUse(throwingStore(), NOW); noteSetback(throwingStore(), NOW); } catch { threw = true; }
  check(!threw, 'noteFirstUse and noteSetback never throw');
  // Without the bridge (the web, build 8, PR 1 before the plugin) nothing is written.
  const ls = memStore();
  withDevice(null, UA0, () => {
    globalThis.localStorage = ls;
    try { noteFirstUse(); noteSetback(); } finally { delete globalThis.localStorage; }
  });
  check(ls.m.size === 0, 'on the web (no bridge) noteFirstUse and noteSetback write nothing');
  const ls2 = memStore();
  withDevice(fakeCapacitor().C, UA2, () => {
    globalThis.localStorage = ls2;
    try { noteFirstUse(); } finally { delete globalThis.localStorage; }
  });
  check(ls2.m.has('kf-review'), 'at shell 2 with the plugin noteFirstUse writes the stamp');
}

// ── 3. the gate ─────────────────────────────────────────────────────────────
const bridgeMod = await load('src/lib/review/bridge.ts');
if (bridgeMod) {
  const { reviewBridge, REVIEW_PLUGIN, WRITE_REVIEW_URL } = bridgeMod;
  check(REVIEW_PLUGIN === 'KnowFlowReview', 'the plugin is KnowFlowReview');
  check(WRITE_REVIEW_URL === 'https://apps.apple.com/app/id6820418649?action=write-review', 'the write-review URL is Apple\'s documented form for app 6820418649');
  const gate = (cap, ua) => withDevice(cap, ua, () => reviewBridge());
  check(gate(null, UA0) === null, 'the web: null');
  check(gate(null, UA2) === null, 'a forged KnowFlowApp/2 in a browser (no Capacitor): null');
  check(gate(fakeCapacitor().C, `${UA0} KnowFlowApp/1`) === null, 'shell 1 (build 8) even with the plugin: null');
  check(gate(fakeCapacitor().C, UA0) === null, 'no shell marker even with the plugin: null');
  check(gate(fakeCapacitor({ platform: 'android' }).C, UA2) === null, 'the Android shell (KnowFlowApp/2, getPlatform android): null');
  check(gate(fakeCapacitor({ plugins: [] }).C, UA2) === null, 'shell 2 on iOS without the plugin (a build before PR 2): null');
  check(gate(fakeCapacitor({ plugins: ['KnowFlowStore', 'KnowFlowApple'] }).C, UA2) === null, 'shell 2 with the other plugins only: null');
  check(gate(fakeCapacitor({ native: false }).C, UA2) === null, 'not native: null');
  check(gate(fakeCapacitor({ promise: false }).C, UA2) === null, 'no nativePromise: null');
  const { C, calls } = fakeCapacitor();
  const b = gate(C, UA2);
  check(b !== null && Object.keys(b).sort().join() === 'available,request', 'shell 2, iOS, the plugin: a bridge with available and request only', b ? Object.keys(b).join() : 'null');
  if (b) {
    const a = await b.available();
    await b.request();
    check(JSON.stringify(a) === JSON.stringify({ available: true, version: '1.1' }), 'available() reads the plugin\'s answer', JSON.stringify(a));
    check(calls.length === 2 && calls.every(([p]) => p === 'KnowFlowReview') && calls[0][1] === 'available' && calls[1][1] === 'request', 'it calls KnowFlowReview.available and .request and nothing else', JSON.stringify(calls));
  }
  for (const [name, answer] of [['a rejection', () => Promise.reject(new Error('no'))], ['a non-object', 'yes'], ['available false', { available: false, version: '1.1' }], ['no version', { available: true }], ['an empty version', { available: true, version: ' ' }], ['a 40-character version', { available: true, version: '1'.repeat(40) }]]) {
    const bb = gate(fakeCapacitor({ answer }).C, UA2);
    let got;
    try { got = bb ? await bb.available() : null; } catch { got = 'threw'; }
    const usable = got && got !== 'threw' && got.available === true && typeof got.version === 'string';
    check(bb !== null && got !== 'threw' && !usable, `available() with ${name}: never throws, not usable`, JSON.stringify(got));
  }
}

// ── 4. the trigger ──────────────────────────────────────────────────────────
const trig = await load('src/components/review/ReviewTrigger.tsx');
if (trig && store) {
  const { reviewAtResult, liveChecksPass, REVIEW_DELAY_MS } = trig;
  check(REVIEW_DELAY_MS === 2000, 'the delay is 2 s', String(REVIEW_DELAY_MS));
  const NOW = at('2027-01-10');
  const ready = () => memStore({ 'kf-review': JSON.stringify({ v: 1, first: '2027-01-01', wins: 1, askedVersion: null, askedAt: null, setback: null, lastWin: null }) });
  const run = async ({ s = ready(), here = () => true, live = () => true, available = { available: true, version: '1.1' }, onWait, moment = { score: 4, total: 5 } } = {}) => {
    const log = [];
    const bridge = {
      available: async () => { log.push('available'); return available; },
      request: async () => { log.push('request'); },
    };
    const reason = await reviewAtResult({
      bridge,
      local: s,
      moment,
      now: () => NOW,
      wait: async (ms) => { log.push(`wait:${ms}`); if (onWait) onWait(s); },
      stillHere: here,
      live: () => { log.push('live'); return live(); },
    });
    return { reason, log, rec: s.m?.get('kf-review') ? JSON.parse(s.m.get('kf-review')) : null };
  };
  const a = await run();
  check(a.reason === 'ask' && a.log.join() === 'available,wait:2000,live,request', 'all holding: available, the 2 s wait, the live checks, THEN request', a.log.join());
  check(a.rec.askedVersion === '1.1' && a.rec.askedAt === '2027-01-10' && a.rec.wins === 2, 'the ask is written before the call (version, day) with the win', JSON.stringify(a.rec));
  const lowRun = await run({ moment: { score: 1, total: 3 } });
  check(lowRun.reason === 'low-score' && !lowRun.log.includes('request') && !lowRun.log.some((x) => x.startsWith('wait')), 'a low score: low-score, no wait, no request', lowRun.log.join());
  const firstWin = await run({ s: memStore({ 'kf-review': JSON.stringify({ v: 1, first: '2027-01-01', wins: 0, askedVersion: null, askedAt: null, setback: null, lastWin: null }) }) });
  check(firstWin.reason === 'few-wins' && firstWin.rec.wins === 1 && !firstWin.log.includes('request'), 'the first win: counted and written, few-wins, no request', JSON.stringify(firstWin));
  const left = await run({ here: (() => { let n = 0; return () => n++ === 0; })() });
  check(left.reason === null && !left.log.includes('request'), 'the screen left the result during the wait: no request, no reading', left.log.join());
  const busy = await run({ live: () => false });
  check(busy.reason === 'busy' && !busy.log.includes('request') && busy.rec.askedVersion === null, 'a live check fails: busy, no request, nothing marked asked', JSON.stringify(busy));
  const changed = await run({ onWait: (s) => s.setItem('kf-review', JSON.stringify({ v: 1, first: '2027-01-01', wins: 2, askedVersion: '1.1', askedAt: '2027-01-10', setback: null, lastWin: '2027-01-10' })) });
  check(changed.reason === 'asked-this-version' && !changed.log.includes('request'), 'another screen asked during the wait (re-read): no second request', changed.log.join());
  const setbackDuring = await run({ onWait: (s) => { const r = JSON.parse(s.m.get('kf-review')); s.setItem('kf-review', JSON.stringify({ ...r, setback: '2027-01-10' })); } });
  check(setbackDuring.reason === 'setback-today' && !setbackDuring.log.includes('request'), 'a refusal during the wait: setback-today, no request', setbackDuring.log.join());
  const s1 = ready();
  let writes = 0;
  const failing = { m: s1.m, getItem: s1.getItem, setItem: (k, v) => { writes++; if (writes > 1) throw new Error('quota'); s1.setItem(k, v); } };
  const noMark = await run({ s: failing });
  check(noMark.reason === 'storage' && !noMark.log.includes('request'), 'the "asked" write fails: storage, no request (it could not be held to once)', noMark.log.join());
  const unav = await run({ available: { available: false, version: null } });
  check(unav.reason === 'unavailable' && !unav.log.includes('request'), 'the plugin does not answer: unavailable, no request');
  const fresh = await run({ s: memStore() });
  check(fresh.reason === 'storage' && !fresh.log.includes('request') && fresh.rec.wins === 0, 'no record (no first-use stamp): storage, a fresh record, no request', JSON.stringify(fresh));
  const thr = await run({ s: throwingStore() });
  check(thr.reason === 'storage' && !thr.log.includes('request'), 'a throwing localStorage: storage, no request');

  // The live checks, on a fake document.
  const el = (hiddenAncestor = false) => ({ closest: (sel) => (hiddenAncestor && sel === '[aria-hidden="true"]' ? {} : null) });
  const doc = ({ vis = 'visible', focus = true, open = [], active = null } = {}) => ({
    visibilityState: vis,
    hasFocus: () => focus,
    querySelectorAll: () => open,
    activeElement: active,
  });
  const field = (tag, type = '') => ({ tagName: tag, isContentEditable: false, getAttribute: (n) => (n === 'type' ? type : null), type });
  check(liveChecksPass(doc()) === true, 'live: a visible, focused page with nothing open passes');
  check(liveChecksPass(doc({ vis: 'hidden' })) === false, 'live: a hidden page fails');
  check(liveChecksPass(doc({ focus: false })) === false, 'live: a page without focus fails');
  check(liveChecksPass(doc({ open: [el(false)] })) === false, 'live: an open sheet or dialog fails');
  check(liveChecksPass(doc({ open: [el(true)] })) === true, 'live: a CLOSED Sheet (aria-modal inside an aria-hidden wrapper) does not block');
  check(liveChecksPass(doc({ active: field('TEXTAREA') })) === false, 'live: a focused textarea (keyboard up) fails');
  check(liveChecksPass(doc({ active: field('INPUT', 'text') })) === false && liveChecksPass(doc({ active: field('INPUT', '') })) === false, 'live: a focused text input fails');
  check(liveChecksPass(doc({ active: { tagName: 'DIV', isContentEditable: true, getAttribute: () => null } })) === false, 'live: a focused contenteditable fails');
  check(liveChecksPass(doc({ active: field('INPUT', 'radio') })) === true && liveChecksPass(doc({ active: field('BUTTON') })) === true, 'live: a focused radio or button (no keyboard) passes');
  check(liveChecksPass(null) === false, 'live: no document fails');
  // Every open-surface selector the study names is in the list.
  const sels = String(trig.OPEN_SURFACES ?? '');
  for (const s of ['[data-kf-consent-sheet="open"]', '[data-kf-paywall]', '[data-kf-camera-sheet]', 'dialog[open]', '[aria-modal="true"]']) check(sels.includes(s), `live: ${s} is read`);
}

// ── 5. the sources ──────────────────────────────────────────────────────────
const walk = (dir) => {
  const out = [];
  for (const n of readdirSync(resolvePath(ROOT, dir))) {
    const p = `${dir}/${n}`;
    if (statSync(resolvePath(ROOT, p)).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
};
const SRC = walk('src').map((p) => ({ p, s: read(p) }));
const TRIGGER = 'src/components/review/ReviewTrigger.tsx';
const BRIDGE = 'src/lib/review/bridge.ts';
const RATE = 'src/components/review/RateRow.tsx';
const STORE = 'src/lib/review/store.ts';
const RULES = 'src/lib/review/rules.ts';
for (const p of [RULES, STORE, BRIDGE, TRIGGER, RATE]) check(has(p), `${p} exists`);
{
  // request(): called from ReviewTrigger only.
  const reviewFiles = SRC.filter((f) => /review\/bridge|reviewBridge/.test(f.s));
  const callers = reviewFiles.filter((f) => /\.request\s*\(/.test(f.s)).map((f) => f.p);
  check(callers.length === 1 && callers[0] === TRIGGER, 'request() is called from ReviewTrigger and nowhere else', callers.join(', ') || '(none)');
  const plugin = SRC.filter((f) => /KnowFlowReview/.test(f.s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map((f) => f.p);
  check(plugin.length === 1 && plugin[0] === BRIDGE, 'the plugin name is in code only in bridge.ts', plugin.join(', '));
  const methodLits = SRC.filter((f) => f.p !== BRIDGE && /review/i.test(f.p) && /['"]request['"]/.test(f.s)).map((f) => f.p);
  check(methodLits.length === 0, 'no other review file names the native method', methodLits.join(', '));
  // No handler reaches it.
  const t = read(TRIGGER);
  const code = t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  check(t !== '' && !/\bon[A-Z][A-Za-z]*\s*[=:]/.test(code) && !/addEventListener/.test(code), 'ReviewTrigger has no onClick (or any on* handler) and no event listener');
  const iReq = code.indexOf('.request(');
  const iWait = code.lastIndexOf('await d.wait(', iReq);
  const iLive = code.lastIndexOf('d.live()', iReq);
  check(iReq > 0 && iWait > 0 && iLive > iWait, 'request() comes after the wait and the live checks, in the same sequence', `${iWait} ${iLive} ${iReq}`);
  const iEffect = code.indexOf('useEffect(');
  const iCall = code.indexOf('reviewAtResult({');
  check(iEffect > 0 && iCall > iEffect, 'the hook starts the sequence inside useEffect, never from a handler');
  const exported = [...code.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_]\w*)/g)].map((m) => m[1]).sort();
  check(exported.join() === 'OPEN_SURFACES,REVIEW_DELAY_MS,liveChecksPass,reviewAtResult,useReviewTrigger', 'ReviewTrigger exports the hook, the sequence and the live checks only', exported.join());
  const q = read('src/components/quiz/QuizSection.tsx');
  const hooks = [...q.matchAll(/^([ \t]*)const\s+\w+\s*=\s*useReviewTrigger\(/gm)];
  check(hooks.length === 1 && hooks[0][1] === '  ', 'QuizSection calls useReviewTrigger once, at the top of the component', `${hooks.length} call(s)`);
  check(!/\.request\s*\(/.test(q) && !/reviewAtResult|reviewBridge/.test(q), 'QuizSection never touches the bridge or the sequence itself');
  check(/data-kf-review/.test(q), 'the quiz root carries the inert data-kf-review reading');
  const r = read(RATE);
  check(r !== '' && !/\.request\s*\(/.test(r), 'RateRow never calls request()');
  // The write-review URL: once in src.
  const urlHits = SRC.reduce((n, f) => n + (f.s.match(/apps\.apple\.com\/app\/id6820418649\?action=write-review/g) || []).length, 0);
  check(urlHits === 1 && read(BRIDGE).includes('https://apps.apple.com/app/id6820418649?action=write-review'), 'the write-review URL appears once in src, in bridge.ts', `${urlHits} hit(s)`);
  // Nothing in exchange.
  const NOTHING_FOR_IT = /\b(rewards?|rewarded|allowances?|unlock(?:s|ed)?|bonus(?:es)?|gifts?|pro|premium|free|credits?|incentiv\w*)\b/i;
  for (const p of [TRIGGER, BRIDGE, RULES, STORE, RATE]) {
    const hit = NOTHING_FOR_IT.exec(read(p));
    check(read(p) !== '' && !hit, `${p}: no reward, allowance, unlock or Pro word`, hit ? hit[0] : '');
  }
  // noteSetback on the branches the study names.
  const sites = {
    'src/components/quiz/QuizSection.tsx': 5,
    'src/components/agent/ChatBox.tsx': 4,
    'src/components/summary/SummarySection.tsx': 2,
    'src/components/upload/DropZone.tsx': 4,
    'src/components/upload/CameraPages.tsx': 5,
  };
  for (const [p, n] of Object.entries(sites)) {
    const c = (read(p).match(/\bnoteSetback\(\)/g) || []).length;
    check(c === n, `${p}: noteSetback() on its ${n} refusal/error branch(es)`, `${c} found`);
  }
  const allSetback = SRC.filter((f) => /\bnoteSetback\(\)/.test(f.s)).map((f) => f.p).sort();
  check(allSetback.join() === Object.keys(sites).sort().join(), 'noteSetback() is called from those five files only', allSetback.join());
  const ai = read('src/components/ai-consent/AiConsentProvider.tsx');
  check(/useEffect\(\(\) => \{\s*if \(!preview\) noteFirstUse\(\);\s*\}, \[preview\]\);/.test(ai), 'noteFirstUse() runs in the dashboard AiConsentProvider\'s mount effect (not in a preview)');
  const firstUse = SRC.filter((f) => /\bnoteFirstUse\(\)/.test(f.s)).map((f) => f.p);
  check(firstUse.length === 1, 'noteFirstUse() is called from that provider only', firstUse.join());
  check(/data-kf-paywall/.test(read('src/components/iap/Paywall.tsx')) && /data-kf-consent-sheet="open"/.test(ai) && /data-kf-camera-sheet="open"/.test(read('src/components/upload/CameraPages.tsx')), 'the open-surface markers the live checks read exist in the app');
  // The Settings row.
  const panel = read('src/components/dashboard/SettingsPanel.tsx');
  const iSupport = panel.indexOf('icon={<ClayMail />}');
  const iRate = panel.indexOf('{rateRow}');
  const iUlEnd = panel.indexOf('</ul>', iSupport);
  check(iSupport > 0 && iRate > iSupport && iRate < iUlEnd, 'SettingsPanel: {rateRow} is the last row of Help and legal, after Support');
  for (const p of ['src/app/[locale]/dashboard/settings/page.tsx', 'src/app/[locale]/preview/settings/page.tsx']) {
    check(/rateRow=\{<RateRow label=\{s\.rate\} description=\{s\.rateDesc\} \/>\}/.test(read(p)), `${p} passes the row`);
  }
  check(/^'use client';/.test(r) && /useState\(false\)/.test(r) && /if \(!shown\) return null;/.test(r), 'RateRow is a client component, hidden until the bridge answers');
  check(/<LatinText text=\{label\} \/>/.test(r) && /<LatinText text=\{u\} \/>/.test(r), 'RateRow draws the label and each description unit through LatinText (the Latin names isolated)');
  check(!/target=/.test(r) && /href=\{WRITE_REVIEW_URL\}/.test(r) && /external/.test(r), 'RateRow is a plain <a> to the constant, no target');
  // Native code only where PR 2 put it (verify-apple-native.mjs, section 9,
  // proves the plugin itself); no package.
  const ios = existsSync(resolvePath(ROOT, 'ios')) ? walkAny('ios').filter((p) => /KnowFlowReview|requestReview/.test(read(p))).sort() : [];
  const NATIVE = ['ios/App/App.xcodeproj/project.pbxproj', 'ios/App/App/KnowFlowReview.swift', 'ios/App/App/MainViewController.swift'];
  check(JSON.stringify(ios) === JSON.stringify(NATIVE), 'the rating\'s native code is only the plugin, its registration and its project entries (PR 2)', ios.join(', '));
  const reqFiles = ios.filter((p) => /requestReview/.test(read(p)));
  check(JSON.stringify(reqFiles) === '["ios/App/App/KnowFlowReview.swift"]', 'requestReview appears only in KnowFlowReview.swift', reqFiles.join(', '));
  const pkg = JSON.parse(read('package.json'));
  check(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((k) => /rate|review/i.test(k)), 'no new dependency (no rate or review package)');
}
function walkAny(dir) {
  const out = [];
  for (const n of readdirSync(resolvePath(ROOT, dir))) {
    const p = `${dir}/${n}`;
    if (/^(Pods|build|DerivedData|node_modules|public)$/.test(n)) continue;
    if (statSync(resolvePath(ROOT, p)).isDirectory()) out.push(...walkAny(p));
    else if (/\.(swift|m|h|plist|pbxproj|entitlements)$/.test(n)) out.push(p);
  }
  return out;
}

// RateRow and Settings on the server: nothing drawn, the same markup as without the row.
const rate = await load(RATE);
const panelMod = await load('src/components/dashboard/SettingsPanel.tsx');
if (rate && panelMod) {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  check(renderToStaticMarkup(React.createElement(rate.RateRow, { label: 'Rate KnowFlow', description: 'x' })) === '', 'RateRow renders nothing on the server');
  const props = {
    email: 'student@example.com', isPro: false, renewsOn: null, cancelsOn: null, upgradeHref: null, locale: 'en', pathname: '/en/dashboard/settings',
    privacyHref: '/en/privacy', termsHref: '/en/terms', supportEmail: 'help@example.com', deleteCard: null,
    labels: Object.fromEntries(['title', 'subtitle', 'account', 'email', 'plan', 'free', 'pro', 'freePlanDesc', 'proPlanDesc', 'renews', 'cancels', 'upgrade', 'activeSubscription', 'preferences', 'language', 'appearance', 'themeDark', 'themeLight', 'helpLegal', 'privacyPolicy', 'terms', 'support', 'supportDesc'].map((k) => [k, k])),
  };
  let a = '', b = '';
  try {
    a = renderToStaticMarkup(React.createElement(panelMod.SettingsPanel, props));
    b = renderToStaticMarkup(React.createElement(panelMod.SettingsPanel, { ...props, rateRow: React.createElement(rate.RateRow, { label: 'Rate KnowFlow', description: 'x' }) }));
  } catch (e) {
    check(false, 'SettingsPanel renders on the server', String(e.message).slice(0, 160));
  }
  check(a !== '' && a === b, 'Settings\' server markup is the same with and without the row (check 22 by construction)');
  check(!b.includes('write-review'), 'no write-review link in any server markup');
}

// ── 6. the strings ──────────────────────────────────────────────────────────
const en = (await load('src/lib/i18n/locales/en.ts'))?.en;
const ar = (await load('src/lib/i18n/locales/ar.ts'))?.ar;
if (en && ar) {
  const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
  const batch = read('docs/copy/ARABIC_STRINGS_app_v15.md');
  check(batch !== '' && /^\*\*APPROVED by the owner 2026-11-21/m.test(batch), 'docs/copy/ARABIC_STRINGS_app_v15.md exists and is marked approved 2026-11-21');
  check(batch.includes('f37defce8d4d70a71f46b50d969bdf0236aa95de73d84aede81ecabcfeaf5156'), 'the batch records the approved file\'s sha256');
  const english = new Map([...batch.matchAll(/^- `([^`]+)`: (.+)$/gm)].map((m) => [m[1], m[2]]));
  const rows = [...batch.matchAll(/^\| `([^`]+)` \| (.+?) \| \(new key\) \|$/gm)].map((m) => [m[1], english.get(m[1]), m[2]]);
  check(rows.length === 2 && english.size === 2 && rows.every((x) => x[1] !== undefined), 'the batch holds the two keys, each in both languages', `${rows.length} rows, ${english.size} English`);
  check(rows.map((x) => x[0]).join() === 'dashboard.settings.rate,dashboard.settings.rateDesc', 'the keys are dashboard.settings.rate and rateDesc');
  const STAR = /\bstars?\b|5|\u0665|\u06F5|[\u2605\u2606\u2B50\u272A-\u2730]|\u0646\u062C\u0648\u0645|\u0646\u062C\u0645/i;
  for (const [key, e, a] of rows) {
    check(get(en, key) === e, `en ${key} is the approved string, byte for byte`, JSON.stringify(get(en, key)));
    check(get(ar, key) === a, `ar ${key} is the approved string, byte for byte`, JSON.stringify(get(ar, key)));
    for (const s of [get(en, key), get(ar, key)]) {
      check(typeof s === 'string' && !STAR.test(s), `${key}: no star, "stars", 5, the Arabic word for stars or a star sign`, JSON.stringify(s));
      check(typeof s === 'string' && kfWording(s).length === 0, `${key}: no 3.1.3(f) word`, JSON.stringify(typeof s === 'string' ? kfWording(s) : s));
      check(typeof s === 'string' && !/[\u2014\u2013]/.test(s) && !/[\u0660-\u0669\u06F0-\u06F9]/.test(s), `${key}: no dash, Western digits`);
    }
  }
  // The owner's one change: "في" before App Store, not the draft's "على".
  const desc = get(ar, 'dashboard.settings.rateDesc') ?? '';
  check(desc.includes('\u0641\u064A App Store') && !desc.includes('\u0639\u0644\u0649 App Store'), 'the Arabic description has the owner\'s preposition before App Store');
}

// 7. The description's units and check 31's line rules (fix 2 of #345).
console.log('\n7. the description\'s units');
const unitsMod = await load('src/lib/review/rate-units.ts');
const latinGroups = await load('src/lib/latin-groups.ts');
const review31 = await import(pathToFileURL(resolvePath(ROOT, 'scripts/design-c/review.mjs')).href);
const lineRules = review31.rateLineRules;
check(typeof lineRules === 'function', 'scripts/design-c/review.mjs exports rateLineRules (check 31\'s line rules)');
if (en && ar && typeof lineRules === 'function') {
  const VALUE = { en: en.dashboard.settings.rateDesc, ar: ar.dashboard.settings.rateDesc };
  const SHAPE = { en: [3, 4, 4], ar: [2, 3, 3] };
  const toLines = (units, breaks) => {
    const lines = [[]];
    units.forEach((u, i) => { lines[lines.length - 1].push(...u.split(' ')); if (breaks.includes(i)) lines.push([]); });
    return lines;
  };
  for (const l of ['en', 'ar']) {
    const v = VALUE[l];
    const units = unitsMod ? unitsMod.rateDescUnits(v) : null;
    check(Array.isArray(units) && units.join(' ') === v, `${l}: the units joined with single spaces are the ${l}.ts value byte for byte`, JSON.stringify(units));
    check(Array.isArray(units) && units.map((u) => u.split(' ').length).join() === SHAPE[l].join(), `${l}: the units hold words ${l === 'en' ? '1-3 / 4-7 / 8-11' : '1-2 / 3-5 / 6-8'}`, JSON.stringify(units?.map((u) => u.split(' ').length)));
    check(Array.isArray(units) && units.every((u) => u.length > 0 && u.trim() === u && !/\s\s/.test(u)), `${l}: no unit is empty or carries an edge space`);
    // LatinText decides per unit: every Arabic unit must read right to left (so its Latin names stay isolates), every English one left to right.
    check(Array.isArray(units) && units.every((u) => latinGroups.readsRightToLeft(u) === (l === 'ar')), `${l}: every unit reads ${l === 'ar' ? 'right to left (LatinText isolates its Latin names)' : 'left to right'}`);
    if (Array.isArray(units) && units.length === 3) {
      for (const breaks of [[], [0], [1], [0, 1]]) {
        const found = lineRules(toLines(units, breaks), l, v);
        check(found.length === 0, `${l}: breaking only ${breaks.length ? `after unit ${breaks.map((b) => b + 1).join(' and ')}` : 'nowhere (one line)'} passes check 31's line rules`, found.join('; '));
      }
    }
    for (const kind of ['dangle', 'split', 'single']) {
      const at = review31.rateBreakAt(kind, l, v);
      const words = v.split(' ');
      const found = lineRules([words.slice(0, at + 1), words.slice(at + 1)], l, v);
      check(found.some((x) => x.includes(review31.RATE_LINE_KINDS[kind])), `${l}: the forced case "${kind}" (a break after word ${at + 1}) trips its own rule`, found.join('; ') || 'nothing flagged');
    }
    check(lineRules([v.split(' ')], l, v).length === 0, `${l}: the value on one line passes`);
    check(lineRules([v.split(' ').slice(1)], l, v).some((x) => x.includes('not the approved value')), `${l}: lines that are not the value are flagged`);
  }
  // The layouts 0d753e9 drew (design-c 44865033100): English at 390 and 360, Arabic at 360.
  const ew = VALUE.en.split(' ');
  const enOld = lineRules([ew.slice(0, 6), ew.slice(6)], 'en', VALUE.en);
  check(enOld.some((x) => x.includes('ends on word 6 "a"')) && enOld.some((x) => x.includes('splits "write a review"')), 'en: 0d753e9\'s "Rate the app or write a / review on the App Store." is flagged (ends on "a", splits "write a review")', enOld.join('; '));
  const aw = VALUE.ar.split(' ');
  const arOld = lineRules([aw.slice(0, 4), aw.slice(4)], 'ar', VALUE.ar);
  check(arOld.some((x) => x.includes('the Arabic 4th and 5th words')), 'ar: 0d753e9\'s 360 break between the 4th and 5th words is flagged', arOld.join('; '));
  check(lineRules([aw.slice(0, 3), aw.slice(3)], 'ar', VALUE.ar).some((x) => x.includes('ends on word 3')) && lineRules([aw.slice(0, 6), aw.slice(6)], 'ar', VALUE.ar).some((x) => x.includes('ends on word 6')), 'ar: a line ending on the conjunction (3rd) or the preposition (6th) is flagged');
  for (const w of ['or', 'the', 'on']) {
    const i = ew.indexOf(w);
    check(lineRules([ew.slice(0, i + 1), ew.slice(i + 1)], 'en', VALUE.en).some((x) => x.includes(`"${w}"`)), `en: a line ending on "${w}" is flagged`);
  }
  check(lineRules([ew.slice(0, ew.indexOf('App') + 1), ew.slice(ew.indexOf('App') + 1)], 'en', VALUE.en).some((x) => x.includes('splits "App Store."')), 'en: "App Store" split across lines is flagged');
}
{
  const r = read(RATE);
  const u = read('src/lib/review/rate-units.ts');
  check(/rateDescUnits\(description\)/.test(r), 'RateRow cuts the description with rateDescUnits');
  check(/data-kf-rate-unit/.test(r) && /whitespace-nowrap/.test(r), 'each unit is a marked nowrap span (breaks only between units)');
  check(/\[text-wrap:balance\]/.test(r), 'the description\'s line box is balanced (text-wrap: balance)');
  check(!/[؀-ۿ]/.test(r + u), 'no Arabic letter is typed in RateRow or rate-units (the split is by word index)');
  check(u !== '' && !/Rate the app|write a review|App Store/.test(u), 'rate-units types no English word of the value either');
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('---');
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
