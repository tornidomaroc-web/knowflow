/**
 * Executable proof for the page-photo sweep (fix/page-photo-sweep, 2026-11-17):
 * src/lib/page-photo-sweep.ts and its two callers, POST /api/page-read and
 * POST /api/ingest.
 *
 * WHY IT EXISTS. A camera batch whose POST /api/page-read never arrives (the
 * app killed, the network gone) leaves photos at
 * `{userId}/page-photos/{batchId}/…` that the student cannot delete
 * (002_storage.sql has no delete policy) and nothing else removes. The sweep
 * removes the CALLER'S OWN stale batches, server side, whenever the caller
 * reaches either route.
 *
 *   1. The sweep itself, against an in-memory bucket that answers list() as
 *      Supabase Storage does (one level at a time, folders with id null):
 *      a stale batch removed; the current batch kept even when stale; a batch
 *      under an hour old kept; another user's prefix never listed or removed;
 *      nothing outside `{userId}/page-photos/{uuid}/` ever removed (subject
 *      files, a loose file, a non-UUID folder, a batch holding a sub-folder or
 *      a name the route would refuse, more than 10 entries); the caps (5
 *      batches, 50 objects, 6 lists and 1 remove per request, whole batches) and that what is
 *      left goes on a later request; a stalled list stopped by the 3 s
 *      budget; a malformed user id lists nothing; every storage failure
 *      resolves and is logged with the tag kf-page-photos-left.
 *   2. The routes, driven for real: page-read schedules exactly one sweep with
 *      `after()` once the keys are proven the caller's (before consent) and
 *      passes the current batch; a foreign key schedules none; /api/ingest
 *      schedules one after the session check and none without a session; the
 *      routes only schedule the sweep, so their answer is byte-identical
 *      whether the sweep's storage works, errors, refuses or throws.
 *
 * Stubbed: `next/server` (NextResponse and an `after` that collects the
 * callbacks), the session client, the service-role client's storage (the same
 * in-memory bucket), the entitlement, the document limit, the study event,
 * the Anthropic SDK (never reached: every route case stops at a
 * refusal). The sweep, both routes, the key rules and the dictionaries are
 * the real ones.
 *
 * RED ON 56ee9f7 (main before this change): src/lib/page-photo-sweep.ts does
 * not exist and neither route schedules anything.
 *
 * Tier 0: no network, no credential, no database, no model call.
 * Usage: node --experimental-strip-types scripts/verify-page-photo-sweep.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = pathToFileURL(resolvePath(ROOT, 'src')).href;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'verify-only-not-a-key';
process.env.INGESTION_SERVICE_URL = 'http://ingestion.invalid';
process.env.INGESTION_TOKEN = 'verify-only-not-a-token';
process.env.ANTHROPIC_API_KEY = 'verify-only-not-a-key';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KB = '44444444-4444-4444-8444-444444444444';
const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const HOUR = 3600_000;
const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

// ---- the in-memory bucket ------------------------------------------------------------

const state = {};
globalThis.__sw = state;
function reset() {
  state.objects = new Map(); // key -> { created_at, updated_at }
  state.lists = [];
  state.removes = [];
  state.mode = 'ok'; // ok | list-error | remove-error | throw | stall
  state.after = [];
  state.user = null;
}
function put(key, msAgo, updatedMsAgo = msAgo) {
  state.objects.set(key, { created_at: iso(msAgo), updated_at: iso(updatedMsAgo) });
}
function batch(user, id, count, msAgo) {
  for (let i = 1; i <= count; i++) put(`${user}/page-photos/${id}/p${i}.jpg`, msAgo);
}
// As Supabase Storage answers list(prefix): the immediate children only; a
// sub-folder is one entry with id null and no timestamps; sorted by name.
const BUCKET_SRC = `
const S = () => globalThis.__sw;
export function bucket() {
  return {
    async list(prefix, opts, params) {
      S().lists.push({ prefix, opts, signal: params?.signal });
      if (S().mode === 'throw') throw new Error('socket hang up');
      if (S().mode === 'list-error') return { data: null, error: { message: 'storage unreachable' } };
      if (S().mode === 'stall') {
        const s = params?.signal;
        if (!s) { await new Promise((r) => setTimeout(r, 8000)); return { data: [], error: null }; }
        return new Promise((_, reject) => s.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), { once: true }));
      }
      const seen = new Map();
      for (const [k, o] of S().objects) {
        if (!k.startsWith(prefix + '/')) continue;
        const rest = k.slice(prefix.length + 1);
        const slash = rest.indexOf('/');
        if (slash === -1) seen.set(rest, { name: rest, id: 'obj:' + k, created_at: o.created_at, updated_at: o.updated_at, last_accessed_at: null, metadata: { size: 1 } });
        else { const f = rest.slice(0, slash); if (!seen.has(f)) seen.set(f, { name: f, id: null, created_at: null, updated_at: null, last_accessed_at: null, metadata: null }); }
      }
      const all = [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const off = opts?.offset ?? 0;
      return { data: all.slice(off, off + (opts?.limit ?? 100)), error: null };
    },
    async remove(keys) {
      S().removes.push([...keys]);
      if (S().mode === 'remove-error') return { data: null, error: { message: 'remove refused' } };
      const gone = keys.filter((k) => S().objects.has(k));
      for (const k of gone) S().objects.delete(k);
      return { data: gone.map((name) => ({ name })), error: null };
    },
  };
}`;

// ---- module stubs --------------------------------------------------------------------

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); },
};
export function after(task) { globalThis.__sw.after.push(task); }`;
const SERVICE_STUB = `
import { bucket } from ${JSON.stringify('data:text/javascript,' + encodeURIComponent(BUCKET_SRC))};
export function createClient() {
  return {
    storage: { from: (b) => { globalThis.__sw.bucketName = b; return bucket(); } },
    rpc: async () => ({ data: 0, error: null }),
    from: () => ({ insert: async () => ({ error: null }) }),
  };
}`;
const SESSION_STUB = `
const S = () => globalThis.__sw;
export async function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: S().user } }), getSession: async () => ({ data: { session: null } }) },
    from: () => { throw new Error('the session client was used past a refusal'); },
    rpc: async () => { throw new Error('the session client was used past a refusal'); },
    storage: { from: () => { throw new Error('the session storage was used'); } },
  };
}`;
const ENTITLEMENT_STUB = `export async function getEntitlement() { return { tier: 'free' }; }`;
const LIMITS_STUB = `export async function checkDocumentLimit() { throw new Error('reached past a refusal'); }`;
const STUDY_STUB = `export async function recordStudyEvent() {}`;
const ANTHROPIC_STUB = `export default class Anthropic { constructor() { this.messages = { create: async () => { throw new Error('model called'); } }; } }`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => {
  if (/\.[a-z]+$/i.test(base)) return base;
  if (existsSync(base + '.ts')) return base + '.ts';
  return resolvePath(base, 'index.ts');
};
const fromSrc = (ctx) => typeof ctx.parentURL === 'string' && ctx.parentURL.startsWith(SRC_URL);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk' && fromSrc(ctx)) return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === '@supabase/supabase-js' && fromSrc(ctx)) return { url: inline(SERVICE_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SESSION_STUB), shortCircuit: true };
    if (spec === '@/lib/entitlement') return { url: inline(ENTITLEMENT_STUB), shortCircuit: true };
    if (spec === '@/lib/limits-server') return { url: inline(LIMITS_STUB), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline(STUDY_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    if (spec.startsWith('.') && fromSrc(ctx)) {
      return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const { bucket: memoryBucket } = await import(inline(BUCKET_SRC));

// ---- reporting -----------------------------------------------------------------------

let pass = 0;
const failures = [];
const realLog = console.log;
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  realLog(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${String(detail).slice(0, 600)}` : ''}`);
}
async function attempt(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '));
  }
}
let logs = [];
console.log = (...a) => logs.push(a.join(' '));
console.error = (...a) => logs.push(a.join(' '));
console.warn = () => {};
const tagged = (tag) => logs.filter((l) => l.includes(`"tag":"${tag}"`));

// ---- 1. the sweep --------------------------------------------------------------------

realLog('1. The sweep of the caller\'s own page-photos folder');
let mod = null;
await attempt('the sweep module loads (src/lib/page-photo-sweep.ts)', async () => {
  mod = await load('src/lib/page-photo-sweep.ts');
  check('the sweep module loads (src/lib/page-photo-sweep.ts)', typeof mod.sweepStalePagePhotos === 'function');
});
const sweep = (user, current, extra = {}) => mod.sweepStalePagePhotos(user, current, { now: NOW, bucket: memoryBucket(), ...extra });

if (mod) {
  await attempt('stale / current / fresh', async () => {
    reset(); logs = [];
    const stale = uuid(1), current = uuid(2), fresh = uuid(3);
    batch(USER, stale, 3, 2 * HOUR);
    batch(USER, current, 2, 5 * HOUR);
    batch(USER, fresh, 2, 10 * 60_000);
    const r = await sweep(USER, current);
    const left = [...state.objects.keys()];
    check('a stale batch (2 h) is removed, every photo of it', !left.some((k) => k.includes(stale)) && r.removed === 3, JSON.stringify(r));
    check('the current batch is kept even when its photos are 5 h old', left.filter((k) => k.includes(current)).length === 2);
    check('another batch under an hour old is kept', left.filter((k) => k.includes(fresh)).length === 2);
    check('one remove call, naming only the stale batch', state.removes.length === 1 && state.removes[0].every((k) => k.startsWith(`${USER}/page-photos/${stale}/`)), JSON.stringify(state.removes));
    check('a removal is logged with the tag kf-page-photos-swept', tagged('kf-page-photos-swept').length === 1, logs.join(' | '));
  });

  await attempt('freshness is the NEWEST photo of a batch', async () => {
    reset();
    const b = uuid(5);
    put(`${USER}/page-photos/${b}/p1.jpg`, 3 * HOUR);
    put(`${USER}/page-photos/${b}/p2.jpg`, 3 * HOUR, 20 * 60_000); // created 3 h ago, UPDATED 20 min ago
    put(`${USER}/page-photos/${b}/p3.jpg`, 2 * HOUR);
    await sweep(USER, null);
    check('a batch whose only fresh time is one photo\'s updated_at is kept whole', [...state.objects.keys()].length === 3 && state.removes.length === 0);
    reset();
    put(`${USER}/page-photos/${b}/p1.jpg`, 3 * HOUR);
    put(`${USER}/page-photos/${b}/p2.jpg`, 30 * 60_000);
    await sweep(USER, null);
    check('a batch with one photo created under an hour ago is kept whole', state.objects.size === 2 && state.removes.length === 0);
    reset();
    put(`${USER}/page-photos/${b}/p1.jpg`, HOUR);
    await sweep(USER, null);
    check('exactly one hour old counts as stale', state.objects.size === 0);
  });

  await attempt('another user', async () => {
    reset(); logs = [];
    batch(USER, uuid(1), 2, 2 * HOUR);
    batch(OTHER, uuid(7), 4, 9 * HOUR);
    put(`${OTHER}/${KB}/doc/notes.pdf`, 9 * HOUR);
    await sweep(USER, null);
    check('another user\'s prefix is never listed (only {user}/page-photos and its batch folders)', state.lists.every((l) => l.prefix === `${USER}/page-photos` || l.prefix.startsWith(`${USER}/page-photos/`)), JSON.stringify(state.lists.map((l) => l.prefix)));
    check('another user\'s stale photos and files are all still there', [...state.objects.keys()].filter((k) => k.startsWith(OTHER)).length === 5);
    check('every removed key is the caller\'s page photo', state.removes.flat().every((k) => k.startsWith(`${USER}/page-photos/`)));
    // The caller named as the other user: still only that one prefix.
    reset();
    batch(OTHER, uuid(7), 2, 9 * HOUR);
    await sweep(USER, uuid(7));
    check('a current batch id that is another user\'s does not reach their prefix', state.lists.every((l) => l.prefix.startsWith(`${USER}/`)) && state.objects.size === 2);
  });

  await attempt('outside page-photos', async () => {
    reset();
    const kept = [
      `${USER}/${KB}/doc-1/notes.pdf`,
      `${USER}/${KB}/old.pdf`,
      `${USER}/page-photos/loose.jpg`,
      `${USER}/page-photos/not-a-uuid/p1.jpg`,
      `${USER}/page-photos/${uuid(8)}/nested/p1.jpg`,
      `${USER}/page-photos/${uuid(9)}/.hidden`,
      `${USER}/page-photos-old/${uuid(10)}/p1.jpg`,
    ];
    for (const k of kept) put(k, 30 * 24 * HOUR);
    await sweep(USER, null);
    const left = new Set(state.objects.keys());
    check('nothing outside {userId}/page-photos/{uuid}/{name} is removed (subject files, loose file, non-UUID folder, sub-folder, refused name, look-alike folder)', kept.every((k) => left.has(k)), JSON.stringify(kept.filter((k) => !left.has(k))));
    check('the subject folders are never even listed', state.lists.every((l) => l.prefix === `${USER}/page-photos` || l.prefix.startsWith(`${USER}/page-photos/`)), JSON.stringify(state.lists.map((l) => l.prefix)));
  });

  await attempt('caps', async () => {
    reset(); logs = [];
    for (let i = 1; i <= 8; i++) batch(USER, uuid(100 + i), 10, 2 * HOUR);
    const r1 = await sweep(USER, null);
    check(`one request removes at most ${mod.PAGE_PHOTO_SWEEP_MAX_BATCHES} batches and ${mod.PAGE_PHOTO_SWEEP_MAX_OBJECTS} photos`, r1.removed === 50 && state.objects.size === 30, JSON.stringify(r1));
    check('one request lists at most 1 + 5 times and removes once', state.lists.length <= 6 && state.removes.length === 1 && state.removes[0].length <= 50, `lists ${state.lists.length} removes ${state.removes.length}`);
    check('every list asks for at most 100 entries', state.lists.every((l) => (l.opts?.limit ?? 0) > 0 && l.opts.limit <= 100));
    const r2 = await sweep(USER, null);
    check('what is left goes on the next request', r2.removed === 30 && state.objects.size === 0, JSON.stringify(r2));
    // Whole batches only: 4 batches of 10 then one of 12 -> the 12 waits.
    reset();
    for (let i = 1; i <= 4; i++) batch(USER, uuid(200 + i), 10, 2 * HOUR);
    batch(USER, uuid(205), 12, 2 * HOUR);
    await sweep(USER, null);
    check('a batch that would pass the 50-photo cap is left whole for a later request', state.objects.size === 12 && [...state.objects.keys()].every((k) => k.includes(uuid(205))));
    // More than 10 photos is not a batch the app made: skipped, and it never
    // stops the sweep from reaching the batches sorted after it.
    reset();
    batch(USER, uuid(300), 11, 2 * HOUR);
    batch(USER, uuid(301), 3, 2 * HOUR);
    await sweep(USER, null);
    check('a folder of more than 10 entries (not an app batch) is kept, and the stale batch after it is still removed', state.objects.size === 11 && [...state.objects.keys()].every((k) => k.includes(uuid(300))));
  });

  await attempt('time budget', async () => {
    reset(); logs = [];
    batch(USER, uuid(1), 2, 2 * HOUR);
    state.mode = 'stall';
    // AbortSignal.timeout's timer does not hold the event loop open; in the
    // route the pending request does. Here an interval stands in for it.
    const hold = setInterval(() => {}, 50);
    const t = Date.now();
    const r = await sweep(USER, null, { budgetMs: 300 }).finally(() => clearInterval(hold));
    const ms = Date.now() - t;
    check('a stalled list is cut by the time budget (300 ms here)', ms < 1500 && state.lists.length >= 1 && state.lists[0].signal instanceof AbortSignal, `${ms} ms`);
    check('...nothing removed and the failure logged as kf-page-photos-left', state.removes.length === 0 && r.error && tagged('kf-page-photos-left').length === 1, JSON.stringify(r));
    check(`the default budget is ${mod.PAGE_PHOTO_SWEEP_BUDGET_MS} ms`, mod.PAGE_PHOTO_SWEEP_BUDGET_MS === 3000);
  });

  await attempt('failures never throw', async () => {
    for (const mode of ['list-error', 'remove-error', 'throw']) {
      reset(); logs = [];
      batch(USER, uuid(1), 2, 2 * HOUR);
      state.mode = mode;
      let threw = null, r = null;
      try { r = await sweep(USER, null); } catch (e) { threw = e; }
      check(`storage ${mode}: the sweep resolves, never throws, and logs kf-page-photos-left`, !threw && r && r.error && tagged('kf-page-photos-left').length === 1, String(threw ?? JSON.stringify(r)));
    }
  });

  await attempt('malformed ids', async () => {
    for (const bad of ['', '..', uuid(1).toUpperCase(), `${USER}/x`, null]) {
      reset();
      batch(USER, uuid(1), 2, 2 * HOUR);
      const r = await sweep(bad, null);
      check(`user id ${JSON.stringify(bad)}: nothing listed, nothing removed`, state.lists.length === 0 && state.removes.length === 0 && r.error);
    }
    reset();
    batch(USER, uuid(1), 2, 2 * HOUR);
    const r = await sweep(USER, '../x');
    check('a malformed current batch: nothing listed, nothing removed', state.lists.length === 0 && state.removes.length === 0 && r.error);
  });
}

// ---- 2. the routes -------------------------------------------------------------------

realLog('2. The routes schedule the sweep, and it never changes their answer');
const consentless = { id: USER, user_metadata: {} };
const STALE = uuid(1), CURRENT = uuid(2);
// The current batch holds a third photo the request does not name: the route's
// own finally removes p1/p2, so p9 is how the sweep's exclusion is seen.
// The routes' sweep reads the real clock, so these photos are dated from it.
const putNow = (key, msAgo) => { const t = new Date(Date.now() - msAgo).toISOString(); state.objects.set(key, { created_at: t, updated_at: t }); };
const seed = () => {
  for (const n of [1, 2]) { putNow(`${USER}/page-photos/${STALE}/p${n}.jpg`, 2 * HOUR); putNow(`${USER}/page-photos/${CURRENT}/p${n}.jpg`, 2 * HOUR); }
  putNow(`${USER}/page-photos/${CURRENT}/p9.jpg`, 2 * HOUR);
};

let pageRead = null, ingest = null;
await attempt('the routes load', async () => {
  pageRead = await load('src/app/api/page-read/route.ts');
  ingest = await load('src/app/api/ingest/route.ts');
  check('both routes load with the stubs', typeof pageRead.POST === 'function' && typeof ingest.POST === 'function');
});
const prReq = (keys) => new Request('http://x/api/page-read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kb_id: KB, keys, name: 'pages', locale: 'en' }) });
const ingReq = () => { const f = new FormData(); f.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' })); f.set('kb_id', KB); f.set('locale', 'en'); return new Request('http://x/api/ingest', { method: 'POST', body: f }); };
async function drive(post, req, mode) {
  reset(); seed(); logs = [];
  state.user = consentless;
  state.mode = 'ok';
  const res = await post(req);
  const answer = `${res.status} ${await res.text()}`;
  const scheduled = state.after.length;
  state.routeRemoves = state.removes.length;
  state.mode = mode;
  // What the platform does after the answer: run every after() task. The tasks get the default budget.
  for (const task of state.after) { try { await task(); } catch (e) { logs.push('after task threw: ' + e); } }
  return { answer, scheduled };
}

if (pageRead && ingest) {
  await attempt('page-read schedules the sweep', async () => {
    const keys = [`${USER}/page-photos/${CURRENT}/p1.jpg`, `${USER}/page-photos/${CURRENT}/p2.jpg`];
    const r = await drive(pageRead.POST, prReq(keys), 'ok');
    check('page-read (consent missing, 403) schedules exactly one sweep, after the key check and before consent', r.scheduled === 1 && r.answer.startsWith('403'), r.answer);
    // The route's own finally removes the current batch through the same memory bucket; the sweep must not.
    const swept = state.removes.slice(state.routeRemoves).flat();
    check('...that sweep removes the stale batch', swept.length === 2 && swept.every((k) => k.includes(STALE)) && ![...state.objects.keys()].some((k) => k.includes(STALE)), JSON.stringify(swept));
    check('...and never names the current batch (its unnamed p9 is still there)', !swept.some((k) => k.includes(CURRENT)) && state.objects.has(`${USER}/page-photos/${CURRENT}/p9.jpg`), JSON.stringify(swept));
    const foreign = [`${OTHER}/page-photos/${CURRENT}/p1.jpg`];
    const f = await drive(pageRead.POST, prReq(foreign), 'ok');
    check('a foreign key (403) schedules no sweep', f.scheduled === 0 && f.answer.startsWith('403'), f.answer);
    reset(); state.user = null;
    const noSession = await pageRead.POST(prReq(keys));
    check('no session (401) schedules no sweep', noSession.status === 401 && state.after.length === 0);
  });

  await attempt('ingest schedules the sweep', async () => {
    const r = await drive(ingest.POST, ingReq(), 'ok');
    check('/api/ingest (consent missing, 403) schedules exactly one sweep after the session check', r.scheduled === 1 && r.answer.startsWith('403'), r.answer);
    check('...that sweep removes every stale batch (ingest has no current batch)', ![...state.objects.keys()].some((k) => k.includes('/page-photos/')));
    reset(); state.user = null;
    const noSession = await ingest.POST(ingReq());
    check('/api/ingest without a session (401) schedules no sweep', noSession.status === 401 && state.after.length === 0);
  });

  await attempt('the answer never depends on the sweep', async () => {
    const keys = [`${USER}/page-photos/${CURRENT}/p1.jpg`];
    for (const [name, post, mk] of [['page-read', pageRead.POST, () => prReq(keys)], ['ingest', ingest.POST, ingReq]]) {
      const answers = [];
      for (const mode of ['ok', 'list-error', 'remove-error', 'throw']) {
        const r = await drive(post, mk(), mode);
        answers.push(r.answer);
        if (mode !== 'ok') check(`${name}: storage ${mode} in the sweep logs kf-page-photos-left and throws nothing out of after()`, tagged('kf-page-photos-left').length >= 1 && !logs.some((l) => l.startsWith('after task threw')), logs.join(' | '));
      }
      // The answer is read before any after() task runs, so this holds by
      // construction; what it guards is that the route only SCHEDULES the sweep
      // (a route that awaited it inline would schedule nothing and fail above).
      check(`${name}: the answer is byte-identical across sweep storage ok / error / refused / throw (the sweep is only scheduled)`, answers.every((a) => a === answers[0]), answers.join(' || '));
    }
  });
}

realLog(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  realLog('FAILED:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
