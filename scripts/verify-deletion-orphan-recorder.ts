/**
 * Seven-step proof that `recordDeletionOrphan` works against PRODUCTION, run
 * with `node --experimental-strip-types scripts/verify-deletion-orphan-recorder.ts`.
 *
 * WHY THIS IMPORTS THE REAL FUNCTION AND DOES NOT WRITE ITS OWN INSERT.
 * The store was already proven by the nine-row read-back in register #54. If
 * step 1 here were a hand-written INSERT, every step below would pass without
 * one line of `recordDeletionOrphan` ever executing, and the deliverable would
 * ship unexecuted while the register read green -- the composition register #54
 * was opened for. So the import is relative and extensioned, resolved by Node's
 * type-stripping against `src/`, and it is the SHIPPED FILE that runs here.
 *
 * WHY THE ANON STEPS USE THE ANON KEY. Steps 2, 3, 5 and the residue check go
 * through the same key the watcher will hold. Proving the boolean with the
 * service role would prove a path nothing in production will ever take.
 *
 * WHY STEP 3 SITS WHERE IT SITS. "anon reads nothing" is only meaningful WHILE
 * A ROW EXISTS. Run against an empty table it is vacuously true and proves the
 * RLS-plus-revoke pair not at all -- a green for the wrong reason, which is the
 * defect shape `05_anon_table_select` was added to the migration's verification
 * query to prevent. It must not be moved for convenience.
 *
 * WHY IT ENDS BY MEASURING THE TABLE EMPTY RATHER THAN BY DELETING A ROW.
 * If the delete fails or this process dies mid-run, a synthetic row with
 * `resolved_at is null` sits in production and `has_unresolved_deletion_orphan()`
 * returns true forever. The watcher's first run then fires on a fake, and the
 * team learns on day one that the alarm means nothing. AN ALARM TRAINED TO BE
 * IGNORED BEFORE IT HAS EVER BEEN RIGHT IS WORSE THAN NO ALARM, and it would be
 * self-inflicted by the test of the thing. So the last assertion is
 * `count(*) = 0` over the WHOLE table plus the boolean reading false -- not "we
 * deleted it", but "there is nothing there".
 *
 * STEP 0 IS A REFUSAL, NOT A SETUP. If the table is non-empty on entry, a real
 * orphan may be recorded and this harness must not write to, resolve, or delete
 * anything. It stops.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import {
  recordDeletionOrphan,
  ORPHAN_INSERT_TIMEOUT_MS,
} from '../src/lib/account-deletion/orphan-record.ts';

const SENTINEL_USER_ID = '00000000-0000-0000-0000-000000000000';
const SENTINEL_STAGE = 'synthetic-verification';
const TABLE = 'account_deletion_orphans';
const FN = 'has_unresolved_deletion_orphan';

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

type Row = { step: string; expect: string; observed: string; ok: boolean };
const rows: Row[] = [];
function check(step: string, expect: string, observed: string, ok: boolean) {
  rows.push({ step, expect, observed, ok });
}

/** Captures what the function logs, without discarding it. */
const logged: string[] = [];
const realError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  logged.push(args.map(String).join(' '));
};
function loggedRecordFailure(since: number): boolean {
  return logged.slice(since).some((l) => l.startsWith('[account-deletion-orphan-record-failed]'));
}

