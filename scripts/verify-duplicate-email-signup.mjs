/**
 * Executable proof: what `handle_new_user` does when a SECOND `auth.users` row
 * arrives carrying an email that already exists in `profiles`.
 *
 * WHY THIS EXISTS. `001_initial_schema.sql` declares `profiles.email text
 * unique not null` and an `AFTER INSERT` trigger on `auth.users` that does a
 * BARE `insert into public.profiles (id, email, full_name)` -- no `on conflict`.
 * If an OAuth sign-in (Google, Apple) ever produces a NEW `auth.users` row for
 * an email that already has a password account, that insert collides. Whether it
 * degrades or fails outright decides whether sign-in buttons can ship, and it
 * was an INFERENCE from reading until this script ran.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 *   PROVES: given that a second `auth.users` row with a duplicate email is
 *   ATTEMPTED, what OUR schema does -- the trigger, the constraint, the
 *   transaction, and whether the `auth.users` row survives.
 *
 *   DOES NOT PROVE: whether Supabase would attempt it at all. That is GoTrue's
 *   identity-linking behaviour, a project setting no agent here can read
 *   (`.env.local` is deny-listed and `/auth/v1/settings` needs the anon key).
 *   That half is owner-gated and stays open.
 *
 * THE `auth.users` HERE IS A STAND-IN, AND THE DIFFERENCE MATTERS. It carries
 * only what our code touches: `id`, `email`, `raw_user_meta_data`. Supabase's
 * real table has more, and NOTABLY this stand-in has NO unique constraint on
 * `email` -- deliberately, because constraining it here would mask our trigger
 * behind an auth-side failure and answer a question we are not asking. If
 * Supabase's own table rejects the duplicate first, that is a DIFFERENT and also
 * blocking failure, and it is not what this script measures.
 *
 * `001_initial_schema.sql` is replayed VERBATIM. Only two things are created
 * ahead of it, both because Supabase provides them and a bare Postgres does not:
 * the `auth` schema with that stand-in table, and an `auth.uid()` stub so the
 * RLS policies in the file can compile.
 *
 * THROWAWAY CONTAINER. No production contact of any kind.
 *
 * Requires Docker. Usage:  node scripts/verify-duplicate-email-signup.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-dupemail-verify-pg';

const say = (l) => process.stdout.write((l === undefined ? '' : l) + '\n');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const quiet = (cmd, args) => { try { return run(cmd, args); } catch { return ''; } };

function teardown() {
  quiet('docker', ['rm', '-f', PG]);
}

/** Run SQL, returning stdout. Throws with psql's message on error. */
function psql(sql, { tuplesOnly = true } = {}) {
  const args = ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', 'kftest', '-v', 'ON_ERROR_STOP=1'];
  if (tuplesOnly) args.push('-t', '-A');
  return execFileSync('docker', [...args, '-c', sql], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * Run SQL expecting failure; return the captured error text (never throws).
 *
 * `VERBOSITY=verbose` is set deliberately: at psql's DEFAULT verbosity the
 * SQLSTATE is not printed at all, so asserting on it would be asserting on a
 * string that could never appear -- a check that can only pass by accident.
 */
function psqlExpectFail(sql) {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', 'kftest',
       '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-t', '-A', '-c', sql],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return { failed: false, out };
  } catch (e) {
    return { failed: true, stderr: String(e.stderr ?? e.message) };
  }
}

const failures = [];
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures.push(`${label} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  say('  ' + (ok ? 'OK  ' : 'FAIL') + '  ' + label.padEnd(60) + ' -> ' + JSON.stringify(got));
}

process.on('exit', teardown);
teardown();

say('THROWAWAY POSTGRES. No production contact.');
say('');
say('starting container...');
run('docker', ['run', '-d', '--name', PG, '-e', 'POSTGRES_PASSWORD=testpw', '-e', 'POSTGRES_DB=kftest', 'postgres:16-alpine']);

// wait for readiness
let ready = false;
for (let i = 0; i < 60; i++) {
  if (quiet('docker', ['exec', PG, 'pg_isready', '-U', 'postgres', '-d', 'kftest']).includes('accepting connections')) { ready = true; break; }
  execFileSync('docker', ['exec', PG, 'sleep', '1'], { stdio: 'ignore' });
}
if (!ready) { say('postgres did not become ready'); process.exit(1); }

// ---- Supabase-provided pieces a bare Postgres lacks ------------------------
say('');
say('=== 0. the two Supabase-provided pieces, created before the schema ===');
psql(`
  create schema auth;
  -- STAND-IN. Only what our code touches. NOTE: no unique constraint on email,
  -- deliberately -- see the header.
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb
  );
  create or replace function auth.uid() returns uuid as $$ select null::uuid $$ language sql stable;
