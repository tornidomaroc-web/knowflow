/**
 * Executable proof for register #72b, at the ROUTE level.
 *
 * `verify-checkout-error-classification.mjs` proves the classifier. This proves
 * the handler that uses it: it imports the REAL `POST` from
 * `src/app/api/paddle/checkout/route.ts` and drives every branch, including the
 * three that no other check reaches -- signed out, PADDLE_PRO_PRICE_ID unset,
 * and the happy path.
 *
 * WHAT IS STUBBED, AND WHY THAT IS HONEST. Three imports are replaced: Next's
 * `NextResponse` (so a response can be inspected as data), the Supabase server
 * client (so a session can be present or absent without a database), and the
 * Paddle client (so a chosen error can be thrown without a network call). The
 * handler's own logic -- the auth check, the price-id guard, the classification
 * and the shape of what it returns and logs -- is the real thing, unmodified.
 *
 * Tier 0: no network, no credential, no checkout, no browser.
 *
 * Usage: node --experimental-strip-types scripts/verify-checkout-route.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

const state = { throw: null, user: { id: 'user-123' } };
globalThis.__checkoutRouteStub = state;

const NEXT_SERVER = `
export const NextResponse = {
  json(body, init) { return { status: (init && init.status) || 200, body }; },
};`;
const SUPABASE_STUB = `
export async function createClient() {
  return { auth: { getUser: async () => ({ data: { user: globalThis.__checkoutRouteStub.user } }) } };
}`;
const PADDLE_STUB = `
export const paddleClient = {
  transactions: {
    create: async () => {
      const e = globalThis.__checkoutRouteStub.throw;
      if (e) throw e;
      return { id: 'txn_stubbed_success' };
    },
  },
};`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@/lib/supabase/server') return { url: inline(SUPABASE_STUB), shortCircuit: true };
    if (spec === '@/lib/paddle') return { url: inline(PADDLE_STUB), shortCircuit: true };
    if (spec.startsWith('@/')) {
      const base = resolvePath(ROOT, 'src', spec.slice(2));
      return { url: pathToFileURL(/\.[a-z]+$/i.test(base) ? base : base + '.ts').href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { POST } = await import(
  pathToFileURL(resolvePath(ROOT, 'src/app/api/paddle/checkout/route.ts')).href
);

/** Shaped like the SDK's ApiError. Real shapes are captured in the sibling script. */
function apiError(code, detail) {
  const e = new Error(detail);
  e.name = 'ApiError';
  Object.assign(e, {
    code,
    type: 'request_error',
    detail,
    documentationUrl: `https://developer.paddle.com/v1/errors/${code}`,
    retryAfter: null,
  });
  return e;
}

const logs = [];
const realError = console.error;
console.error = (...a) => logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

const failures = [];

async function check(label, opts, expect) {
  const { user = { id: 'user-123' }, err = null, unsetPrice = false } = opts;
  state.user = user;
  state.throw = err;
  // NB: an explicit flag, not `priceId: undefined` -- that would trigger a
  // destructuring default and silently test the configured case instead. Found
  // by running this harness, which is the point of having it.
  if (unsetPrice) delete process.env.PADDLE_PRO_PRICE_ID;
  else process.env.PADDLE_PRO_PRICE_ID = 'pri_real_configured';

  logs.length = 0;
  const res = await POST();
  const logged = logs.join(' | ');

  realError(`===== ${label}`);
  realError(`  HTTP ${res.status}  body=${JSON.stringify(res.body)}`);
  realError(`  logged: ${logged || '(nothing)'}`);
  realError('');

  if (res.status !== expect.status) failures.push(`${label}: status ${res.status} != ${expect.status}`);
  if (res.body.error !== expect.error) failures.push(`${label}: error ${res.body.error} != ${expect.error}`);
  if (expect.logContains && !logged.includes(expect.logContains)) {
    failures.push(`${label}: log missing ${expect.logContains}`);
  }
  if (expect.noLog && logged) failures.push(`${label}: expected no log, got one`);
  // Paddle prose must never reach the browser.
  if (/price_ids|Authentication header|developer\.paddle\.com/.test(JSON.stringify(res.body))) {
    failures.push(`${label}: upstream detail leaked into the response body`);
  }
  // Every failure response must carry a reference the user can quote.
  if (res.status >= 500 && typeof res.body.reference !== 'string') {
    failures.push(`${label}: failure response carries no reference`);
  }
}

await check('signed out', { user: null }, { status: 401, error: 'unauthorized', noLog: true });
await check('PADDLE_PRO_PRICE_ID unset', { unsetPrice: true }, { status: 500, error: 'checkout_misconfigured', logContains: 'PADDLE_PRO_PRICE_ID is not set' });
await check('happy path', {}, { status: 200, error: undefined, noLog: true });
await check('bad price id', { err: apiError('transaction_price_not_found', 'One or more provided price_ids could not be found, provided: pri_x') }, { status: 500, error: 'checkout_misconfigured', logContains: 'transaction_price_not_found' });
await check('rejected credential', { err: apiError('authentication_malformed', 'Authentication header included, but incorrectly formatted.') }, { status: 500, error: 'checkout_misconfigured', logContains: 'authentication_malformed' });
await check('rate limited', { err: apiError('too_many_requests', 'Too many requests.') }, { status: 503, error: 'checkout_unavailable', logContains: 'too_many_requests' });
await check('transport failure', { err: new TypeError('fetch failed') }, { status: 503, error: 'checkout_unavailable', logContains: 'transport' });

console.error = realError;

if (failures.length === 0) {
  console.log('PASS: 7 route branches verified against the real handler.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
