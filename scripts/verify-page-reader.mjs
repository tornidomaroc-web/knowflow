/**
 * Executable proof for the page reader, "photograph your pages" (feat/page-reader,
 * 2026-11-16): POST /api/page-read and src/lib/page-reader*.ts.
 *
 *   1. The rules, pure: the G2 settings (model, prompt bytes, image tier fit,
 *      thinking off), max_tokens chosen so 0.0025 USD bounds one page, the
 *      Haiku 5.5 price card, the reservation in the allowance verdict, the
 *      key checks, the header reader, the heading draft.
 *   2. The two G2 silent edits, byte for byte: Haiku 5.5's own text for the
 *      vowelized page (the dropped repeated adjective) and for the page whose
 *      "سنة 1665" moved to the end of its line goes into the material exactly
 *      as the model wrote it: the pipeline adds no edit of its own and does
 *      not "fix" the model's.
 *   3. Image safety: a PNG and a JPEG decompression bomb refused from the
 *      header before any decoder runs (sharp never called for them); an
 *      EXIF-rotated photo sent upright, at the tier's size, without its EXIF;
 *      a HEIC file refused cleanly before any decoder; an oversize photo
 *      never downloaded; the other pages of the batch still read.
 *   4. The route, driven for real: a foreign storage key (403, nothing read,
 *      nothing deleted); the order (session, keys, consent, subject, subject
 *      cap, allowance with 0.0025 USD per photo reserved, the day's upload
 *      counter, then the provider); the allowance refusal (429
 *      ai-allowance-used, nothing sent, nothing recorded, nothing counted);
 *      an unreadable ledger (503, nothing sent); the mocked model call
 *      (exactly the G2 request, one call per photo, each billed call recorded
 *      at its real price, nothing recorded for a call that never returned);
 *      one batch is one upload; the photos deleted on every outcome once
 *      they are known to be the caller's; one failed page never loses the
 *      others; the deadline.
 *   5. @anthropic-ai/sdk 0.39 itself, with an offline fetch: the request the
 *      route builds goes on the wire unchanged (version 2023-06-01, the same
 *      API version G2's Python SDK 0.109.1 sent).
 *   6. The ledger kind: AI_SPEND_KINDS, the new migration's check, its
 *      VERIFY rows and the migration manifest agree.
 *
 * What is stubbed, and why that is honest: `NextResponse`; the session
 * Supabase client (auth, the subject, documents, the day's counter, storage
 * list / download / upload, all in memory); the service-role
 * `@supabase/supabase-js` client (the ledger, as scripts/verify-ai-allowance.mjs
 * keeps it, and the photo removal); `getEntitlement`; `checkDocumentLimit`;
 * the study event; the Anthropic SDK in sections 2 to 4 (section 5 runs the
 * real one); the ingestion service (global fetch, which captures the .md).
 * The route, the reader, the image code with the REAL sharp (counted through
 * a wrapper), the allowance, the counter, the shared ingestion and the
 * dictionaries are the real ones.
 *
 * RED ON 9a15fe1 (main before this change): none of the modules, the route,
 * the migration or the draft exist.
 *
 * Tier 0: no network, no credential, no database, no model call.
 * Usage: node --experimental-strip-types scripts/verify-page-reader.mjs [--self-test]
 *   --self-test  also proves the byte-exact check fails on ten planted edits.
 */
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = pathToFileURL(resolvePath(ROOT, 'src')).href;
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SELF_TEST = process.argv.includes('--self-test');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'verify-only-not-a-key';
process.env.INGESTION_SERVICE_URL = 'http://ingestion.invalid';
process.env.INGESTION_TOKEN = 'verify-only-not-a-token';
process.env.ANTHROPIC_API_KEY = 'verify-only-not-a-key';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const BATCH = '33333333-3333-4333-8333-333333333333';
const KB = '44444444-4444-4444-8444-444444444444';
const FOLDER = `${USER}/page-photos/${BATCH}`;

const state = {};
globalThis.__pr = state;

// ---- stubs -------------------------------------------------------------------------

