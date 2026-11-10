/**
 * Executable proof for activation fix 5 (the 2026-11-09 audit, causes #6, #10
 * and #7): three ways a new student's first tries were wasted.
 *
 *  #6  Asking in a subject with no file Ask can answer from used a daily
 *      question and a monthly conversation and called the model. Now the
 *      REAL `/api/agent` handler answers 409 `no_material` first: the
 *      `increment_usage` RPC is never called, no conversation is inserted,
 *      no embedding, no model call. A control subject with a ready file
 *      still counts and answers.
 *  #10 A failed processing used one of the 5 daily uploads. Now the REAL
 *      `/api/ingest` handler counts the day's uploads from today's documents
 *      that did not fail: 5 failures then 5 good files all go through, the
 *      11th is refused with the daily sentence. The bound: failures alone
 *      stop at the attempt ceiling (5 + 5 = 10 attempts), the 11th refused
 *      with the failures sentence, before storage or the ingestion service.
 *  #7  The picked file is held through the AI permission sheet: on "I agree"
 *      the same file is the one sent; on "Not now" nothing is sent and the
 *      file is released, and the drop zone shows the tile with the
 *      `declined` sentence, not the failure box.
 *
 * What is stubbed, and why that is honest: `NextResponse` (a response reads
 * as data); `getEntitlement` (free tier); the Supabase server client, an
 * in-memory database whose `documents` table filters by the columns the
 * routes filter on and whose `increment_usage` adds one per call exactly as
 * the SQL function does; the Anthropic SDK and `embedQuery` (counted, nothing
 * leaves the machine); the ingestion service (global `fetch`: it writes the
 * row `ready` and acks, or answers 500, as the real service does); and
 * `recordStudyEvent`. Everything else is the real code.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-activation-5.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const has = (p) => existsSync(resolvePath(ROOT, p));
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

// ── The in-memory database, shared by the stubs through globalThis. ───────────
const db = { documents: [], conversations: [], messages: [], usage: new Map(), modelCalls: 0, embeds: 0, ingests: 0, storage: 0 };
globalThis.__a5 = db;

const SUPABASE_STUB = `
const D = () => globalThis.__a5;
let seq = 0;
function q(table) {
  const st = { op: 'select', filters: [], payload: null, count: false, head: false };
  const rows = () => (D()[table] ||= []);
  const run = () => {
    const all = rows();
    const hit = all.filter((r) => st.filters.every((f) => f(r)));
    if (st.op === 'insert') {
      const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({ id: p.id ?? 'row-' + (++seq), created_at: new Date().toISOString(), ...p }));
      all.push(...list);
      return { data: list, error: null, count: null };
    }
    if (st.op === 'update') {
      for (const r of hit) Object.assign(r, st.payload);
      return { data: hit, error: null, count: null };
    }
    return { data: st.head ? null : hit, error: null, count: st.count ? hit.length : null };
  };
  const api = {
    select(_cols, opts) { if (st.op === 'select') { st.count = !!opts?.count; st.head = !!opts?.head; } return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    upsert(p) { st.op = 'insert'; st.payload = p; return api; },
    eq(c, v) { st.filters.push((r) => r[c] === v); return api; },
    neq(c, v) { st.filters.push((r) => r[c] !== v); return api; },
    gte(c, v) { st.filters.push((r) => r[c] >= v); return api; },
    in(c, vs) { st.filters.push((r) => vs.includes(r[c])); return api; },
    order() { return api; },
    limit() { return api; },
    single: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: 'no row' } }; },
    maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: null }; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
export async function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: { ai_consent: { version: 1, at: '2026-10-09T00:00:00.000Z' } } } } }),
      getSession: async () => ({ data: { session: { access_token: 'user-token' } } }),
    },
    from: (table) => q(table),
    rpc: async (fn, args) => {
      if (fn === 'increment_usage') {
        const n = (D().usage.get(args.p_kind) || 0) + 1;
        D().usage.set(args.p_kind, n);
        return { data: n, error: null };
      }
      return { data: [], error: null };
    },
    storage: { from: () => ({ upload: async () => { D().storage++; return { error: null }; } }) },
  };
}`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async () => {
        globalThis.__a5.modelCalls++;
        return (async function* () {
          yield { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } };
          yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } };
        })();
      },
    };
  }
}`;

installTsxHooks(ROOT, {
  'next/server': `export const NextResponse = { json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); } };`,
  '@anthropic-ai/sdk': ANTHROPIC_STUB,
  '@/lib/supabase/server': SUPABASE_STUB,
  '@/lib/entitlement': `export async function getEntitlement() { return { tier: 'free' }; }`,
  '@/lib/ingestion': `export async function embedQuery() { globalThis.__a5.embeds++; return [0]; } export function getServiceUrl() { return 'http://ingestion.invalid'; }`,
  '@/lib/study-events': `export async function recordStudyEvent() {}`,
});

const failures = [];
let passed = 0;
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const realError = console.error;
const quiet = async (fn) => { const e = console.error, w = console.warn, l = console.log; console.error = () => {}; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; console.log = l; } };

// The burst guard (2 s between questions) is not under test.
let clock = Date.now();
Date.now = () => (clock += 3000);

// ══ 1. Cause #6: asking in a subject with no file to answer from. ══════════
realError('===== #6 ask with zero material');
check(has('src/lib/ask-material.ts'), 'src/lib/ask-material.ts does not exist (the no-material rule)');
if (has('src/lib/ask-material.ts')) {
  const { hasAnswerableMaterial, NO_MATERIAL_REFUSAL } = await load('src/lib/ask-material.ts');
  check(NO_MATERIAL_REFUSAL === 'no_material', 'the refusal code must be no_material');
  check(hasAnswerableMaterial([]) === false, 'no rows: not answerable');
  check(hasAnswerableMaterial(null) === false, 'null rows: not answerable');
  check(hasAnswerableMaterial([{ status: 'ready', embedding_status: 'ready', chunk_count: 0 }]) === false, 'a ready file with no text (#128) is not answerable');
  check(hasAnswerableMaterial([{ status: 'processing', embedding_status: 'processing', chunk_count: null }]) === false, 'a processing file is not answerable');
  check(hasAnswerableMaterial([{ status: 'error', embedding_status: 'error', chunk_count: null }]) === false, 'a failed file is not answerable');
  check(hasAnswerableMaterial([{ status: 'ready', embedding_status: 'ready', chunk_count: 7 }]) === true, 'a ready file with text is answerable');
  check(hasAnswerableMaterial([{ status: 'ready', embedding_status: 'pending', chunk_count: 0 }]) === true, 'a pre-RAG ready row stays answerable, as #128 rules');
}
{
  const { POST } = await load('src/app/api/agent/route.ts');
  const ask = (kb_id) => quiet(async () => {
    const res = await POST(new Request('http://x/api/agent', { method: 'POST', body: JSON.stringify({ message: 'ما هي مرونة الطلب؟', kb_id, conversation_id: null, locale: 'ar' }) }));
    const body = await res.text();
    return { status: res.status, refusal: res.headers.get('X-KF-Refusal'), body };
  });
  const before = () => ({ q: db.usage.get('query') || 0, convos: db.conversations.length, msgs: db.messages.length, model: db.modelCalls, embeds: db.embeds });
  const cases = [
    ['a subject with no file at all', 'kb-empty', []],
    ['a subject whose only file has no text', 'kb-notext', [{ kb_id: 'kb-notext', status: 'ready', embedding_status: 'ready', chunk_count: 0 }]],
    ['a subject whose only file is processing', 'kb-proc', [{ kb_id: 'kb-proc', status: 'processing', embedding_status: 'processing', chunk_count: null }]],
    ['a subject whose only file failed', 'kb-err', [{ kb_id: 'kb-err', status: 'error', embedding_status: 'error', chunk_count: null }]],
  ];
  for (const [label, kb, rows] of cases) {
    db.documents.push(...rows.map((r, i) => ({ id: `${kb}-${i}`, created_at: '2026-01-01T00:00:00.000Z', ...r })));
    const b = before();
    const r = await ask(kb);
    const a = before();
    realError(`  ${label}: HTTP ${r.status} refusal=${r.refusal} questions +${a.q - b.q} conversations +${a.convos - b.convos} embeds +${a.embeds - b.embeds} model +${a.model - b.model}`);
    check(r.status === 409 && r.refusal === 'no_material', `${label}: must answer 409 no_material, got HTTP ${r.status} ${r.refusal}`);
    check(a.q === b.q, `${label}: the daily question counter moved (+${a.q - b.q})`);
    check(a.convos === b.convos, `${label}: a conversation was inserted (the monthly count moved)`);
    check(a.msgs === b.msgs, `${label}: a message was stored`);
    check(a.embeds === b.embeds && a.model === b.model, `${label}: the embedding or the model was called`);
  }
  // Control: a subject with a ready file is counted and answered, as before.
  db.documents.push({ id: 'ok-1', kb_id: 'kb-ok', status: 'ready', embedding_status: 'ready', chunk_count: 9, created_at: '2026-01-01T00:00:00.000Z' });
  const b = before();
  const r = await ask('kb-ok');
  const a = before();
  realError(`  control, a subject with a ready file: HTTP ${r.status} questions +${a.q - b.q} model +${a.model - b.model}`);
  check(r.status === 200 && a.q === b.q + 1 && a.model === b.model + 1 && a.convos === b.convos + 1, `control: a subject with a ready file must be counted once and answered (HTTP ${r.status}, +${a.q - b.q} question, +${a.model - b.model} model)`);
}
{
  const src = read('src/app/api/agent/route.ts');
  const at = (s) => src.indexOf(s);
  const guard = at('hasAnswerableMaterial(');
  check(guard > 0 && guard < at("enforceLimit(user.id, 'query'") && guard < at('checkConversationLimit(user.id)') && guard < at('embedQuery(message)'), 'agent route: the no-material guard must run before the question counter, the conversation count and the embedding');
  check(/\.eq\('status', 'ready'\)/.test(src.slice(guard - 600, guard)), "agent route: the guard must read the subject's ready rows");
  const box = read('src/components/agent/ChatBox.tsx');
  check(/NO_MATERIAL_REFUSAL/.test(box) && /subjectUploadHref\(safeLocale, kbId\)/.test(box), 'ChatBox: the no-material reply must show the way to the subject\'s upload tile');
  check(/\{!noMaterial && \(\s*<div data-kf-composer/.test(box), 'ChatBox: no composer in a subject with no file to answer from');
  const sel = read('src/components/agent/KBSelector.tsx');
  check(/answerable=\{answerable\.has\(selectedKb\.id\)\}/.test(sel), 'KBSelector: ChatBox must be told whether the subject can be asked');
  if (has('src/lib/ask-material.ts')) {
    const { subjectUploadHref } = await load('src/lib/ask-material.ts');
    check(subjectUploadHref('ar', 'k3') === '/ar/dashboard/knowledge/k3', 'the upload path is the subject\'s own page, where the tile is');
  }
}

// ══ 2. Cause #10: a failed processing does not use one of the 5 uploads. ═══
realError('===== #10 failed processing and the daily uploads');
check(has('src/lib/upload-allowance.ts'), 'src/lib/upload-allowance.ts does not exist (the upload allowance)');
if (has('src/lib/upload-allowance.ts')) {
  const { uploadVerdict, keptUploadsToday, uploadAttemptCeiling, FAILED_UPLOAD_ALLOWANCE, utcDayStart } = await load('src/lib/upload-allowance.ts');
  check(FAILED_UPLOAD_ALLOWANCE === 5 && uploadAttemptCeiling(5) === 10 && uploadAttemptCeiling(500) === 505, 'the bound: 5 failed attempts a day on top of the day\'s uploads (free 10 attempts, Pro 505)');
  const now = new Date('2026-11-10T15:00:00.000Z');
  check(utcDayStart(now).toISOString() === '2026-11-10T00:00:00.000Z', 'the day is the UTC day increment_usage counts in');
  const rows = [
    { status: 'ready', created_at: '2026-11-10T01:00:00.000Z' },
    { status: 'error', created_at: '2026-11-10T02:00:00.000Z' },
    { status: 'error', created_at: '2026-11-10T03:00:00.000Z' },
    { status: 'processing', created_at: '2026-11-10T14:59:00.000Z' },
    { status: 'ready', created_at: '2026-11-09T23:59:59.000Z' },
  ];
  check(keptUploadsToday(rows, now) === 2, `failed and yesterday's files are not counted (got ${keptUploadsToday(rows, now)}, want 2: one ready, one processing)`);
  const v = (kept, attempts) => uploadVerdict({ kept, attempts, cap: 5 });
  check(v(4, 9).allowed === true, 'four kept and four failed: the fifth upload goes through');
  check(v(5, null).reason === 'daily' && v(5, 6).reason === 'daily', 'five kept: the daily refusal');
  check(v(0, 10).allowed === true && v(0, 11).reason === 'failures', 'nothing kept: the 11th attempt meets the ceiling');
  check(v(null, 5).allowed === true && v(null, 6).reason === 'daily', 'kept unreadable: the old rule (attempts against the cap)');
}
{
  const { POST } = await load('src/app/api/ingest/route.ts');
  process.env.INGESTION_TOKEN = 'proof-token';
  let mode = 'fail';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) !== 'http://ingestion.invalid/ingest') return realFetch(url, init);
    db.ingests++;
    const id = init.body.get('document_id');
    if (mode === 'fail') return new Response('converter crashed', { status: 500 });
    const row = db.documents.find((d) => d.id === id);
    Object.assign(row, { status: 'ready', embedding_status: 'ready', chunk_count: 3 });
    return new Response(JSON.stringify({ document_id: id, chunk_count: 3, status: 'ready' }), { status: 200 });
  };
  const upload = (kb) => quiet(async () => {
    const fd = new FormData();
    fd.append('file', new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    fd.append('kb_id', kb);
    fd.append('locale', 'ar');
    const res = await POST(new Request('http://x/api/ingest', { method: 'POST', body: fd }));
    return { status: res.status, body: await res.json().catch(() => ({})) };
  });
  const day = async (kb, plan) => {
    db.documents = db.documents.filter((d) => !d.kb_id?.startsWith('up-'));
    db.usage.set('upload', 0);
    db.ingests = 0;
    const out = [];
    for (const m of plan) { mode = m; out.push(await upload(kb)); }
    return out;
  };
  const { uploadFailuresMessage, dailyLimitMessage, nextDailyReset } = await load('src/lib/limit-messages.ts');
  const head = (s) => (s || '').split('.')[0];
  // Main has no failures sentence: the check below then fails, it does not crash.
  const failuresSentence = typeof uploadFailuresMessage === 'function' ? uploadFailuresMessage('ar', nextDailyReset()) : '(main has no failures sentence)';

  // A. Five failures, then six good files.
  {
    const plan = [...Array(5).fill('fail'), ...Array(6).fill('ok')];
    const out = await day('up-a', plan);
    const ok = out.filter((r) => r.status === 200).length;
    const failed = out.slice(0, 5).filter((r) => r.status === 500).length;
    const ingestsBefore11 = db.ingests;
    realError(`  5 failures then 6 good files: statuses ${out.map((r) => r.status).join(' ')}; ingestion calls ${ingestsBefore11}; counter ${db.usage.get('upload')}`);
    check(failed === 5, `the five failures must reach the service and fail (got ${failed})`);
    check(ok === 5 && out.slice(5, 10).every((r) => r.status === 200), `after 5 failed processings all 5 daily uploads must still go through (got ${ok} of 5)`);
    check(out[10].status === 429 && head(out[10].body.error) === head(dailyLimitMessage('ar', 'upload', 5, 'free', nextDailyReset())), `the 11th (6th good file) must get the daily refusal, got HTTP ${out[10].status} ${JSON.stringify(out[10].body).slice(0, 90)}`);
    check(ingestsBefore11 === 10, `the refused upload must not reach the ingestion service (calls ${ingestsBefore11}, want 10)`);
  }
  // B. Failures only: the bound.
  {
    const out = await day('up-b', Array(12).fill('fail'));
    realError(`  12 failures: statuses ${out.map((r) => r.status).join(' ')}; ingestion calls ${db.ingests}`);
    check(out.slice(0, 10).every((r) => r.status === 500), 'ten failed attempts reach the service (the bound is 10 a day for free)');
    check(out[10].status === 429 && out[11].status === 429, `the 11th and 12th attempts must be refused, got ${out[10].status}, ${out[11].status}`);
    check(head(out[10].body.error) === head(failuresSentence), `the 11th must get the failures sentence, got ${JSON.stringify(out[10].body).slice(0, 90)}`);
    check(db.ingests === 10, `refused attempts must not reach the ingestion service (calls ${db.ingests}, want 10)`);
    check(!/الباقة|Pro/.test(out[10].body.error || ''), 'the failures sentence names no plan');
  }
  // C. A good file the same day after the bound: refused too (the ceiling is a ceiling).
  {
    const out = await day('up-c', [...Array(10).fill('fail'), 'ok']);
    check(out[10].status === 429, 'after ten failed attempts, even a good file waits for the next day (the cost ceiling)');
  }
  globalThis.fetch = realFetch;
  const src = read('src/app/api/ingest/route.ts');
  check(!/enforceLimit\(user\.id, 'upload'/.test(src) && /enforceUploadLimit\(/.test(src), "ingest route: the upload gate must be enforceUploadLimit, not enforceLimit(..., 'upload')");
  const dash = read('src/app/[locale]/dashboard/page.tsx');
  check(/upload: keptUploadsToday\(materialRows\.data/.test(dash) && /summary_generated_at, created_at'/.test(dash), 'the home must show the uploads the gate counts (keptUploadsToday), not the attempt counter');
}

// ══ 3. Cause #7: the picked file through the permission sheet. ═════════════
realError('===== #7 the picked file and the permission sheet');
check(has('src/lib/upload-consent.ts'), 'src/lib/upload-consent.ts does not exist (the consent hold)');
if (has('src/lib/upload-consent.ts')) {
  const { afterConsent } = await load('src/lib/upload-consent.ts');
  const picked = { name: 'notes.pdf', size: 1 };
  const yes = afterConsent(picked, true);
  check(yes.send === picked && yes.held === picked && yes.state === 'uploading' && yes.notice === null, 'grant: the SAME picked file is sent, with no second pick');
  const no = afterConsent(picked, false);
  check(no.send === null && no.held === null && no.state === 'idle' && no.notice === 'declined', 'decline: nothing sent, the file released, the tile back with the declined sentence');
}
{
  const src = read('src/components/upload/DropZone.tsx');
  check(/afterConsent\(picked, await ensureAiConsent\(\{ name: picked\.name \}\)\)/.test(src), 'DropZone: the held file must go through afterConsent with the permission answer, its name on the sheet');
  check(/formData\.append\('file', step\.send\)/.test(src), 'DropZone: the file sent must be the one afterConsent returns');
  check(/e\.target\.value = ''/.test(src), 'DropZone: the file input must be emptied once read, so the same file can be picked again');
  check(!/setErrorMsg\(t\.dashboard\.aiConsent\.declined\)/.test(src), 'DropZone: "Not now" must not end in the failure box');
  const prov = read('src/components/ai-consent/AiConsentProvider.tsx');
  check(/ensure: \(held\?: \{ name: string \}\) => Promise<boolean>/.test(prov) && /data-kf-consent-file/.test(prov), 'the permission sheet must name the held file');

  // The drop zone's preview states, rendered by the real component.
  globalThis.__tsxHooksParams = { locale: 'ar' };
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DropZone } = await load('src/components/upload/DropZone.tsx');
  const { useTranslation } = await load('src/lib/i18n/index.ts');
  const t = useTranslation('ar');
  // The owner approved the line as drafted (docs/copy/ARABIC_STRINGS_app_v8.md).
  const awaiting = t.dashboard.upload.awaitingConsent ?? '\u0000';
  check(awaiting === 'محفوظ هنا حتى تجيب. لم يُرسَل شيء بعد.', `awaitingConsent (ar) is the approved line, got ${JSON.stringify(awaiting)}`);
  const html = (state) => renderToStaticMarkup(createElement(DropZone, { kbId: 'k', previewFile: { name: 'تمارين.pdf', size: 1000, state } }));
  const held = html('consent');
  check(held.includes('تمارين') && held.includes(awaiting) && held.includes('data-kf-upload-held'), `consent: the drop zone shows the held file and that nothing is sent yet (${held.slice(0, 600)})`);
  const declined = html('declined');
  check(declined.includes(t.dashboard.aiConsent.declined) && declined.includes('data-kf-upload="tile"') && !declined.includes(`>${t.dashboard.upload.error}<`), 'declined: the tile is back with the declined sentence, and no failure box');
  check(!declined.includes('تمارين.pdf'), 'declined: the file is released (not shown)');
  // The owner's review of #315: a refusal is no dead end. The red-edged
  // message sits above the same tile the idle state shows.
  const failed = html('failed');
  const at = (needle) => failed.indexOf(needle);
  check(at('data-kf-upload-error') >= 0 && failed.includes('border-danger-border') && failed.includes(t.dashboard.upload.tryAnother), 'failed: the red-edged message is shown');
  check(at('data-kf-upload-error') >= 0 && at('data-kf-upload="tile"') > at('data-kf-upload-error'), `failed: the upload tile is shown below the message (${failed.slice(0, 600)})`);
}

realError(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) realError(`FAIL ${f}`);
if (failures.length) process.exit(1);
realError('PASS: zero material costs no question and calls no model; a failed processing costs no upload and failures stop at 10 a day; the picked file is held through the permission sheet and released on "Not now".');
