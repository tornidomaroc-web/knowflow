// verify-server-timing.mjs — item 4j, functions next to the database.
//
// Proves, without a network or a running app:
//   A. the clock: overlapping Supabase calls count ONCE (wall time), sequential
//      ones add, an interval still open is counted, and the header carries
//      whole milliseconds only (`db;dur=N, total;dur=M`, nothing else);
//   B. the fetch wrapper: inside a timed run it counts this project's Supabase
//      URL and nothing else (a look-alike host is not Supabase), outside a run it
//      counts nothing, every other host gets the very same promise back, and a
//      rejected call still closes its interval without an unhandled rejection;
//   C. withServerTiming sets Server-Timing on a mutable response and returns an
//      immutable one (Response.redirect) untouched;
//   D. the source: vercel.json moves the functions to dub1 and changes nothing
//      else; the five routes export POST through withServerTiming; the layout
//      and four pages start their clock before their first await and log it.
//
// `--self-test` plants the two mistakes this file exists to catch (a summing
// clock and a header with an id in it) and requires both to be caught.
//
// Run: node --experimental-strip-types scripts/verify-server-timing.mjs [--self-test]

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const BASE = 'https://abcdefghij.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;

let failures = 0;
let checks = 0;
function need(ok, what) {
  checks += 1;
  if (ok) console.log(`ok   ${what}`);
  else { failures += 1; console.log(`FAIL ${what}`); }
}

// Install a stub fetch BEFORE the module wraps it.
const MARK = Promise.resolve(new Response('mark'));
const stubFetch = (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('identity=1')) return MARK;
  const ms = Number(new URL(url).searchParams.get('ms') ?? '0');
  const fail = new URL(url).searchParams.get('fail') === '1';
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('planted')) : resolve(new Response('[]', { status: 200 }))), ms),
  );
};
globalThis.fetch = stubFetch;

const st = await import(pathToFileURL(path.join(ROOT, 'src/lib/server-timing.ts')).href);

const HEADER = /^db;dur=\d+, total;dur=\d+$/;

// ---------- A. the clock ----------
function clockCases(impl) {
  const out = {};
  // two calls overlapping 0-100 and 50-150 -> 150 of wall time, not 200
  let c = impl.newClock(0);
  impl.dbStart(c, 0); impl.dbStart(c, 50); impl.dbEnd(c, 100); impl.dbEnd(c, 150);
  out.overlap = impl.dbMs(c, 150);
  // sequential 0-60 then 100-160 -> 120
  c = impl.newClock(0);
  impl.dbStart(c, 0); impl.dbEnd(c, 60); impl.dbStart(c, 100); impl.dbEnd(c, 160);
  out.sequential = impl.dbMs(c, 200);
  out.calls = c.n;
  // open interval 10-? read at 70 -> 60
  c = impl.newClock(0);
  impl.dbStart(c, 10);
  out.open = impl.dbMs(c, 70);
  // an end without a start does not go negative
  c = impl.newClock(0);
  impl.dbEnd(c, 5);
  out.stray = impl.dbMs(c, 10);
  // header
  c = impl.newClock(0);
  impl.dbStart(c, 1.4); impl.dbEnd(c, 13.9);
  out.header = impl.serverTimingValue(c, 40.6);
  return out;
}

function judgeClock(r, label) {
  const bad = [];
  if (r.overlap !== 150) bad.push(`overlap ${r.overlap} (want 150)`);
  if (r.sequential !== 120) bad.push(`sequential ${r.sequential} (want 120)`);
  if (r.calls !== 2) bad.push(`calls ${r.calls} (want 2)`);
  if (r.open !== 60) bad.push(`open ${r.open} (want 60)`);
  if (r.stray !== 0) bad.push(`stray end ${r.stray} (want 0)`);
  if (!HEADER.test(r.header) || r.header !== 'db;dur=13, total;dur=41') bad.push(`header ${JSON.stringify(r.header)} (want "db;dur=13, total;dur=41")`);
  return { ok: bad.length === 0, why: `${label}: ${bad.join('; ') || 'all as expected'}` };
}

