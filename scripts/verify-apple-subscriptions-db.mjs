/**
 * Executable proof for iOS 1.1 item 4d, server half, DATABASE part:
 * supabase/migrations/20261118_apple_subscriptions.sql on Supabase's own
 * postgres image with every migration of the manifest applied in order, and
 * PostgREST with a JWT secret made for the run (the harness of
 * scripts/verify-subscriptions-rls.mjs). Then the REAL handlers of both
 * Apple routes (src/lib/apple-iap/handlers.ts) write through the service
 * role, with a throwaway signing chain injected as the root (the routes
 * themselves pass only Apple Root CA - G3; scripts/verify-apple-iap.mjs
 * proves they refuse this chain), and the REAL readEntitlement reads under
 * RLS as each signed-in student.
 *
 *   1. the migration's own VERIFY query answers its twelve expected lines,
 *      and a second run of the migration changes nothing;
 *   2. grants and RLS: no student or anon write, no service-role DELETE, a
 *      student reads only their own rows, an entitled row without an end is
 *      refused by the table;
 *   3. POST /api/apple/iap/verify's handler: grant, replay, older JWS, wrong
 *      bundle / product / environment, foreign or missing appAccountToken,
 *      forged signature, a subscription already another account's;
 *   4. POST /api/apple/notifications' handler: every type that changes
 *      access, in order, out of order, replayed; unknown types and TEST
 *      write nothing; wrong product / app id, forged outer or inner JWS,
 *      Sandbox off the allowlist, a deleted account;
 *   5. Paddle and Apple on one account: Pro from either, the later end, and
 *      the Paddle table byte-identical after every Apple write.
 *
 * KF_APPLE_PLANT=skip leaves the Apple migration out; the proof must then
 * FAIL (the CI job asserts it), so it cannot pass without the migration.
 *
 * Requires Docker and openssl. Usage:
 *   node --experimental-strip-types scripts/verify-apple-subscriptions-db.mjs
 */
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { pullPinned } from './lib/pinned-image.mjs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { makeAppleTestChain } from './lib/apple-test-chain.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-apple-verify-pg';
const PREST = 'kf-apple-verify-prest';
const NET = 'kf-apple-verify-net';
const PORT = 3996; // 3999 entitlement-read, 3998 entitlement-rls; all may run at once.
const MIGRATION = '20261118_apple_subscriptions.sql';
const PLANT = process.env.KF_APPLE_PLANT ?? '';

// The SAME digests as scripts/gen-db-types.sh and verify-subscriptions-rls.mjs.
const PG_IMAGE = 'supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453';
const PREST_IMAGE = 'postgrest/postgrest:v16.4@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df';

// Verbatim from supabase/auth migrations/20220224000811_update_auth_functions.up.sql,
// the one substitution verify-subscriptions-rls.mjs records and checks.
const GOTRUE_AUTH_UID = `
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;`;

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
const quiet = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return '';
  }
};
const psqlAs = (user, sql) =>
  run('docker', ['exec', '-i', PG, 'psql', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], { input: sql });
const admin = (sql) => psqlAs('supabase_admin', sql);

function teardown() {
  quiet('docker', ['rm', '-f', PG, PREST]);
  quiet('docker', ['network', 'rm', NET]);
}
process.on('exit', teardown);

