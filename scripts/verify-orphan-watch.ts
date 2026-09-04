/**
 * Proof that the watcher's read-and-classify works against PRODUCTION, on all
 * three outcomes, run with `node scripts/verify-orphan-watch.ts`.
 *
 * WHY THIS IMPORTS BOTH SHIPPED MODULES. `readOrphanSignal` comes from
 * scripts/orphan-watch.ts and the sentinel row is written by the real
 * `recordDeletionOrphan`, not by a hand-written INSERT -- the same rule the
 * recorder's own harness follows. A proof that re-implements the thing under
 * test can pass while the thing under test never runs.
 *
 * WHAT IS PROVEN HERE AND WHAT IS NOT, STATED SO NOBODY HAS TO INFER IT.
 * Proven: the read, and the classification of every branch into state/action,
 * including the three ways production can be unreadable. NOT proven: that
 * `gh issue create` / `gh issue close` in the workflow actually succeed. That
 * step is YAML plus one gh call per branch and is verified by inspection. The
 * defect this whole file exists to prevent -- silence meaning two opposite
 * things -- lives entirely in the classification, which is why the
 * classification is what gets executed.
 *
 * THE HAPPY PATH IS NOT THE TEST. Steps 5 through 8 are the reason this file is
 * longer than three lines.
 *
 * STEP 0 IS A REFUSAL. A non-empty table on entry may hold a real orphan; this
 * harness then writes, resolves and deletes nothing, and stops.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { readOrphanSignal, WATCH_TIMEOUT_MS } from './orphan-watch.ts';
import { recordDeletionOrphan } from '../src/lib/account-deletion/orphan-record.ts';

const SENTINEL_USER_ID = '00000000-0000-0000-0000-000000000000';
const SENTINEL_STAGE = 'synthetic-verification';
const TABLE = 'account_deletion_orphans';

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
function shape(r: { state: string; action: string; reason: string }): string {
  return `state=${r.state} action=${r.action} reason=${r.reason.slice(0, 70)}`;
}

/** A server that answers exactly how the caller asks it to, or never. */
async function serve(handler: null | ((res: import('node:http').ServerResponse) => void)) {
  const sockets: Socket[] = [];
  const server = createServer((_req, res) => {
    if (handler) handler(res);
  });
  server.on('connection', (s) => sockets.push(s));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    stop() {
      for (const s of sockets) s.destroy();
      server.close();
    },
  };
}

