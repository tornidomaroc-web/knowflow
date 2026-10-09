/**
 * Executable proof for Apple guideline 5.1.2(i) (docs/store/STORE_PATH.md S4,
 * `src/lib/ai-consent.ts`): "obtain explicit permission before" sharing
 * personal data "with third-party AI".
 *
 * PART 1, THE ROUTES. This imports the REAL `POST` of the four routes that send
 * a student's content to Anthropic or Voyage AI (/api/ingest, /api/agent,
 * /api/summarize, /api/quiz/generate) and drives each twice, with an account
 * that has not given the permission and with one that has:
 *
 *   - without it, every route answers 403 with `code: ai_consent_required`
 *     (the agent: the `X-KF-Refusal` header, its body being plain text) and a
 *     sentence in the request's language, and NOTHING happened first: no usage
 *     counter, no document-count read, no storage upload, no call to the
 *     ingestion service or to Voyage AI, no model call;
 *   - with it, the same request goes past the gate to the route's next step,
 *     the usage counter (stubbed to refuse with a 429, so the run stops there
 *     and nothing further is needed);
 *   - a summary or a quiz that already exists is still served without the
 *     permission, because re-reading it sends nothing anywhere;
 *   - the permission is the account's `user_metadata.ai_consent` at the
 *     current version: absent, null (withdrawn), an older version or a
 *     malformed value all count as not given.
 *
 * What is stubbed, and why that is honest: `NextResponse` (a response reads as
 * data); the Supabase server client, whose `getUser()` returns the account
 * under test and whose every table read, insert, RPC and storage upload is
 * counted; `enforceLimit`, counted and answering 429; the document and
 * conversation counts; the ingestion service and the query embedding (counted);
 * the Anthropic SDK (counted); `recordStudyEvent`; and `fetch` (counted).
 * Nothing leaves the machine.
 *
 * PART 2, THE CLIENT AND THE COPY, read from the source: each of the four call
 * sites awaits the sheet before its request, the dashboard layout mounts the
 * provider with the account's permission, Settings shows the card, both
 * dictionaries name both companies, and the privacy policy says so.
 *
 * Tier 0: no network, no credential, no database, no model call, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-ai-consent.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

const state = {
  user: null,
  doc: null,
  cachedQuiz: false,
  calls: { limit: 0, docCount: 0, convoCount: 0, storage: 0, insert: 0, rpc: 0, ingest: 0, embed: 0, model: 0, fetch: 0 },
};
globalThis.__aiConsentStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); },
};`;

const SUPABASE_STUB = `
const S = () => globalThis.__aiConsentStub;
function chain(table) {
  let op = 'select';
  const result = () => {
    if (table === 'documents') return { data: op === 'select' ? S().doc : null, error: null };
    if (table === 'quizzes') {
      if (op !== 'select') return { data: null, error: null };
      return { data: S().cachedQuiz ? { id: 'quiz-1', document_id: 'doc', generated_at: 'then', model: 'm', created_at: 'then', is_partial: false } : null, error: null };
    }
    if (table === 'quiz_items') {
      return { data: S().cachedQuiz ? [{ id: 'i1', quiz_id: 'quiz-1', question: 'q', options: ['a', 'b'], position: 0 }] : [], error: null };
    }
    return { data: [], count: 0, error: null };
  };
  const c = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result()).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => result();
      if (prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete') {
        return () => { op = prop; S().calls.insert++; return c; };
      }
      return () => c;
    },
  });
  return c;
}
export async function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: S().user } }) },
    from: (table) => chain(table),
    rpc: async () => { S().calls.rpc++; return { data: 1, error: null }; },
    storage: { from: () => ({ upload: async () => { S().calls.storage++; return { data: {}, error: null }; } }) },
  };
}`;

const RATE_LIMIT_STUB = `
export async function enforceLimit() {
  globalThis.__aiConsentStub.calls.limit++;
  return { allowed: false, status: 429, error: 'limit reached (stub)' };
}`;

const LIMITS_SERVER_STUB = `
export async function checkDocumentLimit() { globalThis.__aiConsentStub.calls.docCount++; return { allowed: true, limit: 99, tier: 'free' }; }
export async function checkConversationLimit() { globalThis.__aiConsentStub.calls.convoCount++; return { allowed: true, limit: 99, tier: 'free' }; }
export function conversationMonthWindow() { return { nextStart: new Date() }; }`;

const INGESTION_STUB = `
export function getServiceUrl() { globalThis.__aiConsentStub.calls.ingest++; return 'http://ingestion.invalid'; }
export async function embedQuery() { globalThis.__aiConsentStub.calls.embed++; return [0]; }`;

const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor() {
    this.messages = { create: async () => { globalThis.__aiConsentStub.calls.model++; throw new Error('the model must not be reached in this proof'); } };
  }
}`;

const STUDY_EVENTS_STUB = `export async function recordStudyEvent() {}`;

globalThis.fetch = async () => {
  state.calls.fetch++;
  throw new Error('no network in this proof');
};

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
    if (spec === '@/lib/rate-limit') return { url: inline(RATE_LIMIT_STUB), shortCircuit: true };
    if (spec === '@/lib/limits-server') return { url: inline(LIMITS_SERVER_STUB), shortCircuit: true };
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

const load = async (p) => (await import(pathToFileURL(resolvePath(ROOT, p)).href));
const ingest = (await load('src/app/api/ingest/route.ts')).POST;
const agent = (await load('src/app/api/agent/route.ts')).POST;
const summarize = (await load('src/app/api/summarize/route.ts')).POST;
const quiz = (await load('src/app/api/quiz/generate/route.ts')).POST;
const consent = await load('src/lib/ai-consent.ts');
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');

const failures = [];
const passes = [];
const need = (cond, msg) => { (cond ? passes : failures).push(msg); };

const realLog = console.log;
const realError = console.error;
console.log = () => {};
console.error = () => {};

const USER_WITHOUT = { id: 'user-1', email: 's@example.com', user_metadata: {} };
const USER_WITH = { id: 'user-1', email: 's@example.com', user_metadata: consent.aiConsentGrant(new Date('2026-10-09T00:00:00Z')) };
const READY_DOC = {
  id: 'doc', kb_id: 'kb', status: 'ready',
  markdown_content: 'مرونة الطلب السعرية تقيس استجابة الكمية المطلوبة للتغير في السعر. '.repeat(20),
  summary: null, summary_generated_at: null, summary_model: null, summary_is_partial: null,
};

function resetCalls() {
  for (const k of Object.keys(state.calls)) state.calls[k] = 0;
}
const touched = () => Object.entries(state.calls).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`);

function ingestRequest(locale) {
  const form = new FormData();
  form.append('file', new File(['Photosynthesis turns light into chemical energy. '.repeat(40)], 'notes.txt', { type: 'text/plain' }));
  form.append('kb_id', 'kb');
  form.append('locale', locale);
  return new Request('https://tryknowflow.com/api/ingest', { method: 'POST', body: form });
}
const jsonRequest = (path, body) =>
  new Request(`https://tryknowflow.com${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const ROUTES = [
  { name: '/api/ingest', post: ingest, make: (l) => ingestRequest(l) },
  { name: '/api/agent', post: agent, make: (l) => jsonRequest('/api/agent', { message: 'What is photosynthesis?', kb_id: 'kb', locale: l }) },
  { name: '/api/summarize', post: summarize, make: (l) => jsonRequest('/api/summarize', { document_id: 'doc', locale: l }) },
  { name: '/api/quiz/generate', post: quiz, make: (l) => jsonRequest('/api/quiz/generate', { document_id: 'doc', locale: l }) },
];

async function readRefusal(res) {
  const text = await res.text();
  let code = res.headers.get('X-KF-Refusal');
  let message = text;
  try {
    const body = JSON.parse(text);
    code = code ?? body.code;
    message = body.error;
  } catch { /* the agent answers in plain text */ }
  return { code, message };
}