// fix/page-photo-sweep: the routes schedule the photo sweep with after(); it is
// proved in scripts/verify-page-photo-sweep.mjs and never run here.
const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return new Response(JSON.stringify(body), { status: (init && init.status) || 200, headers: { 'content-type': 'application/json' } }); },
};
export function after() {}`;
const ENTITLEMENT_STUB = `export async function getEntitlement() { return { tier: globalThis.__pr.tier }; }`;
const LIMITS_STUB = `
export async function checkDocumentLimit() { globalThis.__pr.calls.docLimit++; return { allowed: !globalThis.__pr.docLimitReached, limit: 10, tier: globalThis.__pr.tier }; }`;
const STUDY_EVENTS_STUB = `export async function recordStudyEvent() { globalThis.__pr.calls.studyEvent++; }`;

// The student's session client: auth, rows, the day's counter and storage.
const SESSION_STUB = `
const S = () => globalThis.__pr;
function query(table) {
  const q = { table, op: 'select', cols: null, filters: [], row: null };
  const run = (mode) => S().db(q, mode);
  const b = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(run('many')).then(res, rej);
      if (prop === 'single' || prop === 'maybeSingle') return async () => run(prop);
      if (prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete') return (row) => { q.op = prop; q.row = row; return b; };
      if (prop === 'select') return (cols) => { q.cols = cols ?? null; return b; };
      return (...args) => { q.filters.push([prop, ...args]); return b; };
    },
  });
  return b;
}
export async function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: S().user } }),
      getSession: async () => ({ data: { session: S().user ? { access_token: 'user-access-token' } : null } }),
    },
    from: (table) => query(table),
    rpc: async (fn, args) => {
      if (fn !== 'increment_usage') return { data: null, error: { message: 'unknown rpc ' + fn } };
      const n = (S().usage.get(args.p_kind) || 0) + 1;
      S().usage.set(args.p_kind, n);
      return { data: n, error: null };
    },
    storage: {
      from: (bucket) => ({
        list: async (folder, opts, params) => {
          S().calls.list.push({ bucket, folder, opts, signal: params?.signal });
          if (S().listDown) return { data: null, error: { message: 'storage unreachable' } };
          if (S().listStall) {
            const s = params?.signal;
            // Without a signal nothing can cut it short: it answers 6 s late (the time check then fails).
            if (!s) { await new Promise((r) => setTimeout(r, 6000)); return { data: [], error: null }; }
            return new Promise((_, reject) => s.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), { once: true }));
          }
          const entries = [...S().objects.entries()]
            .filter(([k]) => k.startsWith(folder + '/') && !k.slice(folder.length + 1).includes('/'))
            .map(([k, o]) => ({ name: k.slice(folder.length + 1), id: 'obj-' + k, metadata: { size: o.size ?? o.bytes.length, mimetype: 'image/jpeg' } }));
          return { data: entries, error: null };
        },
        // storage-js 2.103: download(path, options, { signal }); an aborted fetch rejects.
        download: async (key, _options, params) => {
          S().calls.download.push(key);
          S().downloadSignals.push(params?.signal);
          if (S().stallKeys.has(key)) {
            const s = params?.signal;
            // Without a signal nothing can cut it short: it answers 6 s late, and the proof's
            // time check fails (rather than hanging the run).
            if (!s) {
              await new Promise((r) => setTimeout(r, 6000));
              const late = S().objects.get(key);
              return late ? { data: new Blob([late.bytes]), error: null } : { data: null, error: { message: 'Object not found' } };
            }
            return new Promise((_, reject) => {
              s.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })), { once: true });
            });
          }
          S().inflight += 1;
          S().maxInflight = Math.max(S().maxInflight, S().inflight);
          await new Promise((r) => setTimeout(r, 5));
          S().inflight -= 1;
          const o = S().objects.get(key);
          return o ? { data: new Blob([o.bytes]), error: null } : { data: null, error: { message: 'Object not found' } };
        },
        upload: async (path, file, opts) => {
          S().calls.upload.push({ bucket, path, file, opts });
          return { data: { path }, error: null };
        },
      }),
    },
  };
}`;

// The service-role client: the ledger (as the SQL function sums it), the photo removal,
// and (item 4j) the batch claim. The claim is kept in its own store and counters
// (claims, calls.claim / claimList / release), so every count below still means
// what it meant before the claim existed; scripts/verify-page-batch-once.mjs
// proves the claim itself.
const SERVICE_STUB = `
const S = () => globalThis.__pr;
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
    storage: {
      from: (bucket) => ({
        // As storage does: only paths that exist are removed and answered;
        // a path it did not delete is simply absent from the answer.
        // As storage does with upsert false: a second object at the same name is refused.
        upload: async (path, body, opts) => {
          S().calls.claim.push({ bucket, path, opts });
          if (S().claimDown) return { data: null, error: { message: 'storage unreachable', status: 503 } };
          if (!opts || opts.upsert !== false) return { data: null, error: { message: 'a claim must never upsert' } };
          if (S().claims.has(path)) return { data: null, error: { message: 'The resource already exists', status: 409, statusCode: '409' } };
          S().claims.add(path);
          S().claimListNext = path.slice(0, path.lastIndexOf('/'));
          return { data: { path }, error: null };
        },
        remove: async (keys) => {
          if (keys.length > 0 && keys.every((k) => k.endsWith('/kf-claim'))) {
            S().calls.release.push([...keys]);
            for (const k of keys) S().claims.delete(k);
            return { data: keys.map((name) => ({ name })), error: null };
          }
          S().calls.remove.push({ bucket, keys: [...keys] });
          S().events.push('remove');
          if (S().removeNoop) return { data: [], error: null };
          const gone = keys.filter((k) => S().objects.has(k));
          for (const k of gone) S().objects.delete(k);
          return { data: gone.map((name) => ({ name })), error: null };
        },
        list: async (folder) => {
          if (S().claimListNext === folder) { S().claimListNext = null; S().calls.claimList.push(folder); }
          else S().calls.adminList.push(folder);
          const entries = [...S().objects.keys()].filter((k) => k.startsWith(folder + '/')).map((k) => ({ name: k.slice(folder.length + 1), id: 'obj-' + k, metadata: { size: 1 } }));
          return { data: entries, error: null };
        },
      }),
    },
  };
}`;

// The model: every call is recorded with its params and options; the reply
// comes from the harness (globalThis.__pr.reply), keyed by the image it got.
const ANTHROPIC_STUB = `
export default class Anthropic {
  constructor(opts) {
    globalThis.__pr.clientOptions.push(opts);
    this.messages = {
      create: async (params, options) => {
        globalThis.__pr.modelCalls.push({ params, options });
        globalThis.__pr.events.push('model');
        return globalThis.__pr.reply(params, options);
      },
    };
  }
}`;

const SHARP_REAL = pathToFileURL(resolvePath(ROOT, 'node_modules/sharp/lib/index.js')).href;
const SHARP_COUNTED = `
import real from ${JSON.stringify(SHARP_REAL)};
function counted(...args) { globalThis.__pr.sharpCalls += 1; globalThis.__pr.sharpInputs.push(args[0] && args[0].byteLength); return real(...args); }
Object.assign(counted, real);
export default counted;`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => {
  if (/\.[a-z]+$/i.test(base)) return base;
  if (existsSync(base + '.ts')) return base + '.ts';
  return resolvePath(base, 'index.ts');
};
const fromSrc = (ctx) => typeof ctx.parentURL === 'string' && ctx.parentURL.startsWith(SRC_URL);
// fix/storage-server-writes: the stored file goes through src/lib/document-storage-server.ts
// (service role, after the key and subject checks), proved in
// scripts/verify-storage-server-writes.mjs; here it forwards to this proof's session storage fake.
const DOC_STORAGE_STUB = `export async function storeOwnDocumentFile({ session, key, body, contentType }) { const { error } = await session.storage.from(\x27documents\x27).upload(key, body, contentType === undefined ? { upsert: false } : { upsert: false, contentType }); return error ? { ok: false, reason: \x27storage\x27, message: error.message } : { ok: true, message: \x27\x27 }; } export async function removeOwnDocumentFile() { return true; } export function ownDocumentKey() { return true; }`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@anthropic-ai/sdk' && fromSrc(ctx)) return { url: inline(ANTHROPIC_STUB), shortCircuit: true };
    if (spec === 'sharp' && fromSrc(ctx)) return { url: inline(SHARP_COUNTED), shortCircuit: true };
    if (spec === '@supabase/supabase-js' && fromSrc(ctx)) return { url: inline(SERVICE_STUB), shortCircuit: true };
    if (spec === '@/lib/document-storage-server') return { url: inline(DOC_STORAGE_STUB), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SESSION_STUB), shortCircuit: true };
    if (spec === '@/lib/entitlement') return { url: inline(ENTITLEMENT_STUB), shortCircuit: true };
    if (spec === '@/lib/limits-server') return { url: inline(LIMITS_STUB), shortCircuit: true };
    if (spec === '@/lib/study-events') return { url: inline(STUDY_EVENTS_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    if (spec.startsWith('.') && fromSrc(ctx)) {
      return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const require = createRequire(import.meta.url);

// ---- reporting -------------------------------------------------------------------------

let pass = 0;
const failures = [];
const realLog = console.log;
const realError = console.error;
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(name);
  realLog(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${String(detail).slice(0, 600)}` : ''}`);
}
async function attempt(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '));
  }
}
const logs = [];
console.log = (...a) => logs.push(a.join(' '));
console.error = (...a) => logs.push(a.join(' '));
console.warn = () => {};

// ---- the G2 evidence --------------------------------------------------------------------

// Haiku 5.5's raw text for the two silent-edit images, byte for byte from
// D:\Temp\kf-research\ocr-g2\results\claude-haiku-5-5.jsonl (`text`), as
// ASCII-escaped JSON so no editor or checkout can change a byte.
const G2_MARKS = JSON.parse('"\\u062a\\u064e\\u0639\\u0652\\u0645\\u064e\\u0644\\u064f \\u0627\\u0644\\u062e\\u064e\\u0644\\u0650\\u064a\\u064e\\u0651\\u0629\\u064f \\u0645\\u064e\\u0639\\u064b\\u0627\\u060c \\u0641\\u064e\\u064a\\u064e\\u0628\\u0652\\u0642\\u0649 \\u0627\\u0644\\u062c\\u0650\\u0633\\u0652\\u0645\\u064f \\u062d\\u064e\\u064a\\u064b\\u0651\\u0627. \\u064a\\u0646\\u0638\\u0651\\u0645 \\u0627\\u0644\\u063a\\u0650\\u0634\\u0627\\u0621\\u064f \\u0627\\u0644\\u062f\\u064f\\u0651\\u062e\\u0648\\u0644\\u064e \\u062c\\u062f\\u064b\\u0651\\u0627\\u060c \\u0648\\u062a\\u062d\\u0648\\u0651\\u0644 \\u0627\\u0644\\u0645\\u064f\\u062a\\u064e\\u0642\\u064e\\u062f\\u0650\\u0651\\u0631\\u064e\\u0629\\u064f \\u0627\\u0644\\u063a\\u0650\\u0630\\u0627\\u0621\\u064e \\u0625\\u0644\\u0649 \\u0637\\u0627\\u0642\\u0629\\u064d. \\u062a\\u064e\\u0636\\u064f\\u0645\\u064f\\u0651 \\u0639\\u062f\\u062f\\u064b\\u0627 \\u0643\\u0628\\u064a\\u0631\\u064b\\u0627 \\u0645\\u0650\\u0646\\u0652 \\u0628\\u064f\\u0631\\u0648\\u062a\\u064a\\u0646\\u064d \\u0645\\u064f\\u0647\\u0650\\u0645\\u064d\\u0651.\\n\\u062a\\u064e\\u0639\\u0652\\u0645\\u064e\\u0644\\u064f \\u0627\\u0644\\u062e\\u064e\\u0644\\u0650\\u064a\\u064e\\u0651\\u0629\\u064f \\u0645\\u064e\\u0639\\u064b\\u0627\\u060c \\u0641\\u064e\\u064a\\u064e\\u0628\\u0652\\u0642\\u0649 \\u0627\\u0644\\u062c\\u0650\\u0633\\u0652\\u0645\\u064f \\u062d\\u064e\\u064a\\u064b\\u0651\\u0627. \\u064a\\u0646\\u0638\\u0651\\u0645 \\u0627\\u0644\\u063a\\u0650\\u0634\\u0627\\u0621\\u064f \\u0627\\u0644\\u062f\\u064f\\u0651\\u062e\\u0648\\u0644\\u064e \\u062c\\u062f\\u064b\\u0651\\u0627\\u060c \\u0648\\u062a\\u062d\\u0648\\u0651\\u0644 \\u0627\\u0644\\u0645\\u064f\\u062a\\u064e\\u0642\\u064e\\u062f\\u0650\\u0651\\u0631\\u064e\\u0629\\u064f \\u0627\\u0644\\u063a\\u0650\\u0630\\u0627\\u0621\\u064e \\u0625\\u0644\\u0649 \\u0637\\u0627\\u0642\\u0629\\u064d. \\u062a\\u064e\\u0636\\u064f\\u0645\\u064f\\u0651 \\u0639\\u062f\\u062f\\u064b\\u0627 \\u0643\\u0628\\u064a\\u0631\\u064b\\u0627 \\u0645\\u0650\\u0646\\u0652 \\u0628\\u064f\\u0631\\u0648\\u062a\\u064a\\u0646\\u064d \\u0645\\u064f\\u0647\\u0650\\u0645\\u064d\\u0651.\\n\\u062a\\u064e\\u0639\\u0652\\u0645\\u064e\\u0644\\u064f \\u0627\\u0644\\u062e\\u064e\\u0644\\u0650\\u064a\\u064e\\u0651\\u0629\\u064f \\u0645\\u064e\\u0639\\u064b\\u0627\\u060c \\u0641\\u064e\\u064a\\u064e\\u0628\\u0652\\u0642\\u0649 \\u0627\\u0644\\u062c\\u0650\\u0633\\u0652\\u0645\\u064f \\u062d\\u064e\\u064a\\u064b\\u0651\\u0627. \\u064a\\u0646\\u0638\\u0651\\u0645 \\u0627\\u0644\\u063a\\u0650\\u0634\\u0627\\u0621\\u064f \\u0627\\u0644\\u062f\\u064f\\u0651\\u062e\\u0648\\u0644\\u064e \\u062c\\u062f\\u064b\\u0651\\u0627\\u060c \\u0648\\u062a\\u062d\\u0648\\u0651\\u0644 \\u0627\\u0644\\u0645\\u064f\\u062a\\u064e\\u0642\\u064e\\u062f\\u0650\\u0651\\u0631\\u064e\\u0629\\u064f \\u0627\\u0644\\u063a\\u0650\\u0630\\u0627\\u0621\\u064e \\u0625\\u0644\\u0649 \\u0637\\u0627\\u0642\\u0629\\u064d. \\u062a\\u064e\\u0636\\u064f\\u0645\\u064f\\u0651 \\u0639\\u062f\\u062f\\u064b\\u0627 \\u0643\\u0628\\u064a\\u0631\\u064b\\u0627 \\u0645\\u0650\\u0646\\u0652 \\u0628\\u064f\\u0631\\u0648\\u062a\\u064a\\u0646\\u064d \\u0645\\u064f\\u0647\\u0650\\u0645\\u064d\\u0651."');
const G2_LIBRE = JSON.parse('"\\u062a\\u0646\\u062a\\u062c \\u062c\\u0632\\u064a\\u0626\\u0629 \\u063a\\u0644\\u0648\\u0643\\u0648\\u0632 \\u0648\\u0627\\u062d\\u062f\\u0629 \\u0646\\u062d\\u0648 30 \\u0625\\u0644\\u0649 32 \\u062c\\u0632\\u064a\\u0626\\u0629 ATP.\\n\\u0644\\u0627 \\u064a\\u0646\\u062a\\u062c \\u0627\\u0644\\u062a\\u062e\\u0645\\u0631 \\u0625\\u0644\\u0627 \\u062c\\u0632\\u064a\\u0626\\u062a\\u064a\\u0646 \\u0641\\u0642\\u0637\\u060c \\u0644\\u0623\\u0646 \\u0627\\u0644\\u0623\\u0643\\u0633\\u062c\\u064a\\u0646 \\u063a\\u064a\\u0631 \\u0645\\u0648\\u062c\\u0648\\u062f.\\n\\u0627\\u0642\\u0631\\u0623 \\u0627\\u0644\\u0635\\u0641\\u062d\\u0627\\u062a 3-4 \\u0645\\u0646 \\u0627\\u0644\\u0643\\u062a\\u0627\\u0628 (\\u0627\\u0644\\u0641\\u0635\\u0644 \\u0627\\u0644\\u062b\\u0627\\u0646\\u064a) \\u0642\\u0628\\u0644 \\u0627\\u0644\\u0627\\u0645\\u062a\\u062d\\u0627\\u0646.\\n\\u0641\\u062d\\u0635 \\u0631\\u0648\\u0628\\u0631\\u062a \\u0647\\u0648\\u0643 \\u0634\\u0631\\u064a\\u062d\\u0629 \\u0645\\u0646 \\u0627\\u0644\\u0641\\u0644\\u064a\\u0646 \\u0633\\u0646\\u0629 1665.\\n\\u0627\\u0644\\u0622\\u0644\\u0629 \\u0627\\u0644\\u062d\\u0627\\u0633\\u0628\\u0629 \\u0644\\u0627 \\u062a\\u0643\\u0641\\u064a\\u060c \\u0648\\u0627\\u0644\\u0625\\u062c\\u0627\\u0628\\u0629 \\u062a\\u062d\\u062a\\u0627\\u062c \\u0625\\u0644\\u0649 \\u0634\\u0631\\u062d.\\nThe cell is the basic unit of life.\\nRobert Hooke described cells in 1665 using a simple microscope.\\n\\u0645\\u0635\\u0637\\u0644\\u062d Mitochondria \\u064a\\u0639\\u0646\\u064a \\u0627\\u0644\\u0645\\u064a\\u062a\\u0648\\u0643\\u0648\\u0646\\u062f\\u0631\\u064a\\u0627 \\u0628\\u0627\\u0644\\u0639\\u0631\\u0628\\u064a\\u0629."');
const EDGY = ' \n\u0634\u0651\u064E\u0631 \u0627\u0653\u0644\u0629 \u200C\u200F\u0640 \uFEFB\r\nline 2 \n';
const G2_MARKS_SHA = '8fd4a71dfac36198ba19536427fb8bdc45e9ecd46ad3a9ef464366a5ecee56ac';
const G2_LIBRE_SHA = '7225010c92fd08f913631ae4d58b8f77ac290bf4358465bd0a7a8c3e935c4282';
// What was printed (G2 ground truth), for the two places the model edited.
const PRINTED_MARKS = 'عددًا كبيرًا كثيرًا مِنْ';
const PRINTED_LIBRE_LINE = 'سنة 1665 فحص روبرت هوك شريحة من الفلين.';
const MODEL_LIBRE_LINE = 'فحص روبرت هوك شريحة من الفلين سنة 1665.';
// run.py `PROMPT`, sha256 of its UTF-8 bytes (computed from the file with Python's ast).
const G2_PROMPT_SHA = 'c7b935a975a53a30d1623ac704452f58a6e988b9d617833a5db4f1671c7b93cd';
// G2's measured calls: input tokens = image tokens + 175 (4,931 for 1623x2295, 4,915 for 1653x2205).
const G2_USAGE = { input_tokens: 4915, output_tokens: 535, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

// The heading draft, parsed from the draft file (an oracle independent of the code).
const draftRows = Object.fromEntries([...read('docs/copy-drafts/page_reader.md').matchAll(/^\| (en|ar) \| (.+) \|$/gm)].map((m) => [m[1], m[2]]));
const heading = (locale, n) => (draftRows[locale] ?? '').replace('{n}', String(n));
const expectedMarkdown = (pages, locale) => pages.map((p) => `## ${heading(locale, p.n)}\n\n${p.text}`).join('\n\n') + '\n';

