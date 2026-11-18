/**
 * Executable proof for the storage insert lockdown, stage 2 (SQL):
 * supabase/migrations/20261118_storage_insert_lockdown.sql, against Supabase's
 * own postgres image AND the real Storage API (supabase/storage-api, which
 * creates the `storage` schema with its own migrations: the bare postgres
 * image has an empty one, which is why public-grants skips 002_storage.sql).
 * Every upload goes through the Storage API over HTTP with a JWT, exactly as
 * a client's would, so the policies, the bucket limit and the API's own
 * checks are all exercised. No production contact.
 *
 * WHAT IS ASSERTED.
 *   BEFORE (002_storage.sql only), the hole, recorded: a student stores an
 *   object anywhere under their prefix, of 30 MiB, and cannot delete it.
 *   AFTER (the migration, applied TWICE as `postgres`, the SQL editor's role):
 *     1. a student upload outside page-photos is refused: a material's key
 *        {uid}/{kb}/{doc}/{name}, the hole's key, another student's
 *        page-photos, a malformed batch id, a dot or nested name, anon;
 *     2. inside {own uid}/page-photos/{uuid}/{name} it is allowed, as the
 *        route's names are (1.jpg, page-01.png, a name with no extension);
 *     3. the 101st page-photos object of one student is refused, another
 *        student is not affected;
 *     4. the service role is unaffected: a material's key, past the cap;
 *     5. the bucket limit: 25 MiB exactly is stored, 25 MiB + 1 is refused,
 *        for the service role too;
 *     6. SELECT unchanged: a student reads their own photo, not another's,
 *        and still cannot delete;
 *     7. the VERIFY query in the migration's footer answers exactly its
 *        three expected rows.
 *
 * Requires Docker (or KF_CONTAINER_CLI, e.g. "wsl.exe -d Ubuntu -u root -- podman"
 * locally). Port 3996 (3997 public-grants, 3998 #126, 3999 #125).
 * Usage: node --experimental-strip-types scripts/verify-storage-lockdown.mjs
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePinned, pullPinned, SOURCES } from './lib/pinned-image.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const PG = 'kf-storage-verify-pg';
const API = 'kf-storage-verify-api';
const NET = 'kf-storage-verify-net';
const PORT = 3996;
// KF_STORAGE_HOST: where the published port is reached (a WSL address locally when
// localhost forwarding is off); localhost in CI.
const BASE = `http://${process.env.KF_STORAGE_HOST || 'localhost'}:${PORT}`;

// The SAME postgres digest as the other Docker-backed checks.
const PG_IMAGE = 'supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453';
// supabase/storage-api v1.89.5 (2026-11-03).
const API_IMAGE = 'supabase/storage-api@sha256:da55932616c45804ab100023c3284cf504901d89df7dd3296d6b2d5dd7fd4166';

const CLI = (process.env.KF_CONTAINER_CLI || 'docker').split(' ').filter(Boolean);
const run = (args, opts = {}) => execFileSync(CLI[0], [...CLI.slice(1), ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
const quiet = (args) => { try { return run(args); } catch { return ''; } };
function image(ref) {
  if (CLI[0] === 'docker' && CLI.length === 1) return pullPinned(ref);
  const { repo, digest } = parsePinned(ref);
  const full = `${SOURCES[repo][0]}@${digest}`;
  if (spawnSync(CLI[0], [...CLI.slice(1), 'image', 'exists', full]).status !== 0) run(['pull', '--quiet', full], { timeout: 900_000 });
  return full;
}
const psqlAs = (user, sql) => run(['exec', '-i', PG, 'psql', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], { input: sql });

function teardown() {
  quiet(['rm', '-f', PG, API]);
  quiet(['network', 'rm', NET]);
}
process.on('exit', teardown);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(label, probe, seconds = 180) {
  for (let i = 0; i < seconds; i++) {
    if (await probe()) return;
    await sleep(1000);
  }
  throw new Error(`${label} did not become ready within ${seconds}s`);
}
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

// --- the stack ----------------------------------------------------------------------
teardown();
console.log('starting throwaway supabase/postgres + supabase/storage-api…');
run(['network', 'create', NET]);
const PG_RUN = image(PG_IMAGE);
const API_RUN = image(API_IMAGE);
run(['run', '-d', '--name', PG, '--network', NET, '-e', 'POSTGRES_PASSWORD=postgres', PG_RUN]);
const pgLogs = () => { const r = spawnSync(CLI[0], [...CLI.slice(1), 'logs', PG], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); };
await waitFor('postgres', async () => pgLogs().includes('init process complete') &&
  spawnSync(CLI[0], [...CLI.slice(1), 'exec', PG, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-q']).status === 0);
console.log(`postgres ready (${since()})`);
psqlAs('supabase_admin', `alter role supabase_storage_admin password 'testpw';`);

const JWT_SECRET = randomBytes(32).toString('hex'); // never printed, never stored
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(role, sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = b64(sub ? { role, aud: 'authenticated', sub, exp } : { role, exp });
  return `${head}.${body}.${createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
const ANON = jwt('anon');
const SERVICE = jwt('service_role');
run(['run', '-d', '--name', API, '--network', NET, '-p', `${PORT}:5000`,
  '-e', `AUTH_JWT_SECRET=${JWT_SECRET}`, '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`, '-e', 'AUTH_JWT_ALGORITHM=HS256',
  '-e', `ANON_KEY=${ANON}`, '-e', `SERVICE_KEY=${SERVICE}`,
  '-e', `DATABASE_URL=postgres://supabase_storage_admin:testpw@${PG}:5432/postgres`,
  '-e', 'POSTGREST_URL=http://unused.invalid:3000',
  // Hosted Supabase's global limit on the free plan; the bucket limit is what is tested.
  '-e', 'FILE_SIZE_LIMIT=52428800',
  '-e', 'STORAGE_BACKEND=file', '-e', 'FILE_STORAGE_BACKEND_PATH=/tmp/storage',
  '-e', 'TENANT_ID=stub', '-e', 'REGION=stub', '-e', 'GLOBAL_S3_BUCKET=stub',
  '-e', 'ENABLE_IMAGE_TRANSFORMATION=false', API_RUN]);
await waitFor('storage-api', async () => {
  try { return (await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(3000) })).status === 200; } catch { return false; }
});
console.log(`storage-api ready, its migrations applied (${since()})`);

// Two students, as GoTrue would have them.
const A = randomUUID();
const B = randomUUID();
psqlAs('supabase_admin', `insert into auth.users (id, aud, role, email) values ('${A}', 'authenticated', 'authenticated', 'a@verify.invalid'), ('${B}', 'authenticated', 'authenticated', 'b@verify.invalid');`);
const TA = jwt('authenticated', A);
const TB = jwt('authenticated', B);

// The bucket and policies production has: 002_storage.sql, as the SQL editor (postgres) runs it.
psqlAs('postgres', readFileSync(resolvePath(ROOT, 'supabase/migrations/002_storage.sql'), 'utf8'));

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1; else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}
async function put(token, key, bytes, contentType = 'image/jpeg') {
  const r = await fetch(`${BASE}/object/documents/${key}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': contentType, 'x-upsert': 'false' },
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}
// An upload the API refuses part-way (over the size limit) is sent from INSIDE
// the API's container: it answers before reading the whole body, and a port
// relay in front of it (Docker Desktop, WSL) can hold that answer back.
function putInside(token, key, size, contentType = 'application/pdf') {
  const js = `const b = Buffer.alloc(${size}, 1); fetch('http://127.0.0.1:5000/object/documents/${key}', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.T, 'content-type': '${contentType}', 'x-upsert': 'false' }, body: b, signal: AbortSignal.timeout(120000) }).then(async (r) => console.log(JSON.stringify({ status: r.status, body: (await r.text()).slice(0, 200) })), (e) => console.log(JSON.stringify({ status: 0, body: String(e.cause?.code || e.message) })));`;
  const out = run(['exec', '-e', `T=${token}`, API, 'node', '-e', js], { timeout: 180_000 });
  return JSON.parse(out.trim().split('\n').pop());
}
async function get(token, key) {
  const r = await fetch(`${BASE}/object/authenticated/documents/${key}`, { headers: { authorization: `Bearer ${token}` } });
  return r.status;
}
async function del(token, key) {
  const r = await fetch(`${BASE}/object/documents`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) });
  return { status: r.status, body: await r.text() };
}
const stored = (key) => psqlAs('postgres', `select count(*) from storage.objects where bucket_id = 'documents' and name = '${key.replace(/'/g, "''")}';`).trim() === '1';
const tiny = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const MiB = 1024 * 1024;
const ok = (r) => r.status === 200;

// --- BEFORE: the hole ------------------------------------------------------------------
console.log('\nBEFORE (002_storage.sql only): the hole');
{
  const k = `${A}/anything/at/all/blob.bin`;
  const r = await put(TA, k, Buffer.alloc(30 * MiB, 7), 'application/octet-stream');
  check('a student stores a 30 MiB object at any key under their prefix', ok(r) && stored(k), JSON.stringify(r));
  const d = await del(TA, k);
  check('...and cannot delete it (no delete policy)', stored(k), JSON.stringify(d));
  const m = await put(TA, `${A}/${randomUUID()}/${randomUUID()}/notes.pdf`, tiny, 'application/pdf');
  check('a student stores at a material\'s key (what the routes did with the session)', ok(m), JSON.stringify(m));
}

// --- the migration, twice -----------------------------------------------------------------
const MIGRATION = readFileSync(resolvePath(ROOT, 'supabase/migrations/20261118_storage_insert_lockdown.sql'), 'utf8');
// KF_LOCKDOWN_PLANT=skip leaves the migration out: the AFTER checks must then fail.
if (process.env.KF_LOCKDOWN_PLANT !== 'skip') {
  psqlAs('postgres', MIGRATION);
  psqlAs('postgres', MIGRATION);
}
console.log(`\nmigration applied twice as postgres (${since()})`);

console.log('AFTER');
const batch = randomUUID();
const photo = (uid, name, b = batch) => `${uid}/page-photos/${b}/${name}`;
// 1. outside page-photos
const refused = [
  ['a material\'s key {uid}/{kb}/{doc}/{name}', TA, `${A}/${randomUUID()}/${randomUUID()}/notes.pdf`],
  ['the hole\'s key (any path under the prefix)', TA, `${A}/anything/x.bin`],
  ['another student\'s page-photos', TA, photo(B, '1.jpg')],
  ['a batch id that is not a UUID', TA, `${A}/page-photos/not-a-uuid/1.jpg`],
  ['an upper-case batch id', TA, `${A}/page-photos/${batch.toUpperCase()}/1.jpg`],
  ['a name starting with a dot', TA, photo(A, '.hidden')],
  ['a nested name', TA, photo(A, 'a/1.jpg')],
  ['an extension over 8 characters', TA, photo(A, '1.jpegjpegj')],
  ['a name over 64 characters before the extension', TA, photo(A, 'a'.repeat(65) + '.jpg')],
  ['page-photos directly, no batch', TA, `${A}/page-photos/1.jpg`],
  ['anon, a well-formed key', ANON, photo(A, '9.jpg')],
];
console.log('1. a student upload outside {own uid}/page-photos/{uuid}/{name} is refused');
for (const [label, token, key] of refused) {
  const r = await put(token, key, tiny);
  check(`${label}: refused, nothing stored`, !ok(r) && !stored(key), `${r.status} ${r.body}`);
}
console.log('2. inside it is allowed');
for (const name of ['1.jpg', 'page-01.png', 'scan_2', 'A9.jpeg']) {
  const r = await put(TA, photo(A, name), tiny);
  check(`${name}: stored`, ok(r) && stored(photo(A, name)), `${r.status} ${r.body}`);
}
console.log('3. at most 100 page-photos objects per student');
{
  // 4 stored above; 96 more reach exactly 100.
  let lastOk = true;
  for (let i = 0; i < 96 && lastOk; i++) lastOk = ok(await put(TA, photo(A, `p${i}.jpg`, randomUUID()), tiny));
  const count = psqlAs('postgres', `select count(*) from storage.objects where starts_with(name, '${A}/page-photos/');`).trim();
  check('the 100th is stored', lastOk && count === '100', `count ${count}`);
  const k101 = photo(A, '101.jpg', randomUUID());
  const r = await put(TA, k101, tiny);
  check('the 101st is refused, nothing stored', !ok(r) && !stored(k101), `${r.status} ${r.body}`);
  const rb = await put(TB, photo(B, '1.jpg'), tiny);
  check('another student is not affected by the first one\'s count', ok(rb), `${rb.status} ${rb.body}`);
}
console.log('4. the service role is unaffected');
{
  const km = `${A}/${randomUUID()}/${randomUUID()}/notes.pdf`;
  const r = await put(SERVICE, km, tiny, 'application/pdf');
  check('a material\'s key: stored', ok(r) && stored(km), `${r.status} ${r.body}`);
  const kp = photo(A, 'svc.jpg', randomUUID());
  const rp = await put(SERVICE, kp, tiny);
  check('page-photos past the student\'s cap: stored', ok(rp) && stored(kp), `${rp.status} ${rp.body}`);
}
console.log('5. the bucket limit, 25 MiB');
{
  const k1 = `${A}/${randomUUID()}/${randomUUID()}/exact.pdf`;
  const r1 = putInside(SERVICE, k1, 25 * MiB);
  check('25 MiB exactly, service role: stored', ok(r1) && stored(k1), `${r1.status} ${r1.body}`);
  const k2 = `${A}/${randomUUID()}/${randomUUID()}/over.pdf`;
  const r2 = putInside(SERVICE, k2, 25 * MiB + 1);
  check('25 MiB + 1, service role: refused, nothing stored', !ok(r2) && !stored(k2), `${r2.status} ${r2.body}`);
  const k3 = photo(B, 'big.jpg', randomUUID());
  const r3 = putInside(TB, k3, 25 * MiB + 1, 'image/jpeg');
  check('25 MiB + 1, a student\'s photo: refused, nothing stored', !ok(r3) && !stored(k3), `${r3.status} ${r3.body}`);
}
console.log('6. SELECT unchanged, still no delete');
{
  check('a student reads their own photo', (await get(TA, photo(A, '1.jpg'))) === 200);
  check('a student does not read another student\'s photo', (await get(TB, photo(A, '1.jpg'))) !== 200);
  await del(TA, photo(A, '1.jpg'));
  check('a student still cannot delete their own photo', stored(photo(A, '1.jpg')));
}
console.log('7. the VERIFY query');
{
  // The query only: from its `-- select` line to its `-- order by` line.
  const footer = MIGRATION.replace(/\r\n/g, '\n').split('-- VERIFY')[1].split('\n');
  const from = footer.findIndex((l) => l.startsWith('-- select'));
  const to = footer.findIndex((l) => l.startsWith('-- order by'));
  const verify = footer.slice(from, to + 1).map((l) => l.slice(3)).join('\n');
  const got = psqlAs('postgres', verify + ';').trim().split('\n').map((l) => l.trim());
  const expected = [
    'bucket|documents | public=false | limit=26214400 | mime=null',
    'policy|Students upload camera photos only | INSERT | {authenticated}',
    'policy|Users can read own files | SELECT | {public}',
  ];
  console.log(got.map((l) => '    ' + l).join('\n'));
  check('exactly the three expected rows', JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
}

console.log(`\n${pass} passed, ${failures.length} failed (${since()})`);
if (failures.length) process.exit(1);