if (process.argv.includes('--self-test')) {
  // Planted 1: a clock that SUMS durations instead of wall time.
  const summing = {
    ...st,
    newClock: (now) => ({ t0: now, db: 0, n: 0, open: 0, since: 0, starts: [] }),
    dbStart: (c, now) => { c.starts.push(now); c.n += 1; c.open += 1; },
    dbEnd: (c, now) => { if (!c.starts.length) return; c.db += now - c.starts.shift(); c.open -= 1; },
    dbMs: (c, now) => c.db + c.starts.reduce((a, s) => a + (now - s), 0),
  };
  const r1 = judgeClock(clockCases(summing), 'planted summing clock');
  // Planted 2: a header that leaks a request id.
  const leaky = { ...st, serverTimingValue: (c, now) => `${st.serverTimingValue(c, now)}, req;desc="b1f0c2"` };
  const r2 = judgeClock(clockCases(leaky), 'planted header with an id');
  need(!r1.ok, `self-test: the summing clock is caught (${r1.why})`);
  need(!r2.ok, `self-test: the id in the header is caught (${r2.why})`);
  console.log(`${failures} failure(s) of ${checks} readings (self-test)`);
  process.exit(failures ? 1 : 0);
}

const rc = judgeClock(clockCases(st), 'clock');
need(rc.ok, `A. overlapping calls count once, sequential add, open counted, header whole ms only: ${rc.why}`);

// ---------- B. the fetch wrapper ----------
st.installFetchTiming();
need(globalThis.fetch !== stubFetch, 'B. fetch is wrapped once installed');
const wrapped = globalThis.fetch;
st.installFetchTiming();
need(globalThis.fetch === wrapped, 'B. a second install does not wrap twice');

need(st.isSupabaseUrl(`${BASE}/rest/v1/documents`), 'B. REST on the project URL is Supabase');
need(st.isSupabaseUrl(new URL(`${BASE}/auth/v1/user`)), 'B. a URL object for Auth is Supabase');
need(st.isSupabaseUrl(new Request(`${BASE}/storage/v1/object/x`)), 'B. a Request for Storage is Supabase');
need(!st.isSupabaseUrl(`${BASE}.evil.example/rest/v1/x`), 'B. a look-alike host is not Supabase');
need(!st.isSupabaseUrl('https://api.anthropic.com/v1/messages'), 'B. Anthropic is not Supabase');
need(!st.isSupabaseUrl(`${BASE}/rest/v1/x`, ''), 'B. with no Supabase URL configured nothing is Supabase');

// outside a run: nothing counted, same promise for every host
const outside = st.newClock();
const p0 = fetch(`${BASE}/rest/v1/a?ms=5`);
await p0;
need(outside.n === 0, 'B. a Supabase call outside a timed run is not counted anywhere');

// inside a run
const { clock } = await st.runTimed(async () => {
  await Promise.all([fetch(`${BASE}/rest/v1/a?ms=40`), fetch(`${BASE}/rest/v1/b?ms=40`)]); // ~40 wall
  await fetch(`${BASE}/auth/v1/user?ms=30`); // +30
  await fetch('https://api.voyageai.com/v1/embeddings?ms=80'); // not counted
  try { await fetch(`${BASE}/rest/v1/c?ms=10&fail=1`); } catch {} // +10, closed on rejection
});
need(clock.n === 4, `B. inside a run exactly the 4 Supabase calls are counted (got ${clock.n})`);
need(clock.open === 0, `B. every interval closed, including the rejected call (open ${clock.open})`);
const dbv = st.dbMs(clock);
need(dbv >= 70 && dbv < 130, `B. db wall time ~80 ms: two parallel 40 count once, +30, +10, Voyage's 80 left out (got ${Math.round(dbv)})`);

// pass-through returns the very same promise for another host, in and out of a run
let inside;
const { clock: c2 } = await st.runTimed(async () => {
  inside = fetch('https://api.anthropic.com/v1/messages?identity=1');
});
need(inside === MARK && c2.n === 0, 'B. inside a run another host gets the underlying promise itself, uncounted');
need(fetch('https://api.anthropic.com/v1/messages?identity=1') === MARK, 'B. outside a run the same holds');