/** What is wrong with `md` against the pages the model wrote; empty when it is byte-exact. */
function byteExactProblems(md, pages, locale) {
  const problems = [];
  const want = Buffer.from(expectedMarkdown(pages, locale), 'utf8');
  const got = Buffer.from(md, 'utf8');
  if (!want.equals(got)) {
    let i = 0;
    while (i < Math.min(want.length, got.length) && want[i] === got[i]) i += 1;
    problems.push(`the material is not the model's pages under their headings: first different byte at ${i} of ${want.length}/${got.length}`);
  }
  let from = 0;
  for (const p of pages) {
    const at = md.indexOf(p.text, from);
    if (at < 0) problems.push(`page ${p.n}: the model's text is not in the material byte for byte`);
    else from = at + p.text.length;
  }
  return problems;
}

// ---- images --------------------------------------------------------------------------

const realSharp = require(resolvePath(ROOT, 'node_modules/sharp'));
const solidJpeg = (width, height, shade = 245) =>
  realSharp({ create: { width, height, channels: 3, background: { r: shade, g: shade, b: shade } } }).jpeg({ quality: 80 }).toBuffer();
/** A PNG header that claims `w` x `h` pixels, with a token IDAT: the decompression-bomb shape. */
function pngBomb(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])), chunk('IEND', Buffer.alloc(0))]);
}
/** A baseline JPEG header that claims `w` x `h` (SOF0) and nothing decodable after it. */
function jpegBomb(w, h) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}
/** The first bytes of an iPhone HEIC: an ISO-BMFF `ftyp` box, brand heic. */
const HEIC = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('mif1heic', 'ascii'), Buffer.alloc(64)]);

// ---- the harness state --------------------------------------------------------------------

const near = (a, b) => Math.abs(a - b) < 1e-9;
function reset({ tier = 'free', consent = true, consentVersion = 2, user = true, spent = 0, ledgerDown = false, subject = true, docLimitReached = false } = {}) {
  Object.assign(state, {
    tier,
    user: user ? { id: USER, user_metadata: consent ? { ai_consent: { version: consentVersion, at: '2026-11-01T00:00:00.000Z' } } : {} } : null,
    subject,
    subjectDown: false,
    docLimitReached,
    ledgerDown,
    listDown: false,
    usage: new Map(),
    objects: new Map(),
    ledger: spent > 0 ? [{ user_id: USER, kind: 'answer', usd: spent, estimated: false, at: new Date(Date.now() - 86400000).toISOString() }] : [],
    calls: { docLimit: 0, studyEvent: 0, list: [], adminList: [], download: [], upload: [], remove: [], ingest: [], insert: [], claim: [], claimList: [], release: [] },
    claims: new Set(),
    claimDown: false,
    claimListNext: null,
    events: [],
    inflight: 0,
    maxInflight: 0,
    removeNoop: false,
    listStall: false,
    stallKeys: new Set(),
    downloadSignals: [],
    modelCalls: [],
    clientOptions: [],
    sharpCalls: 0,
    sharpInputs: [],
    replies: new Map(),
    reply: async (params) => defaultReply(params),
  });
  // Rows from before the window and of another user never count.
  state.ledger.push({ user_id: USER, kind: 'answer', usd: 9, estimated: false, at: '2020-01-01T00:00:00.000Z' });
  state.ledger.push({ user_id: OTHER, kind: 'answer', usd: 9, estimated: false, at: new Date().toISOString() });
  logs.length = 0;
}
const ownRows = () => state.ledger.filter((r) => r.user_id === USER && r.at > '2021' && r.kind !== 'answer');
let H;
// The params the route built for its first page (section 4), sent through the real SDK in section 5.
let savedRouteParams;
async function defaultReply(params) {
  const img = Buffer.from(params.messages[0].content[0].source.data, 'base64');
  const { width, height } = H.readPhotoHeader(img);
  const r = state.replies.get(`${width}x${height}`);
  if (!r) return { content: [{ type: 'text', text: `page ${width}x${height}` }], stop_reason: 'end_turn', usage: G2_USAGE };
  if (r.throw) throw r.throw;
  return {
    content: r.content ?? [{ type: 'text', text: r.text }],
    stop_reason: r.stop_reason ?? 'end_turn',
    ...(r.stop_details !== undefined ? { stop_details: r.stop_details } : {}),
    usage: r.usage ?? G2_USAGE,
  };
}
// The session and DB rows the real code reads. A subject is found only when
// it is asked for by its own id, as PostgREST would (RLS: the caller's own).
state.db = (q, mode) => {
  if (q.table === 'knowledge_bases') {
    if (state.subjectDown) return { data: null, error: { message: 'database unreachable' } };
    const byId = q.filters.find((f) => f[0] === 'eq' && f[1] === 'id');
    return { data: state.subject && byId && byId[2] === KB ? { id: KB } : null, error: null };
  }
  if (q.table === 'documents' && q.op === 'insert') {
    state.calls.insert.push(q.row);
    return { data: { ...q.row }, error: null };
  }
  if (q.table === 'documents' && q.op === 'update') return { data: null, error: null };
  if (q.table === 'documents') return { data: [], error: null, count: 0 };
  return { data: mode === 'many' ? [] : null, error: null };
};
// The ingestion service: captures the .md and answers like the real one.
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/ingest')) {
    const file = init.body.get('file');
    state.calls.ingest.push({ url: String(url), name: file.name, type: file.type, text: Buffer.from(await file.arrayBuffer()).toString('utf8'), document_id: init.body.get('document_id'), signal: init.signal });
    return new Response(JSON.stringify({ document_id: init.body.get('document_id'), chunk_count: 2, status: 'ready', voyage_tokens: 120, pages_total: null, pages_no_text: null }), { status: 200 });
  }
  throw new Error('no network in this proof: ' + url);
};
const key = (name, user = USER, batch = BATCH) => `${user}/page-photos/${batch}/${name}`;
const put = (name, bytes, size) => state.objects.set(key(name), { bytes, size });
const post = (body) => new Request('https://tryknowflow.com/api/page-read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const callRoute = async (POST, body) => {
  const res = await POST(post(body));
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
};