async function main() {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const admin = createClient(url, e.SUPABASE_SERVICE_ROLE_KEY);
  const anon = createClient(url, e.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // ---- 0. REFUSAL GATE ----------------------------------------------------
  const pre = await admin.from(TABLE).select('*', { count: 'exact', head: true });
  if (pre.error || pre.count !== 0) {
    realError(
      `ABORT (step 0): table is not empty on entry -- count=${pre.count} error=${pre.error?.message ?? 'none'}. ` +
        `A real orphan may be recorded. Nothing was written, resolved or deleted.`
    );
    process.exit(2);
  }
  check('0_preflight_empty', 'count=0', 'count=0', true);

  // ---- 1. THE REAL FUNCTION WRITES ----------------------------------------
  const before = logged.length;
  const returned = await recordDeletionOrphan(admin, {
    userId: SENTINEL_USER_ID,
    email: null,
    stage: SENTINEL_STAGE,
    subscriptionsCanceled: 0,
    reason: 'synthetic verification of the recorder; not a real incident',
  });
  check('1a_returns_void', 'undefined', String(returned), returned === undefined);
  check(
    '1b_no_failure_log',
    'no failure line',
    loggedRecordFailure(before) ? 'failure line' : 'no failure line',
    !loggedRecordFailure(before)
  );

  const found = await admin
    .from(TABLE)
    .select('id, user_id, email, stage, subscriptions_canceled, resolved_at');
  const got = found.data ?? [];
  check('1c_row_written', '1 row', `${got.length} row(s) error=${found.error?.message ?? 'none'}`, got.length === 1);
  if (got.length !== 1) throw new Error('step 1c failed; refusing to continue');
  const id = got[0].id as string;
  check(
    '1d_row_shape',
    `user_id=${SENTINEL_USER_ID} email=null stage=${SENTINEL_STAGE} resolved_at=null`,
    `user_id=${got[0].user_id} email=${got[0].email} stage=${got[0].stage} resolved_at=${got[0].resolved_at}`,
    got[0].user_id === SENTINEL_USER_ID &&
      got[0].email === null &&
      got[0].stage === SENTINEL_STAGE &&
      got[0].resolved_at === null
  );

  // ---- 2. THE SIGNAL FLIPS TRUE, READ WITH THE WATCHER'S KEY ---------------
  const t = await anon.rpc(FN);
  check('2_anon_boolean_true', 'true', `${t.data} error=${t.error?.message ?? 'none'}`, t.data === true);

  // ---- 3. ANON READS NOTHING -- WHILE THE ROW EXISTS -----------------------
  const leak = await anon.from(TABLE).select('id, email');
  check(
    '3_anon_reads_nothing',
    '0 rows',
    `${(leak.data ?? []).length} rows error=${leak.error?.message ?? 'none'}`,
    (leak.data ?? []).length === 0
  );

  // ---- 4. THE OPERATOR RESOLVES IT (AND NULLS THE EMAIL) ------------------
  const upd = await admin
    .from(TABLE)
    .update({ resolved_at: new Date().toISOString(), email: null, resolution_note: 'synthetic verification' })
    .eq('id', id)
    .select('id');
  check('4_resolved', '1 row updated', `${(upd.data ?? []).length} error=${upd.error?.message ?? 'none'}`, (upd.data ?? []).length === 1);

  // ---- 5. THE SIGNAL FLIPS BACK -------------------------------------------
  const f = await anon.rpc(FN);
  check('5_anon_boolean_false', 'false', `${f.data} error=${f.error?.message ?? 'none'}`, f.data === false);

  // ---- 6. REMOVE THE SYNTHETIC ROW ----------------------------------------
  const del = await admin.from(TABLE).delete({ count: 'exact' }).eq('id', id);
  check('6_deleted', '1 row deleted', `${del.count} error=${del.error?.message ?? 'none'}`, del.count === 1);

  // ---- 7. THE PATH THAT RUNS ON THE ONLY NIGHT IT MATTERS ------------------
  // 7a: PostgREST returns an error object. 7b: the fetch rejects. 7c: nothing
  // answers at all, and only the timeout ends it.
  const badKey = createClient(url, 'not-a-key');
  let n = logged.length;
  const r7a = await recordDeletionOrphan(badKey, {
    userId: SENTINEL_USER_ID, email: null, stage: SENTINEL_STAGE, subscriptionsCanceled: 0, reason: '7a',
  });
  check(
    '7a_returned_error',
    'undefined + failure line',
    `${String(r7a)} + ${loggedRecordFailure(n) ? 'failure line' : 'NO failure line'}`,
    r7a === undefined && loggedRecordFailure(n)
  );

  const refused = createClient('http://127.0.0.1:1', 'not-a-key');
  n = logged.length;
  const r7b = await recordDeletionOrphan(refused, {
    userId: SENTINEL_USER_ID, email: null, stage: SENTINEL_STAGE, subscriptionsCanceled: 0, reason: '7b',
  });
  check(
    '7b_thrown_rejection',
    'undefined + failure line',
    `${String(r7b)} + ${loggedRecordFailure(n) ? 'failure line' : 'NO failure line'}`,
    r7b === undefined && loggedRecordFailure(n)
  );

  const sockets: Socket[] = [];
  const silent = createServer(() => { /* accept, answer never */ });
  silent.on('connection', (s) => sockets.push(s));
  await new Promise<void>((res) => silent.listen(0, '127.0.0.1', () => res()));
  const port = (silent.address() as { port: number }).port;
  const wedged = createClient(`http://127.0.0.1:${port}`, 'not-a-key');
  n = logged.length;
  const t0 = Date.now();
  const r7c = await recordDeletionOrphan(wedged, {
    userId: SENTINEL_USER_ID, email: null, stage: SENTINEL_STAGE, subscriptionsCanceled: 0, reason: '7c',
  });
  const elapsed = Date.now() - t0;
  for (const s of sockets) s.destroy();
  silent.close();
  check(
    '7c_timeout_bounded',
    `undefined + failure line, elapsed ~${ORPHAN_INSERT_TIMEOUT_MS}ms`,
    `${String(r7c)} + ${loggedRecordFailure(n) ? 'failure line' : 'NO failure line'}, elapsed=${elapsed}ms`,
    r7c === undefined &&
      loggedRecordFailure(n) &&
      elapsed >= ORPHAN_INSERT_TIMEOUT_MS - 250 &&
      elapsed < ORPHAN_INSERT_TIMEOUT_MS + 2000
  );

  // ---- 8. THE TABLE IS MEASURED EMPTY, NOT ASSUMED EMPTY -------------------
  const post = await admin.from(TABLE).select('*', { count: 'exact', head: true });
  check('8a_table_empty', 'count=0', `count=${post.count} error=${post.error?.message ?? 'none'}`, post.count === 0);
  const fin = await anon.rpc(FN);
  check('8b_signal_clear', 'false', `${fin.data} error=${fin.error?.message ?? 'none'}`, fin.data === false);
}

main()
  .then(() => {
    console.error = realError;
    const w = [
      Math.max(4, ...rows.map((r) => r.step.length)),
      Math.max(6, ...rows.map((r) => r.expect.length)),
      Math.max(8, ...rows.map((r) => r.observed.length)),
    ];
    const line = (a: string, b: string, c: string, d: string) =>
      `${a.padEnd(w[0])} | ${b.padEnd(w[1])} | ${c.padEnd(w[2])} | ${d}`;
    console.log(line('step', 'expect', 'observed', 'ok'));
    for (const r of rows) console.log(line(r.step, r.expect, r.observed, String(r.ok)));
    console.log('');
    console.log('captured console.error lines from the function under test:');
    for (const l of logged) console.log(`  ${l}`);
    const bad = rows.filter((r) => !r.ok);
    console.log('');
    console.log(bad.length === 0 ? `ALL ${rows.length} CHECKS PASSED` : `FAILED: ${bad.map((r) => r.step).join(', ')}`);
    process.exit(bad.length === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error = realError;
    console.error('HARNESS ERROR:', err);
    console.error('rows so far:', JSON.stringify(rows, null, 2));
    process.exit(3);
  });