async function waitFor(label, probe, seconds = 120) {
  for (let i = 0; i < seconds; i++) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready within ${seconds}s`);
}

const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// --- the stack ---------------------------------------------------------------------
teardown();
console.log(`starting throwaway supabase/postgres + postgrest…${PLANT ? `  PLANT=${PLANT}` : ''}`);
run('docker', ['network', 'create', NET]);
const PG_RUN = pullPinned(PG_IMAGE);
const PREST_RUN = pullPinned(PREST_IMAGE);
run('docker', ['run', '-d', '--name', PG, '--network', NET, '-e', 'POSTGRES_PASSWORD=postgres', PG_RUN]);
const pgLogs = () => {
  const r = spawnSync('docker', ['logs', PG], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
};
await waitFor('postgres', async () =>
  pgLogs().includes('init process complete') &&
  spawnSync('docker', ['exec', PG, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-q']).status === 0);
console.log(`postgres ready (${since()})`);

const manifest = readFileSync(resolvePath(ROOT, 'supabase/migration-order.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
let applied = 0;
for (const [file, action] of manifest) {
  if (action !== 'apply') continue;
  if (PLANT === 'skip' && file === MIGRATION) continue;
  psqlAs('postgres', readFileSync(resolvePath(ROOT, 'supabase/migrations', file), 'utf8'));
  applied += 1;
}
console.log(`applied ${applied} migrations (${since()})`);
if (!admin(`select pg_get_functiondef('auth.uid()'::regprocedure);`).includes('request.jwt.claims')) admin(GOTRUE_AUTH_UID);
admin(`alter role authenticator password 'testpw';`);

const JWT_SECRET = randomBytes(32).toString('hex'); // never printed, never stored
run('docker', ['run', '-d', '--name', PREST, '--network', NET, '-p', `${PORT}:3000`,
  '-e', `PGRST_DB_URI=postgres://authenticator:testpw@${PG}:5432/postgres`,
  '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
  '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`, PREST_RUN]);
await waitFor('postgrest', async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/subscriptions?select=status`)).status === 200;
  } catch {
    return false;
  }
});
console.log(`postgrest ready (${since()})`);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(role, sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ role, aud: 'authenticated', ...(sub ? { sub } : {}), exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
const clientFor = (jwt) =>
  createClient(`http://localhost:${PORT}`, 'verify-anon-key', {
    auth: { persistSession: false },
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers || {});
        headers.delete('apikey');
        if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
        else headers.delete('Authorization');
        return fetch(String(input).replace('/rest/v1', ''), { ...init, headers });
      },
    },
  });

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}

// --- 1. the migration's VERIFY query -----------------------------------------------------
console.log('');
console.log(`1. ${MIGRATION}: its VERIFY query and a second run:`);
const migSql = readFileSync(resolvePath(ROOT, 'supabase/migrations', MIGRATION), 'utf8');
const migLines = migSql.split(/\r?\n/);
const vStart = migLines.findIndex((l) => l.startsWith('-- VERIFY'));
const eStart = migLines.findIndex((l) => /^-- Expected rows \(\d+\):/.test(l));
const verifySql = migLines.slice(vStart + 1, eStart).map((l) => l.replace(/^-- ?/, '')).join('\n');
const expectedCount = Number(/\((\d+)\)/.exec(migLines[eStart])[1]);
const expected = [];
for (const l of migLines.slice(eStart + 1)) {
  const m = /^--\s{3}(\S+)\s*\|\s(.*)$/.exec(l);
  if (!m) break;
  expected.push(`${m[1]}|${m[2]}`);
}
const readVerify = () => {
  try {
    // As `postgres`, the role the owner runs it with in the SQL editor: its
    // search_path prints the foreign key as auth.users(id), as production will.
    return psqlAs('postgres', verifySql).trim().split('\n');
  } catch (error) {
    return [`ERROR ${String(error.stderr || error.message).split('\n')[0]}`];
  }
};
const got1 = readVerify();
console.log('    VERIFY on the fixture:');
for (const l of got1) console.log('      ' + l);
check(`the expected block lists ${expectedCount} rows`, expected.length === expectedCount, `${expected.length} parsed`);
check('the VERIFY query answers exactly the expected rows, in order', JSON.stringify(got1) === JSON.stringify(expected),
  `missing: ${expected.filter((l) => !got1.includes(l)).join(' ; ')}\n        extra: ${got1.filter((l) => !expected.includes(l)).join(' ; ')}`);