// 1. Without the permission: refused first, in the request's language.
for (const r of ROUTES) {
  for (const locale of ['en', 'ar']) {
    state.user = USER_WITHOUT; state.doc = { ...READY_DOC }; state.cachedQuiz = false;
    resetCalls();
    const res = await r.post(r.make(locale));
    const { code, message } = await readRefusal(res);
    const label = `${r.name} (${locale}) without the permission`;
    realError(`${label}: HTTP ${res.status} code=${code} touched=[${touched().join(', ')}]`);
    need(res.status === 403, `${label}: HTTP 403 (got ${res.status})`);
    need(code === consent.AI_CONSENT_REFUSAL, `${label}: code ${consent.AI_CONSENT_REFUSAL} (got ${code})`);
    const dict = locale === 'ar' ? ar : en;
    need(message === dict.dashboard.aiConsent.declined, `${label}: the sentence is the ${locale} dictionary's declined line`);
    need(touched().length === 0, `${label}: nothing ran before the refusal (touched: ${touched().join(', ') || 'none'})`);
  }
}

// 2. With the permission: the gate lets the request through to the counter.
for (const r of ROUTES) {
  state.user = USER_WITH; state.doc = { ...READY_DOC }; state.cachedQuiz = false;
  resetCalls();
  const res = await r.post(r.make('en'));
  const label = `${r.name} with the permission`;
  realError(`${label}: HTTP ${res.status} touched=[${touched().join(', ')}]`);
  need(res.status === 429, `${label}: past the gate to the usage counter (stubbed 429; got ${res.status})`);
  need(state.calls.limit === 1, `${label}: the usage counter was reached once (got ${state.calls.limit})`);
  need(state.calls.model === 0 && state.calls.storage === 0 && state.calls.ingest === 0 && state.calls.embed === 0,
    `${label}: and nothing beyond it ran in this harness`);
}

