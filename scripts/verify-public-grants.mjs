/**
 * Executable proof for register #137 (PR A): the write grants of schema
 * `public` are exactly the intended ones, table by table, role by role, and
 * every path the application really uses still works under them. Against
 * Supabase's own postgres image and every migration in this repository, with
 * no production contact.
 *
 * WHAT IS ASSERTED.
 *   1. THE MATRIX. For each of the 13 tables and each API role (`anon`,
 *      `authenticated`, `service_role`), which of SELECT, INSERT, UPDATE,
 *      DELETE the role holds, read with `has_table_privilege` by the SAME
 *      statement the production read uses (`scripts/sql/read-public-grants.sql`,
 *      section `2.privs`), compared line for line with the matrix declared
 *      below. A migration that creates a table and forgets its REVOKE, or a
 *      REVOKE that over-reaches, both go red here.
 *   2. THE POLICY SET. The exact policy names per table (section `3.policies`):
 *      the open `Anyone can join waitlist` is gone and none of the five
 *      hand-made duplicates production carried exists.
 *   3. REFUSALS, THROUGH PostgREST. Every write PR A forbids is attempted as
 *      the role PostgREST would use and must answer 42501 (`permission denied`)
 *      with the table byte-identical: a signed-in student on `waitlist`,
 *      `usage_counters`, `study_events`; `anon` on every table, every verb.
 *      The row-security-only shape (UPDATE/DELETE "no error, 0 rows") is a
 *      failure: it would mean the privilege is back.
 *   4. THE REAL WRITE PATHS. `increment_usage` and `record_study_event`, the
 *      SECURITY DEFINER functions `src/lib/rate-limit.ts` and
 *      `src/lib/study-events.ts` call by `.rpc(...)`, still write for the
 *      signed-in student (and refuse `anon` with their own `not authenticated`,
 *      not with 42501), and the student still reads the rows back. Every verb
 *      `authenticated` KEEPS on the other tables is exercised once as the
 *      student (the inserts, updates and deletes the routes and the ingestion
 *      service perform) and must succeed.
 *
 * The container pattern, the digest, the GoTrue `auth.uid()` substitution and
 * the JWT minting are those of scripts/verify-subscriptions-rls.mjs (register
 * #126), which explains each. Port 3997 (3998 is #126's, 3999 is #125's).
 *
 * Requires Docker. Usage:
 *   node --experimental-strip-types scripts/verify-public-grants.mjs
 */
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pullPinned } from './lib/pinned-image.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-grants-verify-pg';
const PREST = 'kf-grants-verify-prest';
const NET = 'kf-grants-verify-net';
const PORT = 3997;

// The SAME digests as scripts/gen-db-types.sh and verify-subscriptions-rls.mjs.
const PG_IMAGE = 'supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453';
const PREST_IMAGE = 'postgrest/postgrest:v16.4@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df';

// Verbatim from supabase/auth migrations/20220224000811_update_auth_functions.up.sql
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

