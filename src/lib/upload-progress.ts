/**
 * WHAT A STUDENT IS TOLD WHILE AN UPLOAD IS BEING PROCESSED (register #113).
 *
 * Uploads are synchronous by ruling (#50, decision 1): `/api/ingest` holds the
 * request through conversion and embedding, and a 4 MB text file measured
 * 80.5 s on production (2026-09-23). For all of it the drop zone showed one
 * static line. A store reviewer, or any student on a phone, reads a minute of
 * "Processing..." as an app that has stopped.
 *
 * THE SERVICE REPORTS NO STAGES (that is B6's shape), so everything here is
 * derived from two things the browser does know: how many bytes it has sent
 * (a real number, from XMLHttpRequest's upload progress) and how long it has
 * been waiting. The estimate is the measured rate, stated as "usually", never
 * as a promise; the bar for the processing half advances against that
 * estimate and STOPS at 90% until the server answers, so it can never claim
 * done before it is.
 */

/** Measured: 4,194,304 bytes in 80.5 s, so about 19.2 s per MB, plus a floor
 *  for the fixed cost of a small file (conversion, one embedding round trip). */
const SECONDS_PER_MB = 19.2;
const FLOOR_SECONDS = 6;
export const PROCESSING_CAP = 0.9;

/** How long processing usually takes for a file of this size, in whole seconds. */
export function expectedProcessingSeconds(bytes: number): number {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  return Math.max(FLOOR_SECONDS, Math.round(mb * SECONDS_PER_MB));
}

export type ProcessingStage = 'reading' | 'preparing' | 'long';

/**
 * Which sentence to show `elapsedMs` into processing. `reading` for the first
 * moments, `preparing` for the expected span, `long` once the wait has run
 * past the estimate, when the honest thing to add is that the student may
 * leave and the material will appear after a refresh.
 */
export function processingStage(elapsedMs: number, bytes: number): ProcessingStage {
  const expected = expectedProcessingSeconds(bytes) * 1000;
  if (elapsedMs < Math.min(4000, expected / 3)) return 'reading';
  if (elapsedMs <= expected) return 'preparing';
  return 'long';
}

/** The processing bar's fill, 0..PROCESSING_CAP, against the estimate. */
export function processingFraction(elapsedMs: number, bytes: number): number {
  const expected = expectedProcessingSeconds(bytes) * 1000;
  return Math.min(PROCESSING_CAP, Math.max(0, elapsedMs / expected) * PROCESSING_CAP);
}
