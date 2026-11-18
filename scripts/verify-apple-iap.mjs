/**
 * Executable proof for iOS 1.1 item 4d, server half, OFFLINE part: the App
 * Store JWS verifier, the purchase rules, the notification-type table, the
 * two-source entitlement merge, and the two routes with the PINNED root.
 * No network, no database, no Docker. The database half (ordering,
 * idempotency, grants, RLS, Paddle and Apple coexisting on real Postgres) is
 * scripts/verify-apple-subscriptions-db.mjs.
 *
 * THE TEST ROOT IS INJECTED, NEVER CONFIGURED. A throwaway chain is made per
 * run (scripts/lib/apple-test-chain.mjs). The library functions accept it
 * because the proof passes it as an argument; the same JWS sent to the real
 * routes, which pass only Apple Root CA - G3, is refused 'chain'. There is no
 * environment variable or header that changes the routes' root.
 *
 * Usage: node --experimental-strip-types scripts/verify-apple-iap.mjs
 * Red on main: the modules under src/lib/apple-iap/ do not exist there.
 */
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { makeAppleTestChain } from './lib/apple-test-chain.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}

// --- stubs: the session, NextResponse, and an admin client that must stay unused --
const USER = '0a1b2c3d-0000-4000-8000-00000000a11e';
const OTHER_USER = '0a1b2c3d-0000-4000-8000-0000000b0b0b';
globalThis.__appleStub = { user: { id: USER }, adminCalls: 0 };
installTsxHooks(ROOT, {
  '@/lib/supabase/server': `export async function createClient() {
    return { auth: { getUser: async () => ({ data: { user: globalThis.__appleStub.user } }) } };
  }`,
  'next/server': `export class NextRequest extends Request {}
  export class NextResponse extends Response {
    static json(body, init = {}) {
      return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
    }
  }`,
  '@supabase/supabase-js': `export function createClient() {
    return new Proxy({}, { get() { globalThis.__appleStub.adminCalls += 1; throw new Error('admin client used'); } });
  }`,
});

