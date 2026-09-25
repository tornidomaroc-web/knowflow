/**
 * Executable proof for register #126 (b): the `subscriptions` read path behaves
 * as the product needs UNDER ROW LEVEL SECURITY, against Supabase's real roles
 * and every migration in this repository, with no production contact.
 *
 * WHAT #125's PROOF LEFT OPEN. `verify-entitlement-plural-read.mjs` drives
 * `readEntitlement` with a bare anon client against a table with no RLS, so it
 * proves the plural read and the tier rule, not that a signed-in user can read
 * their own rows. If production filtered those rows, the read would return `[]`
 * with no error and a paying student would be shown free. This proof closes the
 * half that can be closed without production: it shows that the RLS the
 * MIGRATIONS define does the right thing for `authenticated` and `anon`. Only
 * register #126 (a), a read of production's own catalog with the same query
 * (`scripts/sql/read-subscriptions-rls.sql`), can show production has it.
 *
 * WHAT IS REAL HERE. The database is `supabase/postgres`, the image db-types
 * uses, pinned by the same digest, so `anon`, `authenticated`, `authenticator`,
 * `auth.users`, the default grants and `auth.uid()` are Supabase's own. Every
 * `apply` row of `supabase/migration-order.txt` is applied in order. PostgREST
 * is pinned by tag and digest like #125's. Each test user gets a real HS256 JWT
 * signed with a secret generated for this run and never stored; supabase-js
 * sends it; the real `readEntitlement` does the reading.
 *
 * THE ONE SUBSTITUTION, STATED. The image's init script defines `auth.uid()`
 * as `current_setting('request.jwt.claim.sub')`, the pre-v9 PostgREST setting,
 * which PostgREST v16 no longer sets: under it a signed-in user sees NOTHING
 * (measured 2026-09-26: `[]` with a valid token). On a hosted project that
 * function is redefined by Supabase Auth (GoTrue) migration
 * `20220224000811_update_auth_functions.up.sql`, which the image does not run.
 * This proof installs that migration's body verbatim, and register #126 (a)
 * reads production's actual body with the same query, so the substitution is
 * itself checked, not assumed.
 *
 * Requires Docker. Usage:
 *   node --experimental-strip-types scripts/verify-subscriptions-rls.mjs
 */
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-rls-verify-pg';
const PREST = 'kf-rls-verify-prest';
const NET = 'kf-rls-verify-net';
const PORT = 3998; // 3999 is verify-entitlement-plural-read's; both may run at once.

// The SAME digest as scripts/gen-db-types.sh, for the same reason it gives: a
// floating tag lets an upstream release turn this job red with no commit here.
// Bump both files together, and let the proof pass on the new image first.
const PG_IMAGE = 'supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453';
const PREST_IMAGE = 'postgrest/postgrest:v16.4@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df';

// Verbatim from supabase/auth migrations/20220224000811_update_auth_functions.up.sql
// ({{ Namespace }} = auth). See "THE ONE SUBSTITUTION" above.
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

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
const quiet = (cmd, args) => {
  try {
    return run(cmd, args);
  } catch {
    return '';
  }
};
// `postgres` is demoted after init on this image (roles and the auth schema are
// off limits to it), so fixture work that touches either runs as supabase_admin.
// Migrations run as `postgres`, exactly as scripts/gen-db-types.sh runs them.
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

