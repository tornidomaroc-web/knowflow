/**
 * Executable proof for G2 (page or slide numbers in citations) and G4 (the
 * file's own language and terms), at the PROMPT and at the ROUTE.
 *
 * 1. THE PROMPT BUILDER (src/lib/answer-prompt.ts): the system rules carry G4
 *    (a term as the file writes it, once, beside the translation; names,
 *    formulas, code, units and quoted lines never translated) and G2 (a page
 *    named only from a passage's label, never invented); a passage is
 *    labelled "(file, p. 12)", "(file, pp. 3-4)", "(file, slide 5)", or
 *    "(file)" when the page is unknown, and a set of chunks without pages
 *    builds BYTE-FOR-BYTE the context and user turn the route built before G2.
 * 2. THE PAGE RULE (src/lib/citation-pages.ts): only a valid triple is a
 *    page; anything partial or out of range is no page; the pill's words come
 *    from the real dictionaries, with Western digits.
 * 3. THE ROUTE (the REAL POST of src/app/api/agent/route.ts): with the page
 *    columns read, the model's user turn names each passage's page and the
 *    X-Citations header carries them; with the columns MISSING (the read
 *    answers 42703 / PGRST204, as production does before the migration) the
 *    answer still comes, every label is the file alone and every citation's
 *    page is null; with invalid stored values, no page is invented.
 *
 * Stubbed exactly as scripts/verify-pro-question-cap.mjs stubs them:
 * NextResponse, the Supabase server client, the Anthropic SDK (each call is
 * captured; none leaves the machine), embedQuery, recordStudyEvent and the
 * entitlement. Tier 0: no network, no credential, no database, no model call.
 *
 * Usage: node --experimental-strip-types scripts/verify-answer-prompt.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const state = { chunks: [], pageRows: [], pageError: null, calls: [], pageReads: 0 };
globalThis.__answerPromptStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200 }); },
};`;
const ENTITLEMENT_STUB = `export async function getEntitlement() { return { tier: 'pro' }; }`;
const SUPABASE_STUB = `
const S = () => globalThis.__answerPromptStub;
function chain(table) {
  let result;
  if (table === 'chunks') { S().pageReads++; result = S().pageError ? { data: null, error: S().pageError } : { data: S().pageRows, error: null }; }
  else if (table === 'conversations') result = { data: { id: 'conv-new' }, count: 1, error: null };
  else result = { data: [], count: 0, error: null };
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
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: { ai_consent: { version: 1, at: '2026-10-09T00:00:00.000Z' } } } } }) },
    from: (table) => chain(table),
    rpc: async (fn) => (fn === 'increment_usage' ? { data: 1, error: null } : { data: S().chunks, error: null }),
  };
}`;
const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (args) => {
        globalThis.__answerPromptStub.calls.push(args);
        return (async function* () {
          yield { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } };
          yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } };
        })();
      },
    };
  }
}`;
const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => (/\.[a-z]+$/i.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : resolvePath(base, 'index.ts'));
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk') return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec === '@/lib/entitlement') return { url: inline(ENTITLEMENT_STUB), shortCircuit: true };
    if (spec === '@/lib/ingestion') return { url: inline('export async function embedQuery() { return [0]; }'), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline('export async function recordStudyEvent() {}'), shortCircuit: true };
    if (spec.startsWith('@/')) return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    if (spec.startsWith('.') && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
      return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

// The route's 2-second burst guard is not under test: the clock moves 3 s per call, as in the cap proof.
let clock = Date.UTC(2026, 10, 6, 12, 0, 0);
Date.now = () => (clock += 3000);

const imp = (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const { SYSTEM_INSTRUCTIONS, buildContextBlock, buildUserTurn, passageLabel } = await imp('src/lib/answer-prompt.ts');
const { knownPages, pageLabel } = await imp('src/lib/citation-pages.ts');
const { en } = await imp('src/lib/i18n/locales/en.ts');
const { ar } = await imp('src/lib/i18n/locales/ar.ts');

const fails = [];
let passed = 0;
const need = (ok, msg) => { (ok ? passed++ : fails.push(msg)); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };

// ── 1. the prompt builder ───────────────────────────────────────────────────
const RULES = [
  [/write each technical term as the passage writes it, once, beside your translation/, 'G4: a term as the file writes it, once, beside the translation'],
  [/Never translate names of people, places or files, formulas, equations, code, units or quoted lines; copy them exactly/, 'G4: names, formulas, code, units and quoted lines are never translated'],
  [/Always answer in the same language the user used/, 'the answer stays in the student\'s language (unchanged rule)'],
  [/You may name that page or slide when you cite it\. Never give a page or slide number for a passage whose label has none, and never guess one\./, 'G2: a page only from the label, never invented'],
  [/Cite the passages you use with bracketed numbers like \[1\], \[2\]/, 'the [n] citation rule (unchanged)'],
  [/If the answer is not present in the passages, say so clearly\. Do not fabricate\./, 'the no-fabrication rule (unchanged)'],
];
for (const [re, what] of RULES) need(re.test(SYSTEM_INSTRUCTIONS), `system rules: ${what}`);

const P = (filename, content, s, e, k) => ({ filename, content, page_start: s, page_end: e, page_kind: k });
const four = [P('sum.pdf', 'A', 12, 12, 'page'), P('cheat.pdf', 'B', 3, 4, 'page'), P('deck.pptx', 'C', 5, 5, 'slide'), P('notes.docx', 'D', null, null, null)];
need(JSON.stringify(four.map(passageLabel)) === JSON.stringify(['(sum.pdf, p. 12)', '(cheat.pdf, pp. 3-4)', '(deck.pptx, slide 5)', '(notes.docx)']),
  `passage labels: ${four.map(passageLabel).join(' ')}`);
need(passageLabel(P('deck.pptx', 'x', 5, 6, 'slide')) === '(deck.pptx, slides 5-6)', 'a slide range: (deck.pptx, slides 5-6)');

// Byte-for-byte what the route built before G2 (8ac7948, route.ts), for chunks without pages.
const old = (chunks) => chunks.length ? chunks.map((c, i) => `[${i + 1}] (${c.filename})\n${c.content}`).join('\n\n---\n\n') : '(no relevant passages found)';
const oldTurn = (ctx, m) => `Retrieved passages:\n\n${ctx}\n\n---\n\nQuestion: ${m}`;
const plain = [{ filename: 'a.pdf', content: 'one' }, { filename: 'ملف.docx', content: 'اثنان' }];
need(buildContextBlock(plain) === old(plain), 'a context of chunks with no page is byte-identical to the pre-G2 context');
need(buildContextBlock([]) === old([]), 'no passages: "(no relevant passages found)", as before');
need(buildUserTurn('CTX', 'سؤال') === oldTurn('CTX', 'سؤال'), 'the user turn is byte-identical to the pre-G2 template');

// ── 2. the page rule ────────────────────────────────────────────────────────
const bad = [
  ['page_start 0', { page_start: 0, page_end: 1, page_kind: 'page' }], ['end before start', { page_start: 4, page_end: 3, page_kind: 'page' }],
  ["kind 'sheet'", { page_start: 1, page_end: 1, page_kind: 'sheet' }], ['no kind', { page_start: 1, page_end: 1 }],
  ['kind only', { page_kind: 'slide' }], ['a fraction', { page_start: 1.5, page_end: 2, page_kind: 'page' }],
  ['a string', { page_start: '3', page_end: '3', page_kind: 'page' }], ['all null', { page_start: null, page_end: null, page_kind: null }],
];
for (const [label, row] of bad) need(knownPages(row) === null && pageLabel(row, en.dashboard.agent) === null, `no page from ${label}`);
const labels = (dict) => four.map((c) => pageLabel(c, dict.dashboard.agent));
need(JSON.stringify(labels(en)) === JSON.stringify(['p. 12', 'pp. 3-4', 'slide 5', null]), `English pill labels: ${JSON.stringify(labels(en))}`);
need(JSON.stringify(labels(ar)) === JSON.stringify(['ص 12', 'ص 3-4', 'شريحة 5', null]), `Arabic pill labels: ${JSON.stringify(labels(ar))}`);
need(pageLabel(P('d.pptx', '', 5, 6, 'slide'), ar.dashboard.agent) === 'شرائح 5-6', 'Arabic slide range: شرائح 5-6 (approved app v7)');
need(pageLabel(P('d.pptx', '', 5, 6, 'slide'), en.dashboard.agent) === 'slides 5-6', 'English slide range: slides 5-6');
need(!labels(ar).concat(labels(en)).join('').match(/[٠-٩۰-۹]/), 'Western digits only');

// ── 3. the route ────────────────────────────────────────────────────────────
const { POST } = await imp('src/app/api/agent/route.ts');
const quiet = { log: console.log, error: console.error, warn: console.warn };
const warns = [];
async function ask() {
  state.calls = [];
  console.log = () => {}; console.error = () => {}; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const res = await POST({ json: async () => ({ message: 'ما هي مرونة الطلب؟', kb_id: 'kb-1', locale: 'ar' }) });
    const body = await res.text();
    const header = res.headers.get('X-Citations');
    return { status: res.status, body, cites: header ? JSON.parse(Buffer.from(header, 'base64').toString()) : null, call: state.calls[0] };
  } finally { Object.assign(console, quiet); }
}
state.chunks = [
  { id: 'c1', document_id: 'd1', chunk_index: 0, content: 'Elasticity...', filename: 'sum.pdf', similarity: 0.9 },
  { id: 'c2', document_id: 'd2', chunk_index: 3, content: 'Income...', filename: 'cheat.pdf', similarity: 0.8 },
  { id: 'c3', document_id: 'd3', chunk_index: 1, content: 'Slide text', filename: 'deck.pptx', similarity: 0.7 },
  { id: 'c4', document_id: 'd4', chunk_index: 0, content: 'Notes', filename: 'notes.docx', similarity: 0.6 },
];
const turnOf = (r) => r.call?.messages?.at(-1)?.content || '';
const pagesOf = (r) => (r.cites || []).map((c) => [c.page_start, c.page_end, c.page_kind]);

state.pageRows = [
  { id: 'c1', page_start: 12, page_end: 12, page_kind: 'page' }, { id: 'c2', page_start: 3, page_end: 4, page_kind: 'page' },
  { id: 'c3', page_start: 5, page_end: 5, page_kind: 'slide' }, { id: 'c4', page_start: null, page_end: null, page_kind: null },
];
state.pageError = null;
let r = await ask();
need(r.status === 200 && r.call?.system === SYSTEM_INSTRUCTIONS, 'route, pages read: answered, with the builder\'s system rules');
need(['[1] (sum.pdf, p. 12)', '[2] (cheat.pdf, pp. 3-4)', '[3] (deck.pptx, slide 5)', '[4] (notes.docx)'].every((l) => turnOf(r).includes(l)), 'route, pages read: the model\'s passages are labelled p. 12, pp. 3-4, slide 5, and the .docx by name alone');
need(JSON.stringify(pagesOf(r)) === JSON.stringify([[12, 12, 'page'], [3, 4, 'page'], [5, 5, 'slide'], [null, null, null]]), `route, pages read: X-Citations pages ${JSON.stringify(pagesOf(r))}`);

state.pageError = { code: '42703', message: 'column chunks.page_start does not exist' };
warns.length = 0;
r = await ask();
need(r.status === 200 && r.body === 'answer', 'route, columns MISSING (before the migration): the answer still comes');
need(turnOf(r).includes('[1] (sum.pdf)\nElasticity...') && !/p\. \d|pp\. |slide \d/.test(turnOf(r)), 'route, columns missing: every passage is labelled by its file alone, no page anywhere');
need(pagesOf(r).every((p) => p.every((v) => v === null)), 'route, columns missing: every citation\'s page is null');
need(warns.some((w) => w.includes('[chunk-pages]') && w.includes('42703')), 'route, columns missing: one [chunk-pages] warning names the code');

state.pageError = null;
state.pageRows = [{ id: 'c1', page_start: 0, page_end: 2, page_kind: 'page' }, { id: 'c2', page_start: 3, page_end: 3, page_kind: 'sheet' }, { id: 'c3', page_start: 5, page_end: null, page_kind: 'slide' }];
r = await ask();
need(!/p\. \d|pp\. |slide \d/.test(turnOf(r)) && pagesOf(r).every((p) => p.every((v) => v === null)), 'route, invalid stored values: no page invented, in the passages or the header');

state.chunks = [];
const before = state.pageReads;
r = await ask();
need(r.status === 200 && state.pageReads === before && turnOf(r).includes('(no relevant passages found)'), 'route, nothing retrieved: no page read at all, the context as before');

const route = readFileSync(resolvePath(ROOT, 'src/app/api/agent/route.ts'), 'utf8');
need(!/const SYSTEM_INSTRUCTIONS\s*=/.test(route) && /from '@\/lib\/answer-prompt'/.test(route), 'route.ts keeps no copy of the rules: it imports them from answer-prompt.ts');

console.log(`\n${passed} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
