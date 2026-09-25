/**
 * Executable proof for register #114, at the ROUTE level: a summary that the
 * model did not finish is never saved as if it were complete.
 *
 * Found by the 2026-09-24 cost measurement. An Arabic summary of a 13,421-char
 * document hit the old 1,024-token ceiling, stopped mid-word with
 * `stop_reason: "max_tokens"`, and was saved. Summaries are generate-once with no
 * regenerate path (register #26), so that student could never get a whole one.
 *
 * This imports the REAL `POST` from `src/app/api/summarize/route.ts` and drives
 * it with a stubbed model reply. What is stubbed, and why that is honest:
 * `NextResponse` (so a response reads as data), the Supabase server client (so a
 * ready document exists and every `update` is recorded instead of written), the
 * Anthropic SDK (so the stop reason is chosen, with no network call and no
 * cost), `enforceLimit` (always allows) and `recordStudyEvent` (no-op). The
 * route's own logic -- what it sends the model, what it keeps, what it answers
 * -- is the real thing, unmodified. `@/lib/usage-cost` is real too.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-summary-cutoff.mjs
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// Arabic output density MEASURED on production, 2026-09-24: the cut-off summary
// spent 1,024 output tokens on 1,628 characters (0.63 tokens/char), and Arabic
// prose here runs 5.83 characters a word, so about 3.7 tokens a word. The
// ceiling must hold the word budget the prompt sets, written in Arabic, or an
// obedient Arabic summary is still cut off. This number is the evidence the
// check holds the route to; it is not read from the route.
const MEASURED_AR_TOKENS_PER_WORD = 3.7;

const state = { reply: null, request: null, updates: [] };
globalThis.__summaryCutoffStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return { status: (init && init.status) || 200, body }; },
};`;

// A ready document with no summary yet, owned by the caller. Every update is
// recorded, never written.
const SUPABASE_STUB = `
const S = () => globalThis.__summaryCutoffStub;
export async function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    id: 'doc-1', status: 'ready',
                    markdown_content: 'الطلب هو الكمّيّات التي يرغب المستهلك في شرائها. '.repeat(40),
                    summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: false,
                  },
                  error: null,
                }),
              };
            },
          };
        },
        update(values) {
          return { eq: async () => { S().updates.push(values); return { error: null }; } };
        },
      };
    },
  };
}`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (req) => {
        globalThis.__summaryCutoffStub.request = req;
        return globalThis.__summaryCutoffStub.reply;
      },
    };
  }
}`;

const RATE_LIMIT_STUB = `export async function enforceLimit() { return { allowed: true, count: 1 }; }`;
const STUDY_EVENTS_STUB = `export async function recordStudyEvent() {}`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk') return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec === '@/lib/rate-limit') return { url: inline(RATE_LIMIT_STUB), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline(STUDY_EVENTS_STUB), shortCircuit: true };
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
  pathToFileURL(resolvePath(ROOT, 'src/app/api/summarize/route.ts')).href
);

// The model's words, as the SDK returns them. The cut-off text is the real tail
// of the summary saved on production, ending mid-word.
const CUT_OFF_TEXT = 'ملخص مقرر مبادئ الاقتصاد الجزئي. مرونة الطلب السعرية تقيس استجابة الكمية المطلوبة لتغير السعر، إذا كانت المرونة أك';
const WHOLE_TEXT = 'ملخص مقرر مبادئ الاقتصاد الجزئي. يدرس المقرر سلوك المستهلك والمنتج والسوق الواحد.';
const reply = (text, stop_reason) => ({
  content: [{ type: 'text', text }],
  stop_reason,
  usage: { input_tokens: 9536, output_tokens: stop_reason === 'max_tokens' ? 1024 : 300 },
});

const failures = [];
const logs = [];
const realLog = console.log;
const realError = console.error;
console.log = (...a) => logs.push(a.map(String).join(' '));
console.error = (...a) => logs.push(a.map(String).join(' '));

async function check(label, modelReply, expect) {
  state.reply = modelReply;
  state.request = null;
  state.updates = [];
  logs.length = 0;
  const res = await POST({ json: async () => ({ document_id: 'doc-1', locale: 'ar' }) });

  realError(`===== ${label}`);
  realError(`  HTTP ${res.status}  saved=${state.updates.length}  body=${JSON.stringify(res.body).slice(0, 140)}`);

  if (expect.saved && res.status !== 200) failures.push(`${label}: status ${res.status}, expected 200`);
  if (!expect.saved && res.status === 200) failures.push(`${label}: answered 200, expected a refusal`);
  if (expect.saved && state.updates.length !== 1) failures.push(`${label}: saved ${state.updates.length} times, expected once`);
  if (!expect.saved && state.updates.length !== 0) {
    failures.push(`${label}: SAVED a summary the model did not finish: ${JSON.stringify(state.updates[0].summary).slice(0, 80)}`);
  }
  if (!expect.saved && res.body && typeof res.body.summary === 'string') {
    failures.push(`${label}: returned the unfinished summary to the student`);
  }
  if (!expect.saved && expect.logContains && !logs.join(' | ').includes(expect.logContains)) {
    failures.push(`${label}: log missing ${expect.logContains}`);
  }
}

// 1. The case found on production.
await check('cut off at the output ceiling (max_tokens)', reply(CUT_OFF_TEXT, 'max_tokens'), {
  saved: false,
  logContains: '[summary-incomplete]',
});
// 2. Any other unfinished stop is not a finished summary either.
await check('stopped for any other reason (refusal)', reply(WHOLE_TEXT, 'refusal'), {
  saved: false,
  logContains: '[summary-incomplete]',
});
// 3. Control: a finished summary is still saved exactly once. Without this, a
//    route that refused everything would pass checks 1 and 2.
await check('finished (end_turn)', reply(WHOLE_TEXT, 'end_turn'), { saved: true });

// 4. The ceiling holds the length the prompt asks for, written in Arabic.
{
  const req = state.request;
  const system = Array.isArray(req.system) ? req.system.map((b) => b.text).join('\n') : String(req.system);
  const m = system.match(/at most (\d[\d,]*) words/i);
  realError('===== the ceiling holds the prompt\'s word budget in Arabic');
  if (!m) {
    failures.push('prompt sets no word budget ("at most N words"), so no ceiling can be sized to it');
    realError(`  max_tokens=${req.max_tokens}  word budget=(none)`);
  } else {
    const words = Number(m[1].replace(/,/g, ''));
    const needed = Math.ceil(words * MEASURED_AR_TOKENS_PER_WORD);
    realError(`  max_tokens=${req.max_tokens}  word budget=${words}  Arabic tokens needed=${needed}`);
    if (req.max_tokens < needed) {
      failures.push(`max_tokens ${req.max_tokens} < ${needed} (${words} words x ${MEASURED_AR_TOKENS_PER_WORD} measured Arabic tokens/word)`);
    }
  }
}

console.log = realLog;
console.error = realError;

if (failures.length === 0) {
  console.log('PASS: 4 checks against the real /api/summarize handler.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
