/**
 * Executable proof for register #80(b), at the ROUTE level: a Pro student can ask
 * 25 questions a day and the 26th is refused before any model call, even when
 * every question goes into ONE conversation.
 *
 * The settled price (40 USD a semester, 12 USD a month, Pro at 25 questions a
 * day; #94) was set against a per-question cost, and the code allowed Pro 2,000
 * questions a day (`DAILY_CAPS.pro.query`, `src/lib/rate-limit.ts`). At the
 * measured mean of $0.005622 a question that is $337 per 30 days against a
 * $12 month.
 *
 * It also settles a claim about the monthly meter. `checkConversationLimit`
 * counts CONVERSATIONS started this month (`src/lib/limits-server.ts`), so a
 * student who never opens a second conversation never moves it. The question
 * here is whether that lets them past the DAILY question cap too. It must not:
 * `enforceLimit(user.id, 'query')` runs on every POST, in front of the
 * conversation check, whatever `conversation_id` says.
 *
 * This imports the REAL `POST` from `src/app/api/agent/route.ts`, the REAL
 * `enforceLimit` and `DAILY_CAPS` (`src/lib/rate-limit.ts`), the REAL
 * `checkConversationLimit` (`src/lib/limits-server.ts`) and the real limit
 * messages. What is stubbed, and why that is honest: `NextResponse` (a response
 * reads as data); `getEntitlement` (the tier is chosen); the Supabase server
 * client, whose `increment_usage` RPC is an in-memory counter that returns the
 * new count exactly as the SQL function does, and whose `conversations` count
 * stays at 1 because every question goes into the same conversation; the
 * Anthropic SDK (every call is counted, none leaves the machine); `embedQuery`
 * and `recordStudyEvent`. `Date.now` advances 3 s per question so the 2-second
 * burst guard, which is not under test, never fires.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-pro-question-cap.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// The settled price's allowance (#94, "Pro 25 q/day"). This is the evidence the
// check holds the code to; it is not read from the code.
const PRO_QUESTIONS_PER_DAY = 25;
// The free cap already shipped (#80, 30 -> 10). A control: it passes on main and
// on the branch, so a harness that refused nothing, or everything, cannot pass.
const FREE_QUESTIONS_PER_DAY = 10;

const state = { tier: 'pro', usage: new Map(), modelCalls: 0 };
globalThis.__proCapStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200 }); },
};`;

const ENTITLEMENT_STUB = `
export async function getEntitlement() { return { tier: globalThis.__proCapStub.tier }; }`;

// Every query builder is a thenable chain. Only three reads matter: the
// increment_usage RPC (the daily meter), the conversations count (the monthly
// meter, always 1: one conversation), and the history read (empty).
const SUPABASE_STUB = `
const S = () => globalThis.__proCapStub;
function chain(table) {
  const result = table === 'conversations'
    ? { data: null, count: 1, error: null }
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
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
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
        globalThis.__proCapStub.modelCalls++;
        return (async function* () {
          yield { type: 'message_start', message: { usage: { input_tokens: 4000, output_tokens: 0 } } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } };
          yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 250 } };
        })();
      },
    };
  }
}`;

const INGESTION_STUB = `export async function embedQuery() { return [0]; }`;
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

let clock = Date.UTC(2026, 8, 24, 12, 0, 0);
Date.now = () => (clock += 3000);

const { POST } = await import(pathToFileURL(resolvePath(ROOT, 'src/app/api/agent/route.ts')).href);
const { DAILY_CAPS } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/rate-limit.ts')).href);

const failures = [];
const realLog = console.log;
const realError = console.error;
console.log = () => {};
console.error = () => {};

async function ask(conversation_id) {
  const res = await POST({
    json: async () => ({ message: 'ما هي مرونة الطلب؟', kb_id: 'kb-1', conversation_id, locale: 'ar' }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

// One student, one conversation, `n` questions on one day. Returns the number
// answered before the first refusal, the refusal, and model calls made.
async function day(tier, n) {
  state.tier = tier;
  state.usage = new Map();
  state.modelCalls = 0;
  let answered = 0;
  let refusal = null;
  for (let i = 1; i <= n; i++) {
    const r = await ask('conv-1');
    if (r.status === 200) {
      if (refusal) failures.push(`${tier}: question ${i} answered AFTER a refusal`);
      answered++;
    } else if (!refusal) {
      refusal = { at: i, ...r, modelCallsBefore: state.modelCalls };
    }
  }
  return { answered, refusal, modelCalls: state.modelCalls };
}

realError(`DAILY_CAPS.pro.query = ${DAILY_CAPS.pro.query}   DAILY_CAPS.free.query = ${DAILY_CAPS.free.query}`);

// 1. Pro, 26 questions in ONE conversation.
{
  const r = await day('pro', PRO_QUESTIONS_PER_DAY + 1);
  realError(`===== Pro, ${PRO_QUESTIONS_PER_DAY + 1} questions in one conversation`);
  realError(`  answered=${r.answered}  model calls=${r.modelCalls}  refusal=${r.refusal ? `#${r.refusal.at} HTTP ${r.refusal.status} "${r.refusal.body.slice(0, 70)}"` : '(none)'}`);
  if (r.answered !== PRO_QUESTIONS_PER_DAY) {
    failures.push(`Pro answered ${r.answered} questions in one day, expected ${PRO_QUESTIONS_PER_DAY}`);
  }
  if (!r.refusal || r.refusal.at !== PRO_QUESTIONS_PER_DAY + 1) {
    failures.push(`Pro question ${PRO_QUESTIONS_PER_DAY + 1} was not refused`);
  } else {
    if (r.refusal.status !== 429) failures.push(`Pro refusal was HTTP ${r.refusal.status}, expected 429`);
    if (r.modelCalls !== PRO_QUESTIONS_PER_DAY) {
      failures.push(`the model was called ${r.modelCalls} times, expected ${PRO_QUESTIONS_PER_DAY}: the refusal must come first`);
    }
  }
}

// 2. Control: Free, 11 questions in one conversation. The already-shipped cap.
{
  const r = await day('free', FREE_QUESTIONS_PER_DAY + 1);
  realError(`===== control: Free, ${FREE_QUESTIONS_PER_DAY + 1} questions in one conversation`);
  realError(`  answered=${r.answered}  model calls=${r.modelCalls}  refusal=${r.refusal ? `#${r.refusal.at} HTTP ${r.refusal.status}` : '(none)'}`);
  if (r.answered !== FREE_QUESTIONS_PER_DAY || !r.refusal || r.refusal.status !== 429) {
    failures.push(`control failed: Free answered ${r.answered}, expected ${FREE_QUESTIONS_PER_DAY} then a 429`);
  }
}

console.log = realLog;
console.error = realError;

if (failures.length === 0) {
  console.log('PASS: 2 checks against the real /api/agent handler and the real enforceLimit.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