realLog('1. The rules');
await attempt('src/lib/page-reader.ts loads', async () => {
  H = await load('src/lib/page-reader.ts');
  const A = await load('src/lib/ai-allowance.ts');
  check('the model is claude-haiku-5-5 (a fixed id: no dated snapshot exists to pin)', H.PAGE_READ_MODEL === 'claude-haiku-5-5', H.PAGE_READ_MODEL);
  check('the prompt is G2\'s, byte for byte (run.py PROMPT sha256)', sha256(H.PAGE_READ_PROMPT) === G2_PROMPT_SHA, sha256(H.PAGE_READ_PROMPT ?? ''));
  check('the tier is the high-resolution one G2 used: 2576 px long edge, 4784 image tokens', H.TIER_LONG_EDGE === 2576 && H.TIER_IMAGE_TOKENS === 4784);
  // run.py fit(), run by Python on these sizes; the last two are G2's own images.
  const ORACLE = [[3024, 4032, 1653, 2205], [4032, 3024, 2205, 1653], [2480, 3508, 1622, 2295], [4000, 3000, 2205, 1653], [1000, 1400, 1000, 1400], [8064, 6048, 2205, 1653], [1653, 2205, 1653, 2205], [100, 100, 100, 100], [2576, 2576, 1926, 1926], [12000, 9000, 2205, 1653], [2481, 3508, 1623, 2295], [3000, 4000, 1653, 2205]];
  const wrong = ORACLE.filter(([w, h, ew, eh]) => { const f = H.fitToTier(w, h); return f.width !== ew || f.height !== eh; });
  check('fitToTier reproduces run.py fit() on 12 sizes, G2\'s two image sizes among them', wrong.length === 0, JSON.stringify(wrong));
  const fits = ORACLE.every(([w, h]) => { const f = H.fitToTier(w, h); return Math.max(f.width, f.height) <= 2576 && H.imageTokens(f.width, f.height) <= 4784 && f.width <= w && f.height <= h; });
  check('every fitted size is within the tier and never enlarged', fits);
  check('image tokens: one per 28 x 28 patch (G2: 1623x2295 = 4,756, 4,931 input = 4,756 + 175)', H.imageTokens(1623, 2295) === 4756 && H.imageTokens(1653, 2205) === 4740 && H.PAGE_READ_PROMPT_TOKENS === 175);
  const r = A.HAIKU_55_USD_PER_MTOK?.short;
  check('Haiku 5.5 short-prompt card: 0.10 / 0.50 USD per million tokens (a new constant, not usageUsd)', r && r.input === 0.1 && r.output === 0.5);
  const worst = (maxTokens) => ((H.TIER_IMAGE_TOKENS + H.PAGE_READ_PROMPT_TOKENS) * r.input + maxTokens * r.output) / 1e6;
  check(`max_tokens ${H.PAGE_READ_MAX_TOKENS}: one page costs at most ${worst(H.PAGE_READ_MAX_TOKENS).toFixed(7)} USD, within the 0.0025 reserved`, H.PAGE_READ_MAX_TOKENS === 4000 && worst(H.PAGE_READ_MAX_TOKENS) <= H.PAGE_READ_RESERVE_USD && H.PAGE_READ_RESERVE_USD === 0.0025);
  check('...where run.py\'s 8192 and the report\'s 4096 would not be (0.0045919, 0.0025439)', worst(8192) > 0.0025 && worst(4096) > 0.0025);
  check('a page at G2\'s measured usage (4,915 in, 535 out) is priced 0.000759 USD', A.haiku55Usd(G2_USAGE) === 0.000759, String(A.haiku55Usd(G2_USAGE)));
  check('above 100,000 prompt tokens the long card applies (0.50 / 2.50)', A.haiku55Usd({ input_tokens: 200000, output_tokens: 1000 }) === 0.1025, String(A.haiku55Usd({ input_tokens: 200000, output_tokens: 1000 })));
  check('missing or bad counts price as 0, never NaN', A.haiku55Usd(null) === 0 && A.haiku55Usd({ input_tokens: -5, output_tokens: NaN }) === 0 && A.haiku55Usd({ input_tokens: 1.5 }) === 0);
  check('a price exactly between two micro-dollars rounds up, every time (4,915 in + 4,000 out = 0.0024915 -> 0.002492)', A.haiku55Usd({ input_tokens: 4915, output_tokens: 4000 }) === 0.002492, String(A.haiku55Usd({ input_tokens: 4915, output_tokens: 4000 })));
  check('the reservation is 0.0025 USD per photo', H.pageReadReserveUsd(10) === 0.025 && H.pageReadReserveUsd(1) === 0.0025);
  // The verdict with a reserve; without one, unchanged.
  const v = (spent, reserve, tier = 'free') => A.allowanceVerdict(spent, tier, reserve);
  check('with a reserve: allowed while spend + reserve stays within the ceiling (0.975 + 0.025 = 1.00)', v(0.975, 0.025).allowed === true);
  check('...refused as used one micro-dollar over (0.975001 + 0.025)', v(0.975001, 0.025).allowed === false && v(0.975001, 0.025).reason === 'used');
  check('...refused at the ceiling whatever the reserve', v(1, 0.0025).reason === 'used' && v(1, 0).reason === 'used');
  check('without a reserve the old rule holds: under is allowed, at the ceiling is refused, unread is unread', v(0.999999, 0).allowed && !v(1, 0).allowed && v(null, 0.025).reason === 'unread' && v(NaN, 0).reason === 'unread');
  check('Pro\'s ceiling with a reserve (4.98 + 0.025 > 5.00 is refused, 4.975 + 0.025 allowed)', !v(4.98, 0.025, 'pro').allowed && v(4.975, 0.025, 'pro').allowed);
  // Keys.
  const ok = H.checkPhotoKeys(USER, [key('1.jpg'), key('2.jpg')]);
  check('two of the caller\'s keys in one batch: accepted, folder and names in order', ok.ok && ok.folder === FOLDER && JSON.stringify(ok.names) === '["1.jpg","2.jpg"]', JSON.stringify(ok));
  const cases = [
    ['another user\'s folder', [key('1.jpg', OTHER)], 'foreign'],
    ['one key of eleven too many', Array.from({ length: 11 }, (_, i) => key(`${i}.jpg`)), 'count'],
    ['no key', [], 'count'],
    ['not an array', 'x', 'count'],
    ['a number for a key', [7], 'shape'],
    ['a path that climbs out', [`${USER}/page-photos/${BATCH}/../../${OTHER}/x.jpg`], 'shape'],
    ['a key outside page-photos', [`${USER}/${KB}/1.jpg`], 'shape'],
    ['a key with a nested folder', [`${USER}/page-photos/${BATCH}/a/b.jpg`], 'shape'],
    ['a dot-first name', [key('.hidden')], 'shape'],
    ['an upper-case user id (the storage policy compares the lower-case text)', [key('1.jpg', 'ABCDEF01-2345-4678-9ABC-DEF012345678')], 'shape'],
    ['the same key twice', [key('1.jpg'), key('1.jpg')], 'duplicate'],
    ['two batches', [key('1.jpg'), key('2.jpg', USER, '55555555-5555-4555-8555-555555555555')], 'mixed-batch'],
  ];
  for (const [label, keys, reason] of cases) {
    const got = H.checkPhotoKeys(USER, keys);
    check(`keys refused: ${label} (${reason})`, got.ok === false && got.reason === reason, JSON.stringify(got));
  }
  check('a caller whose id is not a uuid matches no key (never the bucket root)', H.checkPhotoKeys('', [key('1.jpg', '')]).ok === false);
  // The header reader.
  const jpeg = await solidJpeg(321, 123);
  check('JPEG size from its SOF header, a baseline frame', JSON.stringify(H.readPhotoHeader(jpeg)) === '{"format":"jpeg","width":321,"height":123,"sequential":true}', JSON.stringify(H.readPhotoHeader(jpeg)));
  const png = await realSharp({ create: { width: 77, height: 55, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).png().toBuffer();
  check('PNG size from its IHDR, not interlaced', JSON.stringify(H.readPhotoHeader(png)) === '{"format":"png","width":77,"height":55,"sequential":true}', JSON.stringify(H.readPhotoHeader(png)));
  const progressive = await realSharp({ create: { width: 321, height: 123, channels: 3, background: '#808080' } }).jpeg({ progressive: true }).toBuffer();
  check('a progressive JPEG is refused from its header (photo-type: decoded whole, scans read before any time limit)', H.readPhotoHeader(progressive).sequential === false && H.headerRefusal(H.readPhotoHeader(progressive)) === 'photo-type');
  const interlaced = await realSharp({ create: { width: 77, height: 55, channels: 3, background: '#808080' } }).png({ progressive: true }).toBuffer();
  check('an interlaced PNG is refused from its header (photo-type)', H.readPhotoHeader(interlaced).sequential === false && H.headerRefusal(H.readPhotoHeader(interlaced)) === 'photo-type');
  // The bomb the review found: 40 MP, under the pixel cap, but a 10,000,000 px side took 3.5 GB to resize.
  check('a 10,000,000 x 4 PNG (40 MP, under the pixel cap) is refused from its header for its side', H.headerRefusal(H.readPhotoHeader(pngBomb(10000000, 4))) === 'photo-too-many-pixels');
  check('...and so is 4 x 10,000,000, and 12,001 x 100 (a side over 12,000)', H.headerRefusal(H.readPhotoHeader(pngBomb(4, 10000000))) === 'photo-too-many-pixels' && H.headerRefusal(H.readPhotoHeader(pngBomb(12001, 100))) === 'photo-too-many-pixels');
  check('a strip 9 times longer than wide (9,000 x 1,000) is refused for its shape', H.headerRefusal(H.readPhotoHeader(pngBomb(9000, 1000))) === 'photo-odd-shape');
  check('the pixel cap alone refuses a 60 MP PNG (10,000 x 6,000) and a 54 MP JPEG (9,000 x 6,000), both within the side and shape bounds',
    H.headerRefusal(H.readPhotoHeader(pngBomb(10000, 6000))) === 'photo-too-many-pixels' && H.headerRefusal(H.readPhotoHeader(jpegBomb(9000, 6000))) === 'photo-too-many-pixels' && H.sizeRefusal(10000, 6000) === 'photo-too-many-pixels');
  check('a long screenshot within 8:1 (1,170 x 9,000) and 12,000 x 1,500 still pass', H.sizeRefusal(1170, 9000) === null && H.sizeRefusal(12000, 1500) === null && H.sizeRefusal(1170, 9400) === 'photo-odd-shape');
  check('HEIC recognised by its ftyp brand, before any decoder', H.readPhotoHeader(HEIC).format === 'heif' && H.headerRefusal(H.readPhotoHeader(HEIC)) === 'photo-heic');
  const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1');
  check('a GIF is another format (photo-type)', H.headerRefusal(H.readPhotoHeader(gif)) === 'photo-type');
  check('a PNG bomb (100,000 x 100,000) refused from its header', H.headerRefusal(H.readPhotoHeader(pngBomb(100000, 100000))) === 'photo-too-many-pixels');
  check('a JPEG bomb (60,000 x 60,000) refused from its header', H.headerRefusal(H.readPhotoHeader(jpegBomb(60000, 60000))) === 'photo-too-many-pixels');
  check('a 48 MP (8064 x 6048) and a 50 MP (8160 x 6120) baseline photo pass every bound', H.headerRefusal({ format: 'jpeg', width: 8064, height: 6048, sequential: true }) === null && H.headerRefusal({ format: 'jpeg', width: 8160, height: 6120, sequential: true }) === null);
  check('a truncated JPEG with no frame header is unreadable', H.headerRefusal(H.readPhotoHeader(jpeg.subarray(0, 20))) === 'photo-unreadable');
  // The text of a response.
  check('end_turn: the text blocks joined, untouched (leading and trailing space kept)', JSON.stringify(H.pageText({ stop_reason: 'end_turn', content: [{ type: 'text', text: ' a\n' }, { type: 'text', text: 'b ' }] })) === '{"text":" a\\nb "}');
  check('max_tokens is a failed page (read-cut-off), never partial text', H.pageText({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'half' }] }).code === 'read-cut-off');
  check('refusal is read-refused; an empty text is read-empty; anything else read-failed', H.pageText({ stop_reason: 'refusal', content: [] }).code === 'read-refused' && H.pageText({ stop_reason: 'end_turn', content: [{ type: 'text', text: ' \n' }] }).code === 'read-empty' && H.pageText({ stop_reason: 'tool_use', content: [] }).code === 'read-failed');
  // Which responses Anthropic bills ("How refusals are billed", read 2026-11-16).
  const billed = (r) => H.responseBilled(r);
  check('a normal, cut-off or empty answer is billed', billed({ stop_reason: 'end_turn', usage: { output_tokens: 1 } }) && billed({ stop_reason: 'max_tokens', usage: { output_tokens: 4000 } }) && billed({ stop_reason: 'end_turn', usage: { output_tokens: 0 } }));
  check('a refusal after some output is billed, whatever its category', billed({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, usage: { output_tokens: 3 } }));
  check('a refusal before any output is billed for bio, frontier_llm and reasoning_extraction only', ['bio', 'frontier_llm', 'reasoning_extraction'].every((c) => billed({ stop_reason: 'refusal', stop_details: { category: c }, usage: { output_tokens: 0 } })));
  check('...and NOT for cyber, general_harms or no category', ['cyber', 'general_harms', null].every((c) => !billed({ stop_reason: 'refusal', stop_details: { category: c }, usage: { output_tokens: 0 } })) && !billed({ stop_reason: 'refusal', usage: { output_tokens: 0 } }));
  // The heading draft.
  check('the draft file has one en and one ar heading', typeof draftRows.en === 'string' && typeof draftRows.ar === 'string', JSON.stringify(draftRows));
  check('PAGE_HEADING is the draft, in both languages', H.PAGE_HEADING.en === draftRows.en && H.PAGE_HEADING.ar === draftRows.ar);
  for (const [l, t] of Object.entries(draftRows)) {
    check(`${l} heading: {n} once, no em or en dash, no price/plan/upgrade/free word, Western digits only`, (t.match(/\{n\}/g) || []).length === 1 && !/[—–]/.test(t) && !/(free|price|plan|upgrade|subscri|pro\b|\$|مجان|سعر|باق|اشتراك|ترقي)/i.test(t) && !/[٠-٩۰-۹]/.test(t), t);
  }
  check('ar heading: no Latin letter inside the Arabic (the {n} placeholder aside)', !/[A-Za-z]/.test((draftRows.ar ?? 'x').replace('{n}', '')));
  check('the material: a heading per page, the text after it, one blank line between', H.pagesMarkdown([{ n: 1, text: 'a' }, { n: 3, text: 'b' }], 'en') === '## Page 1\n\na\n\n## Page 3\n\nb\n');
});

