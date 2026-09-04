/**
 * Reads the one bit `.github/workflows/deletion-orphan-watch.yml` is allowed to
 * see, and classifies it into THREE outcomes rather than two.
 *
 * Run directly:
 *   node scripts/orphan-watch.ts        (reads ORPHAN_WATCH_URL / ORPHAN_WATCH_KEY)
 *
 * WHY THREE OUTCOMES. The obvious watcher is `if (rpc === true) open an issue`.
 * That watcher reports NOTHING when the Supabase project is paused, when
 * PostgREST 5xxs, when the key is wrong, or when the network fails -- and
 * nothing is exactly what it reports when there are no orphans. Silence would
 * mean two opposite things, which is register #54's founding sentence (a failure
 * invisible at every layer at once) rebuilt inside the last component of #54's
 * own fix.
 *
 * This is not hypothetical for this project. Commit 6513cb2 records that this
 * Supabase project AUTO-PAUSED and nothing detected it. The single condition
 * most likely to silence this watcher has already happened here once.
 *
 * So: `true` -> the orphan issue is opened or kept open. `false` -> it is closed
 * if open. ANYTHING ELSE -> a DISTINCT "cannot read production" issue is opened.
 * The state lives in GitHub Issues, where a human sees an artifact, and not in
 * run history, where a human sees an absence.
 *
 * WHY THE CLASSIFIER IS EXPORTED AND THE CLI IS A THIN SHELL AROUND IT. Same
 * reason scripts/verify-deletion-orphan-recorder.ts imports the shipped
 * recorder: if the proof re-implemented this decision, the decision could ship
 * unexecuted while the proof read green.
 *
 * FAIL CLOSED ON ANYTHING UNRECOGNISED. The body must parse and must be exactly
 * `true` or `false`. A 200 carrying anything else -- an error object, an empty
 * body, HTML from a proxy -- is `unreadable`, not `clear`. Treating an
 * unrecognised success as "no orphans" is the whole defect this file exists to
 * avoid.
 */

import { basename } from 'node:path';

/** Bounded so a wedged endpoint cannot hold a scheduled run open indefinitely. */
export const WATCH_TIMEOUT_MS = 15_000;

export type WatchState = 'present' | 'clear' | 'unreadable';
export type WatchAction = 'open-orphan' | 'close-orphan' | 'open-unreadable';

export type WatchResult = {
  state: WatchState;
  action: WatchAction;
  /** Operator-facing, and deliberately carries no row data -- only the one bit. */
  reason: string;
};

const FN = 'has_unresolved_deletion_orphan';

/**
 * Collapses whitespace and truncates. NOT cosmetic: `reason` is written to
 * GITHUB_OUTPUT, which is a line-oriented `key=value` file, so a newline inside
 * a value ends the value and lets whatever follows be read as ANOTHER output.
 * The text comes from an HTTP response body, so it is not ours to trust. This is
 * the sanitiser for that, applied where the string is built rather than where it
 * is printed, so no future caller can miss it.
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export async function readOrphanSignal(url: string, key: string): Promise<WatchResult> {
  if (!url || !key) {
    return {
      state: 'unreadable',
      action: 'open-unreadable',
      reason: 'missing url or key: the watcher was not configured',
    };
  }

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${FN}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(WATCH_TIMEOUT_MS),
    });
  } catch (caught) {
    return {
      state: 'unreadable',
      action: 'open-unreadable',
      reason: oneLine(`request failed: ${caught instanceof Error ? caught.message : String(caught)}`),
    };
  }

  const body = (await res.text().catch(() => '')).trim();

  if (!res.ok) {
    // A paused project, a rotated key and a dropped grant all land here, and all
    // three must be loud. The body is truncated because it is a diagnostic, not
    // a payload.
    return {
      state: 'unreadable',
      action: 'open-unreadable',
      reason: `http ${res.status}: ${oneLine(body) || '(empty body)'}`,
    };
  }

  if (body === 'true') {
    return { state: 'present', action: 'open-orphan', reason: 'at least one unresolved orphan in production' };
  }
  if (body === 'false') {
    return { state: 'clear', action: 'close-orphan', reason: 'no unresolved orphans' };
  }

  return {
    state: 'unreadable',
    action: 'open-unreadable',
    reason: `http 200 with an unrecognised body: ${oneLine(body) || '(empty body)'}`,
  };
}

/** CLI. Prints `key=value` lines and appends them to GITHUB_OUTPUT when present. */
async function cli(): Promise<void> {
  const result = await readOrphanSignal(
    process.env.ORPHAN_WATCH_URL ?? '',
    process.env.ORPHAN_WATCH_KEY ?? ''
  );
  const lines = [`state=${result.state}`, `action=${result.action}`, `reason=${result.reason}`];
  for (const line of lines) console.log(line);

  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(out, lines.join('\n') + '\n');
  }
  // Exit 0 in every case ON PURPOSE. The workflow branches on `state`; a
  // non-zero exit here would make an unreadable production look like a broken
  // workflow, which is the ambiguity this file exists to remove.
}

// basename, NOT endsWith. `endsWith('orphan-watch.ts')` is also true for
// `verify-orphan-watch.ts`, which imports this module -- the CLI then ran during
// import, printing a spurious classification and, with GITHUB_OUTPUT set, writing
// `state=unreadable` into a workflow's outputs. Caught by running the proof; the
// substring version passed every classification check while doing it.
if (basename(process.argv[1] ?? '') === 'orphan-watch.ts') {
  await cli();
}
