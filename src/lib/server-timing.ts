import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * SERVER-TIMING: HOW LONG A REQUEST WAITED ON THE DATABASE (item 4j, region).
 *
 * The functions moved from iad1 (Washington) to dub1 (Dublin), next to the
 * Supabase project in eu-west-1. What that buys is one transatlantic round trip
 * per database call that waits on the one before it. This file measures it
 * instead of inferring it: every `fetch` to the Supabase URL made while a
 * request is being handled is timed, and the handler's response carries
 *
 *   Server-Timing: db;dur=<ms>, total;dur=<ms>
 *
 * - `db` is WALL time with at least one Supabase call in flight, so calls run
 *   together in a `Promise.all` count once, as the student waits for them once.
 *   It counts until the response headers arrive (what `fetch` resolves on),
 *   which is the round trip the region changes.
 * - `total` is handler start to the moment the headers are written. A streamed
 *   answer (Ask) writes them when the stream starts, so `total` there is the
 *   time to the first byte, not to the last word.
 * - Milliseconds only, rounded: no ids, no paths, no counts that describe a
 *   student's data. No `Timing-Allow-Origin` is sent, so another site's script
 *   cannot read it; the student's own page can, which tells them nothing new.
 *
 * WHY NOT ON THE DASHBOARD PAGES. A Server Component cannot set a response
 * header (`headers()` is read-only), and with the `loading.tsx` skeletons of
 * #354 the headers leave before the page's reads begin. So a page's numbers go
 * to ONE log line per render instead (`logPageTiming`), read in the Vercel
 * runtime log. That is the only honest place for them.
 *
 * The clock rides in an AsyncLocalStorage so a helper deep in `src/lib` that
 * builds its own client is counted without being told. The store lives on
 * `globalThis` under one fixed name, so two bundled copies of this module
 * still share one store and one fetch patch.
 */

export type Clock = { t0: number; db: number; n: number; open: number; since: number };

type Shared = { store: AsyncLocalStorage<Clock>; patched: boolean };
const g = globalThis as typeof globalThis & { __knowflowServerTiming?: Shared };
const shared: Shared = g.__knowflowServerTiming ?? (g.__knowflowServerTiming = { store: new AsyncLocalStorage<Clock>(), patched: false });

export function newClock(now: number = performance.now()): Clock {
  return { t0: now, db: 0, n: 0, open: 0, since: 0 };
}

/** A Supabase call begins. Overlapping calls open one interval. */
export function dbStart(c: Clock, now: number = performance.now()): void {
  if (c.open === 0) c.since = now;
  c.open += 1;
  c.n += 1;
}

/** A Supabase call's headers arrived (or it failed). */
export function dbEnd(c: Clock, now: number = performance.now()): void {
  if (c.open === 0) return;
  c.open -= 1;
  if (c.open === 0) c.db += now - c.since;
}

/** Database wall time so far, counting an interval still open. */
export function dbMs(c: Clock, now: number = performance.now()): number {
  return c.db + (c.open > 0 ? now - c.since : 0);
}

export function serverTimingValue(c: Clock, now: number = performance.now()): string {
  return `db;dur=${Math.round(dbMs(c, now))}, total;dur=${Math.round(now - c.t0)}`;
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: unknown }).url);
  return '';
}

/** True for a request to this project's Supabase (REST, Auth, Storage, RPC). */
export function isSupabaseUrl(input: unknown, base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!base) return false;
  const url = urlOf(input);
  const root = base.replace(/\/+$/, '');
  return url === root || url.startsWith(`${root}/`);
}

/**
 * Wrap `globalThis.fetch` once. Outside a timed request, or for any other host
 * (Anthropic, Voyage, Railway, Apple, Paddle), the call passes straight through
 * and returns the very same promise.
 */
export function installFetchTiming(): void {
  if (shared.patched || typeof globalThis.fetch !== 'function') return;
  const original = globalThis.fetch;
  const timed = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const clock = shared.store.getStore();
    if (!clock || !isSupabaseUrl(input)) return original(input, init);
    dbStart(clock);
    const pending = original(input, init);
    pending.then(
      () => dbEnd(clock),
      () => dbEnd(clock),
    );
    return pending;
  }) as typeof fetch;
  globalThis.fetch = timed;
  shared.patched = true;
}

/** Run `fn` with a fresh clock; returns what it returns and the clock. */
export async function runTimed<T>(fn: () => Promise<T>): Promise<{ value: T; clock: Clock }> {
  installFetchTiming();
  const clock = newClock();
  const value = await shared.store.run(clock, fn);
  return { value, clock };
}

/**
 * Wrap a route handler so its response carries `Server-Timing`. A response
 * with immutable headers (`Response.redirect`) is returned as it is.
 */
export function withServerTiming<A extends unknown[], R extends Response>(
  handler: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const { value, clock } = await runTimed(() => handler(...args));
    try {
      value.headers.set('Server-Timing', serverTimingValue(clock));
    } catch {
      // immutable headers: leave the response untouched
    }
    return value;
  };
}

/**
 * A dashboard page: start a clock for the rest of this render's async work.
 * `enterWith` binds it to the page component's own continuation, which is
 * where its reads are awaited; a sibling layout keeps its own (or none).
 */
export function startPageTiming(): Clock {
  installFetchTiming();
  const clock = newClock();
  shared.store.enterWith(clock);
  return clock;
}

/** One log line per page render: route name and milliseconds, nothing else. */
export function logPageTiming(route: string, clock: Clock): void {
  const now = performance.now();
  console.log(
    `kf-timing ${JSON.stringify({ route, db_ms: Math.round(dbMs(clock, now)), db_calls: clock.n, total_ms: Math.round(now - clock.t0), region: process.env.VERCEL_REGION ?? null })}`,
  );
}
