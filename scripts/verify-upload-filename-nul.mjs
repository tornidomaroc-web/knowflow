/**
 * Executable proof: /api/ingest never hands Postgres a file name holding
 * U+0000. Postgres `text` cannot store it (22P05, the error #295 fixed for the
 * converted text), and the name comes from the client, so a crafted multipart
 * name could carry one. The route removes U+0000 from `documents.filename` and
 * changes nothing else in the name.
 *
 * The REAL route's POST runs with: NextResponse, the Supabase server client
 * (every insert payload recorded; getUser/getSession answer a consenting
 * account), enforceLimit and the document count (allowed), the ingestion
 * service URL and recordStudyEvent stubbed, and `fetch` refused, so the run
 * stops at the forwarding step after the documents insert, with a 500. What
 * is asserted is the payload of that insert.
 *
 * RED ON MAIN: the route stores `file.name` as sent, so the NUL case fails.
 *
 * Tier 0: no network, no credential, no database, no app.
 * Usage: node --experimental-strip-types scripts/verify-upload-filename-nul.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const state = { user: null, inserts: [] };
globalThis.__nulStub = state;
process.env.INGESTION_TOKEN = 'proof-token';

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); },
};`;
const SUPABASE_STUB = `
const S = () => globalThis.__nulStub;
function chain(table) {
  let payload = null;
  const result = () => ({ data: payload ? { ...payload } : [], count: 0, error: null });
  const c = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result()).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => result();
      if (prop === 'insert') return (row) => { payload = row; S().inserts.push({ table, row }); return c; };
      return () => c;
    },
  });
  return c;
}
export async function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: S().user } }),
      getSession: async () => ({ data: { session: { access_token: 'user-token' } } }),
    },
    from: (table) => chain(table),
    rpc: async () => ({ data: 1, error: null }),
    storage: { from: () => ({ upload: async () => ({ data: {}, error: null }) }) },
  };
}`;
const RATE_LIMIT_STUB = `export async function enforceLimit() { return { allowed: true }; } export async function enforceUploadLimit() { return { allowed: true }; }`;
const LIMITS_SERVER_STUB = `export async function checkDocumentLimit() { return { allowed: true, limit: 99, tier: 'free' }; }`;
const INGESTION_STUB = `export function getServiceUrl() { return 'http://ingestion.invalid'; }
export async function embedQuery() { return [0]; }`;
const STUDY_EVENTS_STUB = `export async function recordStudyEvent() {}`;

globalThis.fetch = async () => { throw new Error('no network in this proof'); };

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => {
  if (/\.[a-z]+$/i.test(base)) return base;
  if (existsSync(base + '.ts')) return base + '.ts';
  return resolvePath(base, 'index.ts');
};
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec === '@/lib/rate-limit') return { url: inline(RATE_LIMIT_STUB), shortCircuit: true };
    if (spec === '@/lib/limits-server') return { url: inline(LIMITS_SERVER_STUB), shortCircuit: true };
    if (spec === '@/lib/ingestion') return { url: inline(INGESTION_STUB), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline(STUDY_EVENTS_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    if (spec.startsWith('.') && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
      return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const { POST } = await load('src/app/api/ingest/route.ts');
const consent = await load('src/lib/ai-consent.ts');
state.user = { id: 'user-1', user_metadata: consent.aiConsentGrant(new Date()) };

let pass = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) pass += 1; else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
};

async function upload(name) {
  state.inserts = [];
  const form = new FormData();
  form.append('file', new File(['Photosynthesis turns light into chemical energy.'], name, { type: 'text/plain' }));
  form.append('kb_id', 'kb-1');
  form.append('locale', 'ar');
  const res = await POST(new Request('https://tryknowflow.com/api/ingest', { method: 'POST', body: form }));
  const doc = state.inserts.find((i) => i.table === 'documents');
  return { status: res.status, filename: doc?.row?.filename };
}

const CASES = [
  ['a NUL inside the name', 'not\u0000es.txt', 'notes.txt'],
  ['a NUL at the start of an Arabic name', '\u0000ملخص الفصل 3.txt', 'ملخص الفصل 3.txt'],
  ['Arabic with harakat, tatweel, RLM and ZWJ is kept as sent', 'الْعَرَبِيَّةُ مـــرحبا ‏نص‍.txt', 'الْعَرَبِيَّةُ مـــرحبا ‏نص‍.txt'],
  ['other control characters are kept (Postgres stores them)', 'tab\there\u0001.txt', 'tab\there\u0001.txt'],
];
for (const [label, sent, stored] of CASES) {
  const r = await upload(sent);
  check(`${label}: the documents insert carries ${JSON.stringify(stored)}`, r.filename === stored,
    `got ${JSON.stringify(r.filename)} (status ${r.status})`);
  check(`${label}: no U+0000 in the stored name`, typeof r.filename === 'string' && !r.filename.includes('\u0000'));
}

// Unchanged behaviour, recorded: a NUL after the extension makes the extension
// unknown, so the type check refuses the file before any storage or insert.
const tail = await upload('notes.txt\u0000');
check('a NUL after the extension: refused 415 before any insert (unchanged)', tail.status === 415 && tail.filename === undefined,
  `status ${tail.status}, filename ${JSON.stringify(tail.filename)}`);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