// --- stand up an isolated stack -------------------------------------------
teardown();
console.log('starting throwaway supabase/postgres + postgrest…');
run('docker', ['network', 'create', NET]);
run('docker', ['run', '-d', '--name', PG, '--network', NET, '-e', 'POSTGRES_PASSWORD=postgres', PG_IMAGE]);
// Same two signals as gen-db-types.sh: the init-complete marker (the entrypoint
// runs a temporary server first) and pg_isready forced over TCP inside the
// container, which the temporary server does not answer.
const pgLogs = () => {
  const r = spawnSync('docker', ['logs', PG], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
};
await waitFor('postgres', async () =>
  pgLogs().includes('init process complete') &&
  spawnSync('docker', ['exec', PG, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-q']).status === 0);
console.log(`postgres ready (${since()})`);

// --- every migration, in the manifest's order --------------------------------
const manifest = readFileSync(resolvePath(ROOT, 'supabase/migration-order.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/));
let applied = 0;
for (const [file, action] of manifest) {
  if (action !== 'apply') continue;
  psqlAs('postgres', readFileSync(resolvePath(ROOT, 'supabase/migrations', file), 'utf8'));
  applied += 1;
}
console.log(`applied ${applied} of ${manifest.length} migrations (${manifest.length - applied} skipped by the manifest) (${since()})`);

// --- the one substitution, checked before and after ----------------------------
const uidBefore = admin(`select pg_get_functiondef('auth.uid()'::regprocedure);`);
if (uidBefore.includes('request.jwt.claims')) {
  console.log('auth.uid() on this image already reads request.jwt.claims; nothing to substitute');
} else {
  console.log("auth.uid() on this image reads only request.jwt.claim.sub (pre-v9 PostgREST); installing GoTrue's 20220224000811 body");
  admin(GOTRUE_AUTH_UID);
}
admin(`alter role authenticator password 'testpw';`);

// --- PostgREST with a run-only JWT secret --------------------------------------
const JWT_SECRET = randomBytes(32).toString('hex'); // 64 chars; PostgREST needs >= 32. Never printed, never stored.
run('docker', ['run', '-d', '--name', PREST, '--network', NET, '-p', `${PORT}:3000`,
  '-e', `PGRST_DB_URI=postgres://authenticator:testpw@${PG}:5432/postgres`,
  '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
  '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`, PREST_IMAGE]);
await waitFor('postgrest', async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/subscriptions?select=status`)).status === 200;
  } catch {
    return false;
  }
});
console.log(`postgrest ready (${since()})`);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tokenFor(userId) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ role: 'authenticated', aud: 'authenticated', sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`;
}

// --- the expected side of #126 (a) -----------------------------------------------
const READ_SQL = readFileSync(resolvePath(ROOT, 'scripts/sql/read-subscriptions-rls.sql'), 'utf8');
const catalog = psqlAs('postgres', READ_SQL).trim().split('\n');
console.log('');
console.log('scripts/sql/read-subscriptions-rls.sql on the fixture (the expected side for #126 (a)):');
for (const line of catalog) console.log('    ' + line);

let pass = 0;
const failures = [];
function check(name, ok, detail = '', always = false) {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${detail && (always || !ok) ? `\n        ${detail}` : ''}`);
}

console.log('');
console.log('catalog assertions:');
const has = (line) => catalog.includes(line);
check('RLS is enabled on subscriptions', has('rls_enabled|true'));
check('RLS is not forced (the app never connects as the owner)', has('rls_forced|false'));
const policies = catalog.filter((l) => l.startsWith('policy:'));
check('exactly one policy, the SELECT policy from 20260414', policies.length === 1 &&
  policies[0] === 'policy:Users can view own subscription|cmd=SELECT permissive=PERMISSIVE roles=public using=(auth.uid() = user_id) check=-',
  policies.join(' ; ') || 'no policy');
check('authenticated holds SELECT (the read needs the grant AND the policy)', has('grant:authenticated:SELECT|true'));
check("auth.uid() reads request.jwt.claims (GoTrue's body, what PostgREST >= v9 sets)",
  catalog.some((l) => l.startsWith('auth.uid()|') && l.includes("'request.jwt.claims'")));

// --- fixture users ------------------------------------------------------------------
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10) + 'T00:00:00+00:00';
const LATE = day(180);
const PAST = '2025-01-01T00:00:00+00:00';
const U = {
  A: '0000000a-0000-4000-8000-000000000000', // paying: one active row, far future
  B: '0000000b-0000-4000-8000-000000000000', // paying too; A must never see B
  C: '0000000c-0000-4000-8000-000000000000', // never paid: no row
  D: '0000000d-0000-4000-8000-000000000000', // lapsed: one canceled row; the user who would like to be Pro
};
for (const [k, id] of Object.entries(U)) admin(`insert into auth.users (id, email) values ('${id}', '${k.toLowerCase()}@example.invalid');`);
admin(`insert into subscriptions (user_id, paddle_subscription_id, status, current_period_end) values
  ('${U.A}', 'sub_a', 'active', '${LATE}'),
  ('${U.B}', 'sub_b', 'active', '${LATE}'),
  ('${U.D}', 'sub_d', 'canceled', '${PAST}');`);
const snapshot = () => admin(`select coalesce(md5(string_agg(t::text, ',' order by id)), 'empty') from subscriptions t;`).trim();
const before = snapshot();

// --- the real module, the real client ---------------------------------------------
installTsxHooks(ROOT, {
  '@/lib/supabase/server':
    'export async function createClient(){throw new Error("verify script must call readEntitlement, not getEntitlement")}',
});
const { readEntitlement } = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/entitlement.ts')).href);

// supabase-js addresses /rest/v1 and sends the project key as Authorization; a
// bare PostgREST serves at the root and the user's JWT IS the authorization, so
// the wrapper rewrites the path and puts the test user's token (or nothing, for
// anon) where the key would have been. Nothing else in the client is touched.
const clientFor = (token) =>
  createClient(`http://localhost:${PORT}`, 'verify-anon-key', {
    auth: { persistSession: false },
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers || {});
        headers.delete('apikey');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        else headers.delete('Authorization');
        return fetch(String(input).replace('/rest/v1', ''), { ...init, headers });
      },
    },
  });
const asA = clientFor(tokenFor(U.A));
const asC = clientFor(tokenFor(U.C));
const asD = clientFor(tokenFor(U.D));
const anon = clientFor(null);

// --- read cases -----------------------------------------------------------------------
console.log('');
console.log('read cases (the real readEntitlement through supabase-js):');
const tier = async (client, id) => readEntitlement(client, id);
let r = await tier(asA, U.A);
check('A (active, future) reads A → pro', r.tier === 'pro' && r.expiresAt === LATE, `got ${r.tier} ${r.expiresAt}`);
r = await tier(asA, U.B);
check("A asks with B's id → free (B's row is invisible to A)", r.tier === 'free', `got ${r.tier}`);
r = await tier(anon, U.A);
check("anon asks with A's id → free (no rows for anon)", r.tier === 'free', `got ${r.tier}`);
r = await tier(asC, U.C);
check('C (no row) reads C → free', r.tier === 'free', `got ${r.tier}`);
r = await tier(asD, U.D);
check('D (canceled, lapsed) reads D → free', r.tier === 'free', `got ${r.tier}`);
// The silent mode itself, raw: a filtered read is 200 with [], not an error.
let raw = await anon.from('subscriptions').select('user_id');
check('anon SELECT * is 200 with [] (filtered, not refused: the silent mode #126 names)', !raw.error && raw.data.length === 0,
  raw.error ? raw.error.message : `${raw.data.length} rows`);
raw = await asA.from('subscriptions').select('user_id');
check('A SELECT * returns exactly A\'s one row', !raw.error && raw.data.length === 1 && raw.data[0].user_id === U.A,
  raw.error ? raw.error.message : `${raw.data.length} rows`);

// --- write cases ------------------------------------------------------------------------
// Each attempt is judged twice: by what PostgREST answered, and by the table
// afterwards, read as superuser. A refusal that leaves the table unchanged is
// the only pass. An INSERT with no INSERT policy is an error (42501); an UPDATE
// or DELETE with no such policy is NOT an error, the rows are simply not visible
// to it, so "0 rows affected" plus "table unchanged" is the assertion there.
console.log('');
console.log('write cases (every one must leave the table exactly as it was):');
const unchanged = () => snapshot() === before;
async function refused(name, attempt, alsoStill) {
  const res = await attempt();
  const affected = Array.isArray(res.data) ? res.data.length : 0;
  const stillOk = alsoStill ? await alsoStill() : true;
  const ok = unchanged() && stillOk && (res.error !== null || affected === 0);
  check(name, ok,
    `postgrest: ${res.error ? `${res.error.code} ${res.error.message}` : `no error, ${affected} rows affected`}; table unchanged: ${unchanged()}${alsoStill ? `; tier unchanged: ${stillOk}` : ''}`,
    true);
}
const stillFree = (client, id) => async () => (await tier(client, id)).tier === 'free';
const stillPro = (client, id) => async () => (await tier(client, id)).tier === 'pro';

await refused('D INSERTs an active row for himself', () =>
  asD.from('subscriptions').insert({ user_id: U.D, paddle_subscription_id: 'sub_d2', status: 'active', current_period_end: LATE }).select(),
  stillFree(asD, U.D));
await refused('D UPDATEs his own canceled row to active, future', () =>
  asD.from('subscriptions').update({ status: 'active', current_period_end: LATE }).eq('user_id', U.D).select(),
  stillFree(asD, U.D));
await refused("D UPSERTs his own row (the webhook's verb) to active", () =>
  asD.from('subscriptions').upsert({ user_id: U.D, paddle_subscription_id: 'sub_d', status: 'active', current_period_end: LATE }, { onConflict: 'paddle_subscription_id' }).select(),
  stillFree(asD, U.D));
await refused('A DELETEs his own row', () =>
  asA.from('subscriptions').delete().eq('user_id', U.A).select(),
  stillPro(asA, U.A));
await refused("A UPDATEs B's row", () =>
  asA.from('subscriptions').update({ status: 'canceled' }).eq('user_id', U.B).select());
await refused("A DELETEs B's row", () =>
  asA.from('subscriptions').delete().eq('user_id', U.B).select());
await refused('C (no row) INSERTs an active row for himself', () =>
  asC.from('subscriptions').insert({ user_id: U.C, paddle_subscription_id: 'sub_c', status: 'active', current_period_end: LATE }).select(),
  stillFree(asC, U.C));
await refused('anon INSERTs a row for A', () =>
  anon.from('subscriptions').insert({ user_id: U.A, paddle_subscription_id: 'sub_x', status: 'active', current_period_end: LATE }).select());
await refused("anon UPDATEs D's row to active", () =>
  anon.from('subscriptions').update({ status: 'active', current_period_end: LATE }).eq('user_id', U.D).select(),
  stillFree(asD, U.D));
await refused("anon DELETEs A's row", () =>
  anon.from('subscriptions').delete().eq('user_id', U.A).select(),
  stillPro(asA, U.A));

const total = pass + failures.length;
console.log('');
console.log(`${pass} passed, ${failures.length} failed, ${total} total (${since()})`);
for (const f of failures) console.log('  ! ' + f);

teardown();
process.exit(failures.length === 0 ? 0 : 1);
