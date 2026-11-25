/**
 * Executable proof for item 4j (PR #353): a camera batch is READ AT MOST ONCE,
 * and the app recovers a send whose answer never came without uploading the
 * same photos again.
 *
 *   1. The claim, alone (claimPageBatch / releasePageBatch with a Storage
 *      fake): claimed, taken (both shapes Storage answers a duplicate with),
 *      gone (no photo there, and the claim let go), failed (fail closed);
 *      always `upsert: false`.
 *   2. THE RACE, on the real route: 2 and then 5 requests for ONE batch at
 *      the same moment. Exactly one is read (one model call per page, one
 *      ledger row per page, one ingestion, one upload counted); every other
 *      is 409 page-batch-taken, having read, deleted, counted and spent
 *      nothing. A request minutes later is still 409 (the material was made).
 *      The Storage fake answers a second object at the same name as Storage
 *      does (refused, upsert false), after an await, so the requests really
 *      interleave.
 *   3. The claim's other ends on the route: a refusal lets the claim go after
 *      the photos, so asking again is 410 page-batch-gone; a claim whose
 *      photos are all missing is 410 before any gate counts it; Storage down
 *      is 503 with the photos untouched; a key named like the claim is 400;
 *      one kf-page-read-arrival line per request, whole numbers only.
 *   4. The client alone (sendPageBatch): the time limit aborts the first ask
 *      and the SAME keys are asked once more; 409 is unconfirmed with no new
 *      upload; no answer twice is unconfirmed with the batch kept; "Try
 *      again" (`again`) never uploads; 410 uploads under a new batch, once.
 *   5. The client against the real route (the build 9 shape): the first ask
 *      is held below the page and delivered after the client gave up on it,
 *      before or while the second ask is read; one read in all, the late one
 *      409. A refusal the client never saw: the second ask is 410, the photos
 *      go again under a new batch, and the refusal is what the screen shows.
 *      A first ask that made the material unseen: "Try again" is 409, no
 *      upload, no read.
 *   6. The sweep removes a claimed folder whole (photos and claim, or the
 *      claim alone) after its hour, and never a folder whose claim is new.
 *   7. The camera screen: Close works while the pages are read (and not while
 *      they upload); the camera does not open over a read; "Try again" asks
 *      for the pending batch; the time limit is wired into fetch().
 *
 * Stubbed: NextResponse/after, the session and service Supabase clients
 * (in-memory storage, rows, counter, ledger), entitlement, the subject cap,
 * the study event, the Anthropic SDK, the ingestion service (global fetch),
 * the stored-file write. Real: the route, the claim, the reader with the real
 * sharp, the allowance, the counter, the shared ingestion, sendPageBatch, the
 * sweep, the screen's markup.
 *
 * RED ON a8ddde1 (the head before this change) and on main: no claim exists,
 * so section 2 reads the batch once per request.
 *
 * Tier 0: no network, no credential, no database, no model call.
 * Usage: node --experimental-strip-types scripts/verify-page-batch-once.mjs [--self-test]
 *   --self-test  plants a claim that never refuses a second caller and proves
 *                section 2's race checks fail on it.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const SELF_TEST = process.argv.includes('--self-test');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'verify-only-not-a-key';
process.env.INGESTION_SERVICE_URL = 'http://ingestion.invalid';
process.env.INGESTION_TOKEN = 'verify-only-not-a-token';
process.env.ANTHROPIC_API_KEY = 'verify-only-not-a-key';

const USER = '11111111-1111-4111-8111-111111111111';
const KB = '44444444-4444-4444-8444-444444444444';
const BATCH = '33333333-3333-4333-8333-333333333333';
const CLAIM = 'kf-claim';

const state = {};
globalThis.__pb = state;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** An answer that never reaches the page: rejects when the page's time limit aborts (at once if it already has). */
const lost = (signal) => new Promise((_, reject) => {
  const no = () => reject(new DOMException('aborted', 'AbortError'));
  if (signal.aborted) no();
  else signal.addEventListener('abort', no, { once: true });
});

