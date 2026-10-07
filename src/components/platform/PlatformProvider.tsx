'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Platform } from '@/lib/platform';

/**
 * How a client component learns which shell it is in. The value is read on
 * the server from the request (`currentPlatform()`) by the nearest layout or
 * page that renders gated client components, and handed down here, so the
 * server markup and the hydrated client agree by construction. No client
 * code sniffs `navigator.userAgent`: that would be a second reading that can
 * disagree with the first.
 *
 * The default is `'web'` (fail toward the web, `src/lib/platform.ts`): a
 * gated component rendered outside a provider shows what the web shows.
 */
const PlatformContext = createContext<Platform>('web');

export function PlatformProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
