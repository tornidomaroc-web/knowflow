/**
 * Executable proof for register #72: `getEntitlement` must not downgrade a
 * paying customer who owns more than one `subscriptions` row.
 *
 * WHY THIS EXISTS AS A SCRIPT RATHER THAN A NOTE. The defect was invisible to
 * reading: `.maybeSingle()` looks like "give me one row" and in fact FAILS on
 * two, and the failure was assigned to a variable the old code never read. It
 * was found by running, and it stays fixed only if it can be re-run.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT. This drives the real
 * `src/lib/entitlement.ts` through the real `@supabase/supabase-js` against a
 * real PostgREST over a real Postgres holding the same table definition as
 * `supabase/migrations/20260414_subscriptions.sql`. The client-side response
 * pipeline where the defect lives (`postgrest-js` `processResponse`) is
 * genuinely exercised.
 *
 * The database is a THROWAWAY CONTAINER. This script must never be pointed at
 * the Supabase project: reproducing the two-row case needs a row in
 * `auth.users` to satisfy the FK, and creating users in a production auth table
 * to test a read is a far bigger footprint than the bug being tested.
 *
 * The only substitutions are `@/lib/supabase/server` (Next.js `cookies()`,
 * never called here) and a URL rewrite, because supabase-js addresses
 * `/rest/v1` while a bare PostgREST serves at the root.
 *
 * Requires Docker. Usage:
 *   node --experimental-strip-types scripts/verify-entitlement-plural-read.mjs
 */
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-ent-verify-pg';
const PREST = 'kf-ent-verify-prest';
const NET = 'kf-ent-verify-net';
const PORT = 3999;

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
const quiet = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return '';
  }
};
const psql = (text) =>
  run('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', 'kftest', '-v', 'ON_ERROR_STOP=1', '-qtAc', text]);

function teardown() {
  quiet('docker', ['rm', '-f', PG, PREST]);
  quiet('docker', ['network', 'rm', NET]);
}
// Register #125. The stack is torn down on EVERY exit, not only the planned one:
// the ENOENT crash left both containers running, port 3999 held, for as long as
// the machine stayed up (55 minutes were measured on 2026-09-25), and a case
// that throws inside the code under test would do the same. `teardown` is
// synchronous, so it is safe in an exit handler; running it twice is harmless.
process.on('exit', teardown);

async function waitFor(label, probe, seconds = 45) {
  for (let i = 0; i < seconds; i++) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become ready within ${seconds}s`);
}

// --- stand up an isolated stack -------------------------------------------
teardown();
console.log('starting throwaway postgres + postgrest…');
run('docker', ['network', 'create', NET]);
run('docker', ['run', '-d', '--name', PG, '--network', NET, '-e', 'POSTGRES_PASSWORD=testpw', '-e', 'POSTGRES_DB=kftest', 'postgres:16-alpine']);
// Register #125. `pg_isready` alone is not readiness: the postgres image's
// entrypoint first runs a TEMPORARY server to initialise the database, which
// answers "accepting connections", then stops it and starts the real one. The
// first CI run of this job passed the probe on the temporary server and the
// next psql failed with "FATAL: the database system is shutting down". The
// entrypoint prints "PostgreSQL init process complete" before that restart, so
// both are required: that line in the container's log, then a ready server.
const pgLogs = () => {
  const r = spawnSync('docker', ['logs', PG], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
};
await waitFor('postgres', async () =>
  pgLogs().includes('init process complete') &&
  quiet('docker', ['exec', PG, 'pg_isready', '-U', 'postgres', '-d', 'kftest']).includes('accepting'));

// Mirror of supabase/migrations/20260414_subscriptions.sql. The FK to auth.users
// and the UNIQUE on paddle_subscription_id are reproduced exactly, because the
// absence of a UNIQUE on user_id is the whole point.
psql(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    paddle_subscription_id TEXT UNIQUE,
    paddle_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'free',
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'testpw';
  GRANT anon TO authenticator;
  GRANT USAGE ON SCHEMA public TO anon;
  GRANT SELECT ON subscriptions TO anon;
`);

const constraints = psql(
  `SELECT conname || ' ' || pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='subscriptions'::regclass ORDER BY conname;`
);
console.log('constraints on subscriptions:');
for (const line of constraints.trim().split('\n')) console.log('   ', line);
if (/UNIQUE \(user_id\)/.test(constraints)) {
  console.error('FAIL: the fixture grew a UNIQUE(user_id); the two-row case cannot exist.');
  teardown();
  process.exit(1);
}

run('docker', ['run', '-d', '--name', PREST, '--network', NET, '-p', `${PORT}:3000`,
  '-e', `PGRST_DB_URI=postgres://authenticator:testpw@${PG}:5432/kftest`,
  '-e', 'PGRST_DB_SCHEMA=public', '-e', 'PGRST_DB_ANON_ROLE=anon', 'postgrest/postgrest:latest']);
