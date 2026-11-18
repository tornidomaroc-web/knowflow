/**
 * Executable proof for the storage lockdown, stage 2 (SQL), FROM PRODUCTION'S
 * REAL STATE: supabase/migrations/20261118_storage_lockdown_production.sql
 * (which supersedes the never-applied 20261118_storage_insert_lockdown.sql),
 * against Supabase's own postgres image AND the real Storage API
 * (supabase/storage-api, which creates the `storage` schema with its own
 * migrations: the bare postgres image has an empty one, which is why
 * public-grants skips 002_storage.sql). Every upload and delete goes through
 * the Storage API over HTTP with a JWT, exactly as a client's would, so the
 * policies, the bucket limit and the API's own checks are all exercised. No
 * production contact.
 *
 * WHAT IS ASSERTED.
 *   PRODUCTION'S STATE: the bucket row, then the FIVE policies production has
 *   (the owner's read-only read, 2026-11-18), created from the migration's own
 *   PRODUCTION-BEFORE record: two from 002_storage.sql, three made by hand.
 *   BEFORE, the holes, recorded: a student stores 30 MiB at any key; deletes a
 *   material's stored file (policy 3); with policy 2 alone dropped (what the
 *   superseded file did) policy 5 still stores any key. The migration's VERIFY
 *   query answers its nine BEFORE rows.
 *   AFTER (the migration, applied TWICE as `postgres`, the SQL editor's role):
 *     0. both student INSERT policies, the hand-made DELETE and the duplicate
 *        SELECT are gone; the only write policies are the two camera ones;
 *     1. a student upload outside {own uid}/page-photos/{uuid}/{name} is
 *        refused (a material's key, the hole's key, another student's
 *        page-photos, malformed batch ids and names, anon);
 *     2. inside it is allowed, as the route's names are;
 *     3. the 101st page-photos object of one student is refused, another
 *        student is not affected;
 *     4. the service role is unaffected: stores and removes a material's key
 *        and a photo, past the cap;
 *     5. the bucket limit: 25 MiB exactly is stored, 25 MiB + 1 is refused,
 *        for the service role too;
 *     6. SELECT through "Users can read own files" alone: own photo and own
 *        material read, own batch listed (as /api/page-read does), another
 *        student's photo and anon refused;
 *     7. DELETE: a material's stored file and any own object outside
 *        page-photos refused, another student's photo and anon refused, own
 *        photo deleted, after which one more photo fits under the cap;
 *     8. the VERIFY query in the migration's footer answers exactly its seven
 *        AFTER rows.
 *   KF_LOCKDOWN_PLANT=skip (no migration) and KF_LOCKDOWN_PLANT=old (the
 *   superseded file instead) must both FAIL; CI runs both.
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

const MIGRATION_FILE = 'supabase/migrations/20261118_storage_lockdown_production.sql';
const SUPERSEDED_FILE = 'supabase/migrations/20261118_storage_insert_lockdown.sql';
const MIGRATION = readFileSync(resolvePath(ROOT, MIGRATION_FILE), 'utf8').replace(/\r\n/g, '\n');

let pass = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) pass += 1; else failures.push(name);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `\n        ${detail}` : ''}`);
}

// --- PRODUCTION'S STATE, as the owner read it on 2026-11-18 -------------------------------
// The bucket row of 002_storage.sql, then the five policies EXACTLY as the migration's
// PRODUCTION-BEFORE record lists them (two from 002_storage.sql, three made by hand), run
// as the SQL editor's role (postgres).
psqlAs('postgres', `insert into storage.buckets (id, name, public) values ('documents', 'documents', false);`);
const record = MIGRATION.split('-- PRODUCTION-BEFORE-BEGIN\n')[1].split('-- PRODUCTION-BEFORE-END')[0]
  .split('\n').map((l) => l.replace(/^-- ?/, '')).join('\n');
psqlAs('postgres', record);
const policies = () => psqlAs('postgres', `select policyname || '|' || cmd || '|' || roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;`).trim().split('\n').filter(Boolean);
console.log('\nPRODUCTION\'S STATE');
{
  const got = policies();
  const expected = [
    'Users can read own files|SELECT|{public}',
    'Users can upload to their own folder|INSERT|{public}',
    'Users delete own files|DELETE|{authenticated}',
    'Users read own files|SELECT|{authenticated}',
    'Users upload own files|INSERT|{authenticated}',
  ];
  check('the five production policies exist, with production\'s commands and roles', JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
  const bucket = psqlAs('postgres', `select public || '|' || coalesce(file_size_limit::text, 'null') || '|' || coalesce(array_to_string(allowed_mime_types, ','), 'null') from storage.buckets where id = 'documents';`).trim();
  check('the bucket as production has it: private, no size limit, no MIME list', bucket === 'false|null|null', bucket);
  const fd = psqlAs('postgres', `select pg_get_functiondef('storage.foldername(text)'::regprocedure);`);
  console.log('    storage.foldername, as this Storage API defines it:\n' + fd.trim().split('\n').map((l) => '      ' + l).join('\n'));
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
  const r = await fetch(`${BASE}/object/authenticated/documents/${key}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  return r.status;
}
async function del(token, key) {
  const r = await fetch(`${BASE}/object/documents`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }), signal: AbortSignal.timeout(30_000) });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}
const stored = (key) => psqlAs('postgres', `select count(*) from storage.objects where bucket_id = 'documents' and name = '${key.replace(/'/g, "''")}';`).trim() === '1';
const tiny = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const MiB = 1024 * 1024;
const ok = (r) => r.status === 200;
const material = (uid, name = 'notes.pdf') => `${uid}/${randomUUID()}/${randomUUID()}/${name}`;
// The service role stores a material's file, as the stage 1 code (live since 3d8da77) does.
async function serviceMaterial(uid) {
  const k = material(uid);
  const r = await put(SERVICE, k, tiny, 'application/pdf');
  if (!ok(r) || !stored(k)) throw new Error(`service upload failed: ${r.status} ${r.body}`);
  return k;
}

// The migration's VERIFY query, from its `-- select` line to its `-- order by` line.
function verifyRows() {
  const footer = MIGRATION.split('-- VERIFY')[1].split('\n');
  const from = footer.findIndex((l) => l.startsWith('-- select'));
  const to = footer.findIndex((l) => l.startsWith('-- order by'));
  const q = footer.slice(from, to + 1).map((l) => l.slice(3)).join('\n');
  return psqlAs('postgres', q + ';').trim().split('\n').map((l) => l.trim());
}

// --- BEFORE: production's holes ---------------------------------------------------------
console.log('\nBEFORE (production\'s five policies): the holes');
{
  const rows = verifyRows();
  console.log(rows.map((l) => '    ' + l).join('\n'));
  const expected = [
    '1|bucket|documents public=false limit=null mime=null',
    '2|rls|storage.objects enabled=true',
    '3|check|foldername first element implies the first segment: true',
    '4|policy|objects | Users can read own files | SELECT | {public} | PERMISSIVE',
    '5|policy|objects | Users can upload to their own folder | INSERT | {public} | PERMISSIVE',
    '6|policy|objects | Users delete own files | DELETE | {authenticated} | PERMISSIVE',
    '7|policy|objects | Users read own files | SELECT | {authenticated} | PERMISSIVE',
    '8|policy|objects | Users upload own files | INSERT | {authenticated} | PERMISSIVE',
    '99|count|policies on storage.objects and storage.buckets: 5',
  ];
  check('the VERIFY query on production\'s state answers its nine BEFORE rows', JSON.stringify(rows) === JSON.stringify(expected), JSON.stringify(rows));
  const k = `${A}/anything/at/all/blob.bin`;
  const r = await put(TA, k, Buffer.alloc(30 * MiB, 7), 'application/octet-stream');
  check('a student stores a 30 MiB object at any key under their prefix', ok(r) && stored(k), JSON.stringify(r));
  const m = await serviceMaterial(A);
  await del(TA, m);
  check('a student deletes a material\'s stored file (policy 3, "Users delete own files")', !stored(m));
  // Policy 5 alone (what the superseded migration would have left) still lets anything in.
  psqlAs('postgres', `drop policy "Users can upload to their own folder" on storage.objects;`);
  const k5 = `${A}/policy5/only.bin`;
  const r5 = await put(TA, k5, tiny, 'application/octet-stream');
  check('with policy 2 dropped, policy 5 alone still stores any key', ok(r5) && stored(k5), JSON.stringify(r5));
  psqlAs('postgres', record.match(/create policy "Users can upload to their own folder"[^;]*;/)[0]);
  check('...policy 2 put back: production\'s five again', policies().length === 5);
}

// --- the migration, twice -----------------------------------------------------------------
// KF_LOCKDOWN_PLANT=skip leaves it out; KF_LOCKDOWN_PLANT=old applies the SUPERSEDED file
// instead. The AFTER checks must then fail.
const plant = process.env.KF_LOCKDOWN_PLANT || '';
if (plant === 'old') {
  const old = readFileSync(resolvePath(ROOT, SUPERSEDED_FILE), 'utf8');
  psqlAs('postgres', old);
  psqlAs('postgres', old);
  console.log(`\nPLANT: the superseded migration applied twice instead (${since()})`);
} else if (plant === 'skip') {
  console.log(`\nPLANT: no migration (${since()})`);
} else {
  psqlAs('postgres', MIGRATION);
  psqlAs('postgres', MIGRATION);
  console.log(`\nmigration applied twice as postgres (${since()})`);
}

console.log('AFTER');
const batch = randomUUID();
const photo = (uid, name, b = batch) => `${uid}/page-photos/${b}/${name}`;
console.log('0. both student INSERT policies are gone, and the hand-made DELETE and SELECT');
{
  const names = policies().map((l) => l.split('|')[0]);
  for (const gone of ['Users can upload to their own folder', 'Users upload own files', 'Users delete own files', 'Users read own files']) {
    check(`"${gone}" is gone`, !names.includes(gone), JSON.stringify(names));
  }
  const writers = policies().filter((l) => /\|(INSERT|UPDATE|DELETE|ALL)\|/.test(l));
  check('the only student write policies: the camera INSERT and the camera DELETE', JSON.stringify(writers) === JSON.stringify(['Students delete own camera photos|DELETE|{authenticated}', 'Students upload camera photos only|INSERT|{authenticated}']), JSON.stringify(writers));
}
// 1. outside page-photos
const refused = [
  ['a material\'s key {uid}/{kb}/{doc}/{name}', TA, material(A)],
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
console.log('1. a student upload outside {own uid}/page-photos/{uuid}/{name} is refused (policies 2 and 5 both gone)');
for (const [label, token, key] of refused) {
  const r = await put(token, key, tiny);
  check(`${label}: refused, nothing stored`, !ok(r) && !stored(key), `${r.status} ${r.body}`);
}
console.log('2. inside it is allowed');
for (const name of ['1.jpg', 'page-01.png', 'scan_2', 'A9.jpeg']) {
  const r = await put(TA, photo(A, name), tiny);
  check(`${name}: stored`, ok(r) && stored(photo(A, name)), `${r.status} ${r.body}`);
}
const countA = () => psqlAs('postgres', `select count(*) from storage.objects where starts_with(name, '${A}/page-photos/');`).trim();
console.log('3. at most 100 page-photos objects per student');
{
  // 4 stored above; 96 more reach exactly 100.
  let lastOk = true;
  for (let i = 0; i < 96 && lastOk; i++) lastOk = ok(await put(TA, photo(A, `p${i}.jpg`, randomUUID()), tiny));
  const count = countA();
  check('the 100th is stored', lastOk && count === '100', `count ${count}`);
  const k101 = photo(A, '101.jpg', randomUUID());
  const r = await put(TA, k101, tiny);
  check('the 101st is refused, nothing stored', !ok(r) && !stored(k101), `${r.status} ${r.body}`);
  const rb = await put(TB, photo(B, '1.jpg'), tiny);
  check('another student is not affected by the first one\'s count', ok(rb), `${rb.status} ${rb.body}`);
}
console.log('4. the service role is unaffected');
{
  const km = material(A);
  const r = await put(SERVICE, km, tiny, 'application/pdf');
  check('a material\'s key: stored', ok(r) && stored(km), `${r.status} ${r.body}`);
  const kp = photo(A, 'svc.jpg', randomUUID());
  const rp = await put(SERVICE, kp, tiny);
  check('page-photos past the student\'s cap: stored', ok(rp) && stored(kp), `${rp.status} ${rp.body}`);
  const dr = await del(SERVICE, km);
  check('...and removes a material\'s file', ok(dr) && !stored(km), `${dr.status} ${dr.body}`);
  const dp = await del(SERVICE, kp);
  check('...and a photo', ok(dp) && !stored(kp), `${dp.status} ${dp.body}`);
}
console.log('5. the bucket limit, 25 MiB');
{
  const k1 = material(A, 'exact.pdf');
  const r1 = putInside(SERVICE, k1, 25 * MiB);
  check('25 MiB exactly, service role: stored', ok(r1) && stored(k1), `${r1.status} ${r1.body}`);
  const k2 = material(A, 'over.pdf');
  const r2 = putInside(SERVICE, k2, 25 * MiB + 1);
  check('25 MiB + 1, service role: refused, nothing stored', !ok(r2) && !stored(k2), `${r2.status} ${r2.body}`);
  const k3 = photo(B, 'big.jpg', randomUUID());
  const r3 = putInside(TB, k3, 25 * MiB + 1, 'image/jpeg');
  check('25 MiB + 1, a student\'s photo: refused, nothing stored', !ok(r3) && !stored(k3), `${r3.status} ${r3.body}`);
}
console.log('6. SELECT through policy 1 alone (4 dropped): what /api/page-read and the cap need');
{
  check('a student reads their own photo', (await get(TA, photo(A, '1.jpg'))) === 200);
  check('a student reads their own material file', (await get(TA, (await serviceMaterial(A)))) === 200);
  check('a student does not read another student\'s photo', (await get(TB, photo(A, '1.jpg'))) !== 200);
  check('anon reads nothing', (await get(ANON, photo(A, '1.jpg'))) !== 200);
  const lr = await fetch(`${BASE}/object/list/documents`, { method: 'POST', headers: { authorization: `Bearer ${TA}`, 'content-type': 'application/json' }, body: JSON.stringify({ prefix: `${A}/page-photos/${batch}/`, limit: 100 }), signal: AbortSignal.timeout(30_000) });
  const listed = lr.status === 200 ? (await lr.json()).map((o) => o.name).sort() : [];
  check('a student lists their own batch, as /api/page-read does (4 photos)', JSON.stringify(listed) === JSON.stringify(['1.jpg', 'A9.jpeg', 'page-01.png', 'scan_2']), `${lr.status} ${JSON.stringify(listed)}`);
}
console.log('7. DELETE only under {own uid}/page-photos/');
{
  const m = await serviceMaterial(A);
  const dm = await del(TA, m);
  check('a student\'s delete of a material\'s stored file: refused, the file stays', stored(m), `${dm.status} ${dm.body}`);
  const blob = `${A}/anything/at/all/blob.bin`;
  const dh = await del(TA, blob);
  check('...of their own object outside page-photos (the old hole\'s 30 MiB blob): refused', stored(blob), `${dh.status} ${dh.body}`);
  const dx = await del(TB, photo(A, '1.jpg'));
  check('another student\'s delete of a photo: refused, the photo stays', stored(photo(A, '1.jpg')), `${dx.status} ${dx.body}`);
  const da = await del(ANON, photo(A, '1.jpg'));
  check('anon\'s delete: refused', stored(photo(A, '1.jpg')), `${da.status} ${da.body}`);
  const d1 = await del(TA, photo(A, '1.jpg'));
  check('a student\'s delete of their own photo: gone', ok(d1) && !stored(photo(A, '1.jpg')), `${d1.status} ${d1.body}`);
  check('...the count drops to 99', countA() === '99', `count ${countA()}`);
  const again = photo(A, 'again.jpg', randomUUID());
  const ra = await put(TA, again, tiny);
  check('...so one more photo fits under the cap (100)', ok(ra) && stored(again) && countA() === '100', `${ra.status} ${ra.body}`);
  const k102 = photo(A, 'over.jpg', randomUUID());
  const rr = await put(TA, k102, tiny);
  check('...and the next is refused again', !ok(rr) && !stored(k102), `${rr.status} ${rr.body}`);
}
console.log('8. the VERIFY query');
{
  const got = verifyRows();
  const expected = [
    '1|bucket|documents public=false limit=26214400 mime=null',
    '2|rls|storage.objects enabled=true',
    '3|check|foldername first element implies the first segment: true',
    '4|policy|objects | Students delete own camera photos | DELETE | {authenticated} | PERMISSIVE',
    '5|policy|objects | Students upload camera photos only | INSERT | {authenticated} | PERMISSIVE',
    '6|policy|objects | Users can read own files | SELECT | {public} | PERMISSIVE',
    '99|count|policies on storage.objects and storage.buckets: 3',
  ];
  console.log(got.map((l) => '    ' + l).join('\n'));
  check('exactly the seven expected AFTER rows', JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
  const exprs = psqlAs('postgres', `select policyname || ' / using: ' || coalesce(qual, '-') || ' / check: ' || coalesce(with_check, '-') from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;`);
  console.log('    the policies\' expressions, as the server deparses them:\n' + exprs.trim().split('\n').map((l) => '      ' + l).join('\n'));
}

console.log(`\n${pass} passed, ${failures.length} failed (${since()})`);
if (failures.length) process.exit(1);