const imp = (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
let jws, rules, root, entitlement, verifyRoute, notificationsRoute;
try {
  jws = await imp('src/lib/apple-iap/jws.ts');
  rules = await imp('src/lib/apple-iap/rules.ts');
  root = await imp('src/lib/apple-iap/apple-root.ts');
  entitlement = await imp('src/lib/entitlement.ts');
  verifyRoute = await imp('src/app/api/apple/iap/verify/route.ts');
  notificationsRoute = await imp('src/app/api/apple/notifications/route.ts');
} catch (error) {
  console.log(`FAIL  the Apple IAP modules do not load: ${error.message}`);
  console.log('\n0 passed, 1 failed');
  process.exit(1);
}

const chain = makeAppleTestChain();
const ROOTS = [chain.root];
// Two minutes ahead of the wall clock: the chain was made a moment ago, and a
// signedDate inside its first second would predate the certificates.
const NOW = Date.now() + 120000;
const DAY = 86400000;
const tx = (over = {}) => ({
  transactionId: '2000000000000002',
  originalTransactionId: '2000000000000001',
  webOrderLineItemId: '2000000000000003',
  bundleId: 'com.knowflow.app',
  productId: 'com.knowflow.app.pro.monthly',
  subscriptionGroupIdentifier: '21000001',
  purchaseDate: NOW - 60000,
  originalPurchaseDate: NOW - 60000,
  expiresDate: NOW + 30 * DAY,
  quantity: 1,
  type: 'Auto-Renewable Subscription',
  appAccountToken: USER,
  inAppOwnershipType: 'PURCHASED',
  signedDate: NOW - 1000,
  environment: 'Production',
  transactionReason: 'PURCHASE',
  storefront: 'MAR',
  price: 9990,
  currency: 'USD',
  ...over,
});

const verify = (token, roots = ROOTS, now = NOW) => {
  try {
    return { payload: jws.verifyAppleSignedData(token, roots, { now }), code: null };
  } catch (error) {
    return { payload: null, code: error.code ?? `threw ${error.message}` };
  }
};

// --- 1. the verifier ------------------------------------------------------------------
console.log('1. the JWS verifier (src/lib/apple-iap/jws.ts):');
const good = chain.sign(tx());
let r = verify(good);
check('a test-chain JWS verifies when the TEST root is injected, and returns its payload', r.payload?.transactionId === '2000000000000002', r.code ?? '');
r = verify(good, root.appleRootCertificates());
check('the same JWS against the pinned Apple Root CA - G3 is refused: chain', r.code === 'chain', `code ${r.code}`);
const pinned = root.appleRootCertificates();
check('the production trust set is exactly one certificate, Apple Root CA - G3, by its published SHA-256',
  pinned.length === 1 && pinned[0].fingerprint256 === root.APPLE_ROOT_CA_G3_SHA256 && /CN=Apple Root CA - G3/.test(pinned[0].subject) &&
  root.APPLE_ROOT_CA_G3_SHA256 === '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79',
  `${pinned.length} cert(s), ${pinned[0]?.fingerprint256}`);
r = verify(chain.sign(tx(), { key: 'stranger' }));
check('forged: the good chain in the header, signed with a stranger key: signature', r.code === 'signature', `code ${r.code}`);
{
  const other = chain.sign(tx({ appAccountToken: OTHER_USER }));
  const [h, , s] = good.split('.');
  r = verify(`${h}.${other.split('.')[1]}.${s}`);
  check('tampered: another payload under the good header and signature: signature', r.code === 'signature', `code ${r.code}`);
}
r = verify(chain.sign(tx(), { header: { alg: 'none' } }));
check('alg none: algorithm', r.code === 'algorithm', `code ${r.code}`);
r = verify(chain.sign(tx(), { header: { alg: 'HS256' } }));
check('alg HS256: algorithm', r.code === 'algorithm', `code ${r.code}`);
{
  const [, b, s] = good.split('.');
  const two = Buffer.from(JSON.stringify({ alg: 'ES256', x5c: [chain.der64('leaf'), chain.der64('inter')] })).toString('base64url');
  r = verify(`${two}.${b}.${s}`);
  check('x5c with two certificates: chain', r.code === 'chain', `code ${r.code}`);
}
r = verify(chain.sign(tx(), { chain: ['otherLeaf', 'otherInter', 'otherRoot'] }));
check('a self-consistent chain to a root that is not injected: chain', r.code === 'chain', `code ${r.code}`);
r = verify(chain.sign(tx(), { chain: ['leaf', 'inter', 'otherRoot'] }));
check("x5c's third certificate is never trusted: a stranger root there changes nothing (accepted via the injected root)", r.payload !== null, r.code ?? '');
r = verify(chain.sign(tx(), { chain: ['otherLeaf', 'otherInter', 'root'] }));
check("the injected root's bytes as x5c[2] do not make a stranger's intermediate trusted: chain", r.code === 'chain', `code ${r.code}`);
r = verify(chain.sign(tx(), { chain: ['leafNoMarker', 'inter', 'root'] }));
check('a leaf without the App Store marker OID 1.2.840.113635.100.6.11.1: marker', r.code === 'marker', `code ${r.code}`);
r = verify(chain.sign(tx(), { chain: ['leafUnderNoMarker', 'interNoMarker', 'root'] }));
check('an intermediate without the WWDR marker OID 1.2.840.113635.100.6.2.1: marker', r.code === 'marker', `code ${r.code}`);
r = verify(chain.sign(tx(), { chain: ['inter', 'root', 'root'], key: 'inter' }));
check('the intermediate posing as the leaf (a CA signing for itself): chain', r.code === 'chain', `code ${r.code}`);
r = verify(chain.sign(tx({ signedDate: Date.UTC(2015, 0, 1) })));
check('signedDate before the chain was valid: expired-certificate', r.code === 'expired-certificate', `code ${r.code}`);
r = verify(chain.sign(tx({ signedDate: NOW + 3600000 })));
check('signedDate an hour in the future: signed-date', r.code === 'signed-date', `code ${r.code}`);
r = verify(chain.sign(tx({ signedDate: undefined })));
check('no signedDate: signed-date', r.code === 'signed-date', `code ${r.code}`);
for (const [label, value] of [['a number', 42], ['two parts', 'a.b'], ['an empty string', ''], ['65 KiB', 'a'.repeat(65 * 1024) + '.b.c'], ['a non-base64url part', 'a.b!.c']]) {
  r = verify(value);
  check(`${label}: malformed`, r.code === 'malformed', `code ${r.code}`);
}

// --- 2. the rules ---------------------------------------------------------------------
console.log('');
console.log('2. the purchase rules (src/lib/apple-iap/rules.ts):');
const t = (over) => rules.readTransaction(tx(over));
check('the proposed product id is com.knowflow.app.pro.monthly, the bundle com.knowflow.app, the app 6820418649',
  rules.APPLE_PRO_PRODUCT_ID === 'com.knowflow.app.pro.monthly' && rules.APPLE_BUNDLE_ID === 'com.knowflow.app' && rules.APPLE_APP_APPLE_ID === 6820418649);
check('the Pro transaction has no problem', rules.proTransactionProblem(t()) === null);
check('another bundle is refused', /bundle/.test(rules.proTransactionProblem(t({ bundleId: 'com.other.app' })) ?? ''));
check('another product is refused', /product/.test(rules.proTransactionProblem(t({ productId: 'com.knowflow.app.pro.yearly' })) ?? ''));
check('a non-renewing type is refused', /type/.test(rules.proTransactionProblem(t({ type: 'Non-Renewing Subscription' })) ?? ''));
check('FAMILY_SHARED is refused', /ownership/.test(rules.proTransactionProblem(t({ inAppOwnershipType: 'FAMILY_SHARED' })) ?? ''));
const allow = rules.parseSandboxUserIds(` ${USER.toUpperCase()} , not-a-uuid,,`);
check('the Sandbox allowlist keeps valid ids, lowercased, and drops the rest', allow.size === 1 && allow.has(USER));
check('Production is allowed for any account', rules.environmentAllowed('Production', OTHER_USER, allow));
check('Sandbox is refused for an account not on the list', !rules.environmentAllowed('Sandbox', OTHER_USER, allow));
check('Sandbox is allowed for a listed account', rules.environmentAllowed('Sandbox', USER, allow));
check('Sandbox is refused for everyone when the variable is unset', !rules.environmentAllowed('Sandbox', USER, rules.parseSandboxUserIds(undefined)));
check('Xcode and LocalTesting are refused even for a listed account',
  !rules.environmentAllowed('Xcode', USER, allow) && !rules.environmentAllowed('LocalTesting', USER, allow));
check('appAccountToken is read lowercased', t({ appAccountToken: USER.toUpperCase() }).appAccountToken === USER);

console.log('');
console.log('3. every notification type (statusFromNotification):');
const plain = t();
const revoked = t({ revocationDate: NOW - 1000, revocationReason: 0 });
const cases = [
  ['SUBSCRIBED', 'INITIAL_BUY', undefined, plain, 'active'],
  ['SUBSCRIBED', 'RESUBSCRIBE', undefined, plain, 'active'],
  ['DID_RENEW', null, undefined, plain, 'active'],
  ['DID_RENEW', 'BILLING_RECOVERY', undefined, plain, 'active'],
  ['OFFER_REDEEMED', 'UPGRADE', undefined, plain, 'active'],
  ['RENEWAL_EXTENDED', null, undefined, plain, 'active'],
  ['REFUND_REVERSED', null, undefined, plain, 'active'],
  ['DID_FAIL_TO_RENEW', 'GRACE_PERIOD', undefined, plain, 'grace_period'],
  ['DID_FAIL_TO_RENEW', null, undefined, plain, 'billing_retry'],
  ['GRACE_PERIOD_EXPIRED', null, undefined, plain, 'billing_retry'],
  ['EXPIRED', 'VOLUNTARY', undefined, plain, 'expired'],
  ['EXPIRED', 'BILLING_RETRY', undefined, plain, 'expired'],
  ['REFUND', null, undefined, revoked, 'refunded'],
  ['REFUND', null, undefined, plain, 'refunded'],
  ['REVOKE', null, undefined, revoked, 'revoked'],
  ['DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', undefined, plain, null],
  ['DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', 1, plain, 'active'],
  ['DID_CHANGE_RENEWAL_PREF', null, undefined, plain, null],
  ['PRICE_INCREASE', 'PENDING', undefined, plain, null],
  ['RENEWAL_EXTENSION', 'SUMMARY', undefined, plain, null],
  ['REFUND_DECLINED', null, undefined, plain, null],
  ['DID_RENEW', null, 4, plain, 'grace_period'],
  ['SUBSCRIBED', 'INITIAL_BUY', 3, plain, 'billing_retry'],
  ['DID_RENEW', null, 1, revoked, 'revoked'],
  ['CONSUMPTION_REQUEST', null, 1, plain, null],
  ['ONE_TIME_CHARGE', null, 1, plain, null],
  ['METADATA_UPDATE', null, 1, plain, null],
  ['MIGRATION', null, 1, plain, null],
  ['PRICE_CHANGE', null, 1, plain, null],
  ['RESCIND_CONSENT', null, 1, plain, null],
  ['EXTERNAL_PURCHASE_TOKEN', 'UNREPORTED', 1, plain, null],
  ['TEST', null, 1, plain, null],
  ['A_TYPE_APPLE_ADDS_LATER', null, 1, plain, null],
];
for (const [type, subtype, status, txn, want] of cases) {
  const got = rules.statusFromNotification(type, subtype, status, txn);
  check(`${type}${subtype ? `/${subtype}` : ''}${status !== undefined ? ` data.status=${status}` : ''}${txn.revocationDate ? ' (revoked tx)' : ''} → ${want ?? 'nothing written'}`,
    got === want, `got ${got}`);
}
const grace = NOW + 16 * DAY;
check('grace_period ends at gracePeriodExpiresDate', rules.periodEndFor('grace_period', plain, { gracePeriodExpiresDate: grace }) === grace);
check('grace_period without the date falls back to expiresDate', rules.periodEndFor('grace_period', plain, { gracePeriodExpiresDate: null }) === plain.expiresDate);
check('active ends at expiresDate', rules.periodEndFor('active', plain, { gracePeriodExpiresDate: grace }) === plain.expiresDate);
check('a transaction the app sends: active before expiry, expired after, revoked when revoked',
  rules.statusFromTransaction(plain, NOW) === 'active' && rules.statusFromTransaction(plain, plain.expiresDate + 1) === 'expired' &&
  rules.statusFromTransaction(revoked, NOW) === 'revoked');

// --- 4. the two-source merge ------------------------------------------------------------
console.log('');
console.log('4. Pro from either source (entitlementFromRows over both tables):');
const iso = (ms) => new Date(ms).toISOString();
const merge = (paddleRows, appleRows) => entitlement.entitlementFromRows([...paddleRows, ...entitlement.appleRowsAsEntitlementRows(appleRows)]);
const F = iso(NOW + 10 * DAY), G = iso(NOW + 20 * DAY), P = iso(NOW - DAY);
const mcases = [
  ['Apple active, future; no Paddle', [], [{ status: 'active', expires_at: F }], 'pro', F],
  ['Apple grace_period, future', [], [{ status: 'grace_period', expires_at: F }], 'pro', F],
  ['Apple billing_retry, future end', [], [{ status: 'billing_retry', expires_at: F }], 'free', null],
  ['Apple active but its end has passed', [], [{ status: 'active', expires_at: P }], 'free', null],
  ['Apple refunded / revoked / expired', [], [{ status: 'refunded', expires_at: F }, { status: 'revoked', expires_at: F }, { status: 'expired', expires_at: F }], 'free', null],
  ['Paddle active (G) and Apple expired: Paddle stands', [{ status: 'active', current_period_end: G }], [{ status: 'expired', expires_at: F }], 'pro', G],
  ['Paddle canceled and Apple active (F): Apple stands', [{ status: 'canceled', current_period_end: G }], [{ status: 'active', expires_at: F }], 'pro', F],
  ['both live: the later end wins across sources', [{ status: 'active', current_period_end: F }], [{ status: 'active', expires_at: G }], 'pro', G],
  ['both dead', [{ status: 'canceled', current_period_end: G }], [{ status: 'expired', expires_at: F }], 'free', null],
  ['Paddle only (no Apple rows): exactly the old answer', [{ status: 'past_due', current_period_end: F }], [], 'pro', F],
];
for (const [name, p, a, tier, exp] of mcases) {
  const got = merge(p, a);
  check(`${name} → ${tier}${exp ? ' until that end' : ''}`, got.tier === tier && got.expiresAt === exp, `got ${got.tier} ${got.expiresAt}`);
}

// --- 5. the routes pass the pinned root only -------------------------------------------
console.log('');
console.log('5. the real routes, which can only use the pinned Apple root:');
const req = (body) => ({ text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), headers: new Headers() });
let res = await verifyRoute.POST(req({ signedTransaction: good }));
let body = await res.json();
check('POST /api/apple/iap/verify with a valid TEST-chain purchase: 400 unverified/chain, nothing granted',
  res.status === 400 && body.error === 'unverified' && body.reason === 'chain' && res.headers.get('cache-control') === 'no-store', `${res.status} ${JSON.stringify(body)}`);
