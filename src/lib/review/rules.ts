/**
 * WHEN THE APP MAY ASK FOR A RATING (iOS 1.1, big item 4h; the study
 * rating-study-e7948da, item 4). Pure: no storage, no clock of its own, no
 * bridge. `decide()` is the whole rule; scripts/verify-review.mjs holds every
 * boundary.
 *
 * The moment is the quiz result screen. The app asks Apple (and Apple alone
 * decides whether a sheet shows, at most 3 times in 365 days) only when ALL
 * of these hold, read in this order:
 *
 *   too-new             the first-use stamp on this device is under 3
 *                       calendar days old (a clock moved back reads as
 *                       negative days, so it is too new as well);
 *   setback-today       a refusal or an error line was shown today (or on a
 *                       day "after" today: the clock moved back);
 *   low-score           under 3 questions, or under 60% right;
 *   few-wins            this is not yet the 2nd counted result. A
 *                       qualifying result is counted at most ONCE PER
 *                       CALENDAR DAY (`lastWin`), so a retake of the same
 *                       quiz minutes later is not a second win; a win day
 *                       after today (the clock moved back) counts nothing;
 *   asked-this-version  the app already asked for this app version;
 *   too-soon            under 120 days since the last ask (any version);
 *   storage             no usable record or no usable version string.
 *
 * too-new comes first so a fresh device (App Review's, CI's simulator) reads
 * too-new whatever its score: one reading, one meaning.
 *
 * Nothing is offered for a rating, and nothing is locked behind one
 * (guideline 3.2.2(x), 5.6.1). The rule only chooses a calm moment.
 */
export const THRESHOLDS = { minTotal: 3, minRatio: 0.6, minWins: 2, minDays: 3, gapDays: 120 } as const;

/** The device record (src/lib/review/store.ts). Dates are the device's calendar days, YYYY-MM-DD. */
export type ReviewState = {
  v: 1;
  first: string;
  wins: number;
  askedVersion: string | null;
  askedAt: string | null;
  setback: string | null;
  /** The day of the last counted result, so at most one counts per calendar day. */
  lastWin: string | null;
};

/** The result on screen: right answers and questions graded. */
export type ReviewMoment = { score: number; total: number };

export type ReviewReason =
  | 'too-new'
  | 'few-wins'
  | 'low-score'
  | 'asked-this-version'
  | 'too-soon'
  | 'setback-today'
  | 'storage'
  | 'ask';

export type ReviewDecision = { ask: boolean; reason: ReviewReason; next: ReviewState };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `s` is a real calendar day written YYYY-MM-DD. */
export function isDay(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DAY.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** The device's calendar day for `now`, or '' for an invalid date. */
export function dayOf(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Calendar days from day `a` to day `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  const u = (s: string) => {
    const m = DAY.exec(s)!;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  return Math.round((u(b) - u(a)) / 86_400_000);
}

/** A version string the app can hold itself to (CFBundleShortVersionString, "1.1"). */
export function isVersion(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '' && v.length <= 32;
}

/** A graded result good enough to count: at least 3 questions, at least 60% right. */
export function qualifies(m: ReviewMoment): boolean {
  const { score, total } = m;
  if (!Number.isInteger(score) || !Number.isInteger(total)) return false;
  if (score < 0 || total < THRESHOLDS.minTotal || score > total) return false;
  // Whole numbers only, so 3 of 5 is exactly 60% (no floating point edge).
  return score * 100 >= total * Math.round(THRESHOLDS.minRatio * 100);
}

/** A fresh record dated `today`: no result counted, never asked. */
export function freshState(today: string): ReviewState {
  return { v: 1, first: today, wins: 0, askedVersion: null, askedAt: null, setback: null, lastWin: null };
}

/**
 * The decision at a result screen. `next` is the record with this result
 * counted (when it qualifies, `count` is not false, and no result was
 * counted today or "later": lastWin null or strictly before today); the ask
 * itself is written by markAsked(), only once the live checks pass.
 */
export function decide(
  state: ReviewState | null,
  moment: ReviewMoment,
  now: Date,
  version: unknown,
  opts: { count?: boolean } = {},
): ReviewDecision {
  const today = dayOf(now);
  if (!today) return { ask: false, reason: 'storage', next: state ?? freshState('1970-01-01') };
  if (!state) return { ask: false, reason: 'storage', next: freshState(today) };
  const good = qualifies(moment);
  const counts = opts.count !== false && good && (state.lastWin === null || daysBetween(state.lastWin, today) > 0);
  const next: ReviewState = counts ? { ...state, wins: state.wins + 1, lastWin: today } : { ...state };
  const no = (reason: ReviewReason): ReviewDecision => ({ ask: false, reason, next });
  if (!isVersion(version)) return no('storage');
  if (daysBetween(state.first, today) < THRESHOLDS.minDays) return no('too-new');
  if (state.setback !== null && daysBetween(state.setback, today) <= 0) return no('setback-today');
  if (!good) return no('low-score');
  if (next.wins < THRESHOLDS.minWins) return no('few-wins');
  if (state.askedVersion === version) return no('asked-this-version');
  if (state.askedAt !== null && daysBetween(state.askedAt, today) < THRESHOLDS.gapDays) return no('too-soon');
  return { ask: true, reason: 'ask', next };
}

/** The record once the app has asked: this version, today. */
export function markAsked(state: ReviewState, version: string, now: Date): ReviewState {
  return { ...state, askedVersion: version, askedAt: dayOf(now) };
}
