/**
 * Executable proof for the storage insert lockdown, stage 1 (code): every file
 * KnowFlow stores in the `documents` bucket is written, and rolled back, by the
 * SERVER with the service role, never with the student's session, and only
 * after the checks the session used to imply have passed on the server.
 *
 * WHY. supabase/migrations/002_storage.sql lets a signed-in student INSERT any
 * object whose first path segment is their id. /api/ingest and /api/sample
 * used that policy, so it could not be narrowed, and the same policy let a
 * student call the Storage API directly and store unlimited objects of any
 * size under their prefix, which nothing removes (no delete policy). Stage 2
 * (supabase/migrations/20261118_storage_insert_lockdown.sql, applied by hand
 * AFTER this code is live) narrows the student's INSERT to camera photos.
 *
 * WHAT IS ASSERTED.
 *   1. ingestMaterial (src/lib/ingest-material.ts, shared by /api/ingest and
 *      /api/page-read), driven for real: the file is uploaded by a client made
 *      with SUPABASE_SERVICE_ROLE_KEY, under the SAME key
 *      ({userId}/{kbId}/{documentId}/{safe name}), with the SAME options
 *      ({ upsert: false }, nothing else) and the very File; the session's
 *      storage is never touched; the subject check comes before the write.
 *   2. A subject that is not the caller's (another student's, a made-up id,
 *      a path-shaped id), a subject read that fails, a missing service role
 *      and a storage error: each answers the unchanged 500 "nothing saved"
 *      sentence with NOTHING written (no upload of either kind, no row).
 *   3. /api/sample, driven for real: the PDF is uploaded by the service client
 *      with { upsert: false, contentType: 'application/pdf' } at the normal
 *      key; a failure after the upload REMOVES the file (it could not before:
 *      a student has no delete policy), the row and the subject it made.
 *   4. The module's key rule: the first segment must be the caller, the second
 *      the subject, then a document id and one flat name; nothing else.
 *   5. THE GUARD: no file under src/ writes to storage (upload, remove, move,
 *      copy, update, signed upload URL) except through a client named `admin`
 *      in the five files allowed to hold one. --self-test plants six writes
 *      the guard must catch.
 *
 * RED ON 56ee9f7..d675b6c: ingestMaterial and /api/sample upload with the
 * student's session, the sample rollback cannot remove the file, and the
 * module does not exist.
 *
 * Tier 0: no network, no credential, no database, no app.
 * Usage: node --experimental-strip-types scripts/verify-storage-server-writes.mjs [--self-test]
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

// ── 5. The guard, first: it is pure and the self-test needs nothing else. ───────
// The files allowed to write to storage, each only through a service-role
// client named `admin` (built from SUPABASE_SERVICE_ROLE_KEY or handed in by a
// caller that built it so).
const STORAGE_WRITERS = new Set([
  'src/lib/document-storage-server.ts', // stage 1: the stored file of every material, and its rollback
  'src/lib/page-reader-server.ts',      // the read camera photos removed
  'src/lib/page-photo-sweep.ts',        // abandoned camera batches removed
  'src/lib/material-deletion.ts',       // a material's file on delete
  'src/lib/account-deletion/storage.ts', // every file of a deleted account
]);
const WRITE_METHODS = ['upload', 'update', 'remove', 'move', 'copy', 'createSignedUploadUrl', 'uploadToSignedUrl', 'emptyBucket', 'deleteBucket', 'createBucket', 'updateBucket'];
const READ_METHODS = new Set(['list', 'download', 'createSignedUrl', 'createSignedUrls', 'getPublicUrl', 'exists', 'info']);

/** Every storage write in `code` that is not allowed for file `rel`. */
export function storageWriteViolations(rel, source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out = [];
  const line = (i) => code.slice(0, i).split('\n').length;
  // (a) every `.storage` access: whose client, and which method on the bucket.
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*|\))\s*\.\s*storage\b/g)) {
    const receiver = m[1];
    const after = code.slice(m.index + m[0].length, m.index + m[0].length + 400).replace(/\s+/g, '');
    const method = /^\.from\((?:[^()]|\([^()]*\))*\)(?:as[\w<>{}\[\]|&,:'" ]+)?\.(\w+)\(/.exec(after)?.[1] ?? null;
    const writes = method === null ? null : !READ_METHODS.has(method);
    if (receiver !== 'admin') {
      // A session (or any other) client: reads only, and only spelled in full.
      if (writes !== false) out.push(`${rel}:${line(m.index)} ${receiver}.storage${method ? `…${method}(` : ' (method not visible)'}: only a service-role client named admin may write`);
    } else if (!STORAGE_WRITERS.has(rel)) {
      out.push(`${rel}:${line(m.index)} admin.storage in a file not allowed to write storage`);
    }
  }
  // (b) a bucket handle passed around: any write method on something called
  // bucket outside the allowed files, and signed upload URLs anywhere else.
  for (const m of code.matchAll(new RegExp(`\\b(\\w*[Bb]ucket\\w*)\\s*\\.\\s*(${WRITE_METHODS.join('|')})\\s*\\(`, 'g'))) {
    if (!STORAGE_WRITERS.has(rel)) out.push(`${rel}:${line(m.index)} ${m[1]}.${m[2]}( outside the files allowed to write storage`);
  }
  for (const m of code.matchAll(/\b(createSignedUploadUrl|uploadToSignedUrl)\b/g)) {
    if (!STORAGE_WRITERS.has(rel)) out.push(`${rel}:${line(m.index)} ${m[1]} outside the files allowed to write storage`);
  }
  return out;
}

function srcFiles(dir = resolvePath(ROOT, 'src')) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = resolvePath(dir, name);
    if (statSync(p).isDirectory()) out.push(...srcFiles(p));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  // Each plant must be caught; the real tree's allowed writers must not be.
  const PLANTS = [
    ['src/lib/ingest-material.ts', "await supabase.storage.from('documents').upload(filePath, file, { upsert: false });"],
    ['src/app/api/sample/route.ts', 'await supabase.storage\n  .from(DOCUMENTS_BUCKET)\n  .remove([storagePath]);'],
    ['src/components/dashboard/X.tsx', "const { error } = await createClient().storage.from('documents').upload(k, f);"],
    ['src/lib/x.ts', "const bucket = supabase.storage.from('documents'); await bucket.upload(k, f);"],
    ['src/lib/y.ts', "await admin.storage.from('documents').upload(k, f);"],
    ['src/lib/z.ts', "const { data } = await supabase.storage.from('documents').createSignedUploadUrl(k);"],
  ];
  let bad = 0;
  for (const [rel, code] of PLANTS) {
    const v = storageWriteViolations(rel, code);
    console.log(`  ${v.length ? 'caught' : 'MISSED'}  ${rel}: ${code.split('\n')[0]}`);
    if (!v.length) bad++;
  }
  const allowedReads = [
    ['src/lib/page-reader-server.ts', 'const { data } = await supabase.storage\n  .from(DOCUMENTS_BUCKET)\n  .list(folder, { limit: 100 });'],
    ['src/lib/page-reader-server.ts', 'const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).download(keys[i], {}, { signal });'],
  ];
  for (const [rel, code] of allowedReads) {
    const v = storageWriteViolations(rel, code);
    console.log(`  ${v.length ? 'WRONGLY CAUGHT' : 'allowed'}  ${rel}: a session read`);
    if (v.length) bad++;
  }
  console.log(bad ? `\nself-test FAILED: ${bad}` : '\nself-test: every planted write caught, every session read allowed');
  process.exit(bad ? 1 : 0);
}

// ── The fakes, shared with the stubs through globalThis. ─────────────────────────
const U = '0f2c6a1e-7b4d-4c3a-9e21-5d8f0a6b7c11';   // the caller
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'; // another student
const KB = '3d4e5f60-7182-4394-a5b6-c7d8e9f0a1b2';    // the caller's subject
const FOREIGN_KB = 'b1c2d3e4-f506-4718-a92b-3c4d5e6f7081'; // the other student's subject

const db = {
  user: null,
  knowledge_bases: [],
  documents: [],
  chunks: [],
  sessionFiles: new Map(),
  serviceFiles: new Map(),
  events: [],
  serviceKeys: [],
  failAt: null,
  subjectReadFails: false,
  serviceRemoveFails: false,
  logs: [],
};
globalThis.__ss = db;

const SESSION_STUB = `
const D = () => globalThis.__ss;
// RLS as the schema has it: a student sees and writes rows of their own subjects only.
const ownKb = (kbId) => D().knowledge_bases.some((k) => k.id === kbId && k.user_id === D().user?.id);
const visible = (table, r) => table === 'knowledge_bases' ? r.user_id === D().user?.id : ownKb(r.kb_id);
function q(table) {
  const st = { op: 'select', filters: [], payload: null, count: false, head: false, limit: null };
  const run = () => {
    D().events.push('session:' + st.op + ':' + table);
    if (table === 'knowledge_bases' && st.op === 'select' && D().subjectReadFails) return { data: null, error: { message: 'forced subject read failure' }, count: null };
    const all = D()[table] ?? [];
    for (const f of st.filters) if (f.bad) return { data: null, error: { message: 'invalid input syntax for type uuid' }, count: null };
    const hit = all.filter((r) => visible(table, r) && st.filters.every((f) => f(r)));
    if (st.op === 'insert') {
      if (D().failAt === table) return { data: null, error: { message: 'forced ' + table + ' failure' }, count: null };
      const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({ id: p.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...p }));
      if (table !== 'knowledge_bases' && !list.every((r) => ownKb(r.kb_id))) return { data: null, error: { message: 'new row violates row-level security policy' }, count: null };
      all.push(...list);
      return { data: list, error: null, count: null };
    }
    if (st.op === 'delete') {
      for (const r of hit) {
        all.splice(all.indexOf(r), 1);
        if (table === 'documents') D().chunks = D().chunks.filter((c) => c.document_id !== r.id);
        if (table === 'knowledge_bases') { D().documents = D().documents.filter((d) => d.kb_id !== r.id); D().chunks = D().chunks.filter((c) => c.kb_id !== r.id); }
      }
      return { data: hit, error: null, count: null };
    }
    if (st.op === 'update') { for (const r of hit) Object.assign(r, st.payload); return { data: hit, error: null, count: null }; }
    const rows = st.limit === null ? hit : hit.slice(0, st.limit);
    return { data: st.head ? null : rows, error: null, count: st.count ? hit.length : null };
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const api = {
    select(_c, opts) { if (st.op === 'select') { st.count = !!opts?.count; st.head = !!opts?.head; } return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    delete() { st.op = 'delete'; return api; },
    eq(c, v) {
      const f = (r) => r[c] === v || (typeof v === 'string' && typeof r[c] === 'string' && UUID.test(v) && r[c] === v.toLowerCase());
      if ((c === 'id' || c === 'kb_id' || c === 'user_id') && typeof v === 'string' && !UUID.test(v)) f.bad = true;
      st.filters.push(f); return api;
    },
    neq(c, v) { st.filters.push((r) => r[c] !== v); return api; },
    gte() { return api; }, order() { return api; },
    limit(n) { st.limit = n; return api; },
    single: async () => { const r = run(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
    maybeSingle: async () => { const r = run(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
export function sessionClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: D().user } }),
      getSession: async () => ({ data: { session: { access_token: 'user-token' } } }),
    },
    from: (table) => q(table),
    rpc: async () => ({ data: null, error: null }),
    // The bucket as the student's session reaches it (002_storage.sql): insert under the own prefix, no delete.
    storage: { from: (bucket) => ({
      upload: async (key, body, opts) => {
        D().events.push('session-upload:' + key);
        if (key.split('/')[0] !== D().user?.id) return { error: { message: 'new row violates row-level security policy' } };
        D().sessionFiles.set(key, { bucket, body, opts });
        return { error: null };
      },
      remove: async (keys) => { D().events.push('session-remove:' + keys.join(',')); return { data: [], error: null }; },
    }) },
  };
}
export async function createClient() { return sessionClient(); }`;

const SERVICE_STUB = `
const D = () => globalThis.__ss;
export function createClient(url, key, opts) {
  D().serviceKeys.push(key);
  return {
    storage: { from: (bucket) => ({
      upload: async (k, body, o) => {
        D().events.push('service-upload:' + k);
        if (D().failAt === 'storage') return { data: null, error: { message: 'forced storage failure' } };
        if (D().serviceFiles.has(k) && !o?.upsert) return { data: null, error: { message: 'The resource already exists' } };
        D().serviceFiles.set(k, { bucket, body, opts: o });
        return { data: { path: k }, error: null };
      },
      // As storage does: only keys that exist are removed and answered.
      remove: async (keys) => {
        D().events.push('service-remove:' + keys.join(','));
        if (D().serviceRemoveFails) return { data: null, error: { message: 'forced remove failure' } };
        const gone = keys.filter((k) => D().serviceFiles.delete(k)).map((k) => ({ name: k }));
        return { data: gone, error: null };
      },
    }) },
    from() { throw new Error('the service client is used for storage only here'); },
  };
}`;

registerHooks({
  load(url, ctx, next) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
installTsxHooks(ROOT, {
  'next/server': `export const NextResponse = { json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); } };
export function after() {}`,
  '@/lib/supabase/server': SESSION_STUB,
  '@supabase/supabase-js': SERVICE_STUB,
  '@/lib/ai-allowance-server': 'export async function checkAiAllowance() { return { allowed: true }; } export async function recordAiSpend() {}',
  '@/lib/ingestion': `export function getServiceUrl() { return 'http://ingestion.invalid'; } export async function embedQuery() { return [0]; }`,
  '@/lib/study-events': 'export async function recordStudyEvent() {}',
  '@/lib/limits-server': `export async function checkKBLimit() { return { allowed: true, limit: 99, tier: 'free' }; } export async function checkDocumentLimit() { return { allowed: true, limit: 99, tier: 'free' }; }`,
  '@/lib/entitlement': `export async function getEntitlement() { return { tier: 'free' }; }`,
});

// The ingestion service answers ready; nothing else may leave.
let ingests = 0;
globalThis.fetch = async (url) => {
  if (String(url).startsWith('http://ingestion.invalid/ingest')) {
    ingests++;
    return new Response(JSON.stringify({ document_id: 'x', chunk_count: 3, status: 'ready', pages_total: null, pages_no_text: null, voyage_tokens: 10 }), { status: 200 });
  }
  throw new Error(`a request left the proof: ${url}`);
};
process.env.INGESTION_TOKEN = 'proof-token';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-proof-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-proof-key';
const origError = console.error;
console.error = (...a) => { db.logs.push(a.map(String).join(' ')); };

let pass = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) pass += 1; else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
};
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

const { ingestMaterial } = await load('src/lib/ingest-material.ts');
const { uploadRefusalMessage } = await load('src/lib/limit-messages.ts');
const { safeStorageName } = await load('src/lib/storage-key.ts');
// The same session stub the route gets, for driving ingestMaterial directly.
const { sessionClient } = await import('data:text/javascript,' + encodeURIComponent(SESSION_STUB));
let mod = null;
if (existsSync(resolvePath(ROOT, 'src/lib/document-storage-server.ts'))) mod = await load('src/lib/document-storage-server.ts');

function reset() {
  db.user = { id: U };
  db.knowledge_bases = [
    { id: KB, user_id: U, name: 'Biology' },
    { id: FOREIGN_KB, user_id: OTHER, name: 'Their subject' },
  ];
  db.documents = []; db.chunks = [];
  db.sessionFiles = new Map(); db.serviceFiles = new Map();
  db.events = []; db.serviceKeys = []; db.logs = [];
  db.failAt = null; db.subjectReadFails = false; db.serviceRemoveFails = false;
  ingests = 0;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-proof-key';
}
const sessionWrites = () => db.events.filter((e) => e.startsWith('session-upload') || e.startsWith('session-remove'));
const serviceUploads = () => db.events.filter((e) => e.startsWith('service-upload'));

async function ingest(kbId, name = 'ملخص الفصل 3.pdf', locale = 'ar') {
  const file = new File(['%PDF-1.4 proof'], name, { type: 'application/pdf' });
  const res = await ingestMaterial({ supabase: sessionClient(), user: db.user, kbId, file, fileType: 'pdf', safeLocale: locale, trace: { forwarded: false } });
  return { status: res.status, body: await res.json(), file };
}

// ══ 1. ingestMaterial, the caller's own subject. ═════════════════════════════════
console.log('1. ingestMaterial stores the file with the service role, same key, same options');
{
  reset();
  const r = await ingest(KB);
  const doc = db.documents[0];
  const stored = [...db.serviceFiles.entries()];
  const key = stored[0]?.[0];
  const expected = doc ? `${U}/${KB}/${doc.id}/${safeStorageName('ملخص الفصل 3.pdf')}` : '<no row>';
  check('the material is made (200, ready, 3 chunks), as before', r.status === 200 && r.body.success === true && r.body.chunk_count === 3, JSON.stringify(r));
  check('exactly one upload, by the service client; the session never touches storage', serviceUploads().length === 1 && sessionWrites().length === 0, db.events.join(' | '));
  check('the service client is made with SUPABASE_SERVICE_ROLE_KEY and nothing else', db.serviceKeys.length >= 1 && db.serviceKeys.every((k) => k === 'service-proof-key'), JSON.stringify(db.serviceKeys));
  check('the key is {userId}/{kbId}/{documentId}/{safe name}, the one written to documents.storage_path', key === expected && doc?.storage_path === key, `stored ${key}, row ${doc?.storage_path}, want ${expected}`);
  check('the options are exactly { upsert: false } (no content type, as before)', JSON.stringify(stored[0]?.[1]?.opts) === JSON.stringify({ upsert: false }), JSON.stringify(stored[0]?.[1]?.opts));
  check('the body is the very File the route received', stored[0]?.[1]?.body === r.file);
  const subjectAt = db.events.indexOf('session:select:knowledge_bases');
  const uploadAt = db.events.findIndex((e) => e.startsWith('service-upload'));
  check('the subject is checked under the session (RLS) BEFORE the service-role write', subjectAt >= 0 && uploadAt > subjectAt, db.events.join(' | '));
}

// ══ 2. Refusals: nothing written, the unchanged sentence. ════════════════════════
console.log('2. a subject that is not the caller\'s, a failed read, no service role, a storage error');
const NOTHING_SAVED = { ar: uploadRefusalMessage('ar', 'nothing-saved'), en: uploadRefusalMessage('en', 'nothing-saved') };
const refusals = [
  ['another student\'s subject', () => ingest(FOREIGN_KB)],
  ['a made-up subject id', () => ingest('c0ffee00-0000-4000-8000-000000000000', 'notes.txt', 'en')],
  ['a path-shaped subject id', () => ingest(`${KB}/../${FOREIGN_KB}`, 'notes.txt', 'en')],
  ['the subject read fails', () => { db.subjectReadFails = true; return ingest(KB, 'notes.txt', 'en'); }],
  ['no service role configured', () => { delete process.env.SUPABASE_SERVICE_ROLE_KEY; return ingest(KB); }],
  ['storage refuses the upload', () => { db.failAt = 'storage'; return ingest(KB, 'notes.txt', 'en'); }],
];
for (const [label, go] of refusals) {
  reset();
  const r = await go();
  const locale = r.body.error === NOTHING_SAVED.ar ? 'ar' : 'en';
  check(`${label}: 500 with the unchanged "nothing saved" sentence`, r.status === 500 && r.body.success === false && r.body.error === NOTHING_SAVED[locale], JSON.stringify(r.body));
  const uploadsAllowed = label === 'storage refuses the upload' ? 1 : 0;
  check(`${label}: no session write, ${uploadsAllowed} service upload attempt, no file kept, no row, nothing forwarded`,
    sessionWrites().length === 0 && serviceUploads().length === uploadsAllowed && db.serviceFiles.size === 0 && db.sessionFiles.size === 0 && db.documents.length === 0 && ingests === 0,
    `${db.events.join(' | ')}; rows ${db.documents.length}; ingests ${ingests}`);
  check(`${label}: the cause is logged as "Storage upload failed:"`, db.logs.some((l) => l.startsWith('Storage upload failed:')), db.logs.join(' / '));
}

// ══ 3. /api/sample. ═════════════════════════════════════════════════════════════
console.log('3. /api/sample uploads with the service role and its rollback removes the file');
const { POST } = await load('src/app/api/sample/route.ts');
const consent = await load('src/lib/ai-consent.ts');
const callSample = async (locale = 'en') => {
  const res = await POST(new Request('https://tryknowflow.com/api/sample', { method: 'POST', body: JSON.stringify({ locale }) }));
  return { status: res.status, body: await res.json() };
};
const sampleUser = () => ({ id: U, user_metadata: consent.aiConsentGrant(new Date()) });
{
  reset(); db.user = sampleUser(); db.knowledge_bases = [];
  const r = await callSample('en');
  const doc = db.documents[0];
  const [key, f] = [...db.serviceFiles.entries()][0] ?? [];
  check('first press: 200, one service upload, no session write', r.status === 200 && r.body.created === true && serviceUploads().length === 1 && sessionWrites().length === 0, `${JSON.stringify(r.body)} ${db.events.join(' | ')}`);
  check('first press: the key is {userId}/{kbId}/{documentId}/{name}.pdf and on the row', key === doc?.storage_path && new RegExp(`^${U}/${r.body.subjectId}/${doc?.id}/[A-Za-z0-9._-]+\\.pdf$`).test(key ?? ''), `${key} / ${doc?.storage_path}`);
  check('first press: options { upsert: false, contentType: application/pdf }, a PDF body', JSON.stringify(f?.opts) === JSON.stringify({ upsert: false, contentType: 'application/pdf' }) && Buffer.from(f?.body ?? []).subarray(0, 5).toString() === '%PDF-', JSON.stringify(f?.opts));
}
for (const failAt of ['documents', 'chunks']) {
  reset(); db.user = sampleUser(); db.knowledge_bases = []; db.failAt = failAt;
  const r = await callSample('ar');
  const removes = db.events.filter((e) => e.startsWith('service-remove'));
  check(`failure at ${failAt}: 500 sample_failed`, r.status === 500 && r.body.code === 'sample_failed', JSON.stringify(r.body));
  check(`failure at ${failAt}: the rollback REMOVES the stored file with the service role (none left)`, removes.length === 1 && db.serviceFiles.size === 0 && sessionWrites().length === 0, db.events.join(' | '));
  check(`failure at ${failAt}: the row and the subject this request made are gone`, db.documents.length === 0 && db.chunks.length === 0 && db.knowledge_bases.length === 0);
}
{
  reset(); db.user = sampleUser(); db.knowledge_bases = []; db.failAt = 'storage';
  const r = await callSample('ar');
  check('failure at the upload: 500 sample_failed, nothing to remove, nothing left', r.status === 500 && db.serviceFiles.size === 0 && db.events.every((e) => !e.startsWith('service-remove')) && db.knowledge_bases.length === 0, db.events.join(' | '));
}
{
  reset(); db.user = sampleUser(); db.knowledge_bases = []; db.failAt = 'chunks'; db.serviceRemoveFails = true;
  const r = await callSample('ar');
  check('a removal that fails is logged with the kf-storage-left tag, the answer unchanged', r.status === 500 && r.body.code === 'sample_failed' && db.logs.some((l) => l.includes('kf-storage-left')), db.logs.join(' / '));
}

// ══ 4. The key rule. ════════════════════════════════════════════════════════════
console.log('4. the module\'s key rule');
check('src/lib/document-storage-server.ts exists and exports ownDocumentKey, storeOwnDocumentFile, removeOwnDocumentFile',
  !!mod && typeof mod.ownDocumentKey === 'function' && typeof mod.storeOwnDocumentFile === 'function' && typeof mod.removeOwnDocumentFile === 'function');
if (mod) {
  const D = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const cases = [
    [`${U}/${KB}/${D}/notes.pdf`, true, 'the caller, the subject, a document id, a flat name'],
    [`${OTHER}/${KB}/${D}/notes.pdf`, false, 'another user first'],
    [`${U}/${FOREIGN_KB}/${D}/notes.pdf`, false, 'another subject second'],
    [`${U}/${KB}/notes.pdf`, false, 'the pre-#110 shape (no document id)'],
    [`${U}/${KB}/${D}/a/notes.pdf`, false, 'a nested name'],
    [`${U}/${KB}/${D}/..`, false, 'a dot name'],
    [`${U}/${KB}/${D}/`, false, 'an empty name'],
    [`${U}/page-photos/${D}/1.jpg`, false, 'a camera photo key'],
    [`${U.toUpperCase()}/${KB}/${D}/notes.pdf`, false, 'an upper-case user id'],
  ];
  for (const [key, want, label] of cases) check(`ownDocumentKey: ${label} -> ${want}`, mod.ownDocumentKey(U, KB, key) === want);
  check('ownDocumentKey: a user id that is not a UUID is refused', mod.ownDocumentKey('user-1', KB, `user-1/${KB}/${D}/n.pdf`) === false);
  reset();
  const ok = await mod.removeOwnDocumentFile(U, KB, `${OTHER}/${KB}/${D}/n.pdf`);
  check('removeOwnDocumentFile refuses a key outside the caller\'s subject, before any client is made', ok === false && db.serviceKeys.length === 0 && db.events.length === 0);
}

// ══ 5. The guard over src/. ═══════════════════════════════════════════════════════
console.log('5. no student-session storage write left in src/');
{
  const violations = srcFiles().flatMap((p) => storageWriteViolations(relative(ROOT, p).replaceAll('\\', '/'), readFileSync(p, 'utf8').replace(/\r\n/g, '\n')));
  check('every storage write under src/ goes through admin in an allowed file', violations.length === 0, violations.join('\n        '));
  const sample = read('src/app/api/sample/route.ts');
  check('/api/sample no longer claims the stored file cannot be removed', !/CANNOT BE\s*\n?\s*\*?\s*REMOVED HERE/.test(sample) && !/Refused by the bucket's policies today/.test(sample));
}

console.error = origError;
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