const notif = chain.sign({
  notificationType: 'SUBSCRIBED', subtype: 'INITIAL_BUY', notificationUUID: '6f1d2c3b-0000-4000-8000-000000000001', version: '2.0', signedDate: NOW - 500,
  data: { appAppleId: 6820418649, bundleId: 'com.knowflow.app', environment: 'Production', signedTransactionInfo: good, status: 1 },
});
res = await notificationsRoute.POST(req({ signedPayload: notif }));
body = await res.json();
check('POST /api/apple/notifications with a valid TEST-chain SUBSCRIBED: 400 unverified/chain, nothing written',
  res.status === 400 && body.error === 'unverified' && body.reason === 'chain', `${res.status} ${JSON.stringify(body)}`);
check('neither route touched the database (the refusal comes before any read or write)', globalThis.__appleStub.adminCalls === 0, `${globalThis.__appleStub.adminCalls} admin calls`);
globalThis.__appleStub.user = null;
res = await verifyRoute.POST(req({ signedTransaction: good }));
check('verify without a session: 401', res.status === 401, `${res.status}`);
globalThis.__appleStub.user = { id: USER };
for (const [label, b] of [['a body that is not JSON', 'nope'], ['no signedTransaction', {}], ['a number', { signedTransaction: 7 }], ['over 32 KiB', { signedTransaction: 'a'.repeat(33 * 1024) }]]) {
  res = await verifyRoute.POST(req(b));
  check(`verify with ${label}: 400/413 bad-request`, (res.status === 400 || res.status === 413) && (await res.json()).error === 'bad-request', `${res.status}`);
}
for (const [label, b] of [['a body that is not JSON', 'nope'], ['no signedPayload', {}]]) {
  res = await notificationsRoute.POST(req(b));
  check(`notifications with ${label}: 400 bad-request`, res.status === 400 && (await res.json()).error === 'bad-request', `${res.status}`);
}

console.log('');
console.log(`${pass} passed, ${failures.length} failed, ${pass + failures.length} total`);
for (const f of failures) console.log('  ! ' + f);
process.exit(failures.length === 0 ? 0 : 1);
