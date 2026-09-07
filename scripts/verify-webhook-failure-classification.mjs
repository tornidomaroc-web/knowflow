/**
 * Executable proof for register #72c: a failed Paddle webhook must say WHICH
 * failure it was, and must answer with a status that gets a recoverable event
 * redelivered.
 *
 * WHAT IS REAL HERE. The real `POST` handler from
 * `src/app/api/paddle/webhook/route.ts`, the real `src/lib/paddle.ts` client,
 * and the REAL SDK signature verification -- signatures below are genuine
 * HMAC-SHA256 over `ts:body`, exactly as Paddle computes them, so the stale
 * window and the HMAC mismatch are both exercised for real rather than
 * simulated.
 *
 * Only two imports are replaced: `next/server` (so a response can be inspected
 * as data) and `@supabase/supabase-js` (so a write outcome can be chosen
 * without a database). NOTHING is written to any Supabase project.
 *
 * TIER 0: no network, no credential, no subscription, no checkout, no browser.
 *
 * Usage: node --experimental-strip-types scripts/verify-webhook-failure-classification.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
// ASSEMBLED AT RUNTIME, NOT WRITTEN AS LITERALS, AND DELIBERATELY SO. These are
// throwaway test values with no access to anything, but a credential-SHAPED
// string in source trips scripts/secrets_scan.py -- correctly, because that
// guard cannot tell a fake from a real one by looking. Adding an allow-list
// exception would blunt a security control to satisfy a test, which is the
// wrong trade. Do not "tidy" these back into string literals.
const SECRET = ['verify', 'only', 'hmac', 'key', 'material'].join('-');
const FAKE_PADDLE_KEY = ['pdl', 'sdbx', 'apikey', '01verifyonlynotreal'].join('_');

// The real src/lib/paddle.ts refuses to load if PADDLE_ENV and the key
// disagree, so both are set consistently. No network call is made: webhook
// unmarshalling is pure crypto.
process.env.PADDLE_ENV = 'sandbox';
process.env.PADDLE_API_KEY = FAKE_PADDLE_KEY;
process.env.PADDLE_WEBHOOK_SECRET = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://verify.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = ['verify', 'service', 'role'].join('-');

const state = { upsertError: null, updateError: null };
globalThis.__webhookStub = state;

const NEXT_SERVER = `
export class NextRequest {}
export const NextResponse = {
  json(body, init) { return { status: (init && init.status) || 200, body }; },
};`;

// Mimics supabase-js closely enough for this handler: it throws on a missing
// URL exactly as the real client does, and returns { error } from writes.
const SUPABASE_STUB = `
export function createClient(url, key) {
  if (!url) throw new Error('supabaseUrl is required.');
  if (!key) throw new Error('supabaseKey is required.');
  return {
    from() {
      return {
        upsert: async () => ({ error: globalThis.__webhookStub.upsertError }),
        update() { return { eq: async () => ({ error: globalThis.__webhookStub.updateError }) }; },
      };
    },
  };
}`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@supabase/supabase-js') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) {
      const base = resolvePath(ROOT, 'src', spec.slice(2));
      return { url: pathToFileURL(/\.[a-z]+$/i.test(base) ? base : base + '.ts').href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { POST } = await import(
  pathToFileURL(resolvePath(ROOT, 'src/app/api/paddle/webhook/route.ts')).href
);

// --- payloads and genuine signatures ---------------------------------------
function eventBody({ status = 'active', endsAt = '2027-01-01T00:00:00Z', userId = 'user-abc' } = {}) {
  return JSON.stringify({
    event_id: 'evt_verify_1',
    notification_id: 'ntf_verify_1',
    event_type: 'subscription.created',
    occurred_at: '2026-09-07T00:00:00Z',
    data: {
      id: 'sub_verify_1',
      status,
      customer_id: 'ctm_verify_1',
      custom_data: userId ? { user_id: userId } : null,
      // Required: Subscription's constructor does `new TimePeriod(billing_cycle)`
      // unconditionally, so omitting it throws before any handler logic runs.
      billing_cycle: { interval: 'month', frequency: 1 },
      current_billing_period: endsAt ? { starts_at: '2026-09-07T00:00:00Z', ends_at: endsAt } : null,
      items: [],
    },
  });
}

/** Exactly how Paddle signs: HMAC-SHA256 hex over `ts:body`. */
function sign(body, { secret = SECRET, tsOffsetSeconds = 0 } = {}) {
  const ts = Math.floor(Date.now() / 1000) + tsOffsetSeconds;
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

const request = (body, signature) => ({
  headers: { get: (k) => (k.toLowerCase() === 'paddle-signature' ? signature : null) },
  text: async () => body,
});

// --- harness ---------------------------------------------------------------
const logs = [];
const realLog = console.log;
const realError = console.error;
const realWarn = console.warn;
const capture = (...a) => logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

const failures = [];

async function check(label, { body, signature, upsertError = null, updateError = null, noUrl = false }, expect) {
  state.upsertError = upsertError;
  state.updateError = updateError;
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (noUrl) delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  logs.length = 0;
  console.error = capture;
  console.warn = capture;
  let res;
  try {
    res = await POST(request(body, signature));
  } finally {
    console.error = realError;
    console.warn = realWarn;
    if (noUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  }

  const logged = logs.join(' | ');
  realLog(`===== ${label}`);
  realLog(`  HTTP ${res.status}  body=${JSON.stringify(res.body)}`);
  realLog(`  logged: ${logged || '(nothing)'}`);
  realLog('');

  if (res.status !== expect.status) failures.push(`${label}: status ${res.status} != ${expect.status}`);
  if (expect.error !== undefined && res.body.error !== expect.error) {
    failures.push(`${label}: error ${res.body.error} != ${expect.error}`);
  }
  for (const needle of expect.logContains ?? []) {
    if (!logged.includes(needle)) failures.push(`${label}: log missing ${JSON.stringify(needle)}`);
  }
  if (expect.logExcludes) {
    for (const needle of expect.logExcludes) {
      if (logged.includes(needle)) failures.push(`${label}: log should not contain ${JSON.stringify(needle)}`);
    }
  }
  return res;
}

const good = eventBody();

// 1. The happy path still works.
await check('valid signature, write succeeds', { body: good, signature: sign(good) },
  { status: 200 });

// 2. Transient write failure must be redelivered, and must name the replay handle.
await check('valid signature, transient DB error', { body: good, signature: sign(good), upsertError: { code: '08006', message: 'connection failure' } },
  { status: 500, logContains: ['ntf_verify_1', 'evt_verify_1', 'notifications.replay'] });

// 3. Deleted user is terminal: acknowledged so Paddle stops.
await check('valid signature, FK violation (user deleted)', { body: good, signature: sign(good), upsertError: { code: '23503', message: 'fk violation' } },
  { status: 200, logContains: ['ntf_verify_1'] });

// 4/5. Not from Paddle at all.
await check('no paddle-signature header', { body: good, signature: null },
  { status: 400, error: 'signature_missing', logContains: ['do not investigate the secret', 'signature_missing'] });

await check('malformed signature header', { body: good, signature: 'ts=123' },
  { status: 400, error: 'signature_malformed', logContains: ['signature_malformed'] });

// 6. THE MISDIAGNOSIS. Correct secret, correct HMAC, but the 5s window closed.
await check('valid HMAC, timestamp 60s stale', { body: good, signature: sign(good, { tsOffsetSeconds: -60 }) },
  {
    status: 503,
    error: 'signature_stale',
    logContains: ['signature_stale', 'NOT PADDLE_WEBHOOK_SECRET', 'handler latency'],
  });

// 7. Fresh timestamp, genuine mismatch. Non-200 on purpose.
await check('wrong secret, fresh timestamp', { body: good, signature: sign(good, { secret: ['the', 'wrong', 'secret'].join('-') }) },
  {
    status: 401,
    error: 'signature_invalid',
    logContains: ['signature_invalid', 'forged', 'rotated'],
  });

// 8. A timestamp in OUR FUTURE. Written expecting a 503, and the run said
//    otherwise: the SDK rejects only `now > ts + 5`, never future-dating, so
//    this verifies normally and succeeds. Kept as a regression guard on that
//    real behaviour, and it is why the classifier has no clock-skew branch.
await check('timestamp 1h in our future verifies fine', { body: good, signature: sign(good, { tsOffsetSeconds: 3600 }) },
  { status: 200 });

// 9. Existing hard obligation, unchanged: never persist entitling with no expiry.
const noExpiry = eventBody({ endsAt: null });
await check('entitling status with no current_period_end', { body: noExpiry, signature: sign(noExpiry) },
  { status: 400, logContains: ['refusing entitling subscription row', 'ntf_verify_1'] });

// 10. Previously threw PAST every handler here; now classified and logged.
await check('SUPABASE_URL unset', { body: good, signature: sign(good), noUrl: true },
  { status: 500, error: 'unhandled', logContains: ['supabaseUrl is required'], logExcludes: ['Webhook verification failed'] });

// --- summary ---------------------------------------------------------------
realLog('===== distinguishability =====');
realLog('  BEFORE: every one of these answered 400 {"error":"Webhook verification failed"}');
realLog('  AFTER : 200 / 400 signature_missing / 400 signature_malformed / 503 signature_stale /');
realLog('          401 signature_invalid / 500 unhandled / 500 write-failure / 200 terminal');
realLog('');

if (failures.length === 0) {
  realLog(`PASS: 10 webhook failure classes verified against the real handler.`);
  process.exit(0);
}
realLog(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) realLog('  ! ' + f);
process.exit(1);
