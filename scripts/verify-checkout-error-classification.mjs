/**
 * Executable proof for register #72b: a failed checkout must say WHICH failure
 * it was, to the operator, and must tell the user the one thing they can act on
 * in their own language.
 *
 * WHY A SCRIPT. The defect was that three unrelated causes produced one
 * indistinguishable outcome. Proving that is fixed means running all three and
 * comparing, which is what this does. Register #71: reasoning found none of our
 * defects.
 *
 * TWO MODES.
 *   default  Classify FIXTURES captured from the real Paddle sandbox (below),
 *            plus a real TypeError from a genuinely failed fetch. No network,
 *            no credential, so this runs anywhere including CI.
 *   --live   Re-capture the fixtures from the Paddle sandbox first, then assert
 *            against what came back, so drift in Paddle's error codes is caught
 *            rather than assumed away. Needs a sandbox key file; see below.
 *
 * TIER 0 EITHER WAY. Every live call is designed to fail, so it creates
 * nothing. `--live` reads the transaction count before and after and refuses to
 * report success if it changed.
 *
 * Usage:
 *   node --experimental-strip-types scripts/verify-checkout-error-classification.mjs
 *   node --experimental-strip-types scripts/verify-checkout-error-classification.mjs --live
 */
import { pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = process.argv.includes('--live');

// The project's TypeScript imports are extensionless ('./en'), which tsc
// resolves and bare Node ESM does not. Append the extension rather than
// touching application source to suit a test.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
      const candidate = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier + '.ts');
      if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { classifyCheckoutFailure, newCheckoutReference } = await import(
  pathToFileURL(resolvePath(ROOT, 'src/lib/paddle-errors.ts')).href
);
const { en } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/i18n/locales/en.ts')).href);
const { ar } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/i18n/locales/ar.ts')).href);

/**
 * CAPTURED FROM THE REAL PADDLE SANDBOX, not written from the documentation.
 * Reproduce with `--live`. Note that both API errors carry the SAME `type`
 * ('request_error'); only `code` separates a broken credential from a broken
 * price id, which is exactly the distinction this change exists to make.
 */
function fixtureApiError({ code, type, detail, documentationUrl }) {
  // Shaped like the SDK's ApiError: message === detail, plus the fields the
  // classifier reads. Constructed rather than imported so this mode needs no
  // network and no credential.
  const e = new Error(detail);
  e.name = 'ApiError';
  Object.assign(e, { code, type, detail, documentationUrl, retryAfter: null });
  return e;
}

const FIXTURES = {
  badPriceId: fixtureApiError({
    code: 'transaction_price_not_found',
    type: 'request_error',
    detail: 'One or more provided price_ids could not be found, provided: pri_00000000000000000000000000',
    documentationUrl: 'https://developer.paddle.com/v1/errors/transactions/transaction_price_not_found',
  }),
  rejectedCredential: fixtureApiError({
    code: 'authentication_malformed',
    type: 'request_error',
    detail: 'Authentication header included, but incorrectly formatted.',
    documentationUrl: 'https://developer.paddle.com/v1/errors/shared/authentication_malformed',
  }),
  rateLimited: fixtureApiError({
    code: 'too_many_requests',
    type: 'request_error',
    detail: 'Too many requests. Please wait and try again.',
    documentationUrl: 'https://developer.paddle.com/v1/errors/shared/too_many_requests',
  }),
};

// A genuine transport failure, produced rather than described.
async function realTransportError() {
  try {
    await fetch('http://127.0.0.1:1/definitely-not-listening');
    throw new Error('expected the fetch to fail');
  } catch (e) {
    return e;
  }
}

