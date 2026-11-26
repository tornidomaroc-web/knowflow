/**
 * ONE PRESS, ONE REQUEST (item 4j, tap feedback).
 *
 * A button that starts server work (a summary, a quiz, a question, a delete,
 * a rename, a sign-out, a Settings action) used to be guarded only by its own
 * React state: `if (isLoading) return`, or `disabled={busy}`. Both are read
 * from the LAST RENDER. Two presses that land before React commits the first
 * one's state both read "not busy" and both send. That window is real:
 *
 * - the study buttons and Ask's send set their loading state only AFTER
 *   `await ensureAiConsent()`, so the update is scheduled from a microtask at
 *   default priority, not flushed with the click;
 * - every handler is open to two clicks in one task (a double tap the WebView
 *   coalesces, a keyboard repeat, `click()` twice), which no state can see.
 *
 * design-c check 33 presses each guarded button twice in one task and counts
 * the requests that leave the page (BEFORE, main, is reported). A second
 * summary or quiz is a paid model call; a second DELETE is a destructive write.
 *
 * `singleFlight` closes the window with a flag held OUTSIDE React state
 * (a ref), set synchronously at the top of the handler and cleared when the
 * handler settles, success or failure. The component's own state still
 * drives what the student sees (its existing loading text, `disabled`); this
 * only makes the second press a no-op until the first has finished.
 *
 * Pure and React-free, so scripts/verify-tap-feedback.mjs runs it in Node
 * with its forced cases; the hook is src/lib/use-single-flight.ts.
 */
export interface Flight {
  current: boolean;
}

/**
 * Wraps `fn` so that, while one call is running, every further call returns
 * at once without calling `fn`. The flag is released when `fn` settles,
 * including when it throws (the error is passed on to the caller).
 */
export function singleFlight<A extends unknown[]>(
  flight: Flight,
  fn: (...args: A) => unknown,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    if (flight.current) return;
    flight.current = true;
    try {
      await fn(...args);
    } finally {
      flight.current = false;
    }
  };
}