// ---- stubs -------------------------------------------------------------------------------

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); },
};
export function after() {}`;

// The student's session client: auth, rows, the day's counter, and storage
// (list / download as Storage answers them: every object in the folder, the
// claim included).
const SESSION_STUB = `
const S = () => globalThis.__pb;
function query(table) {
  const q = { table, op: 'select', filters: [], row: null };
  const run = (mode) => S().db(q, mode);
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(run('many')).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => run(prop);
      if (prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete') return (row) => { q.op = prop; q.row = row; return b; };
      if (prop === 'select') return () => b;
      return (...args) => { q.filters.push([prop, ...args]); return b; };
    },
  });
  return b;
}
export async function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: S().user } }),
      getSession: async () => ({ data: { session: S().user ? { access_token: 't' } : null } }),
    },
    from: (table) => query(table),
    rpc: async (fn, args) => {
      if (fn !== 'increment_usage') return { data: null, error: { message: 'unknown rpc ' + fn } };
      const n = (S().usage.get(args.p_kind) || 0) + 1;
      S().usage.set(args.p_kind, n);
      return { data: n, error: null };
    },
    storage: {
      from: () => ({
        list: async (folder) => {
          await new Promise((r) => setTimeout(r, 1));
          const entries = [...S().objects.entries()]
            .filter(([k]) => k.startsWith(folder + '/') && !k.slice(folder.length + 1).includes('/'))
            .map(([k, o]) => ({ name: k.slice(folder.length + 1), id: 'obj-' + k, metadata: { size: o.bytes.length } }));
          return { data: entries, error: null };
        },
        download: async (key) => {
          S().calls.download.push(key);
          await new Promise((r) => setTimeout(r, 3));
          const o = S().objects.get(key);
          return o ? { data: new Blob([o.bytes]), error: null } : { data: null, error: { message: 'Object not found' } };
        },
        upload: async (path, file) => {
          S().objects.set(path, { bytes: Buffer.from(await file.arrayBuffer()) });
          return { data: { path }, error: null };
        },
      }),
    },
  };
}`;

// The service-role client: the ledger, the photo removal and THE CLAIM. A
// second object at a name already there is refused, as Storage refuses it
// with upsert false (the unique index on storage.objects (bucket_id, name));
// the refusal is decided after an await, so concurrent requests interleave
// and only the check itself is atomic, as the database's is.
const SERVICE_STUB = `
const S = () => globalThis.__pb;
export function createClient() {
  return {
    rpc: async (fn, args) => {
      if (fn !== 'ai_spend_since') return { data: null, error: { message: 'unknown function ' + fn } };
      const since = Date.parse(args.p_since);
      return { data: S().ledger.filter((r) => r.user_id === args.p_user && Date.parse(r.at) >= since).reduce((a, r) => a + r.usd, 0), error: null };
    },
    from: (table) => ({
      insert: async (row) => {
        if (table !== 'ai_spend') return { error: { message: 'wrong table ' + table } };
        S().ledger.push({ ...row, at: new Date().toISOString() });
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        upload: async (path, body, opts) => {
          S().calls.claim.push({ path, opts });
          await new Promise((r) => setTimeout(r, S().claimDelay()));
          if (S().claimDown) return { data: null, error: { message: 'storage unreachable', status: 503 } };
          if (!opts || opts.upsert !== false) return { data: null, error: { message: 'a claim must never upsert' } };
          if (S().objects.has(path) && !S().plantNoRefusal) {
            // Older Storage APIs answer HTTP 400 with statusCode "409"; newer ones 409.
            return { data: null, error: S().claimHttp409 ? { message: 'The resource already exists', status: 409 } : { message: 'The resource already exists', status: 400, statusCode: '409' } };
          }
          S().objects.set(path, { bytes: Buffer.from(String(body)), claim: true, at: Date.now() });
          return { data: { path }, error: null };
        },
        list: async (folder) => {
          const entries = [...S().objects.keys()].filter((k) => k.startsWith(folder + '/') && !k.slice(folder.length + 1).includes('/')).map((k) => ({ name: k.slice(folder.length + 1), id: 'obj-' + k }));
          return { data: entries, error: null };
        },
        remove: async (keys) => {
          S().calls.remove.push([...keys]);
          const gone = keys.filter((k) => S().objects.has(k));
          for (const k of gone) S().objects.delete(k);
          return { data: gone.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
}`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (params) => {
        const S = globalThis.__pb;
        S.modelCalls.push(params.model);
        await new Promise((r) => setTimeout(r, S.modelDelay));
        return { content: [{ type: 'text', text: 'page text ' + S.modelCalls.length }], stop_reason: 'end_turn', usage: { input_tokens: 4915, output_tokens: 535, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
      },
    };
  }
}`;
const DOC_STORAGE_STUB = `export async function storeOwnDocumentFile() { return { ok: true, message: '' }; } export async function removeOwnDocumentFile() { return true; } export function ownDocumentKey() { return true; }`;

installTsxHooks(ROOT, {
  'next/server': NEXT_SERVER,
  '@/lib/supabase/server': SESSION_STUB,
  '@supabase/supabase-js': SERVICE_STUB,
  '@anthropic-ai/sdk': ANTHROPIC_STUB,
  '@/lib/entitlement': `export async function getEntitlement() { return { tier: 'pro' }; }`,
  '@/lib/limits-server': `export async function checkDocumentLimit() { return { allowed: true, limit: 100, tier: 'pro' }; }`,
  '@/lib/study-events': `export async function recordStudyEvent() {}`,
  '@/lib/document-storage-server': DOC_STORAGE_STUB,
  '@/lib/supabase/client': 'export function createClient(){ throw new Error("no Supabase in a proof"); }',
});
globalThis.__tsxHooksParams = { locale: 'en' };

// ---- reporting -------------------------------------------------------------------------

let pass = 0;
const failures = [];
const realLog = console.log;
const logs = [];
console.log = (...a) => logs.push(a.join(' '));
console.error = (...a) => logs.push(a.join(' '));
console.warn = () => {};
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  realLog(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${String(detail).slice(0, 700)}` : ''}`);
}
const section = (t) => realLog(`\n${t}`);
async function load(p) {
  try {
    return await import(pathToFileURL(resolvePath(ROOT, p)).href);
  } catch (e) {
    check(`${p} loads (${String(e?.message ?? e).split('\n')[0]})`, false);
    return null;
  }
}
async function attempt(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e?.stack ?? e).split('\n').slice(0, 4).join(' | '));
  }
}

// ---- the harness state ----------------------------------------------------------------------

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const PAGES = [];
for (const [w, h] of [[600, 800], [640, 860], [580, 780]]) {
  PAGES.push(await sharp({ create: { width: w, height: h, channels: 3, background: '#fbf8f2' } }).jpeg({ quality: 80 }).toBuffer());
}

function reset({ consent = 2, spent = 0 } = {}) {
  Object.assign(state, {
    user: { id: USER, user_metadata: consent ? { ai_consent: { version: consent, at: '2026-11-01T00:00:00.000Z' } } : {} },
    usage: new Map(),
    objects: new Map(),
    ledger: spent > 0 ? [{ user_id: USER, kind: 'answer', usd: spent, estimated: false, at: new Date(Date.now() - 3600000).toISOString() }] : [],
    calls: { claim: [], remove: [], download: [], ingest: [], insert: [] },
    modelCalls: [],
    modelDelay: 25,
    claimDelay: () => Math.floor(Math.random() * 6),
    claimDown: false,
    claimHttp409: false,
    plantNoRefusal: SELF_TEST && state.plantArmed === true,
  });
  logs.length = 0;
}
state.db = (q, mode) => {
  if (q.table === 'knowledge_bases') return { data: { id: KB }, error: null };
  if (q.table === 'documents' && q.op === 'insert') {
    state.calls.insert.push(q.row);
    return { data: { ...q.row }, error: null };
  }
  if (q.table === 'documents' && q.op === 'update') return { data: null, error: null };
  if (q.table === 'documents') return { data: [], error: null, count: 0 };
  return { data: mode === 'many' ? [] : null, error: null };
};
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/ingest')) {
    state.calls.ingest.push(init.body.get('document_id'));
    return new Response(JSON.stringify({ document_id: init.body.get('document_id'), chunk_count: 2, status: 'ready', voyage_tokens: 120, pages_total: null, pages_no_text: null }), { status: 200 });
  }
  throw new Error('no network in this proof: ' + url);
};
const key = (name, batch = BATCH) => `${USER}/page-photos/${batch}/${name}`;
const folderOf = (batch = BATCH) => `${USER}/page-photos/${batch}`;
const putBatch = (batch = BATCH, n = 3) => {
  const keys = [];
  for (let i = 0; i < n; i++) {
    state.objects.set(key(`p${i + 1}.jpg`, batch), { bytes: PAGES[i % PAGES.length] });
    keys.push(key(`p${i + 1}.jpg`, batch));
  }
  return keys;
};
const photosLeft = (batch = BATCH) => [...state.objects.keys()].filter((k) => k.startsWith(folderOf(batch) + '/') && !k.endsWith('/' + CLAIM));
const claimHeld = (batch = BATCH) => state.objects.has(`${folderOf(batch)}/${CLAIM}`);
const pageRows = () => state.ledger.filter((r) => r.kind === 'page_read');
const requestFor = (keys, query = '?kf_t=1795622031009&kf_c=812&kf_s=901&kf_u=4000&kf_r=0') =>
  new Request(`https://tryknowflow.com/api/page-read${query}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kb_id: KB, keys, name: 'pages', locale: 'en' }) });
const answerOf = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const reader = await load('src/lib/page-reader.ts');
const server = await load('src/lib/page-reader-server.ts');
const route = await load('src/app/api/page-read/route.ts');
const photos = await load('src/lib/page-photos.ts');
const sweep = await load('src/lib/page-photo-sweep.ts');
const limits = await load('src/lib/limit-messages.ts');
const POST = route?.POST;

// ---- 1. the claim, alone -------------------------------------------------------------------

section('1. The claim, alone');
await attempt('the claim module', async () => {
  check('the claim is named kf-claim; the codes are page-batch-taken (409) and page-batch-gone (410)', reader.PAGE_BATCH_CLAIM_NAME === CLAIM && reader.PAGE_BATCH_TAKEN === 'page-batch-taken' && reader.PAGE_BATCH_GONE === 'page-batch-gone');
  check('the claim\'s name is one checkPhotoKeys accepts, so the sweep sees an app folder', reader.checkPhotoKeys(USER, [key(CLAIM)]).ok === true);
  const store = new Map();
  const calls = [];
  const bucket = {
    async upload(path, body, opts) { calls.push(['upload', path, opts]); if (store.has(path)) return { data: null, error: { message: 'The resource already exists', status: 400, statusCode: '409' } }; store.set(path, body); return { data: {}, error: null }; },
    async list(folder) { calls.push(['list', folder]); return { data: [...store.keys()].filter((k) => k.startsWith(folder + '/')).map((k) => ({ name: k.slice(folder.length + 1), id: 'x' })), error: null }; },
    async remove(paths) { calls.push(['remove', paths]); for (const p of paths) store.delete(p); return { data: paths, error: null }; },
  };
  const f = folderOf();
  store.set(`${f}/p1.jpg`, 'x');
  const a = await server.claimPageBatch(f, ['p1.jpg'], 1795622031009.4, { bucket });
  check('first caller: claimed, with upsert false and the arrival time (whole ms) as the claim\'s body', a.kind === 'claimed' && calls[0][2].upsert === false && store.get(`${f}/${CLAIM}`) === '1795622031009', JSON.stringify({ a, calls }));
  const b = await server.claimPageBatch(f, ['p1.jpg'], 2, { bucket });
  check('second caller: taken (Storage\'s HTTP 400 with statusCode "409")', b.kind === 'taken', JSON.stringify(b));
  check('isAlreadyExists also reads HTTP 409, and not a 503 or a 404', server.isAlreadyExists({ message: 'x', status: 409 }) && !server.isAlreadyExists({ message: 'storage unreachable', status: 503 }) && !server.isAlreadyExists({ message: 'Object not found', status: 404 }) && !server.isAlreadyExists(null));
  const g = folderOf('55555555-5555-4555-8555-555555555555');
  const c = await server.claimPageBatch(g, ['p1.jpg'], 3, { bucket });
  check('no photo of the batch there: gone, and the claim it made is let go', c.kind === 'gone' && !store.has(`${g}/${CLAIM}`), JSON.stringify(c));
  const down = { async upload() { return { data: null, error: { message: 'storage unreachable', status: 503 } }; } };
  const d = await server.claimPageBatch(f, ['p1.jpg'], 4, { bucket: down });
  const thrower = { async upload() { throw new Error('socket hang up'); } };
  const e = await server.claimPageBatch(f, ['p1.jpg'], 4, { bucket: thrower });
  check('Storage down or throwing: failed (never taken, never claimed), and nothing thrown', d.kind === 'failed' && e.kind === 'failed');
  check('releasePageBatch removes exactly the claim', (await server.releasePageBatch(f, { bucket })) === true && !store.has(`${f}/${CLAIM}`) && store.has(`${f}/p1.jpg`));
});

// ---- 2. the race ------------------------------------------------------------------------------

async function race(n) {
  reset();
  const keys = putBatch();
  const answers = await Promise.all(Array.from({ length: n }, () => POST(requestFor(keys)).then(answerOf)));
  return { keys, answers };
}
section('2. The race: requests for ONE batch at the same moment');
await attempt('the race', async () => {
  for (const n of [2, 5]) {
    const { answers } = await race(n);
    const ok = answers.filter((a) => a.status === 200);
    const taken = answers.filter((a) => a.status === 409 && a.body.code === 'page-batch-taken');
    check(`${n} at once: exactly one 200, ${n - 1} answered 409 page-batch-taken`, ok.length === 1 && taken.length === n - 1, JSON.stringify(answers.map((a) => [a.status, a.body.code])));
    check(`${n} at once: the pages were read ONCE (3 model calls, not ${3 * n})`, state.modelCalls.length === 3, String(state.modelCalls.length));
    check(`${n} at once: billed once (3 page_read rows), one material ingested, one upload counted`, pageRows().length === 3 && state.calls.ingest.length === 1 && state.calls.insert.length === 1 && state.usage.get('upload') === 1, JSON.stringify({ rows: pageRows().length, ingest: state.calls.ingest.length, upload: state.usage.get('upload') }));
    check(`${n} at once: the photos downloaded once each, removed once, and none left`, state.calls.download.length === 3 && state.calls.remove.filter((r) => r.some((k) => k.endsWith('.jpg'))).length === 1 && photosLeft().length === 0, JSON.stringify({ downloads: state.calls.download.length, removes: state.calls.remove }));
    check(`${n} at once: the 409 says the unconfirmed sentence (the screen shows its own)`, taken.every((a) => a.body.success === false && a.body.error === limits.uploadRefusalMessage('en', 'unconfirmed')));
    check(`${n} at once: the claim stays (a material was made)`, claimHeld());
  }
  // A request minutes later for the same batch: still refused, nothing read.
  const keys = [key('p1.jpg'), key('p2.jpg'), key('p3.jpg')];
  const before = { model: state.modelCalls.length, rows: pageRows().length, upload: state.usage.get('upload'), removes: state.calls.remove.length };
  const late = await answerOf(await POST(requestFor(keys)));
  check('a request for that batch after the material was made: 409, nothing read, counted, spent or deleted', late.status === 409 && late.body.code === 'page-batch-taken' && state.modelCalls.length === before.model && pageRows().length === before.rows && state.usage.get('upload') === before.upload && state.calls.remove.length === before.removes, JSON.stringify(late));
  // The other Storage answer for a duplicate.
  reset();
  state.claimHttp409 = true;
  const k2 = putBatch();
  const two = await Promise.all([POST(requestFor(k2)), POST(requestFor(k2))].map((p) => p.then(answerOf)));
  check('the same with Storage answering HTTP 409: one 200, one 409, three model calls', two.filter((a) => a.status === 200).length === 1 && two.filter((a) => a.status === 409).length === 1 && state.modelCalls.length === 3);
});

// ---- 3. the claim's other ends on the route ---------------------------------------------------

section('3. Refusals let the claim go; a gone batch is 410; Storage down is 503; the arrival line');
await attempt('the route\'s other ends', async () => {
  reset({ consent: 1 });
  let keys = putBatch();
  let a = await answerOf(await POST(requestFor(keys)));
  check('a refusal after the claim (version-1 permission): 403 as before, the photos deleted as before', a.status === 403 && a.body.code === 'ai_consent_required' && photosLeft().length === 0, JSON.stringify(a));
  check('...and the claim let go (nothing was saved)', !claimHeld());
  state.user.user_metadata = { ai_consent: { version: 2, at: '2026-11-01T00:00:00.000Z' } };
  a = await answerOf(await POST(requestFor(keys)));
  check('asking again for that batch: 410 page-batch-gone, nothing read, nothing counted', a.status === 410 && a.body.code === 'page-batch-gone' && state.modelCalls.length === 0 && !state.usage.has('upload'), JSON.stringify(a));
  check('...and no claim left behind', !claimHeld());

  reset({ spent: 999 });
  keys = putBatch();
  a = await answerOf(await POST(requestFor(keys)));
  check('allowance used: 429 as before, nothing sent, photos deleted, claim let go', a.status === 429 && state.modelCalls.length === 0 && photosLeft().length === 0 && !claimHeld(), JSON.stringify(a));

  reset();
  a = await answerOf(await POST(requestFor([key('p1.jpg'), key('p2.jpg')])));
  check('a batch whose photos are all missing: 410 before any gate (no upload counted, nothing listed by the reader)', a.status === 410 && a.body.code === 'page-batch-gone' && !state.usage.has('upload') && state.calls.download.length === 0 && !claimHeld(), JSON.stringify(a));

  reset();
  keys = putBatch();
  state.claimDown = true;
  a = await answerOf(await POST(requestFor(keys)));
  check('Storage refuses the claim: 503, the photos untouched, nothing read', a.status === 503 && photosLeft().length === 3 && state.modelCalls.length === 0 && state.calls.remove.length === 0, JSON.stringify(a));

  reset();
  keys = putBatch();
  a = await answerOf(await POST(requestFor([keys[0], key(CLAIM)])));
  check('a key named like the claim: 400, nothing claimed or deleted', a.status === 400 && state.calls.claim.length === 0 && state.calls.remove.length === 0 && photosLeft().length === 3);

  reset();
  keys = putBatch();
  await POST(requestFor(keys, '?kf_t=1795622031009&kf_c=812&kf_s=901&kf_u=4000&kf_r=1'));
  const lines = logs.filter((l) => l.includes('"tag":"kf-page-read-arrival"')).map((l) => JSON.parse(l));
  const l = lines[0] ?? {};
  check('one kf-page-read-arrival line per request', lines.length === 1, JSON.stringify(lines));
  check('...with the five timeline values as numbers and the arrival time', l.kf_t === 1795622031009 && l.kf_c === 812 && l.kf_s === 901 && l.kf_u === 4000 && l.kf_r === 1 && typeof l.at_ms === 'number' && /^\d{4}-\d\d-\d\dT/.test(l.at) && l.gap_ms === l.at_ms - l.kf_t, JSON.stringify(l));
  check('...and nothing about the student or the pages', Object.keys(l).sort().join(',') === 'at,at_ms,gap_ms,kf_c,kf_r,kf_s,kf_t,kf_u,tag' && !JSON.stringify(l).includes(USER) && !JSON.stringify(l).includes(BATCH));
  const odd = reader.arrivalLine('/api/page-read?kf_t=12a&kf_c=-5&kf_s=1e9&kf_u=' + '9'.repeat(16) + '&kf_r=%3Cb%3E&x=1', 1000);
  check('a value that is not a whole number of at most 15 digits is null; other keys are not copied', odd.kf_t === null && odd.kf_c === null && odd.kf_s === null && odd.kf_u === null && odd.kf_r === null && odd.gap_ms === null && !('x' in odd), JSON.stringify(odd));
});

// ---- 4. the client alone ----------------------------------------------------------------------

const blobs = Array.from({ length: 3 }, (_, i) => new Blob([PAGES[i]], { type: 'image/jpeg' }));
let seq = 0;
const ids = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const batchOf = (k) => k.split('/')[2];
/** A client whose asks are answered by `answers`, in order: a function (keys, signal) => answer, 'hang' or 'throw'. */
function client(answers) {
  const log = { uploads: [], reads: [], removes: [], asks: [], signals: [] };
  let i = 0;
  return {
    log,
    deps: {
      userId: USER,
      newBatchId: ids,
      readTimeLimitMs: 40,
      upload: async (k, b) => { log.uploads.push(k); },
      remove: async (k) => { log.removes.push(k); },
      read: async (keys, signal, ask) => {
        log.reads.push(keys);
        log.asks.push(ask);
        log.signals.push(signal);
        const a = answers[Math.min(i++, answers.length - 1)];
        if (a === 'throw') throw new TypeError('Load failed');
        if (a === 'hang') return lost(signal);
        return typeof a === 'function' ? a(keys, signal) : a;
      },
    },
  };
}
const ok200 = { status: 200, text: '{"success":true,"document_id":"d","chunk_count":2}' };
const taken409 = { status: 409, text: '{"success":false,"code":"page-batch-taken"}' };
const gone410 = { status: 410, text: '{"success":false,"code":"page-batch-gone"}' };

section('4. The client: time limit, one more ask with the same keys, no second upload');
await attempt('the client', async () => {
  check('the read\'s time limit is 75 s', photos.READ_TIME_LIMIT_MS === 75_000);
  let c = client(['hang', ok200]);
  const t0 = Date.now();
  let r = await photos.sendPageBatch(blobs, c.deps);
  check('the first ask hangs: its signal is aborted at the limit, and the SAME keys are asked once more (ask 0, then 1)', r.kind === 'answered' && r.status === 200 && c.log.reads.length === 2 && JSON.stringify(c.log.reads[0]) === JSON.stringify(c.log.reads[1]) && c.log.asks.join() === '0,1' && c.log.signals[0].aborted && Date.now() - t0 >= 40, JSON.stringify({ r: r.kind, asks: c.log.asks }));
  check('...one batch uploaded (3 photos), nothing deleted', c.log.uploads.length === 3 && c.log.removes.length === 0);
  c = client(['throw', taken409]);
  r = await photos.sendPageBatch(blobs, c.deps);
  check('a network error, then 409 taken: unconfirmed (taken), no new upload, nothing deleted', r.kind === 'unconfirmed' && r.taken === true && c.log.uploads.length === 3 && c.log.removes.length === 0 && c.log.reads.length === 2);
  c = client(['hang', 'hang']);
  r = await photos.sendPageBatch(blobs, c.deps);
  check('no answer twice: unconfirmed, the batch KEPT (its keys returned, nothing deleted), two asks only', r.kind === 'unconfirmed' && r.taken === false && c.log.reads.length === 2 && c.log.removes.length === 0 && JSON.stringify(r.keys) === JSON.stringify(c.log.reads[0]));
  const posted = { batchId: r.batchId, keys: r.keys };
  c = client([taken409]);
  r = await photos.sendPageBatch(blobs, c.deps, posted);
  check('"Try again" with the pending batch: no upload, the same keys asked, 409 is unconfirmed again', r.kind === 'unconfirmed' && r.taken && c.log.uploads.length === 0 && JSON.stringify(c.log.reads[0]) === JSON.stringify(posted.keys));
  c = client([ok200]);
  r = await photos.sendPageBatch(blobs, c.deps, posted);
  check('"Try again" whose first request never arrived: no upload, read once, 200', r.kind === 'answered' && r.status === 200 && c.log.uploads.length === 0 && c.log.reads.length === 1);
  c = client([gone410, ok200]);
  r = await photos.sendPageBatch(blobs, c.deps, posted);
  check('"Try again" answered 410 gone: the photos go under a NEW batch (3 uploads), then read: 200', r.kind === 'answered' && c.log.uploads.length === 3 && batchOf(c.log.uploads[0]) !== posted.batchId && batchOf(c.log.reads[1][0]) === batchOf(c.log.uploads[0]));
  c = client([gone410, gone410]);
  r = await photos.sendPageBatch(blobs, c.deps);
  check('410 twice in one send: upload-failed after ONE new upload (no loop)', r.kind === 'upload-failed' && c.log.uploads.length === 6 && c.log.reads.length === 2);
  c = client([{ status: 429, text: '{"success":false,"code":"daily_limit"}' }]);
  r = await photos.sendPageBatch(blobs, c.deps);
  check('an answered refusal is the answer (one ask, nothing deleted by the client)', r.kind === 'answered' && r.status === 429 && c.log.reads.length === 1 && c.log.removes.length === 0);
  let threw = false;
  try { await photos.sendPageBatch(blobs, client([ok200]).deps, { batchId: 'b', keys: ['a'] }); } catch { threw = true; }
  check('a pending batch of other photos is refused (it must be these photos)', threw);
});

// ---- 5. the client against the real route ---------------------------------------------------

/** Storage-side uploads for the client, the route's answer for each ask, with a transport that can hold an ask. */
function wired(hold) {
  const held = [];
  const log = { uploads: [], asks: [] };
  const deps = {
    userId: USER,
    newBatchId: ids,
    readTimeLimitMs: 40,
    upload: async (k, b) => { log.uploads.push(k); state.objects.set(k, { bytes: Buffer.from(await b.arrayBuffer()) }); },
    remove: async (keys) => { for (const k of keys) state.objects.delete(k); },
    read: async (keys, signal, ask) => {
      log.asks.push(ask);
      const req = requestFor(keys, `?kf_t=${Date.now()}&kf_c=1&kf_s=2&kf_u=3&kf_r=${ask}`);
      if (hold(ask)) {
        // Below the page: the server does not have it yet; the page gives up at the limit.
        let deliver;
        const late = new Promise((r) => { deliver = r; }).then(() => POST(req).then(answerOf));
        held.push({ ask, deliver, late });
        return lost(signal);
      }
      const res = await POST(req);
      return { status: res.status, text: await res.text() };
    },
  };
  return { deps, held, log };
}
section('5. The client against the real route: the build 9 shape');
await attempt('end to end', async () => {
  // (a) The first ask arrives after the client is done.
  reset();
  let w = wired((ask) => ask === 0);
  let r = await photos.sendPageBatch(blobs, w.deps);
  check('first ask held below the page: the second ask (same keys) is read: 200', r.kind === 'answered' && r.status === 200 && w.log.asks.join() === '0,1' && w.log.uploads.length === 3, JSON.stringify({ kind: r.kind, status: r.status, asks: w.log.asks }));
  w.held[0].deliver();
  const lateA = await w.held[0].late;
  check('...the first ask, delivered late, is 409 taken: 3 model calls in all, one material, billed once', lateA.status === 409 && lateA.body.code === 'page-batch-taken' && state.modelCalls.length === 3 && state.calls.ingest.length === 1 && pageRows().length === 3, JSON.stringify({ late: lateA, model: state.modelCalls.length }));

  // (b) The first ask arrives WHILE the second is being read.
  reset();
  state.modelDelay = 80;
  w = wired((ask) => ask === 0);
  const sending = photos.sendPageBatch(blobs, w.deps);
  while (w.log.asks.length < 2) await sleep(5);
  await sleep(20);
  w.held[0].deliver();
  const [rb, lateB] = await Promise.all([sending, w.held[0].late]);
  check('first ask delivered while the second is read: the second is 200, the first 409, read once', rb.kind === 'answered' && rb.status === 200 && lateB.status === 409 && state.modelCalls.length === 3 && state.calls.ingest.length === 1, JSON.stringify({ rb: [rb.kind, rb.status], lateB: lateB.status, model: state.modelCalls.length }));

  // (c) A refusal the client never saw.
  reset({ spent: 999 });
  w = wired(() => false);
  let lostOnce = true;
  const lose = w.deps.read;
  w.deps.read = async (keys, signal, ask) => {
    if (ask === 0 && lostOnce) {
      lostOnce = false;
      await POST(requestFor(keys)); // the server answers; the answer never reaches the page
      return lost(signal);
    }
    return lose(keys, signal, ask);
  };
  r = await photos.sendPageBatch(blobs, w.deps);
  const batches = [...new Set(w.log.uploads.map(batchOf))];
  check('a refusal lost on the way: the second ask is 410, the photos go under a new batch, and the refusal (429) is the answer shown', r.kind === 'answered' && r.status === 429 && batches.length === 2 && state.modelCalls.length === 0, JSON.stringify({ r: [r.kind, r.status], batches: batches.length, asks: w.log.asks }));

  // (d) The first ask made the material; its answer was lost, and the second is told taken.
  reset();
  w = wired(() => false);
  let first = true;
  const real = w.deps.read;
  w.deps.read = async (keys, signal, ask) => {
    if (first) {
      first = false;
      await POST(requestFor(keys));
      return lost(signal);
    }
    return real(keys, signal, ask);
  };
  r = await photos.sendPageBatch(blobs, w.deps);
  check('the material made unseen: unconfirmed (taken), one batch uploaded, read once', r.kind === 'unconfirmed' && r.taken && w.log.uploads.length === 3 && state.modelCalls.length === 3, JSON.stringify({ r }));
  const before = { uploads: w.log.uploads.length, model: state.modelCalls.length };
  const again = await photos.sendPageBatch(blobs, w.deps, { batchId: r.batchId, keys: r.keys });
  check('..."Try again": unconfirmed again, no upload, no read, no second material', again.kind === 'unconfirmed' && w.log.uploads.length === before.uploads && state.modelCalls.length === before.model && state.calls.ingest.length === 1);
});

// ---- 6. the sweep and the claim ---------------------------------------------------------------

section('6. The sweep removes a claimed folder whole, after its hour');
await attempt('the sweep', async () => {
  const now = Date.parse('2026-11-25T12:00:00.000Z');
  const old = '2026-11-25T10:00:00.000Z';
  const fresh = '2026-11-25T11:50:00.000Z';
  const B1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // ten photos + claim, old
  const B2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // the claim alone, old (photos read and removed)
  const B3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; // old photos, a NEW claim (asked again 10 min ago)
  const tree = new Map();
  for (let i = 1; i <= 10; i++) tree.set(`${folderOf(B1)}/p${i}.jpg`, old);
  tree.set(`${folderOf(B1)}/${CLAIM}`, old);
  tree.set(`${folderOf(B2)}/${CLAIM}`, old);
  tree.set(`${folderOf(B3)}/p1.jpg`, old);
  tree.set(`${folderOf(B3)}/${CLAIM}`, fresh);
  const removed = [];
  const bucket = {
    async list(prefix) {
      const seen = new Map();
      for (const [k, t] of tree) {
        if (!k.startsWith(prefix + '/')) continue;
        const rest = k.slice(prefix.length + 1);
        const slash = rest.indexOf('/');
        if (slash === -1) seen.set(rest, { name: rest, id: 'o', created_at: t, updated_at: t });
        else seen.set(rest.slice(0, slash), { name: rest.slice(0, slash), id: null });
      }
      return { data: [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : 1)), error: null };
    },
    async remove(keys) { removed.push(...keys); for (const k of keys) tree.delete(k); return { data: keys, error: null }; },
  };
  const res = await sweep.sweepStalePagePhotos(USER, null, { now, bucket });
  check('ten photos and their claim, an hour old: removed whole (11 objects)', [...Array(10)].every((_, i) => removed.includes(`${folderOf(B1)}/p${i + 1}.jpg`)) && removed.includes(`${folderOf(B1)}/${CLAIM}`), JSON.stringify({ res, removed }));
  check('a folder holding only an old claim: removed', removed.includes(`${folderOf(B2)}/${CLAIM}`));
  check('a folder whose claim is new (asked again): left alone, its photo included', !removed.some((k) => k.startsWith(folderOf(B3))));
});

// ---- 7. the camera screen ---------------------------------------------------------------------

section('7. The camera screen: Close while reading, no camera over a read, "Try again" asks again');
await attempt('the screen', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const pp = await load('src/components/platform/PlatformProvider.tsx');
  const dz = await load('src/components/upload/DropZone.tsx');
  const h = React.createElement;
  const render = (camera) => renderToStaticMarkup(h(pp.PlatformProvider, { platform: 'native', shell: 2 }, h(dz.DropZone, { kbId: 'k', previewCamera: { open: 'camera', camera } })));
  const button = (html, name) => (html.match(new RegExp(`<button[^>]*data-kf-camera="${name}"[^>]*>`)) || [''])[0];
  const reading = render({ pages: 3, phase: 'reading' });
  const idle = render({ pages: 3 });
  check('while the pages are read: the reading line shows', /role="status"/.test(reading));
  check('...Close is enabled', button(reading, 'close') !== '' && !/\sdisabled=""/.test(button(reading, 'close')), button(reading, 'close'));
  check('..."Read the pages" is not (no second send over a read)', /\sdisabled=""/.test(button(reading, 'read')), button(reading, 'read'));
  check('idle: Close and Read enabled, as before', !/\sdisabled=""/.test(button(idle, 'close')) && !/\sdisabled=""/.test(button(idle, 'read')));
  const cam = read('src/components/upload/CameraPages.tsx');
  check('the sheet\'s own close (backdrop, swipe) also works while reading, and not while uploading', cam.includes("onClose={() => (phase === 'reading' || (!busy && phase !== 'preparing')) && onClose()}") && cam.includes("disabled={(busy && phase !== 'reading') || phase === 'preparing'}"));
  check('the camera tile does not open the camera over a send, and a shot is not added during one', /capture: \(\) => \{\s*if \(phaseRef\.current === 'idle'\) inputRef\.current\?\.click\(\);/.test(cam) && /if \(room <= 0 \|\| phaseRef\.current !== 'idle'\) return;/.test(cam));
  check('"Try again" asks for the pending batch when the pages are the same, and keeps it only while unconfirmed', /const again = pending\.current && pending\.current\.pageIds === pageIds \? pending\.current\.batch : undefined;/.test(cam) && /\}, again\);/.test(cam) && /pending\.current = result\.kind === 'unconfirmed' \? \{ batch: \{ batchId: result\.batchId, keys: result\.keys \}, pageIds \} : null;/.test(cam));
  check('the time limit reaches fetch() (signal), and each ask carries its number (kf_r)', /signal,\n\s*\}\);/.test(cam) && /read: async \(keys, signal, ask\) =>/.test(cam) && /uploadedMs, ask \}\)/.test(cam));
  check('no new string: the screen still says labels.unconfirmed for an unconfirmed send', /if \(result\.kind === 'unconfirmed'\) \{\s*noteSetback\(\);\s*return setMessage\(labels\.unconfirmed\);/.test(cam));
});

// ---- the plant -----------------------------------------------------------------------------------

if (SELF_TEST) {
  section('SELF-TEST: a claim that never refuses a second caller must fail the race');
  const before = failures.length;
  state.plantArmed = true;
  const { answers } = await race(2);
  const readTwice = state.modelCalls.length === 6 && answers.every((a) => a.status === 200);
  state.plantArmed = false;
  realLog(`  planted: ${answers.map((a) => a.status).join(',')}, model calls ${state.modelCalls.length}`);
  if (readTwice) { pass += 1; realLog('  OK    the plant reads the batch twice (6 model calls, two 200s): the race checks above would fail on it'); }
  else { failures.push('self-test'); realLog('  FAIL  the plant did not read twice: the race check cannot tell'); }
  void before;
}

realLog(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  realLog('FAILED:');
  for (const f of failures) realLog(`  ! ${f}`);
  process.exit(1);
}