let rerun = null;
if (PLANT !== 'skip') {
  try {
    psqlAs('postgres', migSql);
  } catch (error) {
    rerun = String(error.stderr || error.message).split('\n')[0];
  }
}
check('a second run of the migration succeeds and the VERIFY answer is unchanged (idempotent)', rerun === null && JSON.stringify(readVerify()) === JSON.stringify(got1), rerun ?? '');

// --- fixture users -------------------------------------------------------------------------
const U = {
  A: '0000000a-0000-4000-8000-0000000a991e', // buys in the app
  B: '0000000b-0000-4000-8000-0000000a991e', // Paddle and Apple
  C: '0000000c-0000-4000-8000-0000000a991e', // reviewer / TestFlight: on the Sandbox allowlist
  D: '0000000d-0000-4000-8000-0000000a991e', // another student
};
const GONE = '0000000e-0000-4000-8000-0000000a991e'; // never in auth.users: a deleted account
for (const [k, id] of Object.entries(U)) admin(`insert into auth.users (id, email) values ('${id}', '${k.toLowerCase()}-apple@example.invalid');`);

const service = clientFor(token('service_role'));
const asUser = (id) => clientFor(token('authenticated', id));
const anon = clientFor(null);
const appleSnap = () => admin(`select coalesce(md5(string_agg(t::text, ',' order by id)), 'empty') from public.apple_subscriptions t;`).trim();
const paddleSnap = () => admin(`select coalesce(md5(string_agg(t::text, ',' order by id)), 'empty') from public.subscriptions t;`).trim();
const rowOf = (otid) => {
  const out = admin(`select user_id || '|' || status || '|' || coalesce(to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '-') || '|' || environment || '|' || last_transaction_id from public.apple_subscriptions where original_transaction_id = '${otid}';`).trim();
  if (!out) return null;
  const [user_id, status, expires_at, environment, last_transaction_id] = out.split('|');
  return { user_id, status, expires_at, environment, last_transaction_id };
};

