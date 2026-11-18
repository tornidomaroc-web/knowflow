/**
 * Executable proof for the monthly AI allowance (feat/ai-allowance, 2026-11-15).
 *
 *   1. The rules (src/lib/ai-allowance.ts): one place for the two ceilings,
 *      a rolling 30-day window, the verdict (at the ceiling is refused, an
 *      unreadable ledger is refused), the prices (Haiku from `usage`, Voyage
 *      from the service's reported tokens, else the stated conservative
 *      estimate, flagged), and what a row may carry (never negative, NaN,
 *      infinite or over 10 USD).
 *   2. /api/agent, driven for real: at the ceiling the question is refused
 *      with 429 and `X-KF-Refusal: ai-allowance-used`, in the student's
 *      language, BEFORE the daily counter: nothing is counted, embedded, sent
 *      to the model or written to the ledger. Under the ceiling it is
 *      answered and the ledger gets the answer's real price (from the
 *      stream's `usage`) and the query embedding's (estimated when the
 *      service does not report tokens). An unreadable ledger is a 503 and
 *      calls nothing.
 *   3. /api/summarize, driven for real: the same refusal as JSON with
 *      `code: 'ai-allowance-used'`; under the ceiling one `summary` row at the
 *      price `usage` gives.
 *   4. /api/quiz/generate and /api/ingest, read: consent, then the allowance,
 *      then the daily counter, then the provider; the spend is recorded after
 *      the provider answers; the upload records Voyage's reported tokens.
 *   5. The sentence is the draft in docs/copy-drafts/ai_monthly_allowance.md,
 *      in ar.ts and en.ts, and obeys the copy rules.
 *
 * What is stubbed, and why that is honest: `NextResponse`; `getEntitlement`
 * (the tier is chosen); the session Supabase client (consent and the daily
 * counter, in memory, as scripts/verify-ai-cost-caps.mjs does); the
 * service-role `@supabase/supabase-js` client, whose `ai_spend_since` sums an
 * in-memory ledger by user and window as the SQL function does and whose
 * insert appends to it; the Anthropic SDK and `embedQuery` (counted; nothing
 * leaves the machine). The routes, the allowance modules and the dictionaries
 * are the real ones. The database half (grants, RLS, the checks, the
 * function's privileges) is proved against real Postgres by
 * scripts/verify-public-grants.mjs section 5.
 *
 * RED ON f6f3632 (main before this change): the modules, the routes' checks,
 * the ledger writes and the strings do not exist.
 *
 * Tier 0: no network, no credential, no database, no model call.
 * Usage: node --experimental-strip-types scripts/verify-ai-allowance.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://ledger.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'verify-only-not-a-key';

const USER = 'user-1';
const state = { tier: 'free', consent: true, usage: new Map(), embeds: 0, modelCalls: 0, ledger: [], ledgerDown: false };
globalThis.__allowanceStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200 }); },
};`;
const ENTITLEMENT_STUB = `export async function getEntitlement() { return { tier: globalThis.__allowanceStub.tier }; }`;

// The student's session client: consent, the daily counter, and a ready
// document with enough text for a summary or a quiz.
const SESSION_STUB = `
const S = () => globalThis.__allowanceStub;
const DOC = { id: 'doc-1', status: 'ready', markdown_content: 'نص المادة. '.repeat(400), summary: null, kb_id: 'kb-1', language: 'ar' };
function chain(table) {
  const many = table === 'conversations'
    ? { data: null, count: 1, error: null }
    : table === 'documents'
      ? { data: [{ status: 'ready', embedding_status: 'ready', chunk_count: 4 }], count: 1, error: null }
      : { data: [], count: 0, error: null };
  const one = table === 'documents' ? { data: DOC, error: null } : { data: { id: 'row-1' }, error: null };
  const c = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(many).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => one;
      return () => c;
    },
  });
  return c;
}
export async function createClient() {
  const meta = S().consent ? { ai_consent: { version: 1, at: '2026-10-09T00:00:00.000Z' } } : {};
  return {
    auth: { getUser: async () => ({ data: { user: { id: '${USER}', user_metadata: meta } } }) },
    from: (table) => chain(table),
    rpc: async (fn, args) => {
      if (fn === 'increment_usage') {
        const n = (S().usage.get(args.p_kind) || 0) + 1;
        S().usage.set(args.p_kind, n);
        return { data: n, error: null };
      }
      return { data: [], error: null };
    },
  };
}`;

// The service-role client: the ledger. ai_spend_since sums one user's rows at
// or after p_since, as the SQL function does.
const SERVICE_STUB = `
const S = () => globalThis.__allowanceStub;
export function createClient() {
  return {
    rpc: async (fn, args) => {
      if (fn !== 'ai_spend_since') return { data: null, error: { message: 'unknown function ' + fn } };
      if (S().ledgerDown) return { data: null, error: { message: 'ledger unreachable' } };
      const since = Date.parse(args.p_since);
      const sum = S().ledger.filter((r) => r.user_id === args.p_user && Date.parse(r.at) >= since).reduce((a, r) => a + r.usd, 0);
      return { data: sum, error: null };
    },
    from: (table) => ({
      insert: async (row) => {
        if (table !== 'ai_spend') return { error: { message: 'wrong table ' + table } };
        S().ledger.push({ ...row, at: new Date().toISOString() });
        return { error: null };
      },
    }),
  };
}`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (args) => {
        globalThis.__allowanceStub.modelCalls++;
        if (args.stream) {
          return (async function* () {
            yield { type: 'message_start', message: { usage: { input_tokens: 4000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } };
            yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 250 } };
          })();
        }
        return {
          content: [{ type: 'text', text: 'ملخص المادة في فقرة واحدة.' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5000, output_tokens: 400, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 },
        };
      },
    };
  }
}`;

const INGESTION_STUB = `export async function embedQuery() { globalThis.__allowanceStub.embeds++; return [0]; }
export function getServiceUrl() { return 'http://ingestion.invalid'; }`;
const STUDY_EVENTS_STUB = `export async function recordStudyEvent() {}`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => {
  if (/\.[a-z]+$/i.test(base)) return base;
  if (existsSync(base + '.ts')) return base + '.ts';
  return resolvePath(base, 'index.ts');
};
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk') return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === '@supabase/supabase-js') return { url: inline(SERVICE_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SESSION_STUB), shortCircuit: true };
    if (spec === '@/lib/entitlement') return { url: inline(ENTITLEMENT_STUB), shortCircuit: true };
    if (spec === '@/lib/ingestion') return { url: inline(INGESTION_STUB), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline(STUDY_EVENTS_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) {
      return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    }
    if (spec.startsWith('.') && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
      const base = resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec);
      return { url: pathToFileURL(withTs(base)).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

// Keep the burst guard (2 s between questions) out of the way.
let clock = Date.UTC(2026, 10, 15, 12, 0, 0);
Date.now = () => (clock += 3000);

const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

let pass = 0;
const failures = [];
const realLog = console.log;
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  realLog(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}
async function attempt(name, fn) {
  try { await fn(); } catch (e) { check(name, false, String(e?.message ?? e).split('\n')[0]); }
}
console.error = () => {};
console.warn = () => {};

const draftRows = [...read('docs/copy-drafts/ai_monthly_allowance.md').matchAll(/^\| (en|ar) \| (.+) \|$/gm)].map((m) => [m[1], m[2]]);
const DRAFT = Object.fromEntries(draftRows);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const spentBy = (user) => state.ledger.filter((r) => r.user_id === user).reduce((a, r) => a + r.usd, 0);
const reset = ({ tier = 'free', spent = 0, consent = true, ledgerDown = false } = {}) => {
  state.tier = tier;
  state.consent = consent;
  state.usage = new Map();
  state.embeds = 0;
  state.modelCalls = 0;
  state.ledgerDown = ledgerDown;
  state.ledger = spent > 0 ? [{ user_id: USER, kind: 'answer', usd: spent, estimated: false, at: new Date(Date.UTC(2026, 10, 14)).toISOString() }] : [];
  // A row from before the window and one of another user never count.
  state.ledger.push({ user_id: USER, kind: 'answer', usd: 9, estimated: false, at: '2020-01-01T00:00:00.000Z' });
  state.ledger.push({ user_id: 'someone-else', kind: 'answer', usd: 9, estimated: false, at: new Date().toISOString() });
};
const ownRowsInWindow = () => state.ledger.filter((r) => r.user_id === USER && r.at > '2021');

realLog('1. The rules');
await attempt('src/lib/ai-allowance.ts loads', async () => {
  const A = await load('src/lib/ai-allowance.ts');
  const { usageUsd } = await load('src/lib/usage-cost.ts');
  check('one constant holds both ceilings, in USD', typeof A.AI_ALLOWANCE_USD?.free === 'number' && typeof A.AI_ALLOWANCE_USD?.pro === 'number', JSON.stringify(A.AI_ALLOWANCE_USD));
  check('Pro\'s ceiling is under the lowest net per subscriber (7.41 USD) and over Free\'s', A.AI_ALLOWANCE_USD.pro < 7.41 && A.AI_ALLOWANCE_USD.pro > A.AI_ALLOWANCE_USD.free);
  check('Pro\'s ceiling holds 25 questions a day for 30 days at the measured unit cost (4.22 USD)', A.AI_ALLOWANCE_USD.pro >= 25 * 30 * 0.005622);
  const now = new Date('2026-11-15T12:00:00.000Z');
  check('the window is the rolling 30 days before now', A.allowanceWindowStart(now).toISOString() === '2026-10-16T12:00:00.000Z', A.allowanceWindowStart(now).toISOString());
  const c = A.AI_ALLOWANCE_USD.free;
  check('under the ceiling: allowed', A.allowanceVerdict(c - 0.000001, 'free').allowed === true);
  check('at the ceiling: refused (used)', A.allowanceVerdict(c, 'free').allowed === false && A.allowanceVerdict(c, 'free').reason === 'used');
  check('Free\'s spend that is under Pro\'s ceiling is allowed for Pro', A.allowanceVerdict(c, 'pro').allowed === true);
  check('an unreadable ledger (null or NaN): refused (unread)', A.allowanceVerdict(null, 'pro').reason === 'unread' && A.allowanceVerdict(NaN, 'pro').reason === 'unread');
  check('the refusal code is stable', A.AI_ALLOWANCE_REFUSAL === 'ai-allowance-used');
  for (const bad of [-0.01, -1e-9, NaN, Infinity, -Infinity, 10.000001, '0.5', null, undefined]) {
    check(`a row may not carry usd ${String(bad)}`, A.isRecordableUsd(bad) === false);
  }
  check('a row may carry 0 and 10', A.isRecordableUsd(0) && A.isRecordableUsd(10));
  const t = { input_tokens: 5000, output_tokens: 400, cache_read_tokens: 1000, cache_write_tokens: 0 };
  check('Haiku is priced from usage by usageUsd (0.0071 USD here)', near(A.anthropicUsd(t), usageUsd(t)) && near(A.anthropicUsd(t), 0.0071), String(A.anthropicUsd(t)));
  check('Voyage: 1,000,000 tokens is 0.18 USD', near(A.voyageUsd(1_000_000), 0.18));
  const q = A.queryEmbedSpend(12, 'سؤال');
  check('a question with reported tokens: priced from them, not estimated', near(q.usd, A.voyageUsd(12)) && q.estimated === false);
  const qe = A.queryEmbedSpend(undefined, 'سؤال قصير');
  check('a question without reported tokens: one token per character, estimated', near(qe.usd, A.voyageUsd(9)) && qe.estimated === true, JSON.stringify(qe));
  const u = A.uploadEmbedSpend(3000, 4, 999999);
  check('an upload with reported tokens: priced from them', near(u.usd, A.voyageUsd(3000)) && u.estimated === false);
  const ue = A.uploadEmbedSpend(undefined, 4, 25_000);
  check('an upload without reported tokens: one token per byte, estimated', near(ue.usd, A.voyageUsd(25_000)) && ue.estimated === true);
  const big = A.uploadEmbedSpend(null, 1845, 50_000_000);
  check('...capped at 4 MiB of tokens (0.754975 USD)', near(big.usd, A.voyageUsd(4 * 1024 * 1024)), String(big.usd));
  const none = A.uploadEmbedSpend(undefined, 0, 25_000);
  check('an upload that made no chunks sent nothing to Voyage: 0, not estimated', none.usd === 0 && none.estimated === false);
  for (const bad of [-5, 1.5, '12', NaN]) {
    check(`a reported token count of ${JSON.stringify(bad)} is not trusted`, A.reportedTokens(bad) === null);
  }
});

realLog('2. /api/agent');
await attempt('the agent route loads', async () => {
  const { POST } = await load('src/app/api/agent/route.ts');
  const A = await load('src/lib/ai-allowance.ts');
  async function ask(opts) {
    reset(opts);
    console.log = () => {};
    const res = await POST({
      json: async () => ({ message: 'ما الفكرة الرئيسية؟', kb_id: 'kb-1', conversation_id: 'conv-1', locale: opts.locale ?? 'ar' }),
      headers: new Headers(),
    }).finally(() => { console.log = realLog; });
    const body = (await res.text()).trim();
    return { status: res.status, refusal: res.headers.get('X-KF-Refusal'), body, counted: state.usage.get('query') || 0, embeds: state.embeds, modelCalls: state.modelCalls };
  }
  for (const tier of ['free', 'pro']) {
    const ceiling = A.AI_ALLOWANCE_USD[tier];
    const before = state.ledger.length;
    const r = await ask({ tier, spent: ceiling });
    check(`${tier} at the ceiling (${ceiling} USD in the window): 429`, r.status === 429, `HTTP ${r.status} ${r.body.slice(0, 80)}`);
    check('...with X-KF-Refusal: ai-allowance-used', r.refusal === 'ai-allowance-used', String(r.refusal));
    check('...not counted, not embedded, not sent to the model', r.counted === 0 && r.embeds === 0 && r.modelCalls === 0, `counted=${r.counted} embeds=${r.embeds} model=${r.modelCalls}`);
    check('...and the refused call is not recorded', ownRowsInWindow().length === 1, JSON.stringify(ownRowsInWindow()));
    void before;
  }
  const ar = await ask({ tier: 'free', spent: 5 });
  check('the refusal is the drafted Arabic sentence', ar.body === DRAFT.ar, ar.body.slice(0, 120));
  const en = await ask({ tier: 'free', spent: 5, locale: 'en' });
  check('in English, the drafted English sentence', en.body === DRAFT.en, en.body.slice(0, 120));
  const noConsent = await ask({ tier: 'free', spent: 5, consent: false });
  check('consent still comes first (no consent at the ceiling: 403, not 429)', noConsent.status === 403, `HTTP ${noConsent.status}`);

  const ok = await ask({ tier: 'free', spent: A.AI_ALLOWANCE_USD.free - 0.01 });
  check('just under the ceiling: answered, counted once, embedded once, one model call', ok.status === 200 && ok.counted === 1 && ok.embeds === 1 && ok.modelCalls === 1,
    `HTTP ${ok.status} counted=${ok.counted} embeds=${ok.embeds} model=${ok.modelCalls}`);
  const rows = ownRowsInWindow();
  const answer = rows.find((r) => r.kind === 'answer' && r.usd !== A.AI_ALLOWANCE_USD.free - 0.01);
  check('the answer is recorded at its real price from the stream\'s usage (4,000 in, 250 out: 0.00525 USD)', answer && near(answer.usd, 0.00525) && answer.estimated === false, JSON.stringify(rows));
  const emb = rows.find((r) => r.kind === 'query_embed');
  check('the query embedding is recorded, estimated (this service reports no tokens)', emb && emb.estimated === true && near(emb.usd, A.voyageUsd([...'ما الفكرة الرئيسية؟'].length)), JSON.stringify(emb));

  const down = await ask({ tier: 'pro', ledgerDown: true });
  check('an unreadable ledger: 503, nothing counted, embedded or sent', down.status === 503 && down.counted === 0 && down.embeds === 0 && down.modelCalls === 0,
    `HTTP ${down.status} counted=${down.counted} embeds=${down.embeds} model=${down.modelCalls}`);
});

realLog('3. /api/summarize');
await attempt('the summarize route loads', async () => {
  const { POST } = await load('src/app/api/summarize/route.ts');
  const A = await load('src/lib/ai-allowance.ts');
  async function summarize(opts) {
    reset(opts);
    console.log = () => {};
    const res = await POST({ json: async () => ({ document_id: 'doc-1', locale: opts.locale ?? 'ar' }), headers: new Headers() })
      .finally(() => { console.log = realLog; });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body, counted: state.usage.get('summary') || 0, modelCalls: state.modelCalls };
  }
  const at = await summarize({ tier: 'pro', spent: A.AI_ALLOWANCE_USD.pro });
  check('Pro at the ceiling: 429 with code ai-allowance-used and the drafted sentence', at.status === 429 && at.body.code === 'ai-allowance-used' && at.body.error === DRAFT.ar,
    `HTTP ${at.status} ${JSON.stringify(at.body).slice(0, 160)}`);
  check('...not counted, no model call, nothing recorded', at.counted === 0 && at.modelCalls === 0 && ownRowsInWindow().length === 1);
  const ok = await summarize({ tier: 'pro', spent: 0 });
  check('under the ceiling: summarised once', ok.status === 200 && ok.counted === 1 && ok.modelCalls === 1, `HTTP ${ok.status} ${JSON.stringify(ok.body).slice(0, 160)}`);
  const row = ownRowsInWindow().find((r) => r.kind === 'summary');
  check('...and one summary row at usage\'s price (0.0071 USD)', row && near(row.usd, 0.0071) && row.estimated === false, JSON.stringify(ownRowsInWindow()));
  check('spent in the window is now that one row', near(spentBy(USER) - 9, 0.0071));
});

realLog('4. /api/quiz/generate and /api/ingest, in order');
{
  const order = (src, marks) => {
    const at = marks.map((m) => src.indexOf(m));
    return at.every((i) => i >= 0) && at.every((i, k) => k === 0 || at[k - 1] < i) ? null : marks.map((m, k) => `${m}@${at[k]}`).join(' ');
  };
  const quiz = read('src/app/api/quiz/generate/route.ts');
  let o = order(quiz, ['hasAiConsent(user)', 'checkAiAllowance(user.id', "enforceLimit(user.id, 'quiz'", 'anthropic.messages.create(', "recordAiSpend(user.id, 'quiz'"]);
  check('quiz: consent, allowance, daily counter, model, then the spend', o === null, o ?? '');
  check('quiz: the refusal carries the code', /code: allowance\.code/.test(quiz));
  // feat/page-reader: everything after /api/ingest's gates moved, unchanged, to
  // src/lib/ingest-material.ts (shared with /api/page-read). The route keeps the
  // gates and ends in the one call; the module holds the service and the spend.
  const ingestRoute = read('src/app/api/ingest/route.ts');
  const ingest = read('src/lib/ingest-material.ts');
  o = order(ingestRoute, ['hasAiConsent(user)', 'checkAiAllowance(user.id', 'enforceUploadLimit(user.id', 'ingestMaterial({']);
  check('ingest: consent, allowance, daily counter, then the shared path (src/lib/ingest-material.ts)', o === null, o ?? '');
  // fix/storage-server-writes: the file goes up through storeOwnDocumentFile (service role).
  o = order(ingest, ['storeOwnDocumentFile({ session: supabase, userId: user.id, kbId, key: filePath, body: file })', 'fetch(`${pythonServiceUrl}/ingest`', "recordAiSpend(user.id, 'upload_embed'"]);
  check('...and in it: storage and the service, then the spend', o === null, o ?? '');
  check('ingest: the spend is Voyage\'s reported tokens, else the estimate', /uploadEmbedSpend\(ack\.voyage_tokens, ack\.chunk_count, file\.size\)/.test(ingest));
  check('ingest: a failed ingestion that reports Voyage tokens is still recorded, inside the failure branch',
    /if \(!pyResponse\.ok\) \{[\s\S]*?reportedTokens\(\(JSON\.parse\(detail\)[\s\S]{0,200}recordAiSpend\(user\.id, 'upload_embed', voyageUsd\(failedTokens\)\)[\s\S]{0,300}uploadRefusalMessage\(safeLocale, 'unconfirmed'\)/.test(ingest));
  const agent = read('src/app/api/agent/route.ts');
  o = order(agent, ['hasAiConsent(user)', 'checkAiAllowance(user.id', "enforceLimit(user.id, 'query'", 'embedQuery(message', 'anthropic.messages.create(']);
  check('agent: consent, allowance, daily counter, embedding, model', o === null, o ?? '');
  const py = read('services/ingestion/main.py');
  check('the ingestion service reports voyage_tokens on /embed and /ingest', /"voyage_tokens"/.test(py) && (py.match(/voyage_tokens/g) || []).length >= 3);
  check('embedQuery passes the reported tokens on', /voyage_tokens/.test(read('src/lib/ingestion.ts')));
}

realLog('5. The sentence');
{
  check('the draft file has one en and one ar row', draftRows.length === 2 && DRAFT.en && DRAFT.ar, JSON.stringify(draftRows));
  await attempt('the dictionaries load', async () => {
    const { en } = await load('src/lib/i18n/locales/en.ts');
    const { ar } = await load('src/lib/i18n/locales/ar.ts');
    check('en.ts dashboard.aiAllowance.used is the draft', en.dashboard?.aiAllowance?.used === DRAFT.en, en.dashboard?.aiAllowance?.used);
    check('ar.ts dashboard.aiAllowance.used is the draft', ar.dashboard?.aiAllowance?.used === DRAFT.ar, ar.dashboard?.aiAllowance?.used);
  });
  for (const [k, v] of Object.entries(DRAFT)) {
    check(`${k}: no em or en dash`, !/[—–]/.test(v), v);
    check(`${k}: no price, plan, upgrade or free wording`, !/(free|price|plan|upgrade|subscri|premium|pro\b|\$|€|usd|dollar|مجان|سعر|أسعار|باق|اشترا?ك|ترقي|احتراف|خط[ةت]|درهم|دولار)/i.test(v), v);
    check(`${k}: Western digits only`, !/[٠-٩۰-۹]/.test(v), v);
    if (k === 'ar') check('ar: no Latin letter inside the Arabic', !/[A-Za-z]/.test(v), v);
  }
}

console.log = realLog;
realLog(`\n${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
