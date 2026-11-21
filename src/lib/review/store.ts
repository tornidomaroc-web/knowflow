import { reviewBridge } from '@/lib/review/bridge';
import { dayOf, freshState, isDay, type ReviewState } from '@/lib/review/rules';

/**
 * THE RATING RECORD, ON THIS DEVICE ONLY (the study's item 4): one key in the
 * page's localStorage, `kf-review`, seven fields: the record's version, the
 * first-use day, the count of qualifying quiz results (at most one a day),
 * the app version and day of the last ask, the day of the last refusal or
 * error line, and the day of the last counted result. No account id, no
 * content, no score history. It is never sent anywhere.
 *
 * `v` stays 1 with lastWin added (fix 1 of #345): the key was dormant (no
 * binary carried the plugin), so no device holds a six-field record. One that
 * did would be refused by the strict parse and rewritten fresh, which asks
 * later, never sooner.
 *
 * Why localStorage: a cookie would travel to the server with every request;
 * Swift's UserDefaults is a required-reason API the privacy manifest declares
 * none of (PrivacyInfo.xcprivacy, NSPrivacyAccessedAPITypes empty by audit).
 * WKWebView keeps this key in the app container, so a reinstall starts over.
 *
 * FAIL TOWARD NOT ASKING. A missing, unreadable or unexpected value is
 * rewritten as a fresh record dated today, and that reading asks nothing. A
 * storage that throws (private mode, quota) gives no record: never ask.
 *
 * Only a device the rating can reach writes anything: deviceStorage() is null
 * unless reviewBridge() answers (shell 2, iOS, the KnowFlowReview plugin), so
 * the web and build 8 never hold the key.
 */
export const REVIEW_KEY = 'kf-review';

export type ReviewStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const FIELDS = ['v', 'first', 'wins', 'askedVersion', 'askedAt', 'setback', 'lastWin'] as const;

/** The record, or null when the value is anything else. */
export function parseReview(raw: string | null): ReviewState | null {
  if (raw === null) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  if (keys.join() !== [...FIELDS].sort().join()) return null;
  if (r.v !== 1 || !isDay(r.first)) return null;
  if (typeof r.wins !== 'number' || !Number.isInteger(r.wins) || r.wins < 0 || r.wins > 100_000) return null;
  if (r.askedVersion !== null && (typeof r.askedVersion !== 'string' || r.askedVersion.length > 32)) return null;
  if (r.askedAt !== null && !isDay(r.askedAt)) return null;
  if (r.setback !== null && !isDay(r.setback)) return null;
  if (r.lastWin !== null && !isDay(r.lastWin)) return null;
  return { v: 1, first: r.first, wins: r.wins, askedVersion: r.askedVersion as string | null, askedAt: r.askedAt as string | null, setback: r.setback as string | null, lastWin: r.lastWin as string | null };
}

/** Writes the seven fields and nothing else; false when the storage refuses. */
export function writeReview(storage: ReviewStorage | null, s: ReviewState): boolean {
  if (!storage) return false;
  const out: ReviewState = { v: 1, first: s.first, wins: s.wins, askedVersion: s.askedVersion, askedAt: s.askedAt, setback: s.setback, lastWin: s.lastWin };
  try {
    storage.setItem(REVIEW_KEY, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}

/**
 * The record as stored, or a fresh one written in its place (`fresh: true`,
 * which asks nothing). null when there is no storage, it throws, or the
 * fresh record cannot be written.
 */
export function readReview(storage: ReviewStorage | null, now: Date): { state: ReviewState; fresh: boolean } | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(REVIEW_KEY);
  } catch {
    return null;
  }
  const state = parseReview(raw);
  if (state) return { state, fresh: false };
  const today = dayOf(now);
  if (!today) return null;
  const fresh = freshState(today);
  return writeReview(storage, fresh) ? { state: fresh, fresh: true } : null;
}

/** This device's localStorage, only where the rating can be reached; else null. */
export function deviceStorage(): ReviewStorage | null {
  if (!reviewBridge()) return null;
  try {
    return (globalThis as { localStorage?: ReviewStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** The first-use stamp: written once (by the dashboard's first mount), never moved. */
export function noteFirstUse(storage: ReviewStorage | null = deviceStorage(), now: Date = new Date()): void {
  readReview(storage, now);
}

/** A refusal or an error line was shown: no ask today. */
export function noteSetback(storage: ReviewStorage | null = deviceStorage(), now: Date = new Date()): void {
  const r = readReview(storage, now);
  const today = dayOf(now);
  if (r && today) writeReview(storage, { ...r.state, setback: today });
}