await waitFor('postgrest', async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/subscriptions?select=status`)).ok;
  } catch {
    return false;
  }
});

// --- load the real module --------------------------------------------------
// Register #125. This used to resolve `@/x` to `src/x` with no extension, which
// worked only while entitlement.ts imported nothing under `@/` but the stubbed
// server client. `f0cf3d1` (2026-09-08) added `@/lib/entitlement-core`, and from
// that commit on the import failed with ENOENT before any assertion ran, with
// no CI job to notice. The shared hook resolves `@/` the way every later proof
// does (`.ts`, `.tsx` or a folder's index), so the next such import cannot
// break this file again.
installTsxHooks(ROOT, {
  '@/lib/supabase/server':
    'export async function createClient(){throw new Error("verify script must call readEntitlement, not getEntitlement")}',
});
const { readEntitlement } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/entitlement.ts')).href);

const db = createClient(`http://localhost:${PORT}`, 'verify-anon-key', {
  auth: { persistSession: false },
  global: {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      headers.delete('Authorization');
      headers.delete('apikey');
      return fetch(String(input).replace('/rest/v1', ''), { ...init, headers });
    },
  },
});

// --- the matrix ------------------------------------------------------------
// Register #125. SOON and LATE were fixed dates ('2026-10-01', '2027-03-01'),
// which the clock would have turned into lapsed rows: every "future" case would
// have failed from 2026-10-01 with no change to the code under test. They are
// now 30 and 180 days from the run, at midnight UTC, spelled as PostgREST
// returns a timestamptz ('+00:00', not 'Z') because expiresAt is compared as a
// string. PAST stays fixed: a date in 2025 is lapsed on every future run.
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10) + 'T00:00:00+00:00';
const PAST = '2025-01-01T00:00:00+00:00';
const SOON = day(30);
const LATE = day(180);

const CASES = [
  ['zero rows (free user)',                  [],                                                      'free', null],
  ['one row, active, future',                [['active', SOON]],                                      'pro',  SOON],
  ['one row, active, LAPSED',                [['active', PAST]],                                      'free', null],
  ['one row, canceled',                      [['canceled', SOON]],                                    'free', null],
  ['one row, active, NULL period_end',       [['active', null]],                                      'free', null],
  ['one row, the default free row',          [['free', null]],                                        'free', null],
  ['TWO rows: canceled + active',            [['canceled', PAST], ['active', LATE]],                  'pro',  LATE],
  ['TWO rows: default free + active',        [['free', null], ['active', SOON]],                      'pro',  SOON],
  ['TWO rows: active(soon) then active(late)', [['active', SOON], ['active', LATE]],                  'pro',  LATE],
  ['TWO rows: active(late) then active(soon)', [['active', LATE], ['active', SOON]],                  'pro',  LATE],
  ['TWO rows: both dead',                    [['canceled', PAST], ['canceled', PAST]],                'free', null],
  ['TWO rows: past_due(future) + canceled',  [['past_due', LATE], ['canceled', PAST]],                'pro',  LATE],
  ['THREE rows: two dead, one live',         [['canceled', PAST], ['free', null], ['trialing', SOON]],'pro',  SOON],
  ['THREE rows: all lapsed',                 [['active', PAST], ['past_due', PAST], ['free', null]],  'free', null],
];

let uid = 0;
let pass = 0;
const failures = [];

console.log('');
for (const [name, rows, wantTier, wantExpires] of CASES) {
  const user = `${String(++uid).padStart(8, '0')}-0000-4000-8000-000000000000`;
  psql(`INSERT INTO auth.users (id) VALUES ('${user}');`);
  rows.forEach(([status, end], i) => {
    psql(`INSERT INTO subscriptions (user_id, paddle_subscription_id, status, current_period_end)
          VALUES ('${user}', 'sub_${uid}_${i}', '${status}', ${end === null ? 'NULL' : `'${end}'`});`);
  });

  const got = await readEntitlement(db, user);
  const ok =
    got.tier === wantTier &&
    got.expiresAt === wantExpires &&
    got.adsEnabled === (wantTier === 'free');
  if (ok) pass += 1;
  else failures.push(`${name}\n      expected tier=${wantTier} expiresAt=${wantExpires}\n      got      tier=${got.tier} expiresAt=${got.expiresAt}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(42)} tier=${String(got.tier).padEnd(5)} expiresAt=${got.expiresAt}`);
}

// A read that FAILED must be logged, and must not be reported as a free user.
const broken = createClient(`http://localhost:${PORT}`, 'k', {
  auth: { persistSession: false },
  global: {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      headers.delete('Authorization');
      headers.delete('apikey');
      return fetch(String(input).replace('/rest/v1', '').replace('/subscriptions', '/no_such_table'), { ...init, headers });
    },
  },
});
let logged = false;
const realError = console.error;
console.error = (...a) => { logged = true; realError('        (expected log)', a[0]); };
const errResult = await readEntitlement(broken, '00000001-0000-4000-8000-000000000000');
console.error = realError;
const errOk = logged && errResult.tier === 'free';
if (errOk) pass += 1;
else failures.push('failed read must be logged and resolve to free');
console.log(`  ${errOk ? 'OK  ' : 'FAIL'}  ${'failed read is logged, resolves free'.padEnd(42)} tier=${errResult.tier}`);

console.log('');
console.log(`${pass} passed, ${failures.length} failed, ${CASES.length + 1} total`);
for (const f of failures) console.log('  ! ' + f);

teardown();
process.exit(failures.length === 0 ? 0 : 1);
