'use client';

import { useEffect } from 'react';
import { PLATFORM, PLATFORM_HEADER } from '@/lib/platform';

/**
 * In the native build, every same-origin `/api/` request carries
 * `x-kf-platform: native`, so the server composes refusals without purchase
 * sentences (Apple 3.1.1(a); `src/lib/platform.ts`).
 *
 * Done ONCE here, by wrapping `window.fetch`, rather than at each of the
 * fourteen `fetch('/api/...')` call sites: a call site added later would
 * otherwise ship the web sentence into the store build with nothing to catch
 * it. In the web build (`PLATFORM === 'web'`) this renders nothing and touches
 * nothing; the wrapper is installed only when the flag was set at build time.
 */
export function NativePlatformHeader() {
  useEffect(() => {
    if (PLATFORM !== 'native') return;
    const w = window as Window & { __kfPlatformFetch?: boolean };
    if (w.__kfPlatformFetch) return;
    w.__kfPlatformFetch = true;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const sameOriginApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
      if (!sameOriginApi) return original(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set(PLATFORM_HEADER, 'native');
      return original(input, { ...init, headers });
    };
  }, []);
  return null;
}