`, { tuplesOnly: false });
say('  auth.users stand-in : id, email, raw_user_meta_data — NO unique on email');
say('  auth.uid() stub     : returns null, so the RLS policies compile');
say('');

// ---- replay the real migration verbatim ------------------------------------
say('=== 1. replay supabase/migrations/001_initial_schema.sql VERBATIM ===');
const schema = readFileSync(resolvePath(ROOT, 'supabase/migrations/001_initial_schema.sql'), 'utf8');
execFileSync('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', 'kftest', '-v', 'ON_ERROR_STOP=1'],
  { input: schema, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
say('  replayed, no errors');
const emailCon = psql(`select conname || ' ' || pg_get_constraintdef(oid) from pg_constraint
                       where conrelid='public.profiles'::regclass and contype='u';`);
say('  profiles unique constraint: ' + emailCon);
say('');

// ---- what fires on this path ------------------------------------------------
say('=== 2. everything that fires on an auth.users INSERT ===');
const trigs = psql(`select tgname || '  ' || case tgtype::int & 2 when 2 then 'BEFORE' else 'AFTER' end
                    || '  -> ' || p.proname
                    from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                    where tgrelid='auth.users'::regclass and not tgisinternal;`);
say('  triggers on auth.users : ' + (trigs || '(none)'));
check('exactly one non-internal trigger', trigs.split('\n').filter(Boolean).length, 1);
const evt = psql(`select count(*) from pg_event_trigger;`);
say('  event triggers          : ' + evt + '  (DDL only; they never fire on DML)');
say('');

// ---- first user: the happy path ---------------------------------------------
say('=== 3. FIRST user signs up with a password (the happy path) ===');
psql(`insert into auth.users (id, email, raw_user_meta_data)
      values ('11111111-1111-4111-8111-111111111111', 'dupe-test@example.com', '{"full_name":"First User"}'::jsonb);`,
     { tuplesOnly: false });
check('auth.users rows', Number(psql(`select count(*) from auth.users;`)), 1);
check('profiles rows (trigger fired)', Number(psql(`select count(*) from public.profiles;`)), 1);
say('  profile: ' + psql(`select id || ' | ' || email || ' | ' || coalesce(full_name,'') from public.profiles;`));
say('');

// ---- second user, SAME email: the question ----------------------------------
say('=== 4. SECOND auth.users row, DIFFERENT id, SAME email ===');
say('    (this is what an OAuth sign-in produces IF Supabase creates rather than links)');
const r = psqlExpectFail(`insert into auth.users (id, email, raw_user_meta_data)
      values ('22222222-2222-4222-8222-222222222222', 'dupe-test@example.com', '{"full_name":"Google User"}'::jsonb);`);
say('');
check('the INSERT failed', r.failed, true);
if (r.failed) {
  const lines = String(r.stderr).split('\n').map((s) => s.trim()).filter((s) => /ERROR|DETAIL|CONTEXT|SQLSTATE/i.test(s));
  say('  psql reported, verbatim:');
  for (const l of lines) say('    ' + l);
  const sqlstate = /23505/.test(r.stderr) ? '23505' : '(not 23505)';
  check('SQLSTATE is 23505 unique_violation', sqlstate, '23505');
  check('names the profiles email constraint', /profiles_email_key/.test(r.stderr), true);
  check('raised from inside handle_new_user', /handle_new_user/.test(r.stderr), true);
}
say('');

// ---- THE question: did the auth.users row survive? --------------------------
say('=== 5. DID THE auth.users INSERT SURVIVE, OR WAS IT ROLLED BACK? ===');
const usersAfter = Number(psql(`select count(*) from auth.users;`));
const profilesAfter = Number(psql(`select count(*) from public.profiles;`));
say('  auth.users rows now : ' + usersAfter);
say('  profiles rows now   : ' + profilesAfter);
check('auth.users still holds ONLY the first user', usersAfter, 1);
check('the second user does NOT exist', Number(psql(`select count(*) from auth.users where id='22222222-2222-4222-8222-222222222222';`)), 0);
say('  => the AFTER INSERT trigger raising ABORTS THE WHOLE STATEMENT.');
say('     Not "the profiles insert failed and the user was created anyway".');
say('     NO USER IS CREATED AT ALL.');
say('');

// ---- and inside an explicit transaction with earlier work --------------------
say('=== 6. inside an explicit transaction, does it abort work done BEFORE it? ===');
const tx = psqlExpectFail(`
  begin;
    create table public.marker_probe (n int);
    insert into public.marker_probe values (1);
    insert into auth.users (id, email, raw_user_meta_data)
      values ('33333333-3333-4333-8333-333333333333', 'dupe-test@example.com', '{}'::jsonb);
  commit;`);
check('the transaction failed', tx.failed, true);
const markerExists = psql(`select count(*) from information_schema.tables
                           where table_schema='public' and table_name='marker_probe';`);
check('work done earlier in the SAME transaction is also lost', Number(markerExists), 0);
say('  => the exception aborts the ENTIRE transaction, not just the failing');
say('     statement. Anything the caller did in the same transaction is lost.');
say('');

// ---- the shape of the fix, stated but NOT written ---------------------------
say('=== 7. does an ON CONFLICT clause change the outcome? (probe only) ===');
say('    Proving the SHAPE of a fix. NO migration is written by this script.');
psql(`create or replace function public.handle_new_user_probe() returns trigger as $$
      begin
        insert into public.profiles (id, email, full_name)
        values (new.id, new.email, new.raw_user_meta_data->>'full_name')
        on conflict (email) do nothing;
        return new;
      end; $$ language plpgsql security definer;
      create trigger probe_trigger after insert on auth.users
        for each row execute procedure public.handle_new_user_probe();
      alter table auth.users disable trigger on_auth_user_created;`, { tuplesOnly: false });
const probe = psqlExpectFail(`insert into auth.users (id, email, raw_user_meta_data)
      values ('44444444-4444-4444-8444-444444444444', 'dupe-test@example.com', '{}'::jsonb);`);
check('with ON CONFLICT DO NOTHING the insert SUCCEEDS', probe.failed, false);
check('auth.users now holds the second user', Number(psql(`select count(*) from auth.users;`)), 2);
check('profiles still holds ONE row (no duplicate profile)', Number(psql(`select count(*) from public.profiles;`)), 1);
say('  => the user is created, and is left WITHOUT a profile row of their own.');
say('     That is a DIFFERENT problem, not a fix. Stated, not adopted.');
say('');

say('======================== SUMMARY ========================');
if (failures.length === 0) say('ALL CHECKS PASSED.');
else { say(`FAILURES (${failures.length}):`); for (const f of failures) say('  ! ' + f); process.exit(21); }
