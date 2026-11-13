/**
 * Executable proof for the Paddle webhook's safety rules (fix/paddle-safety).
 *
 * It imports the REAL `POST` from `src/app/api/paddle/webhook/route.ts`, the
 * REAL `src/lib/paddle.ts` (the Paddle SDK, no API key, no network) and the
 * REAL signature check, and signs every delivery with a test secret the way
 * Paddle does: `paddle-signature: ts=<unix>;h1=<hex HMAC-SHA256 of "ts:body">`.
 *
 * What is stubbed: Next's `NextResponse` (a response as data) and the
 * Supabase admin client (an in-memory `subscriptions` table that understands
 * the queries the route makes). `node:crypto` is wrapped for modules under
 * `src/` only, to count calls to `timingSafeEqual`.
 *
 * The rules, each a group below:
 *   1. Pro is granted only for exactly ONE item, the price in
 *      PADDLE_PRO_PRICE_ID, quantity 1. Any other price or quantity, or a
 *      second item: logged, no entitling row. A canceled event always lands.
 *   2. The signature is compared in constant time (timingSafeEqual, length
 *      checked first), over the raw body, inside the 5 s window.
 *   3. An event older than the last one applied to a subscription never
 *      overwrites it; a redelivery changes nothing; a newer one applies.
 *
 * Tier 0: no network, no credential, no database, no Paddle call.
 *
 * Usage: node --experimental-strip-types scripts/verify-paddle-webhook-safety.mjs
 */
import { registerHooks } from 'node:module';
import { createHmac } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = pathToFileURL(resolvePath(ROOT, 'src')).href;
const SECRET = ['verify', 'only', 'webhook', 'key', 'not', 'real'].join('-');
const PRO = 'pri_01testpro000000000000000000';
const OTHER = 'pri_01testcheap00000000000000000';
process.env.PADDLE_WEBHOOK_SECRET = SECRET;
process.env.PADDLE_PRO_PRICE_ID = PRO;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-not-a-key';
delete process.env.PADDLE_API_KEY;
delete process.env.PADDLE_ENV;

// ── The in-memory table ────────────────────────────────────────────────────
const db = { rows: new Map(), calls: [] };
globalThis.__kfWebhookDb = db;
globalThis.__kfTimingSafeEqual = 0;

const NEXT_SERVER = `
export class NextRequest {}
export const NextResponse = {
  json(body, init) { return { status: (init && init.status) || 200, body }; },
};`;

// A builder that records the query and runs it when awaited.
const SUPABASE_STUB = `
const db = globalThis.__kfWebhookDb;
function parseOr(s) {
  return s.split(',').map((p) => {
    const [col, op, ...rest] = p.split('.');
    let v = rest.join('.');
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return { col, op, v };
  });
}
function test(row, f) {
  const x = row[f.col];
  if (f.op === 'eq') return x === f.v;
  if (f.op === 'is') return f.v === 'null' ? x == null : false;
  if (f.op === 'lt') return x != null && Date.parse(x) < Date.parse(f.v);
  throw new Error('stub: unsupported filter ' + f.op);
}
class Q {
  constructor(kind, payload, opts) { this.kind = kind; this.payload = payload; this.opts = opts || {}; this.filters = []; this.ors = []; }
  eq(col, v) { this.filters.push({ col, op: 'eq', v }); return this; }
  lt(col, v) { this.filters.push({ col, op: 'lt', v }); return this; }
  or(s) { this.ors.push(parseOr(s)); return this; }
  select() { return this; }
  then(ok, bad) { return Promise.resolve().then(() => this.run()).then(ok, bad); }
  run() {
    db.calls.push({ kind: this.kind, payload: this.payload, opts: this.opts, filters: this.filters, ors: this.ors });
    if (this.kind === 'upsert') {
      if (db.beforeUpsert) { const f = db.beforeUpsert; db.beforeUpsert = null; f(); }
      const key = this.payload.paddle_subscription_id;
      const had = db.rows.get(key);
      if (had && this.opts.ignoreDuplicates) return { data: [], error: null };
      const row = { ...(had || {}), ...this.payload };
      db.rows.set(key, row);
      return { data: [row], error: null };
    }
    if (this.kind === 'update') {
      const hit = [];
      for (const [k, row] of db.rows) {
        if (!this.filters.every((f) => test(row, f))) continue;
        if (!this.ors.every((alts) => alts.some((f) => test(row, f)))) continue;
        db.rows.set(k, { ...row, ...this.payload });
        hit.push(db.rows.get(k));
      }
      return { data: hit, error: null };
    }
    throw new Error('stub: unsupported ' + this.kind);
  }
}
export function createClient() {
  return { from(t) {
    if (t !== 'subscriptions') throw new Error('stub: table ' + t);
    return { upsert: (p, o) => new Q('upsert', p, o), update: (p) => new Q('update', p) };
  } };
}`;

