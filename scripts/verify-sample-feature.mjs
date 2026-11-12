/**
 * Executable proof for the sample file feature (audit cause 9,
 * docs/plans/sample-file.md): the pure helpers and the REAL `/api/sample`
 * handler, driven against an in-memory database.
 *
 *  1. THE DAY'S UPLOADS. `keptUploadsToday` does not count a row with
 *     `is_sample: true`, and counts every other row exactly as before.
 *  2. THE ROWS. `sampleDocumentRow` is ready at once (status and embedding
 *     status `ready`, 2 pages, 0 without text, `is_sample` true, a storage
 *     path, the file's whole text for the summary and the quiz);
 *     `sampleChunkRows` holds the committed chunks, one per chunk, each
 *     vector 1024 numbers in pgvector's text form; `sampleMarkdown` joins the
 *     overlapping chunks back into the approved text.
 *  3. THE ROUTE, in order: no session 401; no AI permission 403
 *     `ai_consent_required` and NOTHING written; with it, one subject, one
 *     stored PDF (the committed bytes, at {user}/{subject}/{document}/name),
 *     one document, the chunks in ONE insert; a second call returns the same
 *     subject and creates nothing; at the subject limit 403 `subject_limit`
 *     and nothing written; an empty subject of the sample's name is reused;
 *     a failure at the upload, the document insert or the chunk insert
 *     removes what the request created and answers 500 `sample_failed`.
 *     `increment_usage` is never called and no request leaves (fetch throws).
 *  4. THE SOURCE: the route has no service role, no `/api/ingest`, no
 *     `enforceUploadLimit`, no `increment_usage`; the consent check stands
 *     before every write and the limit check before the subject insert; the
 *     button is drawn only inside `stepsFirst`; the ready question is offered
 *     only for a sample subject and only fills the field.
 *
 * FORCED CASES (--self-test): the proof run with one thing wrong must fail.
 *   count    keptUploadsToday counting the sample row
 *   consent  the route's consent check removed
 *   double   the route's idempotency read removed
 *
 * What is stubbed: `NextResponse`, the Supabase server client (the in-memory
 * database below), `getEntitlement` (free tier). Everything else is real.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-sample-feature.mjs [--self-test | --plant <name>]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PLANTS = ['count', 'consent', 'double'];
const args = process.argv.slice(2);

if (args[0] === '--self-test') {
  let bad = 0;
  for (const p of PLANTS) {
    const r = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), '--plant', p], { encoding: 'utf8', cwd: ROOT });
    const caught = r.status === 1 && /FAIL/.test(r.stdout);
    console.log(`${caught ? 'ok  ' : 'MISS'} forced case "${p}" ${caught ? 'is caught' : `was NOT caught (exit ${r.status})`}: ${(r.stdout.match(/ {2}! .*/) || [''])[0].trim()}`);
    if (!caught) bad++;
  }
  process.exit(bad ? 1 : 0);
}
const plant = args[0] === '--plant' ? args[1] : null;
if (plant && !PLANTS.includes(plant)) { console.log(`unknown forced case ${plant}`); process.exit(2); }

const has = (p) => existsSync(resolvePath(ROOT, p));
// A Windows checkout holds CRLF (core.autocrlf); every pattern below is written for LF.
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const finish = () => {
  if (failures.length === 0) { console.log(`PASS: ${passed} checks hold for the sample file feature.`); process.exit(0); }
  console.log(`FAIL: ${failures.length} problem(s), ${passed} checks hold`);
  for (const f of failures) console.log('  ! ' + f);
  process.exit(1);
};

// ── The in-memory database, shared with the stub through globalThis. ──────────
const db = { knowledge_bases: [], documents: [], chunks: [], files: new Map(), rpc: 0, inserts: [], user: null, failAt: null };
globalThis.__sf = db;
const SUPABASE_STUB = `
const D = () => globalThis.__sf;
function q(table) {
  const st = { op: 'select', filters: [], payload: null, count: false, head: false, limit: null };
  const run = () => {
    const all = D()[table];
    const hit = all.filter((r) => st.filters.every((f) => f(r)));
    if (st.op === 'insert') {
      if (D().failAt === table) return { data: null, error: { message: 'forced ' + table + ' failure' }, count: null };
      const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({ id: p.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...p }));
      all.push(...list);
      D().inserts.push({ table, rows: list.length });
      return { data: list, error: null, count: null };
    }
    if (st.op === 'delete') {
      for (const r of hit) {
        all.splice(all.indexOf(r), 1);
        // on delete cascade, as the schema has it
        if (table === 'documents') D().chunks = D().chunks.filter((c) => c.document_id !== r.id);
        if (table === 'knowledge_bases') { D().documents = D().documents.filter((d) => d.kb_id !== r.id); D().chunks = D().chunks.filter((c) => c.kb_id !== r.id); }
      }
      return { data: hit, error: null, count: null };
    }
    const rows = st.limit === null ? hit : hit.slice(0, st.limit);
    return { data: st.head ? null : rows, error: null, count: st.count ? hit.length : null };
  };
  const api = {
    select(_cols, opts) { if (st.op === 'select') { st.count = !!opts?.count; st.head = !!opts?.head; } return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    delete() { st.op = 'delete'; return api; },
    eq(c, v) { st.filters.push((r) => r[c] === v); return api; },
    neq(c, v) { st.filters.push((r) => r[c] !== v); return api; },
    limit(n) { st.limit = n; return api; },
    order() { return api; },
    single: async () => { const r = run(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
export async function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: D().user } }) },
    from: (table) => q(table),
    rpc: async () => { D().rpc++; return { data: null, error: null }; },
    storage: { from: (bucket) => ({
      upload: async (key, body, opts) => {
        if (D().failAt === 'storage') return { error: { message: 'forced storage failure' } };
        if (D().files.has(key) && !opts?.upsert) return { error: { message: 'exists' } };
        D().files.set(key, { bucket, bytes: Buffer.from(body), contentType: opts?.contentType });
        return { error: null };
      },
      remove: async (keys) => { for (const k of keys) D().files.delete(k); return { data: [], error: null }; },
    }) },
  };
}`;

// `import x from '….json'` (src/lib/sample-file-data.ts), which Next bundles.
registerHooks({
  load(url, ctx, next) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
installTsxHooks(ROOT, {
  'next/server': `export const NextResponse = { json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); } };`,
  '@/lib/supabase/server': SUPABASE_STUB,
  '@/lib/entitlement': `export async function getEntitlement() { return { tier: 'free' }; }`,
});
// Nothing may leave the machine: the route makes no request of its own.
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('a request left the route'); };

const NOW = new Date('2026-11-12T10:00:00.000Z');
const today = '2026-11-12T08:00:00.000Z';

// ══ 1. The day's uploads. ═════════════════════════════════════════════════════
{
  const mod = await load('src/lib/upload-allowance.ts');
  const kept = plant === 'count' ? (rows, now) => mod.keptUploadsToday(rows.map(({ is_sample, ...r }) => r), now) : mod.keptUploadsToday;
  const real = { status: 'ready', created_at: today };
  check(kept([real, { ...real, is_sample: true }], NOW) === 1, `keptUploadsToday counts the sample row: ${kept([real, { ...real, is_sample: true }], NOW)} for one real upload and the sample (want 1)`);
  check(kept([{ ...real, is_sample: true }], NOW) === 0, 'keptUploadsToday: the sample alone must count 0');
  check(kept([real, { ...real, is_sample: false }, { ...real, is_sample: null }, { status: 'processing', created_at: today }], NOW) === 4, 'keptUploadsToday: rows with is_sample false, null or absent count as before (want 4)');
  check(kept([{ status: 'error', created_at: today }, { status: 'ready', created_at: '2026-11-11T23:59:59.000Z' }, { status: 'ready', created_at: null }], NOW) === 0, 'keptUploadsToday: a failed row, yesterday\'s row and a row with no date still count 0');
}

// ══ 2. The rows. ══════════════════════════════════════════════════════════════
check(has('src/lib/sample-file.ts'), 'src/lib/sample-file.ts does not exist (the sample file\'s pure helpers)');
check(has('src/lib/sample-file-data.ts'), 'src/lib/sample-file-data.ts does not exist (the committed chunks, imported)');
check(has('src/app/api/sample/route.ts'), 'src/app/api/sample/route.ts does not exist');
if (!has('src/lib/sample-file.ts') || !has('src/lib/sample-file-data.ts') || !has('src/app/api/sample/route.ts')) finish();

const S = await load('src/lib/sample-file.ts');
const { sampleData } = await load('src/lib/sample-file-data.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');
const manifest = JSON.parse(read('data/sample-file/manifest.json'));
const approved = read('docs/copy-drafts/sample_file_cell.md');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const approvedText = (lang) => norm([...approved.split(lang === 'ar' ? '## Arabic file' : '## English file')[1].split(/\n## /)[0].matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n'));

for (const lang of ['ar', 'en']) {
  const data = sampleData(lang);
  const want = lang === 'ar' ? 3 : 1;
  check(data.lang === lang && data.chunks.length === want, `sampleData(${lang}): ${data.chunks.length} chunk(s) of lang ${data.lang} (want ${want})`);
  const row = S.sampleDocumentRow({ id: 'doc-1', kbId: 'kb-1', filename: 'x.pdf', storagePath: 'u/kb-1/doc-1/x.pdf', data });
  check(row.status === 'ready' && row.embedding_status === 'ready', `${lang} document row: status ${row.status}, embedding_status ${row.embedding_status} (want ready, ready)`);
  check(row.is_sample === true && row.chunk_count === want && row.pages_total === 2 && row.pages_no_text === 0, `${lang} document row: is_sample ${row.is_sample}, chunk_count ${row.chunk_count}, pages ${row.pages_total}/${row.pages_no_text}`);
  check(row.file_type === 'pdf' && row.storage_path === 'u/kb-1/doc-1/x.pdf' && row.id === 'doc-1' && row.kb_id === 'kb-1', `${lang} document row: type, path, id or subject is wrong`);
  check(norm(row.markdown_content) === approvedText(lang), `${lang} document row: markdown_content is not the approved text (${norm(row.markdown_content).length} characters against ${approvedText(lang).length})`);
  const rows = S.sampleChunkRows(data, 'doc-1', 'kb-1');
  check(rows.length === want && rows.every((r, i) => r.chunk_index === i && r.document_id === 'doc-1' && r.kb_id === 'kb-1'), `${lang} chunk rows: count, order or ids are wrong`);
  check(rows.every((r) => typeof r.embedding === 'string' && Array.isArray(JSON.parse(r.embedding)) && JSON.parse(r.embedding).length === manifest.dimensions), `${lang} chunk rows: an embedding is not ${manifest.dimensions} numbers in pgvector's text form`);
  check(rows.every((r, i) => r.content === data.chunks[i].content && r.token_count === data.chunks[i].token_count && r.page_kind === 'page' && r.page_start >= 1 && r.page_end <= 2), `${lang} chunk rows: content, token_count or page columns differ from the committed JSON`);
  check(Object.keys(rows[0]).sort().join(',') === 'chunk_index,content,document_id,embedding,kb_id,page_end,page_kind,page_start,token_count', `${lang} chunk rows: columns ${Object.keys(rows[0]).sort().join(',')} are not the ones the ingestion service writes`);
}
check(S.sampleMarkdown([{ content: 'abc def' }, { content: 'def ghi' }, { content: 'xyz' }]) === 'abc def ghixyz', 'sampleMarkdown: overlapping chunks must be joined once, others appended');
check(S.sampleFileName(ar.dashboard.home.sampleFileName) === 'الخلية.pdf' && S.sampleFileName(en.dashboard.home.sampleFileName) === 'The cell.pdf', 'the stored file names must be الخلية.pdf and The cell.pdf');
check(ar.dashboard.home.sampleSubjectName === 'مثال' && en.dashboard.home.sampleSubjectName === 'Sample', 'the subject names must be مثال and Sample');
check(ar.dashboard.home.sampleButton === 'جرّب بملف جاهز', 'the Arabic button must read جرّب بملف جاهز');
check(ar.dashboard.agent.sampleQuestion === 'ما دور الميتوكوندريا في الخلية؟' && en.dashboard.agent.sampleQuestion === 'What do mitochondria do in the cell?', 'the ready question is not the approved one');
check(S.sampleQuestionFor('kb-s', ['kb-s'], 'Q') === 'Q' && S.sampleQuestionFor('kb-x', ['kb-s'], 'Q') === null && S.sampleQuestionFor('kb-x', [], 'Q') === null, 'the ready question must be offered for a sample subject only');
check(S.sampleAskHref('ar', 'abc') === '/ar/dashboard/agent?kb=abc', 'sampleAskHref must open the subject\'s Ask');
{
  const marked = S.markSampleRows([{ id: 'a' }, { id: 'b' }], new Set(['b']));
  check(marked[0].is_sample === false && marked[1].is_sample === true, 'markSampleRows must mark exactly the sample ids');
}

