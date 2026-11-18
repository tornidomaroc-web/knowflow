'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { cameraAllowed, type Platform } from '@/lib/platform';

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
 *
 * `shell` is the shell's version (`currentShellVersion()`, 0 on the web), read
 * the same way and for one question only: may the camera be offered
 * (`cameraAllowed`, shell 2 on). Omitted, it is 0: no camera.
 */
const PlatformContext = createContext<{ platform: Platform; shell: number }>({ platform: 'web', shell: 0 });

export function PlatformProvider({ platform, shell = 0, children }: { platform: Platform; shell?: number; children: ReactNode }) {
  return <PlatformContext.Provider value={{ platform, shell }}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  return useContext(PlatformContext).platform;
}

/** Whether this shell may open the camera (src/lib/platform.ts, `cameraAllowed`). */
export function useCameraAllowed(): boolean {
  const { platform, shell } = useContext(PlatformContext);
  return platform === 'native' && cameraAllowed(shell);
}