// --- THE INTENDED WRITERS MATRIX ---------------------------------------------
// One letter per privilege held: r = SELECT, a = INSERT, w = UPDATE, d = DELETE
// (the relacl letters). This is the register's declared state of the grants
// after PR A (docs/db-grants-audit-137.md §2 and §6). PR B narrows
// `authenticated` on six tables; PR C narrows `profiles`. Each must edit this
// table in the same PR, which is the point: a grant moves nowhere unnoticed.
const INTENDED = {
  account_deletion_orphans: { anon: '',     authenticated: '',     service_role: 'rawd' }, // 20260904
  chunks:                   { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  conversations:            { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  documents:                { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  knowledge_bases:          { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  messages:                 { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  profiles:                 { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  quiz_items:               { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  quizzes:                  { anon: 'r',    authenticated: 'rawd', service_role: 'rawd' },
  study_events:             { anon: 'r',    authenticated: 'r',    service_role: 'rawd' }, // PR A
  subscriptions:            { anon: 'r',    authenticated: 'r',    service_role: 'rawd' }, // 20261004
  usage_counters:           { anon: 'r',    authenticated: 'r',    service_role: 'rawd' }, // PR A
  waitlist:                 { anon: 'r',    authenticated: 'r',    service_role: 'rawd' }, // PR A
};
const VERBS = [['SELECT', 'r'], ['INSERT', 'a'], ['UPDATE', 'w'], ['DELETE', 'd']];
const ROLES = ['anon', 'authenticated', 'service_role'];

// The policy names each table must carry, exactly (the migrations' own).
const POLICIES = {
  account_deletion_orphans: [],
  chunks: ['Users can delete own chunks', 'Users can insert own chunks', 'Users can read own chunks'],
  conversations: ['Users can manage own conversations'],
  documents: ['Users can manage own documents'],
  knowledge_bases: ['Users can manage own KBs'],
  messages: ['Users can manage own messages'],
  profiles: ['Users can manage own profile'],
  quiz_items: ['Users can manage own quiz_items'],
  quizzes: ['Users can manage own quizzes'],
  study_events: ['Users can read own study events'],
  subscriptions: ['Users can view own subscription'],
  usage_counters: ['Users can read own usage'],
  waitlist: [],
};
// The six PR A drops; production carried all six, the repository only the first.
const DROPPED = ['Anyone can join waitlist', 'Users own profile', 'Users own KBs', 'Users own documents', 'Users own conversations', 'Users own messages'];

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
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

// --- stand up an isolated stack -------------------------------------------
teardown();
console.log('starting throwaway supabase/postgres + postgrest…');
run('docker', ['network', 'create', NET]);
// The pinned images, fetched by digest from the first registry that answers
// (scripts/lib/pinned-image.mjs): Docker Hub alone failed every Docker-backed
// check three times on 2026-10-09. The digests above stay the contract.
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

if (!admin(`select pg_get_functiondef('auth.uid()'::regprocedure);`).includes('request.jwt.claims')) {
  console.log("auth.uid() on this image reads only request.jwt.claim.sub; installing GoTrue's 20220224000811 body");
  admin(GOTRUE_AUTH_UID);
}
admin(`alter role authenticator password 'testpw';`);

// --- PostgREST with a run-only JWT secret --------------------------------------
const JWT_SECRET = randomBytes(32).toString('hex'); // never printed, never stored
run('docker', ['run', '-d', '--name', PREST, '--network', NET, '-p', `${PORT}:3000`,
  '-e', `PGRST_DB_URI=postgres://authenticator:testpw@${PG}:5432/postgres`,
  '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
  '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`, PREST_RUN]);
await waitFor('postgrest', async () => {
  try {
    return (await fetch(`http://localhost:${PORT}/profiles?select=id`)).status === 200;
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

let pass = 0;
const failures = [];
function check(name, ok, detail = '', always = false) {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${detail && (always || !ok) ? `\n        ${detail}` : ''}`);
}

// --- the expected side of the production read, and the matrix -------------------
const READ_SQL = readFileSync(resolvePath(ROOT, 'scripts/sql/read-public-grants.sql'), 'utf8');
const readOut = psqlAs('postgres', READ_SQL);
// -qtA prints `section|value`, the value carrying its own newlines. Split on the
// section markers, which are the only lines of the form `<digits>.<word>|`.
const sections = {};
let cur = null;
for (const line of readOut.split('\n')) {
  const m = line.match(/^(\d+\.\w+)\|(.*)$/);
  if (m) {
    cur = m[1];
    sections[cur] = m[2] ? [m[2]] : [];
  } else if (cur !== null && line !== '') {
    sections[cur].push(line);
  }
}
console.log('');
console.log('scripts/sql/read-public-grants.sql on the fixture (the expected side of the production read):');
for (const [s, lines] of Object.entries(sections)) {
  console.log(`  ${s}`);
  for (const l of lines) console.log('    ' + l);
}

console.log('');
console.log('1. the grants matrix (section 2.privs against the declared INTENDED table):');
const privs = sections['2.privs'] ?? [];
const tables = Object.keys(INTENDED).sort();
const expectedPrivLines = [];
for (const t of tables) {
  for (const r of ROLES) {
    const held = INTENDED[t][r];
    expectedPrivLines.push(`${t} | ${r}: ${VERBS.map(([v, l]) => `${v}=${held.includes(l)}`).join(' ')}`);
  }
}
check(`the read lists exactly the ${tables.length} declared tables and nothing else`,
  JSON.stringify([...new Set(privs.map((l) => l.split(' | ')[0]))].sort()) === JSON.stringify(tables),
  `live: ${[...new Set(privs.map((l) => l.split(' | ')[0]))].sort().join(', ')}`);
for (const exp of expectedPrivLines) {
  const [head] = exp.split(': ');
  const got = privs.find((l) => l.startsWith(head + ': '));
  check(exp, got === exp, `read: ${got ?? '<missing>'}`);
}
check('no privs line is outside the declared matrix',
  privs.every((l) => expectedPrivLines.includes(l)), privs.filter((l) => !expectedPrivLines.includes(l)).join(' ; '));

console.log('');
console.log('2. the policy set per table (section 3.policies):');
const pol = (sections['3.policies'] ?? []).map((l) => l.split(' | ')).filter((p) => p.length >= 3);
for (const t of tables) {
  const names = pol.filter((p) => p[0] === t).map((p) => p[1]).sort();
  check(`${t}: policies = [${POLICIES[t].join(', ') || 'none'}]`,
    JSON.stringify(names) === JSON.stringify([...POLICIES[t]].sort()), `read: [${names.join(', ')}]`);
}
for (const d of DROPPED) {
  check(`no policy named "${d}" exists (PR A drops it)`, !pol.some((p) => p[1] === d));
}
check('every policy is PERMISSIVE and for roles=public', pol.every((p) => p[2].includes('permissive=PERMISSIVE roles=public')));

// --- fixture: one student, through the real signup trigger ----------------------------
const A = '0000000a-0000-4000-8000-000000000137';
admin(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'a@example.invalid', '{"full_name":"A"}');`);
check('the signup trigger (handle_new_user, definer) created A\'s profile', admin(`select count(*) from profiles where id = '${A}';`).trim() === '1');

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
const asA = clientFor(tokenFor(A));
const anon = clientFor(null);

const snapshot = (t) => admin(`select coalesce(md5(string_agg(x::text, ',' order by x::text)), 'empty') from public.${t} x;`).trim();
const snapshotAll = () => Object.fromEntries(tables.map((t) => [t, snapshot(t)]));
const sameAs = (before) => {
  const now = snapshotAll();
  return tables.filter((t) => now[t] !== before[t]);
};

async function refused(name, attempt) {
  const before = snapshotAll();
  const res = await attempt();
  const affected = Array.isArray(res.data) ? res.data.length : 0;
  const moved = sameAs(before);
  // 42501 is also the code of a row-security refusal ("new row violates
  // row-level security policy"); only the GRANT answers "permission denied for
  // table", and that wording is what PR A is for.
  const ok = moved.length === 0 && res.error !== null && res.error.code === '42501' && /permission denied for table/.test(res.error.message);
  check(name, ok,
    `postgrest: ${res.error ? `${res.error.code} ${res.error.message}` : `no error, ${affected} rows affected`} (expected 42501 permission denied for table); tables changed: ${moved.join(', ') || 'none'}`);
}
async function allowed(name, attempt, expect) {
  const res = await attempt();
  const ok = res.error === null && (expect ? expect(res.data) : true);
  check(name, ok, res.error ? `${res.error.code} ${res.error.message}` : `data: ${JSON.stringify(res.data).slice(0, 120)}`);
  return res.data;
}

// --- 3. refusals -------------------------------------------------------------------------
console.log('');
console.log('3. refusals through PostgREST (every one 42501, every table byte-identical):');
// INSERT probes send no RETURNING (supabase-js: `Prefer: return=minimal` when
// `.select()` is absent). With RETURNING, a table without a SELECT policy
// (waitlist) refuses the RETURNING under row security even where the INSERT
// itself would have landed, which would hide the open-INSERT hole PR A closes.
await refused('A INSERTs into waitlist', () => asA.from('waitlist').insert({ email: 'x@example.invalid' }));
await refused('A INSERTs their own usage_counters row', () => asA.from('usage_counters').insert({ user_id: A, query_count: 99 }));
await refused('A UPDATEs usage_counters', () => asA.from('usage_counters').update({ query_count: 0 }).eq('user_id', A).select());
await refused('A DELETEs usage_counters', () => asA.from('usage_counters').delete().eq('user_id', A).select());
await refused('A INSERTs their own study_events row (a forged study day)', () => asA.from('study_events').insert({ user_id: A, kind: 'quiz_submitted' }));
await refused('A UPDATEs study_events', () => asA.from('study_events').update({ kind: 'quiz_submitted' }).eq('user_id', A).select());
await refused('A DELETEs study_events', () => asA.from('study_events').delete().eq('user_id', A).select());
await refused('A INSERTs into account_deletion_orphans (20260904)', () => asA.from('account_deletion_orphans').insert({}));
await refused('A INSERTs into subscriptions (20261004)', () => asA.from('subscriptions').insert({ user_id: A, status: 'active' }));
const probeRow = {
  account_deletion_orphans: {}, chunks: { chunk_index: 0, content: 'x' }, conversations: { user_id: A }, documents: { filename: 'x' },
  knowledge_bases: { user_id: A, name: 'x' }, messages: { role: 'user', content: 'x' }, profiles: { id: A, email: 'x@example.invalid' },
  quiz_items: { question: 'x', options: ['a'], correct_index: 0, position: 0 }, quizzes: {}, study_events: { user_id: A, kind: 'quiz_submitted' },
  subscriptions: { user_id: A, status: 'active' }, usage_counters: { user_id: A }, waitlist: { email: 'anon@example.invalid' },
};
// PostgREST refuses an UPDATE or DELETE with no filter (21000) before Postgres
// sees it, so each probe filters on a column the table has; usage_counters is
// the one table without `id`. The value matches nothing; the grant, not the
// row, is what answers.
const NOBODY = '00000000-0000-4000-8000-000000000000';
const keyOf = (t) => (t === 'usage_counters' ? 'user_id' : 'id');
const probeSet = (t) => (t === 'quizzes' ? { model: 'x' } : t === 'account_deletion_orphans' ? { user_id: NOBODY } : probeRow[t]);
for (const t of tables) {
  await refused(`anon INSERTs into ${t}`, () => anon.from(t).insert(probeRow[t]));
  await refused(`anon UPDATEs ${t}`, () => anon.from(t).update(probeSet(t)).eq(keyOf(t), NOBODY).select());
  await refused(`anon DELETEs ${t}`, () => anon.from(t).delete().eq(keyOf(t), NOBODY).select());
}

// --- 4. the real write paths ---------------------------------------------------------------
console.log('');
console.log('4. the real write paths, as the signed-in student (the definer functions, and every verb authenticated keeps):');
// src/lib/rate-limit.ts:118 and src/lib/study-events.ts:72, the same .rpc calls.
let r = await asA.rpc('increment_usage', { p_kind: 'query' });
check('increment_usage(query) as A writes A\'s counter and returns 1', r.error === null && r.data === 1, r.error ? `${r.error.code} ${r.error.message}` : `returned ${r.data}`);
r = await asA.rpc('increment_usage', { p_kind: 'upload' });
check('increment_usage(upload) as A returns 1', r.error === null && r.data === 1, r.error ? `${r.error.code} ${r.error.message}` : `returned ${r.data}`);
r = await asA.rpc('increment_usage', { p_kind: 'query' });
check('increment_usage(query) again returns 2 (the on-conflict UPDATE path of the definer)', r.error === null && r.data === 2, r.error ? `${r.error.code} ${r.error.message}` : `returned ${r.data}`);
r = await asA.rpc('record_study_event', { p_kind: 'question_asked' });
check('record_study_event(question_asked) as A returns the new row id', r.error === null && /^[0-9a-f-]{36}$/.test(r.data ?? ''), r.error ? `${r.error.code} ${r.error.message}` : `returned ${r.data}`);
r = await asA.from('usage_counters').select('query_count, upload_count').eq('user_id', A);
check('A reads their own usage_counters row back (the dashboard\'s read): query 2, upload 1', r.error === null && r.data?.length === 1 && r.data[0].query_count === 2 && r.data[0].upload_count === 1, r.error ? r.error.message : JSON.stringify(r.data));
r = await asA.from('study_events').select('kind').eq('user_id', A);
check('A reads their one study event back (the streak\'s read)', r.error === null && r.data?.length === 1 && r.data[0].kind === 'question_asked', r.error ? r.error.message : JSON.stringify(r.data));
{
  const before = snapshotAll();
  r = await anon.rpc('increment_usage', { p_kind: 'query' });
  check("anon calls increment_usage: refused by the function's own guard ('not authenticated'), nothing written",
    r.error !== null && /not authenticated/.test(r.error.message) && sameAs(before).length === 0, r.error ? `${r.error.code} ${r.error.message}` : 'no error');
  r = await anon.rpc('record_study_event', { p_kind: 'question_asked' });
  check("anon calls record_study_event: refused by the function's own guard, nothing written",
    r.error !== null && /not authenticated/.test(r.error.message) && sameAs(before).length === 0, r.error ? `${r.error.code} ${r.error.message}` : 'no error');
}
r = await anon.from('usage_counters').select('user_id');
check('anon SELECT on usage_counters is 200 with [] (SELECT stays granted; the policy filters)', r.error === null && r.data.length === 0, r.error ? r.error.message : `${r.data.length} rows`);
r = await anon.from('waitlist').select('email');
check('anon SELECT on waitlist is 200 with [] (no SELECT policy; nothing readable)', r.error === null && r.data.length === 0, r.error ? r.error.message : `${r.data.length} rows`);

// Every verb `authenticated` keeps, once, in the order the routes use them.
const kb = await allowed('A INSERTs a knowledge_bases row (dashboard/knowledge/new)', () => asA.from('knowledge_bases').insert({ user_id: A, name: 'Subject' }).select('id').single(), (d) => !!d?.id);
const doc = await allowed('A INSERTs a documents row (/api/ingest)', () => asA.from('documents').insert({ kb_id: kb.id, filename: 'notes.txt' }).select('id').single(), (d) => !!d?.id);
await allowed('A UPDATEs the documents row (/api/ingest, /api/summarize, rename, the ingestion service)', () => asA.from('documents').update({ status: 'ready', embedding_status: 'ready' }).eq('id', doc.id).select('id'), (d) => d.length === 1);
await allowed('A INSERTs chunks (the ingestion service, forwarded JWT)', () => asA.from('chunks').insert([{ document_id: doc.id, kb_id: kb.id, chunk_index: 0, content: 'c0' }, { document_id: doc.id, kb_id: kb.id, chunk_index: 1, content: 'c1' }]).select('id'), (d) => d.length === 2);
await allowed('A DELETEs chunks (the ingestion service, before re-embedding)', () => asA.from('chunks').delete().eq('document_id', doc.id).select('id'), (d) => d.length === 2);
const conv = await allowed('A INSERTs a conversations row (/api/agent)', () => asA.from('conversations').insert({ kb_id: kb.id, user_id: A }).select('id').single(), (d) => !!d?.id);
await allowed('A INSERTs a messages row (/api/agent)', () => asA.from('messages').insert({ conversation_id: conv.id, role: 'user', content: 'q' }).select('id'), (d) => d.length === 1);
const quiz = await allowed('A INSERTs a quizzes row (/api/quiz/generate)', () => asA.from('quizzes').insert({ document_id: doc.id }).select('id').single(), (d) => !!d?.id);
await allowed('A INSERTs quiz_items (/api/quiz/generate)', () => asA.from('quiz_items').insert({ quiz_id: quiz.id, question: 'q', options: ['a', 'b'], correct_index: 0, position: 0 }).select('id'), (d) => d.length === 1);
await allowed('A DELETEs the quizzes row (/api/quiz/generate on a failed regeneration)', () => asA.from('quizzes').delete().eq('id', quiz.id).select('id'), (d) => d.length === 1);
await allowed('A DELETEs the documents row (material deletion, the session client)', () => asA.from('documents').delete().eq('id', doc.id).select('id'), (d) => d.length === 1);

const total = pass + failures.length;
console.log('');
console.log(`${pass} passed, ${failures.length} failed, ${total} total (${since()})`);
for (const f of failures) console.log('  ! ' + f);

teardown();
process.exit(failures.length === 0 ? 0 : 1);