// 3. An existing summary or quiz is read back without the permission.
{
  state.user = USER_WITHOUT; state.doc = { ...READY_DOC, summary: 'A stored summary.', summary_is_partial: false }; state.cachedQuiz = false;
  resetCalls();
  const res = await summarize(jsonRequest('/api/summarize', { document_id: 'doc', locale: 'en' }));
  const body = await res.json();
  need(res.status === 200 && body.cached === true && body.summary === 'A stored summary.', `a stored summary is served without the permission (HTTP ${res.status}, cached=${body.cached})`);
  need(state.calls.model === 0 && state.calls.limit === 0, 'and reading it calls neither the model nor the counter');
}
{
  state.user = USER_WITHOUT; state.doc = { ...READY_DOC }; state.cachedQuiz = true;
  resetCalls();
  const res = await quiz(jsonRequest('/api/quiz/generate', { document_id: 'doc', locale: 'en' }));
  const body = await res.json();
  need(res.status === 200 && body.cached === true, `a stored quiz is served without the permission (HTTP ${res.status}, cached=${body.cached})`);
  need(state.calls.model === 0 && state.calls.limit === 0, 'and reading it calls neither the model nor the counter');
}

// 4. What counts as the permission.
const cases = [
  [null, false, 'no user'],
  [{}, false, 'no metadata'],
  [{ user_metadata: {} }, false, 'never asked'],
  [{ user_metadata: { ...consent.AI_CONSENT_WITHDRAWN } }, false, 'withdrawn (null)'],
  [{ user_metadata: { ai_consent: { version: consent.AI_CONSENT_VERSION - 1, at: 'x' } } }, false, 'an older version'],
  [{ user_metadata: { ai_consent: true } }, false, 'a bare true'],
  [{ user_metadata: { ai_consent: { version: String(consent.AI_CONSENT_VERSION) } } }, false, 'a version that is a string'],
  [{ user_metadata: consent.aiConsentGrant(new Date()) }, true, 'what the sheet writes'],
];
for (const [user, expected, label] of cases) {
  need(consent.hasAiConsent(user) === expected, `hasAiConsent: ${label} -> ${expected}`);
}
need(/^\d{4}-\d\d-\d\dT/.test(consent.aiConsentGrant(new Date()).ai_consent.at), 'the grant records when it was given');

// PART 2. The client, the copy and the policy, from the source.
const src = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const callSites = [
  ['src/components/upload/DropZone.tsx', "send(formData"],
  ['src/components/agent/ChatBox.tsx', "fetch('/api/agent'"],
  ['src/components/summary/SummarySection.tsx', "fetch('/api/summarize'"],
  ['src/components/quiz/QuizSection.tsx', "fetch('/api/quiz/generate'"],
];
for (const [file, request] of callSites) {
  const s = src(file);
  const gate = s.indexOf('await ensureAiConsent()');
  const req = s.indexOf(request);
  need(gate > 0 && req > 0 && gate < req, `${file}: the sheet is awaited before ${request}`);
  need(/aiConsent\.declined/.test(s), `${file}: a declined sheet shows the declined sentence`);
}
const layout = src('src/app/[locale]/dashboard/layout.tsx');
need(/<AiConsentProvider[\s\S]*initialConsented=\{hasAiConsent\(user\)\}/.test(layout), 'the dashboard layout mounts the provider with the account\'s permission');
need(/<AiConsentCard \/>/.test(src('src/app/[locale]/dashboard/settings/page.tsx')), 'Settings shows the permission card');
need(/\{consentCard\}/.test(src('src/components/dashboard/SettingsPanel.tsx')), 'the Settings panel renders it');

const KEYS = Object.keys(en.dashboard.aiConsent);
need(KEYS.length === 18, `the en sheet has 18 strings (got ${KEYS.length})`);
need(JSON.stringify(Object.keys(ar.dashboard.aiConsent)) === JSON.stringify(KEYS), 'ar has the same keys in the same order');
for (const [dict, l] of [[en, 'en'], [ar, 'ar']]) {
  const c = dict.dashboard.aiConsent;
  need(c.anthropic.includes('Anthropic'), `${l}: the sheet names Anthropic`);
  need(c.voyage.includes('Voyage AI'), `${l}: the sheet names Voyage AI`);
  need(c.declined.includes('Anthropic') && c.declined.includes('Voyage AI'), `${l}: the refusal names both`);
  need(KEYS.every((k) => typeof c[k] === 'string' && c[k].trim().length > 0), `${l}: no empty string`);
  need(KEYS.every((k) => !/\u2014/.test(c[k])), `${l}: no em dash (VISUAL_LANGUAGE)`);
}
const privacy = src('src/app/[locale]/(site)/privacy/page.tsx');
need(/We ask your permission before anything is sent to Anthropic or Voyage AI/.test(privacy), 'the privacy policy says the permission is asked first');
need(/withdraw the permission at any time in Settings/.test(privacy), 'and that it can be withdrawn in Settings');

console.log = realLog;
console.error = realError;

if (failures.length === 0) {
  console.log(`PASS: ${passes.length} checks. The four AI routes refuse without the permission before anything runs, pass with it, still serve what is stored; the client asks first; the copy names both companies.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} of ${failures.length + passes.length} checks`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