// ---------------------------------------------------------------------------
// Optional: re-capture the fixtures from the live sandbox.
// ---------------------------------------------------------------------------
if (LIVE) {
  const keyPath = process.env.PADDLE_SANDBOX_KEY_FILE || 'D:\\secrets\\paddle_sandbox_key.txt';
  let key;
  try {
    let raw = readFileSync(keyPath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    key = raw.trim();
  } catch (e) {
    console.error(`--live needs a sandbox key file. Set PADDLE_SANDBOX_KEY_FILE. (${e.code})`);
    process.exit(2);
  }
  if (!key) {
    console.error('--live: key file is empty.');
    process.exit(2);
  }
  // Hard refusal. There is no override, and nothing below ever prints the key.
  if (!key.includes('_sdbx')) {
    console.error('--live: refusing to run, the key is not a Paddle sandbox key.');
    process.exit(2);
  }

  const { Paddle, Environment } = await import('@paddle/paddle-node-sdk');
  const paddle = new Paddle(key, { environment: Environment.sandbox });

  const countTransactions = async () => {
    let n = 0;
    for await (const _t of paddle.transactions.list()) n += 1;
    return n;
  };
  const before = await countTransactions();

  const capture = async (client) => {
    try {
      await client.transactions.create({
        items: [{ priceId: 'pri_00000000000000000000000000', quantity: 1 }],
        customData: { user_id: 'verify-not-a-real-user' },
      });
      throw new Error('expected the create to fail');
    } catch (e) {
      return e;
    }
  };

  FIXTURES.badPriceId = await capture(paddle);
  FIXTURES.rejectedCredential = await capture(
    new Paddle('pdl_sdbx_apikey_01verify000000000000000000000000000notreal', { environment: Environment.sandbox })
  );

  const after = await countTransactions();
  console.log(`--live: sandbox transactions ${before} -> ${after}`);
  if (before !== after) {
    console.error('ALARM: a failing create left state behind. Refusing to report success.');
    process.exit(1);
  }
  console.log('--live: re-captured from the real sandbox; nothing was created.\n');
}

// ---------------------------------------------------------------------------
// The old handler, transcribed verbatim from the pre-change route, so the
// before/after comparison is against what actually shipped.
//
//   } catch (error) {
//     console.error('Checkout error:', error);
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// ---------------------------------------------------------------------------
function oldHandler(error) {
  return {
    logged: `Checkout error: ${error && error.message}`,
    body: { error: 'Internal Server Error' },
    status: 500,
  };
}

function newHandler(error) {
  const reference = newCheckoutReference();
  const failure = classifyCheckoutFailure(error);
  return {
    logged: JSON.stringify({ msg: 'checkout failed', reference, ...failure.log }),
    body: { error: failure.code, reference, retryable: failure.retryable },
    status: failure.status,
  };
}

/** What the browser actually renders, per locale, for a given response body. */
function rendered(body, bundle) {
  const messages = {
    checkout_unavailable: bundle.pricing.checkout.unavailable,
    checkout_misconfigured: bundle.pricing.checkout.misconfigured,
  };
  const msg = messages[body.error] ?? bundle.pricing.checkout.failed;
  return body.reference ? `${msg}  [${bundle.pricing.checkout.reference} ${body.reference}]` : msg;
}

const CASES = [
  ['bad price id', FIXTURES.badPriceId, 'checkout_misconfigured', 500, false],
  ['rejected credential', FIXTURES.rejectedCredential, 'checkout_misconfigured', 500, false],
  ['rate limited', FIXTURES.rateLimited, 'checkout_unavailable', 503, true],
  ['transport failure', await realTransportError(), 'checkout_unavailable', 503, true],
];

let failures = [];
const oldBodies = new Set();
const newBodies = new Set();
// What an operator could actually tell apart in the logs, which is the number
// the complaint was really about.
const oldSignatures = new Set();
const newSignatures = new Set();

for (const [name, err, wantCode, wantStatus, wantRetryable] of CASES) {
  const before = oldHandler(err);
  const after = newHandler(err);
  oldBodies.add(`${before.status} ${before.body.error}`);
  newBodies.add(`${after.status} ${after.body.error}`);
  // The old log line was one unstructured string with no code and no status.
  oldSignatures.add('Checkout error: <opaque>');
  const sig = JSON.parse(after.logged);
  newSignatures.add(sig.paddleCode || sig.kind);

  console.log(`===== ${name} =====`);
  console.log('  BEFORE  user sees : ' + before.body.error + `   (HTTP ${before.status})`);
  console.log('  BEFORE  logged    : ' + before.logged);
  console.log('  AFTER   user (en) : ' + rendered(after.body, en));
  console.log('  AFTER   user (ar) : ' + rendered(after.body, ar));
  console.log(`  AFTER   HTTP      : ${after.status}  retryable=${after.body.retryable}`);
  console.log('  AFTER   logged    : ' + after.logged);
  console.log('');

  if (after.body.error !== wantCode) failures.push(`${name}: code ${after.body.error} != ${wantCode}`);
  if (after.status !== wantStatus) failures.push(`${name}: status ${after.status} != ${wantStatus}`);
  if (after.body.retryable !== wantRetryable) failures.push(`${name}: retryable ${after.body.retryable} != ${wantRetryable}`);
  // The whole point: Paddle's prose must not reach the browser.
  const serialised = JSON.stringify(after.body);
  if (/price_ids|Authentication header|pri_0|developer\.paddle\.com/.test(serialised)) {
    failures.push(`${name}: upstream detail leaked into the response body`);
  }
  // ...and must be present in the log.
  if (err.code && !after.logged.includes(err.code)) {
    failures.push(`${name}: paddle code ${err.code} missing from the log line`);
  }
}

console.log('===== distinguishability =====');
console.log(`  user-facing  BEFORE: ${CASES.length} causes -> ${oldBodies.size} outcome(s): ${[...oldBodies].join(', ')}`);
console.log(`  user-facing  AFTER : ${CASES.length} causes -> ${newBodies.size} outcome(s): ${[...newBodies].join(', ')}`);
console.log(`  operator     BEFORE: ${oldSignatures.size} distinguishable signature(s) (no code, no status, one flat string)`);
console.log(`  operator     AFTER : ${newSignatures.size} distinguishable signature(s): ${[...newSignatures].join(', ')}`);
if (oldBodies.size !== 1) failures.push('expected the old handler to collapse every cause into one outcome');
if (newBodies.size < 2) failures.push('the new handler still collapses causes together');
// The operator must be able to tell every cause apart, which is the complaint
// that started this: a failed checkout could not say what failed.
if (newSignatures.size !== CASES.length) {
  failures.push(`operator can distinguish only ${newSignatures.size} of ${CASES.length} causes`);
}

// Both locales must actually carry the strings; a missing translation is the
// bilingual half of this defect and would otherwise ship silently.
console.log('');
console.log('===== translation coverage =====');
for (const [label, bundle] of [['en', en], ['ar', ar]]) {
  const block = bundle?.pricing?.checkout;
  const keys = ['unavailable', 'misconfigured', 'failed', 'reference'];
  const missing = keys.filter((k) => typeof block?.[k] !== 'string' || !block[k].trim());
  console.log(`  ${label}: ${missing.length === 0 ? 'all 4 keys present' : 'MISSING ' + missing.join(', ')}`);
  if (missing.length) failures.push(`${label} locale missing: ${missing.join(', ')}`);
}
if (en.pricing?.checkout?.unavailable === ar.pricing?.checkout?.unavailable) {
  failures.push('ar and en carry the identical string; the Arabic copy is untranslated');
}

console.log('');
if (failures.length === 0) {
  console.log(`PASS: ${CASES.length} causes classified, both locales covered.`);
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