realLog('2. The two G2 silent edits stay the model\'s, byte for byte');
await attempt('the route loads', async () => {
  check('the vowelized page text is G2\'s (sha256)', sha256(G2_MARKS) === G2_MARKS_SHA);
  check('the "سنة 1665" page text is G2\'s (sha256)', sha256(G2_LIBRE) === G2_LIBRE_SHA);
  check('G2 evidence: the model dropped the repeated adjective (كثيرًا) the page printed', !G2_MARKS.includes(PRINTED_MARKS) && G2_MARKS.includes('عددًا كبيرًا مِنْ'));
  check('G2 evidence: the model moved "سنة 1665" to the end of its line', G2_LIBRE.includes(MODEL_LIBRE_LINE) && !G2_LIBRE.includes(PRINTED_LIBRE_LINE));
  const { POST } = await load('src/app/api/page-read/route.ts');
  reset();
  const marks = await solidJpeg(1210, 1600);
  const libre = await solidJpeg(1220, 1600);
  put('1.jpg', marks);
  put('2.jpg', libre);
  state.replies.set('1210x1600', { text: G2_MARKS });
  state.replies.set('1220x1600', { text: G2_LIBRE });
  // A page every common clean-up would change: a leading space and newline, a
  // CR, shadda before fatha (NFC reorders them), alef + maddah above (NFC
  // composes them), ZWNJ, RLM, tatweel, the lam-alef presentation form (NFKC
  // unfolds it) and trailing spaces. G2's two pages are stable under all of
  // those, so without this page the check could not see them.
  put('3.jpg', await solidJpeg(1230, 1600));
  state.replies.set('1230x1600', { text: EDGY });
  const out = await callRoute(POST, { kb_id: KB, keys: [key('1.jpg'), key('2.jpg'), key('3.jpg')], name: 'الفصل الثاني', locale: 'ar' });
  check('200, and the material was made', out.status === 200 && out.body.success === true, JSON.stringify(out.body).slice(0, 300));
  const md = state.calls.ingest[0]?.text ?? '';
  const pages = [{ n: 1, text: G2_MARKS }, { n: 2, text: G2_LIBRE }, { n: 3, text: EDGY }];
  check('the third page is one that trim, NFC, NFKC and CRLF clean-ups all change', EDGY.trim() !== EDGY && EDGY.normalize('NFC') !== EDGY && EDGY.normalize('NFKC') !== EDGY.normalize('NFC') && EDGY.includes('\r'));
  const problems = byteExactProblems(md, pages, 'ar');
  check('the .md the ingestion service received is exactly the three pages under "## الصفحة 1/2/3", the model\'s text byte for byte', problems.length === 0, problems.join('; '));
  check('...the dropped adjective is not put back (no "fix" of the model\'s edit)', !md.includes(PRINTED_MARKS));
  check('...and "سنة 1665" is where the model put it, at the end of its line', md.includes(MODEL_LIBRE_LINE) && !md.includes(PRINTED_LIBRE_LINE));
  check('one .md file, named from the request, through the shared ingestion', state.calls.ingest.length === 1 && state.calls.ingest[0].name === 'الفصل الثاني.md' && state.calls.ingest[0].type === 'text/markdown', JSON.stringify(state.calls.ingest.map((c) => c.name)));
  check('...stored and recorded as a .md material', state.calls.insert[0]?.file_type === 'md' && state.calls.insert[0]?.filename === 'الفصل الثاني.md' && /\/[0-9a-f-]{36}\/upload$|\.md$/.test(state.calls.insert[0]?.storage_path ?? ''), JSON.stringify(state.calls.insert[0]));
  check('the answer lists the three photos as read', JSON.stringify(out.body.photos) === '[{"n":1,"read":true},{"n":2,"read":true},{"n":3,"read":true}]', JSON.stringify(out.body.photos));
  if (SELF_TEST) {
    realLog('   self-test: the byte-exact check must fail on each planted edit');
    const planted = [
      ['the dropped adjective put back', md.replace('عددًا كبيرًا مِنْ', 'عددًا كبيرًا كثيرًا مِنْ')],
      ['"سنة 1665" moved back to the start', md.replace(MODEL_LIBRE_LINE, PRINTED_LIBRE_LINE)],
      ['harakat stripped', md.replace(/[\u064B-\u0652]/g, '')],
      // G2's page holds الآلة (U+0622), which NFD splits into U+0627 U+0653.
      ['NFD normalisation', md.normalize('NFD')],
      ['CRLF line endings', md.replace(/\n/g, '\r\n')],
      ['a page trimmed of its last full stop', md.replace(/\.\n\n## /, '\n\n## ')],
      ['NFC normalisation', md.normalize('NFC')],
      ['NFKC normalisation', md.normalize('NFKC')],
      ['each page trimmed', md.replace(EDGY, EDGY.trim())],
      ['zero-width marks and tatweel stripped', md.replace(/[\u200B-\u200F\u0640]/g, '')],
    ];
    for (const [label, bad] of planted) {
      check(`self-test: ${label} is caught`, bad !== md && byteExactProblems(bad, pages, 'ar').length > 0, bad === md ? 'the planted edit changed nothing' : '');
    }
  }
});

realLog('3. Image safety');
await attempt('the image path', async () => {
  const { POST } = await load('src/app/api/page-read/route.ts');
  const image = await load('src/lib/page-photo-image.ts');
  // A batch of ten: two good pages, and eight photos that must each fail alone.
  reset();
  const whole = await solidJpeg(1300, 1600, 200);
  const truncated = whole.subarray(0, Math.floor(whole.length / 2)); // a real header, then the data cut off
  check('the truncated photo keeps a readable baseline header (so only the decoder can fail it)', H.headerRefusal(H.readPhotoHeader(truncated)) === null, JSON.stringify(H.readPhotoHeader(truncated)));
  put('1.jpg', await solidJpeg(1210, 1600));
  put('2.png', pngBomb(100000, 100000));
  put('3.jpg', jpegBomb(60000, 60000));
  put('4.heic', HEIC);
  put('5.jpg', await solidJpeg(1250, 1600));
  put('6.png', pngBomb(10000000, 4)); // the review's bomb: 40 MP, a 10,000,000 px side, 3.5 GB to resize
  put('7.jpg', await realSharp({ create: { width: 1270, height: 1600, channels: 3, background: '#f0f0f0' } }).jpeg({ progressive: true }).toBuffer());
  put('8.png', await realSharp({ create: { width: 1280, height: 1600, channels: 3, background: '#f0f0f0' } }).png({ progressive: true }).toBuffer());
  put('9.png', pngBomb(9000, 1000));
  put('10.jpg', truncated);
  state.replies.set('1210x1600', { text: 'first page' });
  state.replies.set('1250x1600', { text: 'fifth page' });
  const sharpBefore = state.sharpCalls;
  const names = ['1.jpg', '2.png', '3.jpg', '4.heic', '5.jpg', '6.png', '7.jpg', '8.png', '9.png', '10.jpg'];
  const out = await callRoute(POST, { kb_id: KB, keys: names.map((n) => key(n)), name: 'mixed', locale: 'en' });
  const codes = (out.body.photos ?? []).map((p) => (p.read ? 'read' : p.code)).join(',');
  check('one batch of ten: the two good pages read, each bad photo fails alone with its own code',
    codes === 'read,photo-too-many-pixels,photo-too-many-pixels,photo-heic,read,photo-too-many-pixels,photo-type,photo-type,photo-odd-shape,photo-unreadable', codes);
  check('only the two good photos and the truncated one reached sharp (2 calls each: header, then the pipeline); the bombs, the strip, the HEIC, the progressive and the interlaced file never did', state.sharpCalls - sharpBefore === 6, `sharp calls: ${state.sharpCalls - sharpBefore}`);
  check('...nor the model: two calls, one per good page', state.modelCalls.length === 2);
  check('...and the material holds pages 1 and 5 under their own numbers', state.calls.ingest[0]?.text === '## Page 1\n\nfirst page\n\n## Page 5\n\nfifth page\n', JSON.stringify(state.calls.ingest[0]?.text));
  check('two page_read rows in the ledger, one per billed call', ownRows().filter((r) => r.kind === 'page_read').length === 2);
  check('the truncated photo failed in the decoder and was logged, without losing a page', logs.some((l) => l.includes('"tag":"kf-page-photo-unreadable"') && l.includes('"page":10')));
  // Behind the header check, libvips' own view of the header is held to the same bounds.
  let refusedBySharp = '';
  const t0 = Date.now();
  try { await image.photoForModel(pngBomb(8000, 7000)); } catch (e) { refusedBySharp = String(e?.message ?? e); }
  check('backstop: libvips refuses a 56 MP header at its configured 50 MP cap (sharp\'s own default, 268 MP, would let it through)', /pixel limit/i.test(refusedBySharp) && Date.now() - t0 < 5000, refusedBySharp);
  let strip = '';
  const t1 = Date.now();
  try { await image.photoForModel(pngBomb(10000000, 4)); } catch (e) { strip = String(e?.message ?? e); }
  check('backstop: the 10,000,000 x 4 strip handed straight to the normaliser is refused from libvips\' header, before the resize that took 3.5 GB', /photo-too-many-pixels to libvips/.test(strip) && Date.now() - t1 < 2000, `${strip} (${Date.now() - t1} ms)`);
  let prog = '';
  try { await image.photoForModel(await realSharp({ create: { width: 64, height: 64, channels: 3, background: '#808080' } }).jpeg({ progressive: true }).toBuffer()); } catch (e) { prog = String(e?.message ?? e); }
  check('backstop: a progressive JPEG handed straight to the normaliser is refused by libvips\' view', /progressive or interlaced/.test(prog), prog || 'it was decoded');
  // One decode at a time in the whole process: two photos asked for at once (as two requests on one
  // Fluid instance would) go through sharp one after the other, never interleaved.
  const first = await solidJpeg(900, 1200, 120);
  const second = await solidJpeg(1000, 1300, 230);
  check('the two queue-test photos differ in size, so their sharp calls can be told apart', first.length !== second.length);
  state.sharpInputs = [];
  await Promise.all([image.photoForModel(first), image.photoForModel(second)]);
  const order = state.sharpInputs.map((n) => (n === first.length ? 'A' : n === second.length ? 'B' : '?')).join('');
  check('two photos prepared at once are decoded one after the other (AABB), not side by side', order === 'AABB', order);
  // Only the JPEG and PNG buffer loaders are on in libvips (GHSA-f88m-g3jw-g9cj): even bytes that got
  // past the header check reach no other parser.
  for (const [label, bytes] of [
    ['a WebP', await realSharp({ create: { width: 20, height: 20, channels: 3, background: '#808080' } }).webp().toBuffer()],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')],
    ['a TIFF', await realSharp({ create: { width: 20, height: 20, channels: 3, background: '#808080' } }).tiff().toBuffer()],
  ]) {
    let refused = '';
    try { await image.photoForModel(bytes); } catch (e) { refused = String(e?.message ?? e); }
    check(`libvips allowlist: ${label} handed straight to the normaliser is refused (no WebP, SVG or TIFF parser runs)`, /unsupported image format/i.test(refused), refused || 'it was decoded');
  }
  const stillPng = await image.photoForModel(await realSharp({ create: { width: 30, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer());
  const pngPx = await realSharp(stillPng.jpeg).raw().toBuffer();
  check('...while a PNG still loads, its transparency flattened on white', stillPng.width === 30 && stillPng.height === 20 && pngPx[0] > 240 && pngPx[1] > 240 && pngPx[2] > 240, [...pngPx.slice(0, 3)].join(','));

  // EXIF: stored on its side (4032 x 3024) with orientation 6, so upright it is a portrait page.
  const upright = await realSharp({ create: { width: 300, height: 400, channels: 3, background: '#ffffff' } })
    .composite([{ input: await realSharp({ create: { width: 60, height: 60, channels: 3, background: '#ff0000' } }).png().toBuffer(), left: 0, top: 0 }])
    .png().toBuffer();
  const sideways = await realSharp(upright).rotate(-90).withMetadata({ orientation: 6 }).jpeg({ quality: 95 }).toBuffer();
  const sideMeta = await realSharp(sideways).metadata();
  check('the test photo is stored sideways (400 x 300) with EXIF orientation 6', sideMeta.width === 400 && sideMeta.height === 300 && sideMeta.orientation === 6, JSON.stringify({ w: sideMeta.width, h: sideMeta.height, o: sideMeta.orientation }));
  const small = await image.photoForModel(sideways);
  const { data: px, info } = await realSharp(small.jpeg).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => px.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  const red = (p) => p[0] > 200 && p[1] < 80 && p[2] < 80;
  check('sent upright: 300 x 400, the red corner back at the top left', small.width === 300 && small.height === 400 && info.width === 300 && info.height === 400 && red(at(10, 10)) && !red(at(289, 10)) && !red(at(10, 389)), JSON.stringify({ w: info.width, h: info.height, tl: [...at(10, 10)], tr: [...at(289, 10)] }));
  const sentMeta = await realSharp(small.jpeg).metadata();
  check('...as a JPEG with no EXIF left (no orientation, no GPS can travel)', sentMeta.format === 'jpeg' && sentMeta.exif === undefined && sentMeta.orientation === undefined, JSON.stringify({ format: sentMeta.format, exif: !!sentMeta.exif, o: sentMeta.orientation }));
  // The phone held upside down (3) and turned the other way (8) come back upright too.
  for (const [orientation, turn] of [[3, 180], [8, 90]]) {
    const stored = await realSharp(upright).rotate(turn).withMetadata({ orientation }).jpeg({ quality: 95 }).toBuffer();
    const sent = await image.photoForModel(stored);
    const raw = await realSharp(sent.jpeg).raw().toBuffer({ resolveWithObject: true });
    const pick = (x, y) => raw.data.slice((y * raw.info.width + x) * raw.info.channels, (y * raw.info.width + x) * raw.info.channels + 3);
    check(`EXIF orientation ${orientation}: sent upright, 300 x 400, the red corner at the top left`, raw.info.width === 300 && raw.info.height === 400 && red(pick(10, 10)) && !red(pick(289, 389)), JSON.stringify({ w: raw.info.width, h: raw.info.height, tl: [...pick(10, 10)] }));
  }
  const big = await realSharp({ create: { width: 4032, height: 3024, channels: 3, background: '#f5f5f5' } }).withMetadata({ orientation: 6 }).jpeg({ quality: 70 }).toBuffer();
  const bigOut = await image.photoForModel(big);
  const bigMeta = await realSharp(bigOut.jpeg).metadata();
  check('a 12 MP photo stored sideways is sent upright at the tier\'s size, 1653 x 2205 (G2\'s size)', bigOut.width === 1653 && bigOut.height === 2205 && bigMeta.width === 1653 && bigMeta.height === 2205, JSON.stringify({ w: bigMeta.width, h: bigMeta.height }));

  // An oversize photo is refused from the listing, never downloaded.
  reset();
  put('1.jpg', await solidJpeg(1210, 1600));
  put('2.jpg', await solidJpeg(1220, 1600), 25 * 1024 * 1024 + 1);
  state.replies.set('1210x1600', { text: 'one' });
  const big2 = await callRoute(POST, { kb_id: KB, keys: [key('1.jpg'), key('2.jpg')], name: 'n', locale: 'en' });
  check('a photo over 25 MiB in the listing: photo-too-large, and it is never downloaded', (big2.body.photos ?? [])[1]?.code === 'photo-too-large' && !state.calls.download.includes(key('2.jpg')) && state.calls.download.includes(key('1.jpg')), JSON.stringify({ photos: big2.body.photos, downloads: state.calls.download }));
  reset();
  put('1.jpg', await solidJpeg(1210, 1600));
  const missing = await callRoute(POST, { kb_id: KB, keys: [key('1.jpg'), key('9.jpg')], name: 'n', locale: 'en' });
  check('a photo named but not uploaded: photo-missing, the other read', (missing.body.photos ?? []).map((x) => x.code ?? 'read').join(',') === 'read,photo-missing');
  check('...storage removed one of two, so the removal was checked by listing: nothing left, no second removal', state.calls.remove.length === 1 && state.calls.adminList.length === 1 && !logs.some((l) => l.includes('kf-page-photos-left')));

  // A removal that silently deletes nothing is caught, logged and tried once more; the student still gets the material.
  reset();
  put('1.jpg', await solidJpeg(1210, 1600));
  state.removeNoop = true;
  const noop = await callRoute(POST, { kb_id: KB, keys: [key('1.jpg')], name: 'n', locale: 'en' });
  check('storage removing nothing is not taken as removed: kf-page-photos-left is logged, the route tries once more, the material is still made', noop.status === 200 && state.calls.remove.length === 2 && logs.filter((l) => l.includes('"tag":"kf-page-photos-left"')).length === 2, JSON.stringify({ status: noop.status, removes: state.calls.remove.length, logs: logs.filter((l) => l.includes('page-photos-left')) }));
});

realLog('4. The route');
await attempt('the route, its order and its refusals', async () => {
  const { POST } = await load('src/app/api/page-read/route.ts');
  const { AI_ALLOWANCE_REFUSAL } = await load('src/lib/ai-allowance.ts');
  const { TEMPORARILY_UNAVAILABLE, uploadRefusalMessage } = await load('src/lib/limit-messages.ts');
  const { AI_CONSENT_REFUSAL } = await load('src/lib/ai-consent.ts');
  const { en } = await load('src/lib/i18n/locales/en.ts');
  const ten = async () => {
    for (let n = 1; n <= 10; n++) {
      put(`${n}.jpg`, await solidJpeg(1200 + 10 * n, 1600));
      state.replies.set(`${1200 + 10 * n}x1600`, { text: `text of page ${n}` });
    }
    return Array.from({ length: 10 }, (_, i) => key(`${i + 1}.jpg`));
  };
  const nothingSpent = (label) => {
    check(`${label}: nothing sent to Anthropic`, state.modelCalls.length === 0, `${state.modelCalls.length} calls`);
    check(`${label}: nothing recorded in the ledger`, ownRows().length === 0, JSON.stringify(ownRows()));
    check(`${label}: no upload counted`, !state.usage.get('upload'), JSON.stringify([...state.usage]));
    check(`${label}: nothing downloaded or decoded, nothing ingested`, state.calls.download.length === 0 && state.sharpCalls === 0 && state.calls.ingest.length === 0);
  };

  // (e) A foreign storage key.
  reset();
  let keys = await ten();
  let out = await callRoute(POST, { kb_id: KB, keys: [...keys.slice(0, 9), key('10.jpg', OTHER)], name: 'n', locale: 'en' });
  check('a key in another user\'s folder: 403 page-photo-foreign, the request sentence', out.status === 403 && out.body.code === 'page-photo-foreign' && out.body.error === uploadRefusalMessage('en', 'request'), JSON.stringify(out));
  nothingSpent('foreign key');
  check('foreign key: nothing listed and nothing deleted, the caller\'s nine photos included', state.calls.list.length === 0 && state.calls.remove.length === 0 && state.objects.size === 10);
  check('foreign key: refused before the consent, the subject and the allowance were even read', state.calls.docLimit === 0);

  // Malformed and signed-out requests.
  reset();
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, locale: 'en' });
  check('no name: 400 with the request sentence, nothing touched', out.status === 400 && out.body.error === uploadRefusalMessage('en', 'request') && state.calls.remove.length === 0);
  out = await callRoute(POST, { kb_id: 'not-a-uuid', keys, name: 'n', locale: 'ar' });
  check('a subject id that is not a uuid: 400 in Arabic', out.status === 400 && out.body.error === uploadRefusalMessage('ar', 'request'));
  out = await callRoute(POST, { kb_id: KB, keys: [...keys, key('11.jpg')], name: 'n', locale: 'en' });
  check('eleven keys: 400, nothing deleted', out.status === 400 && state.calls.remove.length === 0);
  reset({ user: false });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('signed out: 401 with the session sentence, nothing deleted (whose would they be?)', out.status === 401 && out.body.error === uploadRefusalMessage('en', 'session') && state.calls.remove.length === 0);
  nothingSpent('signed out');

  // Consent.
  reset({ consent: false });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('without the AI permission: 403 ai_consent_required, the declined sentence', out.status === 403 && out.body.code === AI_CONSENT_REFUSAL && out.body.error === en.dashboard.aiConsent.declined, JSON.stringify(out.body));
  nothingSpent('no permission');
  check('no permission: the photos are deleted (single use), exactly the ten keys, once', state.calls.remove.length === 1 && JSON.stringify(state.calls.remove[0].keys) === JSON.stringify(keys) && state.objects.size === 0);

  // The camera screen: a version-1 permission named text only, so the route
  // needs the one whose sheet named photos (PAGE_READ_CONSENT_VERSION, 2).
  reset({ consentVersion: 1 });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('with the text-only permission (version 1): 403 ai_consent_required, the declined sentence', out.status === 403 && out.body.code === AI_CONSENT_REFUSAL && out.body.error === en.dashboard.aiConsent.declined, JSON.stringify(out.body));
  nothingSpent('version-1 permission');

  // The subject.
  reset({ subject: false });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('a subject that is not the caller\'s: 404 before anything is spent', out.status === 404 && state.calls.docLimit === 0);
  nothingSpent('foreign subject');
  reset();
  keys = await ten();
  out = await callRoute(POST, { kb_id: '66666666-6666-4666-8666-666666666666', keys, name: 'n', locale: 'en' });
  check('another well-formed subject id while the caller has their own: 404 (the read asks for that id, not any subject)', out.status === 404 && state.calls.docLimit === 0, JSON.stringify(out));
  nothingSpent('another subject id');
  reset();
  state.subjectDown = true;
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('the subject cannot be read: 503 temporarily unavailable, not "not found"', out.status === 503 && out.body.error === TEMPORARILY_UNAVAILABLE.en, JSON.stringify(out.body));
  nothingSpent('subject unread');
  reset({ docLimitReached: true });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('a subject at its material cap: 403', out.status === 403);
  nothingSpent('subject full');

  // (f) The allowance refusal: Free, 0.98 spent, ten photos reserve 0.025.
  reset({ spent: 0.98 });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('0.98 spent + 10 x 0.0025 over 1.00: 429 ai-allowance-used', out.status === 429 && out.body.code === AI_ALLOWANCE_REFUSAL && out.body.error === en.dashboard.aiAllowance.used, JSON.stringify(out.body));
  nothingSpent('allowance used');
  check('allowance used: the photos are deleted', state.calls.remove.length === 1 && state.objects.size === 0);
  reset({ spent: 0.975 });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('0.975 spent + 0.025 = exactly 1.00 stays within: read', out.status === 200 && state.modelCalls.length === 10, `${out.status} ${state.modelCalls.length}`);

  // (g) An unreadable ledger.
  reset({ ledgerDown: true });
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'ar' });
  check('an unreadable ledger: 503, temporarily unavailable, in Arabic', out.status === 503 && out.body.error === TEMPORARILY_UNAVAILABLE.ar, JSON.stringify(out.body));
  nothingSpent('ledger unreadable');

  // The daily counter: one batch is one upload.
  reset();
  state.usage.set('upload', 25);
  keys = await ten();
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('the day\'s uploads used: 429 from the shared counter, nothing sent', out.status === 429 && state.modelCalls.length === 0 && ownRows().length === 0);

  // (h) The mocked model call: ten pages, read. Later pages answer sooner, as
  // real calls of different lengths do, so the pages finish out of order and
  // only the reader's sort can put the material back in photo order.
  reset();
  keys = await ten();
  state.reply = async (params) => {
    const { width } = H.readPhotoHeader(Buffer.from(params.messages[0].content[0].source.data, 'base64'));
    const n = (width - 1200) / 10;
    await new Promise((r) => setTimeout(r, (11 - n) * 15));
    state.finished.push(n);
    return defaultReply(params);
  };
  state.finished = [];
  out = await callRoute(POST, { kb_id: KB, keys, name: 'Chapter 3', locale: 'en' });
  check('the calls finished out of photo order (the stub makes later pages faster)', state.finished.join(',') !== [...state.finished].sort((a, b) => a - b).join(','), state.finished.join(','));
  check('ten photos: 200, one material', out.status === 200 && out.body.success === true && state.calls.ingest.length === 1, JSON.stringify(out.body).slice(0, 200));
  check('one batch is ONE upload on the day\'s counter', state.usage.get('upload') === 1, JSON.stringify([...state.usage]));
  check('one model call per photo, ten', state.modelCalls.length === 10);
  const call = state.modelCalls[0];
  const p = call.params;
  savedRouteParams = p;
  check('the request is G2\'s: claude-haiku-5-5, thinking disabled, max_tokens 4000', p.model === 'claude-haiku-5-5' && JSON.stringify(p.thinking) === '{"type":"disabled"}' && p.max_tokens === 4000, JSON.stringify({ model: p.model, thinking: p.thinking, max_tokens: p.max_tokens }));
  check('...one user turn: the image first (base64 JPEG), then the G2 prompt', p.messages.length === 1 && p.messages[0].role === 'user' && p.messages[0].content.length === 2 && p.messages[0].content[0].type === 'image' && p.messages[0].content[0].source.type === 'base64' && p.messages[0].content[0].source.media_type === 'image/jpeg' && p.messages[0].content[1].type === 'text' && sha256(p.messages[0].content[1].text) === G2_PROMPT_SHA);
  check('...and nothing else: no system, tools, temperature, top_p, top_k or stream', Object.keys(p).sort().join(',') === 'max_tokens,messages,model,thinking', Object.keys(p).sort().join(','));
  check('...with the deadline\'s signal, 2 retries, and an attempt limit equal to what is left of the 120 s deadline (so the SDK never gives up on a slow page and sends it again)',
    call.options?.signal instanceof AbortSignal && call.options?.maxRetries === 2 && Number.isInteger(call.options?.timeout) && call.options.timeout > 100000 && call.options.timeout <= 120000 && state.modelCalls.every((c) => c.options.timeout <= 120000),
    JSON.stringify({ timeout: call.options?.timeout, maxRetries: call.options?.maxRetries }));
  check('the listing and every download carry the deadline (a stalled photo cannot hold the batch)', state.calls.list[0]?.signal instanceof AbortSignal && state.downloadSignals.length === 10 && state.downloadSignals.every((s) => s instanceof AbortSignal));
  check('the .md\'s ingestion carries a signal bounded by what is left of maxDuration', state.calls.ingest[0]?.signal instanceof AbortSignal && state.calls.ingest[0].signal.aborted === false);
  const sentImages = state.modelCalls.map((c) => H.readPhotoHeader(Buffer.from(c.params.messages[0].content[0].source.data, 'base64')));
  check('every image sent is a JPEG within the tier', sentImages.every((h) => h.format === 'jpeg' && Math.max(h.width, h.height) <= 2576 && H.imageTokens(h.width, h.height) <= 4784));
  const rows = ownRows().filter((r) => r.kind === 'page_read');
  check('ten page_read rows, each the real price of its usage (0.000759 USD), none estimated', rows.length === 10 && rows.every((r) => r.usd === 0.000759 && r.estimated === false), JSON.stringify(rows.slice(0, 2)));
  check('...plus the .md\'s embedding, as every upload records it (Voyage\'s 120 tokens, 0.000022 USD)', ownRows().filter((r) => r.kind === 'upload_embed').length === 1 && ownRows().find((r) => r.kind === 'upload_embed').usd === 0.000022);
  const usageLines = logs.filter((l) => l.includes('"tag":"kf-usage"') && l.includes('"route":"page-read"'));
  check('one kf-usage line per call, with tokens and the price, and no text', usageLines.length === 10 && usageLines.every((l) => /"input_tokens":4915/.test(l) && /"usd":0.000759/.test(l) && !/text of page/.test(l)));
  check('the material: ten "## Page n" headings in order, each page\'s text', state.calls.ingest[0].text === Array.from({ length: 10 }, (_, i) => `## Page ${i + 1}\n\ntext of page ${i + 1}`).join('\n\n') + '\n');
  check('the photos are deleted once they are in memory: one removal of exactly the ten keys', state.calls.remove.length === 1 && JSON.stringify(state.calls.remove[0].keys) === JSON.stringify(keys) && state.objects.size === 0);
  check('...with the service role, in the documents bucket, all ten confirmed removed (no listing needed)', state.calls.remove[0].bucket === 'documents' && state.calls.adminList.length === 0);
  check('...and BEFORE the first model call: nothing stays in storage while the pages are read', state.events.indexOf('remove') >= 0 && state.events.indexOf('remove') < state.events.indexOf('model'), state.events.join(','));
  check('the downloads used the student\'s session, ten, and the listing came first', state.calls.download.length === 10 && state.calls.list.length === 1 && state.calls.list[0].folder === FOLDER);
  check('at most three photos were downloaded at once (a request holds about three raw photos, not ten)', state.maxInflight >= 2 && state.maxInflight <= 3, `peak ${state.maxInflight}`);
  check('the answer is the shared ingestion\'s, plus the photos', out.body.document_id && out.body.chunk_count === 2 && out.body.photos.length === 10 && out.body.photos.every((x) => x.read === true));
  check('the Anthropic client gets the server\'s key from the environment', state.clientOptions.at(-1)?.apiKey === process.env.ANTHROPIC_API_KEY);

  // Failed pages: billed ones recorded, unbilled ones not; the rest kept.
  reset();
  keys = await ten();
  state.replies.set('1210x1600', { text: 'unused', stop_reason: 'max_tokens', content: [{ type: 'text', text: 'cut' }], usage: { input_tokens: 4915, output_tokens: 4000 } });
  state.replies.set('1220x1600', { stop_reason: 'refusal', content: [], usage: { input_tokens: 4915, output_tokens: 3 } });
  state.replies.set('1230x1600', { text: '   ', usage: { input_tokens: 4915, output_tokens: 1 } });
  state.replies.set('1240x1600', { throw: Object.assign(new Error('Internal server error'), { status: 500, name: 'InternalServerError' }) });
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  const pc = (out.body.photos ?? []).map((x) => (x.read ? 'read' : x.code)).join(',');
  check('cut-off, refused, empty and failed pages fail alone; the six others are read', out.status === 200 && pc === 'read-cut-off,read-refused,read-empty,read-failed,read,read,read,read,read,read', pc);
  const prow = ownRows().filter((r) => r.kind === 'page_read').map((r) => r.usd).sort();
  const A2 = await load('src/lib/ai-allowance.ts');
  const wantRows = [A2.haiku55Usd({ input_tokens: 4915, output_tokens: 4000 }), A2.haiku55Usd({ input_tokens: 4915, output_tokens: 3 }), A2.haiku55Usd({ input_tokens: 4915, output_tokens: 1 }), ...Array(6).fill(A2.haiku55Usd(G2_USAGE))].sort();
  check('the three billed failures are recorded at their real price (0.002492, 0.000493, 0.000492), the error that returned nothing is not', JSON.stringify(prow) === JSON.stringify(wantRows) && wantRows.includes(0.002492) && prow.length === 9, JSON.stringify(prow));
  check('the material holds pages 5 to 10 only, under their own numbers', /^## Page 5\n\ntext of page 5\n\n## Page 6/.test(state.calls.ingest[0]?.text ?? '') && !/## Page [1-4]\n/.test(state.calls.ingest[0]?.text ?? ''));

  // Refusals before any output: Anthropic bills bio, frontier_llm and reasoning_extraction only.
  reset();
  keys = await ten();
  const preOutput = (category) => ({ stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category, explanation: null }, usage: { input_tokens: 4915, output_tokens: 0 } });
  state.replies.set('1210x1600', preOutput('cyber'));
  state.replies.set('1220x1600', preOutput('general_harms'));
  state.replies.set('1230x1600', preOutput(null));
  state.replies.set('1240x1600', preOutput('bio'));
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  const rc = (out.body.photos ?? []).map((x) => (x.read ? 'read' : x.code)).join(',');
  check('four pages refused before any output fail alone as read-refused; the six others are read', out.status === 200 && rc === 'read-refused,read-refused,read-refused,read-refused,read,read,read,read,read,read', rc);
  const rrows = ownRows().filter((r) => r.kind === 'page_read');
  check('only the billed one (bio) is recorded: 7 rows, not 10; cyber, general_harms and no category cost the student nothing', rrows.length === 7 && rrows.filter((r) => r.usd === A2.haiku55Usd({ input_tokens: 4915, output_tokens: 0 })).length === 1, JSON.stringify(rrows.map((r) => r.usd)));
  const unbilledLines = logs.filter((l) => l.includes('"tag":"kf-usage"') && l.includes('"billed":false'));
  check('...and each unbilled refusal still leaves a kf-usage line, billed false, usd 0', unbilledLines.length === 3 && unbilledLines.every((l) => /"usd":0[,}]/.test(l)), unbilledLines.join(' | ').slice(0, 300));

  // The .md is held to the upload limit the ingestion service sizes itself on.
  reset();
  keys = await ten();
  for (let n = 1; n <= 10; n++) state.replies.set(`${1200 + 10 * n}x1600`, { text: 'x'.repeat(430_000) });
  out = await callRoute(POST, { kb_id: KB, keys, name: 'n', locale: 'en' });
  check('a .md over 4 MiB is not sent to the ingestion service: 422 too-much-text, the pages already recorded', out.status === 422 && out.body.error === uploadRefusalMessage('en', 'too-much-text') && state.calls.ingest.length === 0 && ownRows().filter((r) => r.kind === 'page_read').length === 10, JSON.stringify({ status: out.status, ingested: state.calls.ingest.length }));

  // Nothing readable at all: 422, nothing saved, the upload still counted.
  reset();
  put('1.heic', HEIC);
  put('2.png', pngBomb(100000, 100000));
  out = await callRoute(POST, { kb_id: KB, keys: [key('1.heic'), key('2.png')], name: 'n', locale: 'en' });
  check('no photo readable: 422 pages-unread with the nothing-saved sentence and each photo\'s code', out.status === 422 && out.body.code === 'pages-unread' && out.body.error === uploadRefusalMessage('en', 'nothing-saved') && (out.body.photos ?? []).map((x) => x.code).join(',') === 'photo-heic,photo-too-many-pixels', JSON.stringify(out.body));
  check('...nothing sent, nothing recorded, nothing stored or ingested, the photos deleted', state.modelCalls.length === 0 && ownRows().length === 0 && state.calls.upload.length === 0 && state.calls.ingest.length === 0 && state.objects.size === 0);
  check('...and the attempt counted (as a failed upload is; it keeps no place among the day\'s kept uploads)', state.usage.get('upload') === 1);
});