async function main() {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, e.SUPABASE_SERVICE_ROLE_KEY);

  // ---- 0. REFUSAL GATE ----------------------------------------------------
  const pre = await admin.from(TABLE).select('*', { count: 'exact', head: true });
  if (pre.error || pre.count !== 0) {
    console.error(
      `ABORT (step 0): table is not empty on entry -- count=${pre.count} error=${pre.error?.message ?? 'none'}. ` +
        `A real orphan may be recorded. Nothing was written, resolved or deleted.`
    );
    process.exit(2);
  }
  check('0_preflight_empty', 'count=0', 'count=0', true);

  // ---- 1. CLEAR ------------------------------------------------------------
  const clear1 = await readOrphanSignal(url, anonKey);
  check('1_clear', 'state=clear action=close-orphan', shape(clear1), clear1.state === 'clear' && clear1.action === 'close-orphan');

  // ---- 2. PRESENT, VIA THE REAL RECORDER -----------------------------------
  await recordDeletionOrphan(admin, {
    userId: SENTINEL_USER_ID,
    email: null,
    stage: SENTINEL_STAGE,
    subscriptionsCanceled: 0,
    reason: 'synthetic verification of the watcher; not a real incident',
  });
  const present = await readOrphanSignal(url, anonKey);
  check('2_present', 'state=present action=open-orphan', shape(present), present.state === 'present' && present.action === 'open-orphan');

  // ---- 3. RESOLVE AND REMOVE ----------------------------------------------
  const found = await admin.from(TABLE).select('id');
  const id = (found.data ?? [])[0]?.id as string | undefined;
  check('3a_sentinel_found', '1 row', `${(found.data ?? []).length} row(s)`, (found.data ?? []).length === 1);
  if (!id) throw new Error('step 3a failed; refusing to continue');
  await admin.from(TABLE).update({ resolved_at: new Date().toISOString(), email: null, resolution_note: 'synthetic verification' }).eq('id', id);
  const resolved = await readOrphanSignal(url, anonKey);
  check('3b_resolved_clears', 'state=clear', shape(resolved), resolved.state === 'clear');
  const del = await admin.from(TABLE).delete({ count: 'exact' }).eq('id', id);
  check('3c_deleted', '1 row deleted', `${del.count} error=${del.error?.message ?? 'none'}`, del.count === 1);

  // ---- 4. CLEAR AGAIN ------------------------------------------------------
  const clear2 = await readOrphanSignal(url, anonKey);
  check('4_clear_again', 'state=clear', shape(clear2), clear2.state === 'clear');

  // ---- 5. UNREADABLE: HOST REFUSES ----------------------------------------
  const refused = await readOrphanSignal('http://127.0.0.1:1', anonKey);
  check('5_unreachable', 'state=unreadable action=open-unreadable', shape(refused), refused.state === 'unreadable' && refused.action === 'open-unreadable');

  // ---- 6. UNREADABLE: BAD KEY AGAINST THE REAL PROJECT ---------------------
  const badKey = await readOrphanSignal(url, 'not-a-key');
  check('6_bad_key', 'state=unreadable action=open-unreadable', shape(badKey), badKey.state === 'unreadable' && badKey.action === 'open-unreadable');

  // ---- 7. UNREADABLE: HTTP 200 WITH AN UNRECOGNISED BODY -------------------
  // The subtlest branch, and the one a two-outcome watcher gets wrong: a proxy
  // or an error envelope returning 200 must NOT read as "no orphans".
  const odd = await serve((res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>service unavailable</html>');
  });
  const oddResult = await readOrphanSignal(odd.url, anonKey);
  odd.stop();
  check('7_ok_but_unrecognised', 'state=unreadable action=open-unreadable', shape(oddResult), oddResult.state === 'unreadable' && oddResult.action === 'open-unreadable');

  // ---- 8. UNREADABLE: NOTHING ANSWERS AT ALL -------------------------------
  const wedged = await serve(null);
  const t0 = Date.now();
  const wedgedResult = await readOrphanSignal(wedged.url, anonKey);
  const elapsed = Date.now() - t0;
  wedged.stop();
  check(
    '8_wedged_timeout',
    `state=unreadable, elapsed ~${WATCH_TIMEOUT_MS}ms`,
    `${shape(wedgedResult)}, elapsed=${elapsed}ms`,
    wedgedResult.state === 'unreadable' && elapsed >= WATCH_TIMEOUT_MS - 250 && elapsed < WATCH_TIMEOUT_MS + 2000
  );

  // ---- 9. UNREADABLE: NOT CONFIGURED --------------------------------------
  const unconfigured = await readOrphanSignal('', '');
  check('9_unconfigured', 'state=unreadable action=open-unreadable', shape(unconfigured), unconfigured.state === 'unreadable' && unconfigured.action === 'open-unreadable');

  // ---- 10. MEASURED EMPTY, NOT ASSUMED EMPTY -------------------------------
  const post = await admin.from(TABLE).select('*', { count: 'exact', head: true });
  check('10a_table_empty', 'count=0', `count=${post.count} error=${post.error?.message ?? 'none'}`, post.count === 0);
  const fin = await readOrphanSignal(url, anonKey);
  check('10b_signal_clear', 'state=clear', shape(fin), fin.state === 'clear');
}

main()
  .then(() => {
    const w = [
      Math.max(4, ...rows.map((r) => r.step.length)),
      Math.max(6, ...rows.map((r) => r.expect.length)),
      Math.max(8, ...rows.map((r) => r.observed.length)),
    ];
    const line = (a: string, b: string, c: string, d: string) =>
      `${a.padEnd(w[0])} | ${b.padEnd(w[1])} | ${c.padEnd(w[2])} | ${d}`;
    console.log(line('step', 'expect', 'observed', 'ok'));
    for (const r of rows) console.log(line(r.step, r.expect, r.observed, String(r.ok)));
    const bad = rows.filter((r) => !r.ok);
    console.log('');
    console.log(bad.length === 0 ? `ALL ${rows.length} CHECKS PASSED` : `FAILED: ${bad.map((r) => r.step).join(', ')}`);
    process.exit(bad.length === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('HARNESS ERROR:', err);
    console.error('rows so far:', JSON.stringify(rows, null, 2));
    process.exit(3);
  });