const CRYPTO_WRAP = `
import * as c from 'node:crypto';
export * from 'node:crypto';
export default c.default;
export function timingSafeEqual(a, b) { globalThis.__kfTimingSafeEqual++; return c.timingSafeEqual(a, b); }`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@supabase/supabase-js') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if ((spec === 'node:crypto' || spec === 'crypto') && ctx.parentURL && ctx.parentURL.startsWith(SRC_URL)) {
      return { url: inline(CRYPTO_WRAP), shortCircuit: true };
    }
    if (spec.startsWith('@/')) {
      const base = resolvePath(ROOT, 'src', spec.slice(2));
      return { url: pathToFileURL(/\.[a-z]+$/i.test(base) ? base : base + '.ts').href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { POST } = await import(pathToFileURL(resolvePath(ROOT, 'src/app/api/paddle/webhook/route.ts')).href);

// ── Deliveries ─────────────────────────────────────────────────────────────
let seq = 0;
function subscriptionEvent({ type = 'subscription.created', status = 'active', occurredAt, sub = 'sub_01test0000000000000000001', user = 'user-a', items = [{ price: PRO, quantity: 1 }], endsAt = '2099-01-01T00:00:00.000Z' } = {}) {
  seq++;
  return {
    event_id: `evt_test_${seq}`,
    event_type: type,
    occurred_at: occurredAt || new Date(Date.UTC(2026, 10, 13, 1, 0, seq)).toISOString(),
    notification_id: `ntf_test_${seq}`,
    data: {
      id: sub,
      status,
      customer_id: 'ctm_01test',
      address_id: 'add_01test',
      currency_code: 'USD',
      created_at: '2026-11-13T01:00:00.000Z',
      updated_at: '2026-11-13T01:00:00.000Z',
      collection_mode: 'automatic',
      billing_cycle: { interval: 'month', frequency: 1 },
      current_billing_period: endsAt ? { starts_at: '2026-11-13T01:00:00.000Z', ends_at: endsAt } : null,
      custom_data: user ? { user_id: user } : null,
      items: items.map((it) => ({
        status: 'active',
        quantity: it.quantity,
        recurring: true,
        created_at: '2026-11-13T01:00:00.000Z',
        updated_at: '2026-11-13T01:00:00.000Z',
        price: it.price ? { id: it.price, product_id: 'pro_01test', description: 'test', tax_mode: 'account_setting' } : null,
      })),
    },
  };
}
function sign(body, { ts = Math.floor(Date.now() / 1000), secret = SECRET, h1 } = {}) {
  const mac = h1 ?? createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${mac}`;
}
function request(body, signature) {
  return { headers: { get: (n) => (n.toLowerCase() === 'paddle-signature' ? signature : null) }, text: async () => body };
}
async function deliver(event, opts = {}) {
  const body = opts.rawBody ?? JSON.stringify(event);
  const sig = opts.signature !== undefined ? opts.signature : sign(body, opts);
  return POST(request(body, sig));
}
const row = (sub = 'sub_01test0000000000000000001') => db.rows.get(sub) || null;
const reset = () => { db.rows.clear(); db.calls.length = 0; };
const ENTITLING = new Set(['active', 'trialing', 'past_due']);

// Logs are part of the contract ("log and do not upsert"), so they are captured.
const logs = [];
for (const k of ['error', 'warn', 'log']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { logs.push([k, a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')]); if (process.env.KF_VERBOSE) orig(...a); };
}

let failures = 0;
const results = [];
function check(name, ok, got) {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n       got: ${got}`}`);
  if (!ok) failures++;
}

// ── 1. Pro only for the Pro price, quantity 1, one item ────────────────────
reset();
let r = await deliver(subscriptionEvent());
check('1a the Pro price, quantity 1, active: an entitling row is written', r.status === 200 && row()?.status === 'active' && row()?.user_id === 'user-a', JSON.stringify({ status: r.status, row: row() }));

for (const [label, items] of [
  ['1b another price', [{ price: OTHER, quantity: 1 }]],
  ['1c the Pro price, quantity 2', [{ price: PRO, quantity: 2 }]],
  ['1d the Pro price plus a second item', [{ price: PRO, quantity: 1 }, { price: OTHER, quantity: 1 }]],
  ['1e no items', []],
  ['1f an item without a price', [{ price: null, quantity: 1 }]],
]) {
  for (const status of ['active', 'trialing', 'past_due']) {
    reset(); logs.length = 0;
    r = await deliver(subscriptionEvent({ status, items }));
    const written = row();
    check(`${label}, ${status}: no entitling row, acknowledged (200), logged`,
      r.status === 200 && !(written && ENTITLING.has(written.status)) && logs.some(([k, l]) => k === 'error' && /not the Pro price/i.test(l)),
      JSON.stringify({ status: r.status, row: written, logs: logs.map((l) => l[1].slice(0, 120)) }));
  }
}
// The no-custom_data branch (Paddle's own simulations send custom_data: null) obeys the same rule.
reset();
await deliver(subscriptionEvent({ status: 'active' }));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', user: null, items: [{ price: OTHER, quantity: 1 }], endsAt: '2199-01-01T00:00:00.000Z' }));
check('1g no custom_data, another price, active: the existing row is not moved to the new entitling state', r.status === 200 && row()?.current_period_end === '2099-01-01T00:00:00.000Z', JSON.stringify({ status: r.status, row: row() }));
// A canceled event ALWAYS ends Pro, whatever its items.
for (const items of [[{ price: OTHER, quantity: 1 }], [{ price: PRO, quantity: 3 }], []]) {
  reset();
  await deliver(subscriptionEvent({ status: 'active' }));
  r = await deliver(subscriptionEvent({ type: 'subscription.canceled', status: 'canceled', items, endsAt: null }));
  check(`1h canceled with items ${JSON.stringify(items.map((i) => `${i.price === PRO ? 'PRO' : 'OTHER'}x${i.quantity}`))}: the row ends Pro`, r.status === 200 && row()?.status === 'canceled', JSON.stringify({ status: r.status, row: row() }));
}
// No PADDLE_PRO_PRICE_ID configured: nothing can be checked, so nothing entitling is written.
reset(); logs.length = 0;
delete process.env.PADDLE_PRO_PRICE_ID;
r = await deliver(subscriptionEvent());
process.env.PADDLE_PRO_PRICE_ID = PRO;
check('1i PADDLE_PRO_PRICE_ID unset: no entitling row (fail closed), and a 500 so Paddle redelivers once it is set', r.status === 500 && !(row() && ENTITLING.has(row().status)), JSON.stringify({ status: r.status, row: row() }));

// ── 2. Signature: constant-time, raw body, the window ─────────────────────
reset();
const goodEvent = subscriptionEvent();
const goodBody = JSON.stringify(goodEvent);
const now = Math.floor(Date.now() / 1000);
globalThis.__kfTimingSafeEqual = 0;
r = await deliver(goodEvent, { rawBody: goodBody, signature: sign(goodBody, { ts: now, h1: 'ab'.repeat(32) }) });
check('2a a wrong signature of the right length is refused (401)', r.status === 401, r.status);
check('2b ... and was compared with timingSafeEqual', globalThis.__kfTimingSafeEqual > 0, `${globalThis.__kfTimingSafeEqual} call(s)`);
for (const [label, h1] of [['too short', 'ab'.repeat(31)], ['too long', 'ab'.repeat(33)], ['not hex', 'zz'.repeat(32)], ['empty', '']]) {
  r = await deliver(goodEvent, { rawBody: goodBody, signature: `ts=${now};h1=${h1}` });
  check(`2c an h1 ${label} is refused without throwing past the handler (4xx)`, r.status >= 400 && r.status < 500, r.status);
}
r = await deliver(goodEvent, { rawBody: goodBody, signature: sign(goodBody, { secret: 'another-secret' }) });
check('2d a signature made with another secret is refused (401)', r.status === 401, r.status);
r = await deliver(goodEvent, { rawBody: goodBody + ' ', signature: sign(goodBody) });
check('2e the raw body is what is signed: one added space is refused', r.status === 401, r.status);
const spaced = JSON.stringify(goodEvent, null, 2);
r = await deliver(goodEvent, { rawBody: spaced, signature: sign(spaced) });
check('2f a body formatted differently but signed as sent is accepted (raw body, not re-serialised)', r.status === 200, r.status);
r = await deliver(goodEvent, { rawBody: goodBody, signature: sign(goodBody, { ts: now - 60 }) });
check('2g a correct signature 60 s old is refused (the 5 s window kept)', r.status !== 200 && r.status >= 400, r.status);
r = await deliver(goodEvent, { rawBody: goodBody, signature: `ts=${now};h1=${'ab'.repeat(32)};h1=${createHmac('sha256', SECRET).update(`${now}:${goodBody}`).digest('hex')}` });
check('2h two h1 values (Paddle rotating a secret), the second one right: accepted', r.status === 200, r.status);
r = await deliver(goodEvent, { rawBody: goodBody, signature: null });
check('2i no signature header: refused (400)', r.status === 400, r.status);

// ── 3. Ordering ────────────────────────────────────────────────────────────
const T = (s) => new Date(Date.UTC(2026, 10, 13, 2, 0, s)).toISOString();
reset();
await deliver(subscriptionEvent({ type: 'subscription.created', status: 'active', occurredAt: T(0) }));
await deliver(subscriptionEvent({ type: 'subscription.canceled', status: 'canceled', occurredAt: T(20), endsAt: null }));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', occurredAt: T(10) }));
check('3a an older "active" delivered after a newer "canceled" does not bring Pro back', r.status === 200 && row()?.status === 'canceled', JSON.stringify({ status: r.status, row: row() }));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'past_due', occurredAt: T(30) }));
check('3b a newer event still applies', r.status === 200 && row()?.status === 'past_due', JSON.stringify({ status: r.status, row: row() }));
const again = subscriptionEvent({ type: 'subscription.updated', status: 'active', occurredAt: T(40) });
await deliver(again);
const before = JSON.stringify(row());
r = await deliver(again);
check('3c a redelivery of the same event changes nothing', r.status === 200 && JSON.stringify(row()) === before, `${before} -> ${JSON.stringify(row())}`);
reset();
await deliver(subscriptionEvent({ type: 'subscription.canceled', status: 'canceled', occurredAt: T(20), endsAt: null }));
r = await deliver(subscriptionEvent({ type: 'subscription.created', status: 'active', occurredAt: T(0) }));
check('3d "created" arriving after "canceled" (first write for this subscription was the newer one) stays canceled', r.status === 200 && row()?.status === 'canceled', JSON.stringify({ status: r.status, row: row() }));
reset();
await deliver(subscriptionEvent({ status: 'active', occurredAt: T(0) }));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', user: null, occurredAt: T(5), endsAt: '2100-01-01T00:00:00.000Z' }));
check('3e no custom_data, newer: the existing row is updated', r.status === 200 && row()?.current_period_end === '2100-01-01T00:00:00.000Z', JSON.stringify(row()));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'paused', user: null, occurredAt: T(1), endsAt: null }));
check('3f no custom_data, older: the row is not overwritten', r.status === 200 && row()?.status === 'active', JSON.stringify(row()));

reset();
await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', occurredAt: T(10) }));
r = await deliver(subscriptionEvent({ type: 'subscription.canceled', status: 'canceled', occurredAt: T(5), endsAt: null }));
check('3g a cancellation stamped OLDER than an applied "active" still ends Pro', r.status === 200 && row()?.status === 'canceled', JSON.stringify({ status: r.status, row: row() }));
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', occurredAt: T(7) }));
check('3h ... and an "active" older than the last applied one still cannot undo it', r.status === 200 && row()?.status === 'canceled', JSON.stringify({ status: r.status, row: row() }));
// The race: a concurrent delivery creates the row (with an OLDER event) between the
// guarded update and the insert. The newer event must still land (statement 3).
reset();
db.beforeUpsert = () => db.rows.set('sub_01test0000000000000000001', { user_id: 'user-a', paddle_subscription_id: 'sub_01test0000000000000000001', status: 'trialing', current_period_end: '2099-01-01T00:00:00.000Z', paddle_customer_id: 'ctm_01test', updated_at: T(1) });
db.rows.clear();
const raceCalls = db.calls.length;
r = await deliver(subscriptionEvent({ type: 'subscription.updated', status: 'active', occurredAt: T(50) }));
check('3i a row created by a concurrent older delivery mid-write: the newer event still lands', r.status === 200 && row()?.status === 'active' && row()?.updated_at === T(50), JSON.stringify({ status: r.status, row: row() }));
check('3j ... through update, insert-or-nothing, update (three statements)', db.calls.slice(raceCalls).map((c) => c.kind + (c.opts.ignoreDuplicates ? '(ignore)' : '')).join(',') === 'update,upsert(ignore),update', db.calls.slice(raceCalls).map((c) => c.kind).join(','));
// The filter the route sends is PostgREST's own syntax, as this stub reads it.
check('3k the guard is sent as or=(updated_at.is.null,updated_at.lt."<occurred_at>")', db.calls.some((c) => c.kind === 'update' && c.ors.length === 1 && c.ors[0].map((f) => `${f.col}.${f.op}`).join(',') === 'updated_at.is,updated_at.lt'), JSON.stringify(db.calls.filter((c) => c.kind === 'update').map((c) => c.ors)));

// console.log is captured above, so the report goes straight to stdout.
process.stdout.write(`${results.join('\n')}\n\n${failures ? 'FAIL' : 'PASS'}: ${results.length - failures}/${results.length} checks passed\n`);
process.exit(failures ? 1 : 0);