// ---------- C. withServerTiming ----------
const handler = st.withServerTiming(async () => {
  await fetch(`${BASE}/rest/v1/a?ms=20`);
  return Response.json({ ok: true });
});
const res = await handler(new Request('https://x.example/api'));
const h = res.headers.get('server-timing');
need(HEADER.test(h ?? ''), `C. the response carries Server-Timing in whole ms only: ${h}`);
const [, db, total] = /db;dur=(\d+), total;dur=(\d+)/.exec(h ?? '') ?? [];
need(Number(db) >= 15 && Number(total) >= Number(db), `C. db ${db} ms <= total ${total} ms and db saw the 20 ms call`);
const redirect = st.withServerTiming(async () => Response.redirect('https://x.example/', 307));
const rr = await redirect();
need(rr.status === 307 && rr.headers.get('server-timing') === null, 'C. an immutable redirect is returned untouched');
const plain = st.withServerTiming(async () => new Response('stream'));
const pr = await plain();
need(HEADER.test(pr.headers.get('server-timing') ?? ''), 'C. a plain new Response (the Ask stream shape) gets the header');

// ---------- D. the source ----------
const vercel = JSON.parse(read('vercel.json'));
need(JSON.stringify(vercel.regions) === '["dub1"]', `D. vercel.json regions is exactly ["dub1"]: ${JSON.stringify(vercel.regions)}`);
need(
  JSON.stringify(Object.keys(vercel).sort()) === '["experimentalServices","regions"]' &&
    JSON.stringify(vercel.experimentalServices) === JSON.stringify({ frontend: { routePrefix: '/', framework: 'nextjs' } }),
  'D. vercel.json changes nothing else (experimentalServices as before, no functions/crons/failover keys)',
);

const ROUTES = ['agent', 'summarize', 'quiz/generate', 'quiz/submit', 'page-read'];
for (const r of ROUTES) {
  const src = read(`src/app/api/${r}/route.ts`);
  need(
    /export const POST = withServerTiming\(handlePOST\);?\n?$/.test(src.trimEnd() + '\n') &&
      !/export async function POST/.test(src) &&
      /^async function handlePOST\(request: Request\)/m.test(src) &&
      /import \{ withServerTiming \} from '@\/lib\/server-timing'/.test(src),
    `D. /api/${r} exports POST through withServerTiming`,
  );
}

const PAGES = [
  ['src/app/[locale]/dashboard/layout.tsx', 'layout'],
  ['src/app/[locale]/dashboard/(home)/page.tsx', 'home'],
  ['src/app/[locale]/dashboard/knowledge/(list)/page.tsx', 'subjects'],
  ['src/app/[locale]/dashboard/agent/page.tsx', 'ask'],
  ['src/app/[locale]/dashboard/settings/page.tsx', 'settings'],
];
for (const [file, name] of PAGES) {
  const src = read(file);
  const body = src.slice(src.indexOf('export default async function'));
  const start = body.indexOf('startPageTiming()');
  const firstAwait = body.indexOf('await ');
  const log = body.indexOf(`logPageTiming('${name}', timing)`);
  const ret = body.indexOf('return (');
  need(start > 0 && start < firstAwait, `D. ${name}: the clock starts before the first await`);
  need(log > firstAwait && log < ret, `D. ${name}: one log line after its reads, before it renders`);
}
const settings = read('src/app/[locale]/dashboard/settings/page.tsx');
need(
  /const showBillingNote = await deletionWouldCancelBilling\(supabase, user\.id\)/.test(settings) &&
    /showBillingNote=\{showBillingNote\}/.test(settings) &&
    !/showBillingNote=\{await/.test(settings),
  'D. settings: the billing-note read moved above the JSX, same call, same order, so the log counts it',
);

const lib = read('src/lib/server-timing.ts');
need(!/Timing-Allow-Origin/i.test(lib.replace(/^\s*\*.*$/gm, '')), 'D. no Timing-Allow-Origin is sent (other sites cannot read the timings)');
need(/kf-timing \$\{JSON\.stringify\(\{ route, db_ms: Math\.round\(dbMs\(clock, now\)\), db_calls: clock\.n, total_ms: Math\.round\(now - clock\.t0\), region: process\.env\.VERCEL_REGION \?\? null \}\)\}/.test(lib),
  'D. the page log line holds the route name, ms, the call count and the region, nothing about the student');

console.log(`${failures} failure(s) of ${checks} readings`);
process.exit(failures ? 1 : 0);
