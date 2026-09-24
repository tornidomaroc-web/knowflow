/**
 * Executable proof for register #80(b), the summary and quiz half, at the ROUTE
 * level: a Pro student can generate 5 summaries and 5 quizzes a day, and the
 * 6th of each is refused with a 429 before any model call.
 *
 * The settled price (40 USD a semester, 12 USD a month; #94) was set against
 * measured unit costs. The code allowed Pro 100 summaries and 100 quizzes a day
 * (`DAILY_CAPS.pro`, `src/lib/rate-limit.ts`). At the measured $0.015891 a
 * summary and $0.014168 a quiz (one 13,421-character Arabic document, #94) that
 * is $3.01 a day, $90.18 per 30 days, against a $12 month. At 5 + 5 it is
 * $0.150 a day, $4.51 per 30 days.
 *
 * Each request names a FRESH document, because a summary or quiz that already
 * exists is returned from the cache before `enforceLimit` and costs nothing
 * (register #26/#28). A fresh document is the only way to reach the model, so it
 * is the only thing the cap has to stop. Summaries run first and quizzes second
 * on the SAME day's counters, so the check also holds that 5 summaries do not
 * spend a quiz credit (each kind is its own counter).
 *
 * This imports the REAL `POST` from `src/app/api/summarize/route.ts` and
 * `src/app/api/quiz/generate/route.ts`, the REAL `enforceLimit` and
 * `DAILY_CAPS` (`src/lib/rate-limit.ts`) and the real limit messages. What is
 * stubbed, and why that is honest: `NextResponse` (a response reads as data);
 * `getEntitlement` (the tier is chosen); the Supabase server client, whose
 * `increment_usage` RPC is an in-memory counter that returns the new count
 * exactly as the SQL function does, whose `documents` read returns a ready,
 * never-summarised document, and whose `quizzes` read finds no quiz; the
 * Anthropic SDK (every call is counted, none leaves the machine, and each reply
 * is one the route accepts); `recordStudyEvent`.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-pro-summary-quiz-caps.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// The allowances the owner approved on 2026-09-24 from the settled price
// (register #80(b)). This is the evidence the check holds the code to; it is not
// read from the code.
const PRO_SUMMARIES_PER_DAY = 5;
const PRO_QUIZZES_PER_DAY = 5;
// Free's caps, already shipped. A control: it passes on main and on the branch,
// so a harness that refused nothing, or everything, cannot pass.
const FREE_SUMMARIES_PER_DAY = 5;

const state = { tier: 'pro', usage: new Map(), modelCalls: 0 };
globalThis.__proSqCapStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200 }); },
};`;

const ENTITLEMENT_STUB = `
export async function getEntitlement() { return { tier: globalThis.__proSqCapStub.tier }; }`;

// Every query builder is a thenable chain. What matters: the increment_usage RPC
// (the daily meter); the documents read (a ready document with enough text and
// no summary); the quizzes read (none, so nothing is cached); the two quiz
// inserts, which return rows as the database would.
const SUPABASE_STUB = `
const S = () => globalThis.__proSqCapStub;
const DOC = {
  id: 'doc', status: 'ready',
  markdown_content: 'مرونة الطلب السعرية تقيس استجابة الكمية المطلوبة للتغير في السعر. '.repeat(20),
  summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: null,
};
function chain(table) {
  let op = 'select';
  const result = () => {
    if (table === 'documents') return { data: op === 'select' ? DOC : null, error: null };
    if (table === 'quizzes') {
      return op === 'insert'
        ? { data: { id: 'quiz-1', document_id: 'doc', generated_at: 'now', model: 'm', created_at: 'now', is_partial: false }, error: null }
        : { data: null, error: null };
    }
    if (table === 'quiz_items') {
      return { data: op === 'insert' ? [{ id: 'i1', quiz_id: 'quiz-1', question: 'q', options: ['a', 'b'], position: 0 }] : [], error: null };
    }
    return { data: [], count: 0, error: null };
  };
  const c = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result()).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => result();
      if (prop === 'insert' || prop === 'update' || prop === 'delete') return () => { op = prop; return c; };
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

// A quiz call ends its messages with the assistant prefill "["; the reply is
// the rest of a valid array. Anything else is a summary call.
const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (req) => {
        globalThis.__proSqCapStub.modelCalls++;
        const last = req.messages[req.messages.length - 1];
        const isQuiz = last && last.role === 'assistant' && last.content === '[';
        const text = isQuiz
          ? '{"question":"ما المرونة؟","options":["أ","ب"],"correct_index":0}]'
          : 'ملخص قصير كامل.';
        return {
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 9500, output_tokens: 1000 },
        };
      },
    };
  }
}`;

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

const summarize = (await import(pathToFileURL(resolvePath(ROOT, 'src/app/api/summarize/route.ts')).href)).POST;
const quiz = (await import(pathToFileURL(resolvePath(ROOT, 'src/app/api/quiz/generate/route.ts')).href)).POST;
const { DAILY_CAPS } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/rate-limit.ts')).href);

const failures = [];
const realLog = console.log;
const realError = console.error;
console.log = () => {};
console.error = () => {};

let docSeq = 0;
async function call(post) {
  const res = await post({ json: async () => ({ document_id: `doc-${++docSeq}`, locale: 'ar' }) });
  return { status: res.status, body: await res.text() };
}

// `n` requests on fresh documents against one route, on the current day's
// counters. Returns the number generated before the first refusal, the refusal,
// and the model calls this route made.
async function run(post, n) {
  const before = state.modelCalls;
  let generated = 0;
  let refusal = null;
  for (let i = 1; i <= n; i++) {
    const r = await call(post);
    if (r.status === 200) {
      if (refusal) failures.push(`request ${i} generated AFTER a refusal`);
      generated++;
    } else if (!refusal) {
      refusal = { at: i, ...r, modelCallsBefore: state.modelCalls - before };
    }
  }
  return { generated, refusal, modelCalls: state.modelCalls - before };
}

function newDay(tier) {
  state.tier = tier;
  state.usage = new Map();
}

function report(label, r) {
  realError(`===== ${label}`);
  realError(`  generated=${r.generated}  model calls=${r.modelCalls}  refusal=${r.refusal ? `#${r.refusal.at} HTTP ${r.refusal.status} "${r.refusal.body.slice(0, 70)}"` : '(none)'}`);
}

function expectCap(kind, r, cap) {
  if (r.generated !== cap) failures.push(`Pro generated ${r.generated} ${kind} in one day, expected ${cap}`);
  if (!r.refusal || r.refusal.at !== cap + 1) {
    failures.push(`Pro ${kind} ${cap + 1} was not refused`);
    return;
  }
  if (r.refusal.status !== 429) failures.push(`Pro ${kind} refusal was HTTP ${r.refusal.status}, expected 429`);
  if (r.modelCalls !== cap) {
    failures.push(`the model was called ${r.modelCalls} times for ${kind}, expected ${cap}: the refusal must come first`);
  }
}

realError(`DAILY_CAPS.pro = ${JSON.stringify(DAILY_CAPS.pro)}   DAILY_CAPS.free = ${JSON.stringify(DAILY_CAPS.free)}`);

// 1 and 2. Pro, one day: 6 summaries, then 6 quizzes, on the same counters.
newDay('pro');
{
  const r = await run(summarize, PRO_SUMMARIES_PER_DAY + 1);
  report(`Pro, ${PRO_SUMMARIES_PER_DAY + 1} summaries of fresh documents`, r);
  expectCap('summaries', r, PRO_SUMMARIES_PER_DAY);
}
{
  const r = await run(quiz, PRO_QUIZZES_PER_DAY + 1);
  report(`Pro, same day, ${PRO_QUIZZES_PER_DAY + 1} quizzes of fresh documents`, r);
  expectCap('quizzes', r, PRO_QUIZZES_PER_DAY);
}

// 3. Control: Free, 6 summaries. The already-shipped cap.
newDay('free');
{
  const r = await run(summarize, FREE_SUMMARIES_PER_DAY + 1);
  report(`control: Free, ${FREE_SUMMARIES_PER_DAY + 1} summaries of fresh documents`, r);
  if (r.generated !== FREE_SUMMARIES_PER_DAY || !r.refusal || r.refusal.status !== 429) {
    failures.push(`control failed: Free generated ${r.generated} summaries, expected ${FREE_SUMMARIES_PER_DAY} then a 429`);
  }
}

console.log = realLog;
console.error = realError;

if (failures.length === 0) {
  console.log('PASS: 3 checks against the real /api/summarize and /api/quiz/generate handlers and the real enforceLimit.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