// --- the real modules ----------------------------------------------------------------------
installTsxHooks(ROOT, {
  '@/lib/supabase/server':
    'export async function createClient(){throw new Error("this proof calls readEntitlement and the handlers, not the routes")}',
});
const imp = (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const { readEntitlement } = await imp('src/lib/entitlement.ts');
let handlers;
try {
  handlers = await imp('src/lib/apple-iap/handlers.ts');
} catch (error) {
  check('src/lib/apple-iap/handlers.ts loads', false, error.message);
}

const chain = makeAppleTestChain();
let clock = Date.now() + 120000; // the chain was made a moment ago; see verify-apple-iap.mjs
const deps = {
  admin: service,
  roots: [chain.root],
  sandboxUserIds: new Set([U.C]),
  now: () => clock,
};
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
let seq = 0;
const tx = (over = {}) => ({
  transactionId: String(3000000000000000 + ++seq),
  originalTransactionId: '2000000000000a01',
  bundleId: 'com.knowflow.app',
  productId: 'com.knowflow.app.pro.monthly',
  purchaseDate: clock - 60000,
  originalPurchaseDate: clock - 60000,
  expiresDate: clock + 30 * DAY,
  quantity: 1,
  type: 'Auto-Renewable Subscription',
  appAccountToken: U.A,
  inAppOwnershipType: 'PURCHASED',
  signedDate: clock - 1000,
  environment: 'Production',
  ...over,
});
const tier = async (id) => readEntitlement(asUser(id), id);

// --- 2. grants and RLS --------------------------------------------------------------------
console.log('');
console.log('2. grants and RLS on apple_subscriptions:');
{
  const seed = await service.from('apple_subscriptions').insert({
    user_id: U.D, original_transaction_id: 'seed-d', product_id: 'com.knowflow.app.pro.monthly', environment: 'Production',
    status: 'expired', expires_at: iso(clock - DAY), last_transaction_id: 'seed-d', last_signed_at: iso(clock - 10 * DAY),
  }).select('id');
  check('service_role INSERTs a row (the routes\' writer)', !seed.error && seed.data?.length === 1, seed.error?.message ?? '');
  const before = appleSnap();
  const refused = async (name, attempt) => {
    const res = await attempt();
    check(name, res.error?.code === '42501' && appleSnap() === before, res.error ? `${res.error.code} ${res.error.message}` : 'no error');
  };
  await refused('D INSERTs an active row for himself: 42501', () => asUser(U.D).from('apple_subscriptions').insert({ user_id: U.D, original_transaction_id: 'x', product_id: 'p', environment: 'Production', status: 'active', expires_at: iso(clock + DAY), last_transaction_id: 'x', last_signed_at: iso(clock) }));
  await refused('D UPDATEs his own row to active: 42501', () => asUser(U.D).from('apple_subscriptions').update({ status: 'active', expires_at: iso(clock + DAY) }).eq('user_id', U.D).select());
  await refused('D DELETEs his own row: 42501', () => asUser(U.D).from('apple_subscriptions').delete().eq('user_id', U.D).select());
  await refused('anon SELECTs: 42501 (no grant at all)', () => anon.from('apple_subscriptions').select('id'));
  await refused('anon INSERTs: 42501', () => anon.from('apple_subscriptions').insert({ user_id: U.D }));
  await refused('service_role DELETEs: 42501 (the server never removes a row)', () => service.from('apple_subscriptions').delete().eq('user_id', U.D).select());
  let r = await asUser(U.D).from('apple_subscriptions').select('user_id');
  check('D reads exactly his own row', !r.error && r.data.length === 1 && r.data[0].user_id === U.D, r.error?.message ?? JSON.stringify(r.data));
  r = await asUser(U.A).from('apple_subscriptions').select('user_id');
  check("A reads nothing of D's", !r.error && r.data.length === 0, r.error?.message ?? JSON.stringify(r.data));
  r = await service.from('apple_subscriptions').insert({ user_id: U.D, original_transaction_id: 'no-end', product_id: 'p', environment: 'Production', status: 'active', expires_at: null, last_transaction_id: 'x', last_signed_at: iso(clock) });
  check('an active row with no end is refused by the table itself: 23514', r.error?.code === '23514', r.error ? `${r.error.code} ${r.error.message}` : 'no error');
  r = await service.from('apple_subscriptions').insert({ user_id: U.D, original_transaction_id: 'xcode', product_id: 'p', environment: 'Xcode', status: 'expired', last_transaction_id: 'x', last_signed_at: iso(clock) });
  check("environment 'Xcode' is refused by the table: 23514", r.error?.code === '23514', r.error ? `${r.error.code}` : 'no error');
}

if (!handlers) {
  console.log(`\n${pass} passed, ${failures.length} failed`);
  for (const f of failures) console.log('  ! ' + f);
  process.exit(1);
}
const { verifyPurchase, handleNotification } = handlers;

// --- 3. the verify handler --------------------------------------------------------------
console.log('');
console.log('3. POST /api/apple/iap/verify (verifyPurchase), as A:');
const buy = async (userId, payload, opts) => verifyPurchase({ userId, signedTransaction: chain.sign(payload, opts) }, deps);
const OT = '2000000000000a01';
const firstTx = tx({ expiresDate: clock + 30 * DAY, signedDate: clock - 5000 });
let res = await buy(U.A, firstTx);
let row = rowOf(OT);
check('a verified Production purchase with A\'s appAccountToken: 200, Pro until its expiresDate, row active for A',
  res.status === 200 && res.body.tier === 'pro' && res.body.expiresAt?.startsWith(iso(firstTx.expiresDate).slice(0, 19)) && row?.status === 'active' && row.user_id === U.A,
  `${res.status} ${JSON.stringify(res.body)} row ${JSON.stringify(row)}`);
let ent = await tier(U.A);
check("A's own entitlement read (RLS, the app's next page) is Pro", ent.tier === 'pro', JSON.stringify(ent));
let snap = appleSnap();
res = await verifyPurchase({ userId: U.A, signedTransaction: chain.sign(firstTx) }, deps);
check('the same transaction again (a resend, Restore Purchases): 200, applied false, row unchanged', res.status === 200 && res.body.applied === false && res.body.tier === 'pro' && appleSnap() === snap, JSON.stringify(res.body));
res = await buy(U.A, tx({ signedDate: clock - 9000, expiresDate: clock - DAY }));
check('an OLDER signed transaction (expired) does not overwrite the newer state: applied false, still Pro', res.body.applied === false && appleSnap() === snap && (await tier(U.A)).tier === 'pro', JSON.stringify(res.body));
const refusedBuy = async (name, userId, payload, wantStatus, wantError, opts) => {
  const r = await buy(userId, payload, opts);
  check(name, r.status === wantStatus && r.body.error === wantError && appleSnap() === snap, `${r.status} ${JSON.stringify(r.body)}`);
};
await refusedBuy('another bundle: 422 not-pro-product, nothing written', U.A, tx({ bundleId: 'com.other.app', signedDate: clock }), 422, 'not-pro-product');
await refusedBuy('another product: 422 not-pro-product', U.A, tx({ productId: 'com.knowflow.app.pro.yearly', signedDate: clock }), 422, 'not-pro-product');
await refusedBuy('Sandbox for A (not on the allowlist): 403 environment-not-allowed', U.A, tx({ environment: 'Sandbox', signedDate: clock }), 403, 'environment-not-allowed');
await refusedBuy("D sends A's transaction (appAccountToken is A): 403 not-this-account", U.D, tx({ signedDate: clock }), 403, 'not-this-account');
await refusedBuy('a transaction with no appAccountToken: 403 not-this-account', U.A, tx({ appAccountToken: undefined, signedDate: clock }), 403, 'not-this-account');
await refusedBuy('a forged signature: 400 unverified', U.A, tx({ signedDate: clock }), 400, 'unverified', { key: 'stranger' });
await refusedBuy("D's token on A's original transaction: 409 other-account (a subscription never moves)", U.D, tx({ appAccountToken: U.D, signedDate: clock }), 409, 'other-account');
check("A's row still belongs to A", rowOf(OT)?.user_id === U.A);
res = await buy(U.C, tx({ originalTransactionId: '2000000000000c01', appAccountToken: U.C, environment: 'Sandbox', signedDate: clock - 2000 }));
check('Sandbox for C (on the allowlist, the reviewer or TestFlight account): 200 Pro, row environment Sandbox',
  res.status === 200 && res.body.tier === 'pro' && rowOf('2000000000000c01')?.environment === 'Sandbox', JSON.stringify(res.body));

// --- 4. notifications ----------------------------------------------------------------------
console.log('');
console.log('4. POST /api/apple/notifications (handleNotification), on A\'s subscription:');
let nseq = 0;
const notify = (type, subtype, txPayload, { signedDate, status, renewal, data = {}, outerKey, innerKey } = {}) => {
  const n = {
    notificationType: type,
    ...(subtype ? { subtype } : {}),
    notificationUUID: `6f1d2c3b-0000-4000-8000-${String(++nseq).padStart(12, '0')}`,
    version: '2.0',
    signedDate,
    data: {
      appAppleId: 6820418649,
      bundleId: 'com.knowflow.app',
      environment: txPayload.environment,
      signedTransactionInfo: chain.sign(txPayload, innerKey ? { key: innerKey } : {}),
      ...(renewal ? { signedRenewalInfo: chain.sign({ originalTransactionId: txPayload.originalTransactionId, signedDate: txPayload.signedDate, ...renewal }) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...data,
    },
  };
  return handleNotification(chain.sign(n, outerKey ? { key: outerKey } : {}), deps);
};
let T = clock - 500; // notification signedDates climb from here
const next = () => (T += 1);
const state = () => rowOf(OT);
const expectRow = async (name, r, wantStatus, wantTier, wantApplied = true) => {
  const s = state();
  const e = await tier(U.A);
  check(name, r.status === 200 && r.body.applied === wantApplied && s?.status === wantStatus && e.tier === wantTier,
    `${r.status} ${JSON.stringify(r.body)} row ${s?.status} tier ${e.tier}`);
};

const renewExp = clock + 60 * DAY;
let r = await notify('DID_RENEW', null, tx({ expiresDate: renewExp }), { signedDate: next(), status: 1 });
await expectRow('DID_RENEW: active, the new period end', r, 'active', 'pro');
check('the row\'s end moved to the renewal\'s expiresDate', state()?.expires_at === iso(renewExp), state()?.expires_at);
snap = appleSnap();
r = await notify('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', tx({ expiresDate: renewExp }), { signedDate: next() });
check('DID_CHANGE_RENEWAL_STATUS without data.status: 200, nothing written (says nothing about access)', r.status === 200 && r.body.applied === false && appleSnap() === snap, JSON.stringify(r.body));
const graceEnd = clock + 75 * DAY;
r = await notify('DID_FAIL_TO_RENEW', 'GRACE_PERIOD', tx({ expiresDate: clock - 1000 }), { signedDate: next(), status: 4, renewal: { gracePeriodExpiresDate: graceEnd } });
await expectRow('DID_FAIL_TO_RENEW/GRACE_PERIOD: grace_period, still Pro', r, 'grace_period', 'pro');
check('in grace, Pro runs to gracePeriodExpiresDate', state()?.expires_at === iso(graceEnd) && (await tier(U.A)).expiresAt?.startsWith(iso(graceEnd).slice(0, 19)), state()?.expires_at);
r = await notify('GRACE_PERIOD_EXPIRED', null, tx({ expiresDate: clock - 1000 }), { signedDate: next(), status: 3 });
await expectRow('GRACE_PERIOD_EXPIRED: billing_retry, free', r, 'billing_retry', 'free');
r = await notify('DID_FAIL_TO_RENEW', null, tx({ expiresDate: clock - 1000 }), { signedDate: next() });
await expectRow('DID_FAIL_TO_RENEW (no grace), no data.status: billing_retry, free', r, 'billing_retry', 'free');
r = await notify('DID_RENEW', 'BILLING_RECOVERY', tx({ expiresDate: renewExp }), { signedDate: next(), status: 1 });
await expectRow('DID_RENEW/BILLING_RECOVERY: active again, Pro', r, 'active', 'pro');
const tExpired = next() + 5;
const tStaleRenew = next();
r = await notify('EXPIRED', 'VOLUNTARY', tx({ expiresDate: clock - 1000 }), { signedDate: tExpired, status: 2 });
await expectRow('EXPIRED/VOLUNTARY: expired, free', r, 'expired', 'free');
snap = appleSnap();
r = await notify('DID_RENEW', null, tx({ expiresDate: renewExp }), { signedDate: tStaleRenew, status: 1 });
check('OUT OF ORDER: a DID_RENEW signed BEFORE the EXPIRED, delivered after it: not applied, still expired, still free',
  r.status === 200 && r.body.applied === false && appleSnap() === snap && (await tier(U.A)).tier === 'free', JSON.stringify(r.body));
T = tExpired;
const expiredAgain = { signedDate: tExpired, status: 2 };
r = await notify('EXPIRED', 'VOLUNTARY', tx({ expiresDate: clock - 1000 }), expiredAgain);
check('REPLAY: the EXPIRED again with the same signedDate: applied false, row byte-identical', r.body.applied === false && appleSnap() === snap, JSON.stringify(r.body));
r = await notify('SUBSCRIBED', 'RESUBSCRIBE', tx({ expiresDate: renewExp }), { signedDate: next(), status: 1 });
await expectRow('SUBSCRIBED/RESUBSCRIBE: active, Pro', r, 'active', 'pro');
r = await notify('REFUND', null, tx({ expiresDate: renewExp, revocationDate: clock - 100, revocationReason: 0 }), { signedDate: next(), status: 5 });
await expectRow('REFUND (revocationDate set): refunded, free at once though expiresDate is ahead', r, 'refunded', 'free');
r = await notify('REFUND_REVERSED', null, tx({ expiresDate: renewExp }), { signedDate: next(), status: 1 });
await expectRow('REFUND_REVERSED: active, Pro', r, 'active', 'pro');
r = await notify('REVOKE', null, tx({ expiresDate: renewExp, revocationDate: clock - 50 }), { signedDate: next(), status: 5 });
await expectRow('REVOKE: revoked, free', r, 'revoked', 'free');
r = await notify('OFFER_REDEEMED', 'RESUBSCRIBE', tx({ expiresDate: renewExp }), { signedDate: next(), status: 1 });
await expectRow('OFFER_REDEEMED: active, Pro', r, 'active', 'pro');
snap = appleSnap();
const nothing = async (name, promise, wantStatus = 200) => {
  const x = await promise;
  check(name, x.status === wantStatus && (x.body.applied === false || x.body.error) && appleSnap() === snap, `${x.status} ${JSON.stringify(x.body)}`);
};
await nothing('an unknown type carrying data.status=1: logged, nothing written, nothing granted', notify('A_TYPE_APPLE_ADDS_LATER', null, tx({ productId: 'com.knowflow.app.pro.monthly' }), { signedDate: next(), status: 1 }));
await nothing('CONSUMPTION_REQUEST: nothing written', notify('CONSUMPTION_REQUEST', null, tx(), { signedDate: next(), status: 1 }));
await nothing('TEST: nothing written', notify('TEST', null, tx(), { signedDate: next() }));
await nothing('another product: nothing written', notify('EXPIRED', null, tx({ productId: 'com.knowflow.app.other' }), { signedDate: next(), status: 2 }));
await nothing('a Production notification for another app id: nothing written', notify('EXPIRED', null, tx(), { signedDate: next(), status: 2, data: { appAppleId: 1 } }));
await nothing('another bundle in the notification: nothing written', notify('EXPIRED', null, tx(), { signedDate: next(), status: 2, data: { bundleId: 'com.other.app' } }));
await nothing('a forged outer signedPayload: 400', notify('EXPIRED', null, tx(), { signedDate: next(), status: 2, outerKey: 'stranger' }), 400);
await nothing('a genuine outer payload around a forged signedTransactionInfo: 400', notify('EXPIRED', null, tx(), { signedDate: next(), status: 2, innerKey: 'stranger' }), 400);
await nothing('version 1 shape (no version 2.0): nothing written', handleNotification(chain.sign({ notificationType: 'EXPIRED', signedDate: next(), data: {} }), deps));
await nothing('Sandbox EXPIRED on A\'s row (A not on the allowlist): nothing written', notify('EXPIRED', null, tx({ environment: 'Sandbox', originalTransactionId: OT }), { signedDate: next(), status: 2 }));
check('after all of that, A is still Pro', (await tier(U.A)).tier === 'pro');

console.log('');
console.log('   new subscriptions learned from a notification:');
r = await notify('SUBSCRIBED', 'INITIAL_BUY', tx({ originalTransactionId: '2000000000000d01', appAccountToken: U.D }), { signedDate: next(), status: 1 });
check('SUBSCRIBED for a subscription with no row yet: inserted for the appAccountToken\'s account (D), Pro',
  r.body.applied === true && rowOf('2000000000000d01')?.user_id === U.D && (await tier(U.D)).tier === 'pro', JSON.stringify(r.body));
snap = appleSnap();
await nothing('SUBSCRIBED with no row and no appAccountToken: nothing written', notify('SUBSCRIBED', 'INITIAL_BUY', tx({ originalTransactionId: '2000000000000f01', appAccountToken: undefined }), { signedDate: next(), status: 1 }));
await nothing('SUBSCRIBED for a deleted account (token not in auth.users): 200, nothing written (FK)', notify('SUBSCRIBED', 'INITIAL_BUY', tx({ originalTransactionId: '2000000000000e01', appAccountToken: GONE }), { signedDate: next(), status: 1 }));
r = await notify('DID_RENEW', null, tx({ originalTransactionId: '2000000000000c01', appAccountToken: U.C, environment: 'Sandbox', expiresDate: clock + 5 * 60000 }), { signedDate: next(), status: 1 });
check('Sandbox DID_RENEW on C\'s row (allowlisted): applied', r.body.applied === true && rowOf('2000000000000c01')?.status === 'active', JSON.stringify(r.body));

// --- 5. Paddle and Apple on one account ------------------------------------------------------
console.log('');
console.log('5. Paddle and Apple on one account (B):');
const paddleEnd = iso(clock + 20 * DAY);
admin(`insert into public.subscriptions (user_id, paddle_subscription_id, paddle_customer_id, status, current_period_end, updated_at)
  values ('${U.B}', 'sub_b_apple_proof', 'ctm_b', 'active', '${paddleEnd}', '${iso(clock - DAY)}');`);
let paddle = paddleSnap();
const OB = '2000000000000b01';
const bTx = (over) => tx({ originalTransactionId: OB, appAccountToken: U.B, ...over });
r = await notify('SUBSCRIBED', 'INITIAL_BUY', bTx({ expiresDate: clock + 40 * DAY }), { signedDate: next(), status: 1 });
ent = await tier(U.B);
check('Paddle active (20 days) + Apple active (40 days): Pro until the later, Apple\'s', ent.tier === 'pro' && ent.expiresAt?.startsWith(iso(clock + 40 * DAY).slice(0, 19)), JSON.stringify(ent));
r = await notify('EXPIRED', 'VOLUNTARY', bTx({ expiresDate: clock - 1000 }), { signedDate: next(), status: 2 });
ent = await tier(U.B);
check('Apple EXPIRED: still Pro through Paddle, until Paddle\'s end', ent.tier === 'pro' && ent.expiresAt?.startsWith(paddleEnd.slice(0, 19)), JSON.stringify(ent));
check('the Paddle row is byte-identical after both Apple writes', paddleSnap() === paddle);
admin(`update public.subscriptions set status = 'canceled', updated_at = '${iso(clock)}' where paddle_subscription_id = 'sub_b_apple_proof';`);
paddle = paddleSnap();
r = await notify('SUBSCRIBED', 'RESUBSCRIBE', bTx({ expiresDate: clock + 30 * DAY }), { signedDate: next(), status: 1 });
ent = await tier(U.B);
check('Paddle canceled + Apple active: Pro through Apple', ent.tier === 'pro' && ent.expiresAt?.startsWith(iso(clock + 30 * DAY).slice(0, 19)), JSON.stringify(ent));
r = await notify('REFUND', null, bTx({ expiresDate: clock + 30 * DAY, revocationDate: clock }), { signedDate: next(), status: 5 });
ent = await tier(U.B);
check('Paddle canceled + Apple refunded: free', ent.tier === 'free', JSON.stringify(ent));
check('the Paddle row is byte-identical after every Apple write', paddleSnap() === paddle);
const paddleRows = admin(`select count(*) from public.subscriptions;`).trim();
check('no Apple event ever wrote to public.subscriptions (one row, the one this proof inserted)', paddleRows === '1', paddleRows);
const resA = await verifyPurchase({ userId: U.B, signedTransaction: chain.sign(bTx({ signedDate: next(), expiresDate: clock + 30 * DAY, revocationDate: clock })) }, deps);
check("B resends the refunded transaction (signed after the refund, so it carries revocationDate): 200, revoked, the whole entitlement free", resA.status === 200 && resA.body.tier === 'free', JSON.stringify(resA.body));

console.log('');
const total = pass + failures.length;
console.log(`${pass} passed, ${failures.length} failed, ${total} total (${since()})${PLANT ? `  PLANT=${PLANT}` : ''}`);
for (const f of failures) console.log('  ! ' + f);
process.exit(failures.length === 0 ? 0 : 1);