await attempt('the deadline', async () => {
  const R = await load('src/lib/page-reader-server.ts');
  reset();
  for (let n = 1; n <= 4; n++) put(`${n}.jpg`, await solidJpeg(1200 + 10 * n, 1600));
  const { createClient } = await import(inline(SESSION_STUB));
  const supabase = await createClient();
  let calls = 0;
  // A model that never answers: each call waits for the deadline's abort.
  const anthropic = { messages: { create: (params, options) => { calls += 1; return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })))); } } };
  const names = ['1.jpg', '2.jpg', '3.jpg', '4.jpg'];
  // 2 s: room for the three small photos to be prepared, so three calls are in flight when it passes.
  const r = await R.readPagePhotos({ supabase, anthropic, userId: USER, folder: FOLDER, names, keys: names.map((n) => key(n)), deadlineMs: 2000 });
  check('at the deadline the three pages in flight fail as read-timeout and the fourth is never sent', r.outcomes.map((o) => o.code).join(',') === 'read-timeout,read-timeout,read-timeout,read-timeout' && calls === 3, JSON.stringify({ outcomes: r.outcomes, calls }));
  check('...nothing recorded for calls that returned no usage', ownRows().length === 0);
  check('...and the photos were already out of storage', r.photosRemoved === true && state.objects.size === 0);

  // A 429 with retry-after 5 s against a 1 s deadline, through the REAL SDK 0.39: its retry
  // sleep does not watch the signal, so only the race ends the page at the deadline.
  reset();
  put('1.jpg', await solidJpeg(1210, 1600));
  const { default: RealAnthropic } = await import(pathToFileURL(resolvePath(ROOT, 'node_modules/@anthropic-ai/sdk/index.mjs')).href);
  let sent = 0;
  const limited = new RealAnthropic({
    apiKey: 'verify-only-not-a-key',
    fetch: async () => {
      sent += 1;
      return new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '5' } });
    },
  });
  const started = Date.now();
  const r429 = await R.readPagePhotos({ supabase, anthropic: limited, userId: USER, folder: FOLDER, names: ['1.jpg'], keys: [key('1.jpg')], deadlineMs: 1000 });
  const took = Date.now() - started;
  check('a 429 asking for a 5 s wait cannot carry the page past a 1 s deadline: read-timeout in about 1 s, one request sent, nothing recorded',
    r429.outcomes[0].code === 'read-timeout' && took < 2500 && sent === 1 && ownRows().length === 0, JSON.stringify({ outcome: r429.outcomes[0], took, sent }));

  // One photo's download stalls: it alone fails, the others are read, and the photos still go.
  reset();
  for (let n = 1; n <= 4; n++) put(`${n}.jpg`, await solidJpeg(1200 + 10 * n, 1600));
  state.stallKeys.add(key('2.jpg'));
  const quick = { messages: { create: async (params) => { state.modelCalls.push({ params }); return defaultReply(params); } } };
  const t2 = Date.now();
  const rs = await R.readPagePhotos({ supabase, anthropic: quick, userId: USER, folder: FOLDER, names, keys: names.map((n) => key(n)), deadlineMs: 10000, downloadTimeoutMs: 300 });
  const tookStall = Date.now() - t2;
  check('a stalled download fails that photo alone (photo-missing) after its own time limit; the three others are read',
    rs.outcomes.map((o) => (o.read ? 'read' : o.code)).join(',') === 'read,photo-missing,read,read' && state.modelCalls.length === 3 && tookStall < 5000, JSON.stringify({ outcomes: rs.outcomes, tookStall }));
  check('...and the removal still ran for every key, the stalled one included', state.calls.remove.length === 1 && state.calls.remove[0].keys.length === 4);

  // The DEADLINE, not a per-photo timer, ends a hung listing and a stalled download. A
  // watchdog keeps the run alive and names the failure if the deadline does not end them.
  const within = (promise, ms) => new Promise((resolveIt) => {
    const t = setTimeout(() => resolveIt({ done: false }), ms);
    promise.then((value) => { clearTimeout(t); resolveIt({ done: true, value }); }, (error) => { clearTimeout(t); resolveIt({ done: true, error }); });
  });
  reset();
  for (let n = 1; n <= 3; n++) put(`${n}.jpg`, await solidJpeg(1200 + 10 * n, 1600));
  state.listStall = true;
  const three = ['1.jpg', '2.jpg', '3.jpg'];
  const wl = await within(R.readPagePhotos({ supabase, anthropic: quick, userId: USER, folder: FOLDER, names: three, keys: three.map((n) => key(n)), deadlineMs: 800 }), 4000);
  check('a listing that never answers is ended by the 800 ms deadline: every photo read-timeout, nothing downloaded, and the photos still removed',
    wl.done && wl.value?.outcomes.every((o) => o.code === 'read-timeout') && state.calls.download.length === 0 && state.calls.remove.length === 1,
    wl.done ? JSON.stringify(wl.value?.outcomes ?? String(wl.error)) : 'still waiting 4 s later: the deadline did not end the listing');
  reset();
  for (let n = 1; n <= 3; n++) put(`${n}.jpg`, await solidJpeg(1200 + 10 * n, 1600));
  state.stallKeys.add(key('2.jpg'));
  const wd = await within(R.readPagePhotos({ supabase, anthropic: quick, userId: USER, folder: FOLDER, names: three, keys: three.map((n) => key(n)), deadlineMs: 800, downloadTimeoutMs: 60000 }), 4000);
  check('a stalled download whose own timer is a minute away is ended by the 800 ms deadline (read-timeout), not by its timer',
    wd.done && wd.value?.outcomes[1].code === 'read-timeout',
    wd.done ? JSON.stringify(wd.value?.outcomes ?? String(wd.error)) : 'still waiting 4 s later: the deadline did not end the download');

  // The shared decode slot: a photo still queued when its request's deadline passes is never decoded,
  // and its request answers at its deadline instead of waiting for the slot.
  reset();
  const image = await load('src/lib/page-photo-image.ts');
  const heavy = await realSharp({ create: { width: 8000, height: 6000, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } }).png({ compressionLevel: 1 }).toBuffer();
  const busyStart = Date.now();
  const busy = Array.from({ length: 5 }, () => image.photoForModel(heavy));
  put('1.jpg', await solidJpeg(1210, 1600));
  const small = state.objects.get(key('1.jpg')).bytes.length;
  const t5 = Date.now();
  const rq = await R.readPagePhotos({ supabase, anthropic: quick, userId: USER, folder: FOLDER, names: ['1.jpg'], keys: [key('1.jpg')], deadlineMs: 150 });
  const tookQ = Date.now() - t5;
  await Promise.allSettled(busy);
  const busyMs = Date.now() - busyStart;
  await image.photoForModel(await solidJpeg(64, 64)); // the queue has drained past the expired photo's turn
  check('a photo waiting behind other requests\' decodes when its deadline passes: read-timeout at the deadline (well before the slot frees), and it is never decoded afterwards',
    rq.outcomes[0].code === 'read-timeout' && busyMs > 500 && tookQ < busyMs / 2 && !state.sharpInputs.includes(small) && state.modelCalls.length === 0,
    JSON.stringify({ outcome: rq.outcomes[0], tookQ, busyMs, decodedLater: state.sharpInputs.includes(small) }));
});

