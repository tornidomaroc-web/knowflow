/**
 * ACTIVATION 5, AUDIT CAUSE #10: A FAILED UPLOAD DOES NOT USE ONE OF THE DAY'S UPLOADS.
 *
 * Before this, `/api/ingest` ran `enforceLimit(user, 'upload')` in front of the
 * work: the atomic counter (`increment_usage`, `usage_counters.upload_count`)
 * went up for every attempt, and an attempt the ingestion service then failed
 * kept its place. A student whose first file failed had 4 uploads left that day,
 * for our failure.
 *
 * WHY NOT A REFUND. Refunding would need a decrement on `usage_counters`, and
 * there is none: the table is read-own, every write goes through the SECURITY
 * DEFINER `increment_usage`, which only adds. A decrement RPC is a migration,
 * and this change carries none.
 *
 * WHAT IS COUNTED INSTEAD, TWO NUMBERS:
 *
 * 1. The day's uploads, the 5 the student sees (`DAILY_CAPS[tier].upload`):
 *    today's documents that did not fail (`keptUploadsToday`), read from
 *    `documents` under RLS. A file still `processing` counts (it may end
 *    ready); a file at `error` does not. This read is NOT atomic with
 *    anything: two uploads sent at the same instant can both see 4 and both
 *    pass. Number 2 bounds that.
 * 2. Every attempt, failed or not: the existing atomic counter, unchanged,
 *    now held to `uploadAttemptCeiling(cap)` = the day's uploads plus
 *    `FAILED_UPLOAD_ALLOWANCE`. That is the cost bound on the ingestion
 *    service and Voyage AI: whatever fails, a free account starts at most 10
 *    ingestions a day (Pro 505), and no student loses an upload to the first 5
 *    failures.
 *
 * One consequence, stated rather than hidden: a file deleted the same day no
 * longer counts in number 1 (it is no longer a document), so deleting gives the
 * place back. Number 2 still counts the attempt, so delete-and-upload loops stop
 * at the same ceiling.
 *
 * Pure, so `scripts/verify-activation-5.mjs` can hold it in the typecheck job.
 */

/** Failed attempts a day that never cost the student an upload. Also the slack the ceiling allows above the day's uploads. */
export const FAILED_UPLOAD_ALLOWANCE = 5;

/** The atomic counter's ceiling: the day's uploads plus the failed-attempt allowance. */
export function uploadAttemptCeiling(cap: number): number {
  return cap + FAILED_UPLOAD_ALLOWANCE;
}

/** UTC midnight of `now`'s day: the day `increment_usage` counts in (`current_date`, UTC on Supabase). */
export function utcDayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface UploadRow {
  status: string;
  created_at: string | null;
}

/** Today's (UTC) documents that did not fail: ready, processing, or any status but `error`. */
export function keptUploadsToday(rows: UploadRow[], now: Date = new Date()): number {
  const start = utcDayStart(now).getTime();
  return rows.filter((r) => r.status !== 'error' && r.created_at && Date.parse(r.created_at) >= start).length;
}

/**
 * The decision, before any storage or ingestion work.
 *
 * - `kept`: today's documents that did not fail, BEFORE this upload; `null`
 *   when they could not be read. Then every earlier attempt is taken as kept,
 *   which is exactly the rule before this change (attempts against the cap).
 * - `attempts`: the atomic counter's value AFTER this attempt was added; `null`
 *   when it was not incremented (the request stops at `daily` first).
 *
 * `daily` is the refusal the student already knows (the day's 5 are used);
 * `failures` is the ceiling: too many attempts today, most of them failed.
 * One shape, not a union: the project compiles with strict:false (see
 * `LimitResult` in rate-limit.ts).
 */
export interface UploadVerdict {
  allowed: boolean;
  reason: 'daily' | 'failures' | null;
}

export function uploadVerdict(input: { kept: number | null; attempts: number | null; cap: number }): UploadVerdict {
  const { attempts, cap } = input;
  const kept = input.kept ?? (attempts === null ? null : attempts - 1);
  if (kept !== null && kept >= cap) return { allowed: false, reason: 'daily' };
  if (attempts !== null && attempts > uploadAttemptCeiling(cap)) return { allowed: false, reason: 'failures' };
  return { allowed: true, reason: null };
}
