/**
 * Executable proof for the AI cost caps (fix/ai-cost-caps, 2026-11-13).
 *
 *   1. A question over 4,000 characters is refused by the REAL `/api/agent`
 *      handler with 413 and `X-KF-Refusal: question-too-long`, in the
 *      student's language, BEFORE the consent check and BEFORE the daily
 *      counter: nothing is counted, embedded or sent to the model. A
 *      question of exactly 4,000 characters is answered and counted as
 *      before. A message that is not a string is a 400 and is not counted.
 *   2. Pro's daily uploads are 20 (were 500), so the attempt ceiling is 25;
 *      every other cap is unchanged; a failed upload (status `error`) is not
 *      one of the day's uploads; the price comment names 9.99 USD a month.
 *   3. The ingestion service's content-cap refusals (422 `text_too_long` /
 *      `archive_too_large`, services/ingestion/main.py) are told to the
 *      student by `/api/ingest` as `too-much-text`; any other failure keeps
 *      the reply it had.
 *   4. The two new sentences are exactly the drafts in
 *      docs/copy-drafts/ai_cost_caps.md and obey the copy rules.
 *   5. The chat puts a refused long question back in the box.
 *
 * What is stubbed, and why that is honest: `NextResponse` (a response reads as
 * data); `getEntitlement` (the tier is chosen); the Supabase server client,
 * whose `increment_usage` is an in-memory counter that returns the new count
 * as the SQL function does and whose user carries or lacks the AI consent;
 * the Anthropic SDK and `embedQuery` (counted, nothing leaves the machine);
 * `recordStudyEvent`. The route, `enforceLimit`, `DAILY_CAPS` and the limit
 * messages are the real modules.
 *
 * RED ON 71b1b46: no length check exists (the 4,001-character question is
 * counted, embedded and answered), Pro uploads are 500, and the refusal,
 * the mapping and the drafts do not exist.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 * Usage: node --experimental-strip-types scripts/verify-ai-cost-caps.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

// The numbers this PR sets. Evidence the check holds the code to, not read from it.
const MAX_QUESTION_CHARS = 4000;
const PRO_UPLOADS_PER_DAY = 20;

const state = { tier: 'free', consent: true, usage: new Map(), embeds: 0, modelCalls: 0 };
globalThis.__costCapStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200 }); },
};`;

const ENTITLEMENT_STUB = `
export async function getEntitlement() { return { tier: globalThis.__costCapStub.tier }; }`;

const SUPABASE_STUB = `
const S = () => globalThis.__costCapStub;
function chain(table) {
  const result = table === 'conversations'
    ? { data: null, count: 1, error: null }
    : table === 'documents'
      ? { data: [{ status: 'ready', embedding_status: 'ready', chunk_count: 4 }], count: 1, error: null }
      : { data: [], count: 0, error: null };
  const c = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => result;
      return () => c;
    },
  });
  return c;
}
export async function createClient() {
  const meta = S().consent ? { ai_consent: { version: 1, at: '2026-10-09T00:00:00.000Z' } } : {};
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: meta } } }) },
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

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async () => {
        globalThis.__costCapStub.modelCalls++;
        return (async function* () {
          yield { type: 'message_start', message: { usage: { input_tokens: 4000, output_tokens: 0 } } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } };
          yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 250 } };
        })();
      },
    };
  }
}`;

const INGESTION_STUB = `export async function embedQuery() { globalThis.__costCapStub.embeds++; return [0]; }`;
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
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
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
let clock = Date.UTC(2026, 10, 13, 12, 0, 0);
Date.now = () => (clock += 3000);

const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}
async function attempt(name, fn) {
  try { await fn(); } catch (e) { check(name, false, String(e?.message ?? e).split('\n')[0]); }
}

// The drafts, parsed from the markdown table rows `| en | ... |` / `| ar | ... |`,
// in file order: [question en, question ar, file en, file ar].
const draftRows = [...read('docs/copy-drafts/ai_cost_caps.md').matchAll(/^\| (en|ar) \| (.+) \|$/gm)].map((m) => m[2]);
const DRAFT = {
  question: { en: draftRows[0], ar: draftRows[1] },
  file: { en: draftRows[2], ar: draftRows[3] },
};

const realLog = console.log;
const quiet = () => { console.error = () => {}; console.warn = () => {}; };
quiet();

console.log('1. /api/agent: the question length cap');
await attempt('the agent route loads', async () => {
  const { POST } = await load('src/app/api/agent/route.ts');
  async function ask({ message, locale = 'ar', consent = true, tier = 'free' }) {
    state.tier = tier;
    state.consent = consent;
    state.usage = new Map();
    state.embeds = 0;
    state.modelCalls = 0;
    console.log = () => {}; // the route's kf-usage line
    const res = await POST({
      json: async () => ({ message, kb_id: 'kb-1', conversation_id: 'conv-1', locale }),
      headers: new Headers(),
    }).finally(() => { console.log = realLog; });
    const body = (await res.text()).trim();
    return {
      status: res.status,
      refusal: res.headers.get('X-KF-Refusal'),
      body,
      counted: state.usage.get('query') || 0,
      embeds: state.embeds,
      modelCalls: state.modelCalls,
    };
  }
  const arabic = (n) => 'م'.repeat(n);

  const over = await ask({ message: arabic(MAX_QUESTION_CHARS + 1) });
  check(`a ${MAX_QUESTION_CHARS + 1}-character question is refused with 413`, over.status === 413, `HTTP ${over.status}`);
  check('...with X-KF-Refusal: question-too-long', over.refusal === 'question-too-long', String(over.refusal));
  check('...in Arabic, the drafted sentence', over.body === DRAFT.question.ar, over.body.slice(0, 120));
  check('...and is not counted, embedded or sent to the model', over.counted === 0 && over.embeds === 0 && over.modelCalls === 0,
    `counted=${over.counted} embeds=${over.embeds} model=${over.modelCalls}`);

  const overEn = await ask({ message: 'x'.repeat(MAX_QUESTION_CHARS + 1), locale: 'en' });
  check('in English, the drafted sentence', overEn.status === 413 && overEn.body === DRAFT.question.en, `${overEn.status} ${overEn.body.slice(0, 120)}`);

  const noConsent = await ask({ message: arabic(MAX_QUESTION_CHARS + 1), consent: false });
  check('the cap comes before the consent check (no consent: still 413, not 403)', noConsent.status === 413, `HTTP ${noConsent.status}`);

  const pro = await ask({ message: arabic(MAX_QUESTION_CHARS + 1), tier: 'pro' });
  check('the cap is the same for Pro', pro.status === 413 && pro.counted === 0, `HTTP ${pro.status} counted=${pro.counted}`);

  const at = await ask({ message: arabic(MAX_QUESTION_CHARS) });
  check(`a question of exactly ${MAX_QUESTION_CHARS} characters is answered, counted once, embedded once`,
    at.status === 200 && at.counted === 1 && at.embeds === 1 && at.modelCalls === 1,
    `HTTP ${at.status} counted=${at.counted} embeds=${at.embeds} model=${at.modelCalls} ${at.body.slice(0, 80)}`);

  const emoji = await ask({ message: '📘'.repeat(MAX_QUESTION_CHARS) });
  check('characters are counted as code points (4,000 emoji are 4,000 characters, not 8,000)', emoji.status === 200, `HTTP ${emoji.status}`);

  for (const bad of [12345, { text: 'x' }, ['x']]) {
    const r = await ask({ message: bad });
    check(`a message that is not a string (${JSON.stringify(bad)}) is a 400 and is not counted`, r.status === 400 && r.counted === 0 && r.embeds === 0,
      `HTTP ${r.status} counted=${r.counted}`);
  }
});

console.log('2. The daily caps');
await attempt('rate-limit loads', async () => {
  const { DAILY_CAPS } = await load('src/lib/rate-limit.ts');
  const { uploadAttemptCeiling, keptUploadsToday } = await load('src/lib/upload-allowance.ts');
  check(`Pro uploads a day: ${PRO_UPLOADS_PER_DAY}`, DAILY_CAPS.pro.upload === PRO_UPLOADS_PER_DAY, `got ${DAILY_CAPS.pro.upload}`);
  check(`Pro attempt ceiling: ${PRO_UPLOADS_PER_DAY + 5}`, uploadAttemptCeiling(DAILY_CAPS.pro.upload) === PRO_UPLOADS_PER_DAY + 5);
  check('every other cap is unchanged (free 10/5/5/5, Pro 25 questions, 5 summaries, 5 quizzes)',
    JSON.stringify(DAILY_CAPS.free) === JSON.stringify({ query: 10, upload: 5, summary: 5, quiz: 5 })
      && DAILY_CAPS.pro.query === 25 && DAILY_CAPS.pro.summary === 5 && DAILY_CAPS.pro.quiz === 5,
    JSON.stringify(DAILY_CAPS));
  const now = new Date('2026-11-13T12:00:00Z');
  const rows = [
    { status: 'error', created_at: '2026-11-13T10:00:00Z' }, // refused by a content cap
    { status: 'ready', created_at: '2026-11-13T09:00:00Z' },
  ];
  check('a failed upload is not one of the day\'s uploads (1 of these 2 counts)', keptUploadsToday(rows, now) === 1);
  const src = read('src/lib/rate-limit.ts');
  check('the price comment names 9.99 USD a month, not the old price', /9\.99 USD a month/.test(src) && !/40 USD a semester|12 USD a month/.test(src));
  check('the upload-allowance comment no longer says Pro 505', !/Pro 505/.test(read('src/lib/upload-allowance.ts')));
});

console.log('3. /api/ingest: the content-cap refusal');
await attempt('the mapping loads', async () => {
  const { isContentCapRefusal } = await load('src/lib/ingest-content-caps.ts');
  const { uploadRefusalMessage } = await load('src/lib/limit-messages.ts');
  const truth = [
    [422, '{"detail":"text_too_long: 4395600 characters (cap 4194304)"}', true],
    [422, '{"detail":"archive_too_large: 4 entries, 83886080 bytes uncompressed"}', true],
    [422, '{"detail":[{"loc":["body","file"],"msg":"field required"}]}', false],
    [500, '{"detail":"text_too_long: 1"}', false],
    [413, '{"detail":"File too large"}', false],
    [422, 'text_too_long', false],
    [422, '', false],
  ];
  for (const [status, body, want] of truth) {
    check(`${status} ${body.slice(0, 40) || '(empty)'} -> ${want}`, isContentCapRefusal(status, body) === want);
  }
  check('en too-much-text is the drafted sentence', uploadRefusalMessage('en', 'too-much-text') === DRAFT.file.en, uploadRefusalMessage('en', 'too-much-text'));
  check('ar too-much-text is the drafted sentence', uploadRefusalMessage('ar', 'too-much-text') === DRAFT.file.ar, uploadRefusalMessage('ar', 'too-much-text'));
  const route = read('src/app/api/ingest/route.ts');
  check('the route answers a content-cap refusal with too-much-text and 422',
    /if \(isContentCapRefusal\(pyResponse\.status, detail\)\)[\s\S]{0,300}uploadRefusalMessage\(safeLocale, 'too-much-text'\)[\s\S]{0,80}status: 422/.test(route));
  check('...after the guarded error write, which still runs for it', /await failIfStillProcessing\(upstream\);(\s*\/\/[^\n]*)*\s*if \(isContentCapRefusal/.test(route));
  check('the service and the web share the two codes', ['text_too_long', 'archive_too_large'].every((c) =>
    read('services/ingestion/main.py').includes(`"${c}"`) && read('src/lib/ingest-content-caps.ts').includes(`'${c}'`)));
});

console.log('4. The drafts obey the copy rules');
check('the draft file has four sentences', draftRows.length === 4, JSON.stringify(draftRows));
for (const [k, v] of Object.entries({ 'question en': DRAFT.question.en, 'question ar': DRAFT.question.ar, 'file en': DRAFT.file.en, 'file ar': DRAFT.file.ar })) {
  if (typeof v !== 'string') continue;
  check(`${k}: no em or en dash`, !/[—–]/.test(v), v);
  check(`${k}: no price, plan, upgrade or free wording`, !/(free|price|plan|upgrade|subscri|pro\b|\$|€|مجان|سعر|باق|اشتراك|ترقي|درهم|دولار)/i.test(v), v);
  check(`${k}: Western digits only`, !/[٠-٩۰-۹]/.test(v), v);
  if (k.endsWith('ar')) check(`${k}: no Latin word inside the Arabic`, !/[A-Za-z]/.test(v), v);
}
check('the question sentences name the cap', DRAFT.question.en?.includes('4,000') && DRAFT.question.ar?.includes('4000'));

console.log('5. The chat');
{
  const chat = read('src/components/agent/ChatBox.tsx');
  check('a refused long question goes back in the box and leaves the thread',
    /res\.status === 413 && res\.headers\.get\('X-KF-Refusal'\) === QUESTION_TOO_LONG[\s\S]{0,400}setInput\(userMsg\.content\)/.test(chat)
      && /setMessages\(prev => \[\.\.\.prev\.filter\(m => m\.id !== userMsg\.id\)/.test(chat));
}

console.log = realLog;
console.log(`\n${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