realLog('5. @anthropic-ai/sdk 0.39 sends that request');
await attempt('the real SDK, offline', async () => {
  const sdkPkg = JSON.parse(read('node_modules/@anthropic-ai/sdk/package.json'));
  check('the installed SDK is 0.39.0 (no upgrade needed)', sdkPkg.version === '0.39.0', sdkPkg.version);
  const { default: RealAnthropic } = await import(pathToFileURL(resolvePath(ROOT, 'node_modules/@anthropic-ai/sdk/index.mjs')).href);
  const routeParams = savedRouteParams;
  check('the params the route built in section 4 are at hand', !!routeParams);
  const wire = [];
  const client = new RealAnthropic({
    apiKey: 'verify-only-not-a-key',
    fetch: async (url, init) => {
      wire.push({ url: String(url), headers: init.headers, body: init.body });
      return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null, usage: G2_USAGE }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
    },
  });
  const msg = await client.messages.create(routeParams, { timeout: 60000, maxRetries: 2, signal: new AbortController().signal });
  const sent = wire[0] ?? {};
  const h = sent.headers ?? {};
  const header = (name) => (typeof h.get === 'function' ? h.get(name) : h[name] ?? h[name.toLowerCase()]);
  check('one POST to https://api.anthropic.com/v1/messages', wire.length === 1 && sent.url === 'https://api.anthropic.com/v1/messages', sent.url);
  check('anthropic-version 2023-06-01 (the version G2\'s Python SDK 0.109.1 also sent)', header('anthropic-version') === '2023-06-01', String(header('anthropic-version')));
  const body = JSON.parse(String(sent.body ?? '{}'));
  check('the body on the wire is exactly the route\'s params (thinking disabled included, nothing added)', JSON.stringify(body) === JSON.stringify(routeParams), Object.keys(body).join(','));
  check('the SDK hands back the text and the usage the route prices', msg.content?.[0]?.text === 'ok' && msg.usage?.input_tokens === 4915);
});