// ══ 3. The route. ═════════════════════════════════════════════════════════════
const { POST: realPOST } = await load('src/app/api/sample/route.ts');
const consented = { id: 'user-1', user_metadata: { ai_consent: { version: 1, at: '2026-10-09T00:00:00.000Z' } } };
const reset = () => { db.knowledge_bases = []; db.documents = []; db.chunks = []; db.files = new Map(); db.rpc = 0; db.inserts = []; db.failAt = null; db.user = consented; };
const snapshot = () => ({ kbs: db.knowledge_bases.length, docs: db.documents.length, chunks: db.chunks.length, files: db.files.size });
const empty = (s) => s.kbs === 0 && s.docs === 0 && s.chunks === 0 && s.files === 0;
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const call = (locale) => quiet(async () => {
  // The forced cases change what the handler sees, never the handler's file.
  if (plant === 'consent' && db.user && !db.user.user_metadata?.ai_consent) db.user = { ...db.user, user_metadata: consented.user_metadata };
  if (plant === 'double') db.documents = db.documents.map((d) => ({ ...d, is_sample: false }));
  const res = await realPOST(new Request('http://x/api/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale }) }));
  return { status: res.status, body: await res.json() };
});
const sha = (b) => createHash('sha256').update(b).digest('hex');

// no session
reset(); db.user = null;
{ const r = await call('ar'); check(r.status === 401 && empty(snapshot()), `no session: HTTP ${r.status}, wrote ${JSON.stringify(snapshot())} (want 401, nothing)`); }
// no AI permission
reset(); db.user = { id: 'user-1', user_metadata: {} };
{
  const r = await call('ar');
  check(r.status === 403 && r.body.code === 'ai_consent_required', `no AI permission: HTTP ${r.status} ${r.body.code} (want 403 ai_consent_required)`);
  check(empty(snapshot()) && db.inserts.length === 0, `no AI permission: something was written (${JSON.stringify(snapshot())})`);
  check(r.body.error === ar.dashboard.aiConsent.declined, 'no AI permission: the refusal is not the approved declined sentence in the request\'s language');
}
// the first press, in each language
for (const [locale, dict, lang] of [['ar', ar, 'ar'], ['en', en, 'en']]) {
  reset();
  const r = await call(locale);
  const s = snapshot();
  const want = lang === 'ar' ? 3 : 1;
  check(r.status === 200 && r.body.success === true && r.body.created === true, `${locale} first press: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  check(s.kbs === 1 && s.docs === 1 && s.chunks === want && s.files === 1, `${locale} first press: wrote ${JSON.stringify(s)} (want 1 subject, 1 document, ${want} chunk(s), 1 file)`);
  const kb = db.knowledge_bases[0], doc = db.documents[0];
  check(kb?.name === dict.dashboard.home.sampleSubjectName && kb?.user_id === 'user-1' && kb?.language === lang && r.body.subjectId === kb?.id, `${locale} first press: the subject is ${JSON.stringify(kb)}`);
  check(doc?.filename === `${dict.dashboard.home.sampleFileName}.pdf` && doc?.is_sample === true && doc?.status === 'ready' && doc?.kb_id === kb?.id, `${locale} first press: the document is ${JSON.stringify({ ...doc, markdown_content: undefined })}`);
  const [key, file] = [...db.files.entries()][0] ?? [];
  check(key === doc?.storage_path && new RegExp(`^user-1/${kb?.id}/${doc?.id}/[A-Za-z0-9._-]+\\.pdf$`).test(key ?? ''), `${locale} first press: the stored key ${key} is not {user}/{subject}/{document}/name, or differs from storage_path ${doc?.storage_path}`);
  check(file?.bucket === 'documents' && file?.contentType === 'application/pdf' && sha(file?.bytes ?? Buffer.alloc(0)) === manifest.pdf_sha256[lang], `${locale} first press: the stored bytes are not the committed PDF (sha256 ${sha(file?.bytes ?? Buffer.alloc(0)).slice(0, 12)}, manifest ${manifest.pdf_sha256[lang].slice(0, 12)})`);
  const chunkInserts = db.inserts.filter((i) => i.table === 'chunks');
  check(chunkInserts.length === 1 && chunkInserts[0].rows === want, `${locale} first press: the chunks went in ${chunkInserts.length} insert(s) (want one insert of ${want})`);
  check(db.chunks.every((c) => c.document_id === doc?.id && c.kb_id === kb?.id), `${locale} first press: a chunk points at another document or subject`);
  check(db.rpc === 0 && fetches === 0, `${locale} first press: increment_usage or another rpc was called ${db.rpc} time(s), ${fetches} request(s) left`);
  // the second press
  const before = snapshot(), insertsBefore = db.inserts.length;
  const again = await call(locale);
  const after = snapshot();
  check(again.status === 200 && again.body.subjectId === kb?.id && again.body.created === false, `${locale} second press: HTTP ${again.status} ${JSON.stringify(again.body)} (want the first subject, created false)`);
  check(JSON.stringify(before) === JSON.stringify(after) && db.inserts.length === insertsBefore, `${locale} second press: something was created (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
}
// the subject limit (free tier: FREE_LIMITS.knowledge_bases)
{
  const { FREE_LIMITS } = await load('src/lib/limits.ts');
  reset();
  for (let i = 0; i < FREE_LIMITS.knowledge_bases; i++) db.knowledge_bases.push({ id: `kb-${i}`, user_id: 'user-1', name: `Subject ${i}` });
  db.documents.push({ id: 'd-0', kb_id: 'kb-0', status: 'ready' });
  const before = snapshot();
  const r = await call('en');
  check(r.status === 403 && r.body.code === 'subject_limit' && r.body.limit === FREE_LIMITS.knowledge_bases && r.body.tier === 'free', `at the subject limit: HTTP ${r.status} ${JSON.stringify(r.body)} (want 403 subject_limit with the limit and the tier)`);
  check(JSON.stringify(before) === JSON.stringify(snapshot()) && db.inserts.length === 0, 'at the subject limit: something was written');
  // an empty subject of the sample's name is reused, even at the limit
  db.knowledge_bases[1].name = en.dashboard.home.sampleSubjectName;
  const reused = await call('en');
  check(reused.status === 200 && reused.body.subjectId === 'kb-1' && db.knowledge_bases.length === FREE_LIMITS.knowledge_bases, `an empty "Sample" subject must be reused: HTTP ${reused.status} ${JSON.stringify(reused.body)}, ${db.knowledge_bases.length} subjects`);
  check(db.documents.filter((d) => d.kb_id === 'kb-1').length === 1 && db.chunks.length === 1, 'the reused subject must hold the sample document and its chunk');
}
// a "Sample" subject that already holds a file is NOT reused
reset();
db.knowledge_bases.push({ id: 'kb-full', user_id: 'user-1', name: en.dashboard.home.sampleSubjectName });
db.documents.push({ id: 'd-x', kb_id: 'kb-full', status: 'ready' });
{ const r = await call('en'); check(r.status === 200 && r.body.subjectId !== 'kb-full' && db.knowledge_bases.length === 2, 'a subject named "Sample" that holds a file must not be reused'); }
// failures after the subject insert
for (const failAt of ['storage', 'documents', 'chunks']) {
  reset(); db.failAt = failAt;
  const r = await call('ar');
  const s = snapshot();
  check(r.status === 500 && r.body.code === 'sample_failed', `failure at ${failAt}: HTTP ${r.status} ${r.body.code} (want 500 sample_failed)`);
  check(empty(s), `failure at ${failAt}: left behind ${JSON.stringify(s)} (want nothing)`);
  check(!JSON.stringify(r.body).includes('forced'), `failure at ${failAt}: the internal error text reached the reply`);
}
// a failure in a REUSED subject keeps the subject (it was not this request's)
reset(); db.failAt = 'chunks';
db.knowledge_bases.push({ id: 'kb-old', user_id: 'user-1', name: ar.dashboard.home.sampleSubjectName });
{ const r = await call('ar'); const s = snapshot(); check(r.status === 500 && s.kbs === 1 && s.docs === 0 && s.chunks === 0 && s.files === 0, `failure in a reused subject: ${JSON.stringify(s)} (want the old subject kept, nothing else)`); }
check(db.rpc === 0 && fetches === 0, `across every case: ${db.rpc} rpc call(s), ${fetches} request(s) left (want 0, 0)`);

// ══ 4. The source. ════════════════════════════════════════════════════════════
{
  const src = read('src/app/api/sample/route.ts');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check(!/service[_-]?role|SERVICE_ROLE|createAdminClient|supabase\/admin/i.test(code), 'the route must not use the service role');
  check(!/api\/ingest|enforceUploadLimit|enforceLimit|increment_usage|\.rpc\(|fetch\(/.test(code), 'the route must not call /api/ingest, a usage counter, an rpc or any request');
  const at = (s) => code.indexOf(s);
  const firstWrite = Math.min(...['.insert(', '.upload(', '.delete('].map(at).filter((i) => i >= 0));
  check(at('hasAiConsent(user)') > 0 && at('hasAiConsent(user)') < firstWrite, 'the route: the AI permission check must stand before every write');
  check(at("eq('is_sample', true)") > at('hasAiConsent(user)') && at("eq('is_sample', true)") < firstWrite, 'the route: the existing-sample read must stand after the permission check and before every write');
  check(at('checkKBLimit(user.id)') > 0 && at('checkKBLimit(user.id)') < at(".from('knowledge_bases')\n        .insert("), 'the route: the subject limit must be checked before the subject insert');
  check(/outputFileTracingIncludes:\s*\{\s*'\/api\/sample':\s*\['\.\/data\/sample-file\/cell\.ar\.pdf', '\.\/data\/sample-file\/cell\.en\.pdf'\]/.test(read('next.config.ts')), 'next.config.ts must trace the two PDFs into /api/sample');

  const home = read('src/components/dashboard/StudentHome.tsx');
  check((home.match(/<SampleFileButton/g) || []).length === 1 && /\{stepsFirst && <SampleFileButton /.test(home), 'StudentHome: the sample button must be drawn once, only inside stepsFirst');
  const btn = read('src/components/dashboard/SampleFileButton.tsx');
  check(/await ensureAiConsent\(\)/.test(btn) && btn.indexOf('await ensureAiConsent()') < btn.indexOf("fetch('/api/sample'"), 'SampleFileButton: the permission sheet must come before the request');
  check(/t\.dashboard\.aiConsent\.declined/.test(btn), 'SampleFileButton: "Not now" must show the approved declined sentence');
  check(/disabled=\{adding\}/.test(btn), 'SampleFileButton: the button must be disabled while the sample is added');
  const box = read('src/components/agent/ChatBox.tsx');
  check(/onClick=\{\(\) => \{ setInput\(sampleQuestion\); fieldRef\.current\?\.focus\(\); \}\}/.test(box), 'ChatBox: the ready question must fill the field and send nothing');
  check(!/handleSend\(sampleQuestion\)/.test(box), 'ChatBox: the ready question must not be sent by its chip');
  const sel = read('src/components/agent/KBSelector.tsx');
  check(/sampleQuestion=\{sampleQuestionFor\(selectedKb\.id, sampleKbIds, t\.dashboard\.agent\.sampleQuestion\)\}/.test(sel), 'KBSelector: the ready question must be offered through sampleQuestionFor, for a sample subject only');
  const ingest = read('src/app/api/ingest/route.ts');
  check(/keptUploadsToday\(markSampleRows\(data, sampleIds\)\)/.test(ingest), '/api/ingest: the day\'s uploads must leave the sample out');
  const dash = read('src/app/[locale]/dashboard/page.tsx');
  check(/keptUploadsToday\(markSampleRows\(/.test(dash), 'the home: the uploads ring must leave the sample out');
  const mig = read('supabase/migrations/20261112_documents_is_sample.sql').replace(/^--.*$/gm, '');
  check(/alter table public\.documents\s+add column if not exists is_sample boolean not null default false;/.test(mig), 'the migration must add is_sample boolean not null default false, re-runnable');
  check(!/\b(drop|delete|update|grant|revoke|policy)\b/i.test(mig), 'the migration must be the one additive column and its comment');
  const signed = read('.github/workflows/ios-signed-in.yml');
  check(!/kf-sample-button[^"\n]*\)\s*\.click\(|kf-sample-button[^\n]*\.click\(\)/.test(signed), 'ios-signed-in.yml must never press the sample button (it would write to the reviewer account)');
}

finish();
