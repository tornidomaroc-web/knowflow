/**
 * Executable proof for register #114's quiz ruling: a quiz the model did not
 * finish can never be saved, at ANY point where the output ceiling could cut it.
 *
 * /api/quiz/generate has the same shape as /api/summarize (one Haiku call with
 * an output ceiling, generate-once per (document, language)), so the summary
 * defect had to be ruled out here too. The route never reads `stop_reason`. It is
 * safe for a structural reason instead: the reply is a JSON array, and the route
 * saves only what parses as a whole array of valid items. This check does not
 * trust that argument. It takes a valid five-question Arabic reply, cuts it at
 * every character position (every place `max_tokens` could land), drives the
 * REAL handler with each cut, and fails if any cut is saved. A control proves the
 * whole reply IS saved, so a route that refused everything would not pass.
 *
 * This passes on main as well as on the #114 branch. It is a guard, not the fix:
 * it fails the day someone makes the parse "lenient" (repairing or truncating
 * JSON to salvage items), which would start saving unfinished quizzes.
 *
 * Stubbed: `NextResponse`, the Supabase server client (a ready document, no
 * cached quiz, every insert recorded instead of written), the Anthropic SDK (the
 * reply is chosen, no network, no cost) and `enforceLimit`. The route's own
 * parsing, validation and save logic is the real thing, unmodified.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-quiz-cutoff.mjs
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

const state = { reply: null, quizInserts: 0, itemInserts: 0 };
globalThis.__quizCutoffStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return { status: (init && init.status) || 200, body }; },
};`;

const SUPABASE_STUB = `
const S = () => globalThis.__quizCutoffStub;
const DOC = {
  id: 'doc-1', status: 'ready',
  markdown_content: 'الطلب هو الكمّيّات التي يرغب المستهلك في شرائها. '.repeat(40),
};
function table(name) {
  if (name === 'documents') {
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: DOC, error: null }) }) }) };
  }
  if (name === 'quizzes') {
    return {
      // cache check: no quiz yet for this (document, language)
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      insert: (row) => ({
        select: () => ({
          single: async () => {
            S().quizInserts++;
            return { data: { id: 'quiz-1', ...row, created_at: row.generated_at }, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    };
  }
  if (name === 'quiz_items') {
    return {
      insert: (rows) => ({
        select: async () => {
          S().itemInserts++;
          return { data: rows.map((r, i) => ({ id: 'item-' + i, ...r })), error: null };
        },
      }),
    };
  }
  throw new Error('unexpected table ' + name);
}
export async function createClient() {
  return { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) }, from: table };
}`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = { create: async () => globalThis.__quizCutoffStub.reply };
  }
}`;

const RATE_LIMIT_STUB = `export async function enforceLimit() { return { allowed: true, count: 1 }; }`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk') return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec === '@/lib/rate-limit') return { url: inline(RATE_LIMIT_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) {
      const base = resolvePath(ROOT, 'src', spec.slice(2));
      // A bare path may be a file or a folder with an index (`@/lib/i18n` became one, #83).
      const ts = /\.[a-z]+$/i.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : resolvePath(base, 'index.ts');
      return { url: pathToFileURL(ts).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { POST } = await import(
  pathToFileURL(resolvePath(ROOT, 'src/app/api/quiz/generate/route.ts')).href
);

// A valid five-question Arabic quiz, as the model writes it. The route prefills
// "[" as the assistant turn, so the model's reply is everything AFTER that "[".
// Options deliberately contain brackets and quotes, the characters a naive
// salvage would trip on.
const QUIZ = [
  { question: 'ما العلاقة بين السعر والكمّيّة المطلوبة وفق قانون الطلب؟', options: ['طرديّة', 'عكسيّة', 'لا علاقة', 'ثابتة'], correct_index: 1 },
  { question: 'ما سعر التوازن في جدول المقرّر؟', options: ['2 درهم', '3 دراهم', '4 دراهم', '5 دراهم'], correct_index: 1 },
  { question: 'إذا كانت مرونة الطلب 1.72، فالطلب:', options: ['مرن', 'غير مرن', 'أحاديّ المرونة'], correct_index: 0 },
  { question: 'ما كمّيّة التعادل في التمرين الثاني؟', options: ['[30] وحدة', '"40" وحدة', '50 وحدة'], correct_index: 1 },
  { question: 'المرونة الدخليّة السالبة تعني أن السلعة:', options: ['عاديّة', 'رديئة', 'كماليّة', 'بديلة'], correct_index: 1 },
];
const FULL = JSON.stringify(QUIZ);
const COMPLETION = FULL.slice(1);
const reply = (text, stop_reason) => ({
  content: [{ type: 'text', text }],
  stop_reason,
  usage: { input_tokens: 9588, output_tokens: 900 },
});

const realLog = console.log;
const realError = console.error;
console.log = () => {};
console.error = () => {};

const failures = [];
const call = () => POST({ json: async () => ({ document_id: 'doc-1', locale: 'ar' }) });

// Control first: the whole reply is saved, once.
state.reply = reply(COMPLETION, 'end_turn');
state.quizInserts = 0;
const whole = await call();
if (whole.status !== 200 || state.quizInserts !== 1) {
  failures.push(`control: whole quiz gave HTTP ${whole.status} with ${state.quizInserts} saves, expected 200 and 1`);
}

// Every strict prefix of the reply, as max_tokens could leave it.
let saved = 0;
let firstSaved = null;
for (let cut = 0; cut < COMPLETION.length; cut++) {
  state.reply = reply(COMPLETION.slice(0, cut), 'max_tokens');
  state.quizInserts = 0;
  state.itemInserts = 0;
  const res = await call();
  if (state.quizInserts > 0 || state.itemInserts > 0 || res.status === 200) {
    saved++;
    if (firstSaved === null) firstSaved = cut;
  }
}
if (saved > 0) {
  failures.push(`${saved} cut-off replies were saved (first at char ${firstSaved}: ...${JSON.stringify(COMPLETION.slice(Math.max(0, firstSaved - 30), firstSaved))})`);
}

console.log = realLog;
console.error = realError;
realError(`===== quiz cut at every one of ${COMPLETION.length} positions: ${saved} saved`);

if (failures.length === 0) {
  console.log(`PASS: whole quiz saved once; 0 of ${COMPLETION.length} cut-off replies saved, against the real /api/quiz/generate handler.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
