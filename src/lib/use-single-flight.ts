'use client';

import { useCallback, useRef } from 'react';
import { singleFlight } from './single-flight';

/**
 * The component's one-at-a-time guard (src/lib/single-flight.ts). Returns a
 * wrapper: `const once = useSingleFlight(); const send = once(async () => …)`.
 * Every handler wrapped by the same `once` shares ONE flag, so a component's
 * buttons that start the same work (Ask's send button, its Enter key and its
 * suggested questions) cannot overlap either.
 */
export function useSingleFlight() {
  const flight = useRef(false);
  return useCallback(
    <A extends unknown[]>(fn: (...args: A) => unknown) => singleFlight(flight, fn),
    [],
  );
}