realLog('6. The ledger kind, the migration, the wiring');
await attempt('the ledger kind', async () => {
  const A = await load('src/lib/ai-allowance.ts');
  const mig = read('supabase/migrations/20261116_ai_spend_page_read.sql');
  const sql = mig.replace(/^--.*$/gm, '');
  const kinds = [...(sql.match(/check \(kind in \(([^)]*)\)\)/) ?? [, ''])[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  check('AI_SPEND_KINDS and the new check hold the same six kinds, page_read last', JSON.stringify(A.AI_SPEND_KINDS) === JSON.stringify(kinds) && kinds.at(-1) === 'page_read' && kinds.length === 6, JSON.stringify({ code: A.AI_SPEND_KINDS, sql: kinds }));
  check('the migration only drops and re-adds the kind check, in one transaction', /^\s*begin;\s*alter table public\.ai_spend drop constraint if exists ai_spend_kind_check;\s*alter table public\.ai_spend add constraint ai_spend_kind_check\s*check \(kind in \([^)]*\)\);\s*commit;\s*$/.test(sql), sql.trim());
  check('its VERIFY block expects the six-kind check among its 10 rows', /-- Expected rows \(10\):/.test(mig) && /ai_spend_kind_check=CHECK \(\(kind = ANY \(ARRAY\['answer'::text, 'summary'::text, 'quiz'::text, 'query_embed'::text, 'upload_embed'::text, 'page_read'::text\]\)\)\)/.test(mig));
  const order = read('supabase/migration-order.txt');
  check('the manifest applies it, after 20261115', /^20261116_ai_spend_page_read\.sql\s+apply$/m.test(order) && order.indexOf('20261115_ai_spend.sql') < order.indexOf('20261116_ai_spend_page_read.sql'));
  const types = read('supabase/database.types.ts');
  check('database.types.ts types ai_spend.kind as string, as for the five kinds before (a check constraint does not change the generated types)', /ai_spend: \{\s*Row: \{[^}]*kind: string/.test(types));
});
await attempt('the wiring', async () => {
  const route = read('src/app/api/page-read/route.ts');
  const H2 = await load('src/lib/page-reader.ts');
  check('the route runs on Node.js with maxDuration = PAGE_READ_MAX_DURATION_S (300 s)', /export const runtime = 'nodejs';/.test(route) && new RegExp(`export const maxDuration = ${H2.PAGE_READ_MAX_DURATION_S};`).test(route));
  check('...and the time adds up: reading ends by its 120 s deadline (each call races it), the ingestion gets the rest less a 10 s margin to answer in JSON',
    H2.PAGE_READ_DEADLINE_MS < H2.PAGE_READ_MAX_DURATION_S * 1000 - H2.PAGE_READ_ANSWER_MARGIN_MS && /signal: AbortSignal\.timeout\(Math\.max\(1000, left\)\)/.test(route) && /PAGE_READ_MAX_DURATION_S \* 1000 - PAGE_READ_ANSWER_MARGIN_MS - \(Date\.now\(\) - startedAt\)/.test(route));
  const at = (s) => route.indexOf(s);
  const order = ['supabase.auth.getUser()', 'checkPhotoKeys(user.id', 'hasAiConsent(user, PAGE_READ_CONSENT_VERSION)', "from('knowledge_bases')", 'checkDocumentLimit(kbId', 'checkAiAllowance(user.id, safeLocale, pageReadReserveUsd(owned.length))', 'enforceUploadLimit(user.id', 'readPagePhotos(', 'ingestMaterial('];
  const pos = order.map(at);
  check('the route\'s order: session, keys, consent, subject, subject cap, allowance with the reserve, counter, read, ingest', pos.every((x, i) => x > 0 && (i === 0 || pos[i - 1] < x)), order.map((s, i) => `${s}@${pos[i]}`).join(' '));
  const ingest = read('src/app/api/ingest/route.ts');
  check('/api/ingest uses the same shared path and day\'s-uploads reader (no fork)', /return await ingestMaterial\(\{ supabase, user, kbId, file, fileType: ext, safeLocale, trace \}\)/.test(ingest) && /enforceUploadLimit\(user\.id, safeLocale, platformFromRequest\(request\), \(\) => todaysKeptUploads\(supabase\)\)/.test(ingest) && /todaysKeptUploads\(supabase\)/.test(route));
  // sharp comes through Next's optional dependency (the lockfile pins 0.34.5). It is not added to
  // package.json: a package.json change starts the macOS ios-smoke job on every push of the PR.
  // 0.35.x must not arrive by accident: its entry point (dist/index.cjs) is not followed by Next's
  // file tracing, which would leave libvips out of the function on Vercel (vercel/next.js#96064).
  const lock = JSON.parse(read('package-lock.json'));
  const sharpPkg = JSON.parse(read('node_modules/sharp/package.json') || '{}');
  check('sharp is locked at 0.34.5, and the installed copy is that one with the lib/index.js entry Next\'s tracing follows',
    lock.packages?.['node_modules/sharp']?.version === '0.34.5' && sharpPkg.version === '0.34.5' && sharpPkg.main === 'lib/index.js',
    JSON.stringify({ lock: lock.packages?.['node_modules/sharp']?.version, installed: sharpPkg.version, main: sharpPkg.main }));
  check('the typecheck workflow runs this proof and its self-test', /node --experimental-strip-types scripts\/verify-page-reader\.mjs && node --experimental-strip-types scripts\/verify-page-reader\.mjs --self-test/.test(read('.github/workflows/typecheck.yml')));
});

console.log = realLog;
console.error = realError;
realLog(`\n${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
