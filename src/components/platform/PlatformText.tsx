'use client';

import type { ReactNode } from 'react';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { purchaseLinksAllowed } from '@/lib/platform';

/**
 * ONE PIECE OF COPY, TWO SHELLS (Apple 3.1.3(f); Step Wording-1).
 *
 * The web may name a plan, a subscription or a price where it sells; the app
 * may not (scripts/lib/app-wording.mjs is the rule). This renders `web` on the
 * web and `app` inside the app, read from the PlatformProvider the app's twin
 * layouts set (src/app/[locale]/native/layout.tsx), so a prerendered page and
 * its twin stay bare re-exports of one file. `app={null}` removes the copy.
 *
 * It only ever swaps or drops TEXT: no link may appear in one variant and not
 * the other, which scripts/verify-platform-gate.mjs holds (onlyRemoves).
 * No provider is the web, as everywhere in src/lib/platform.ts.
 */
export function PlatformText({ web, app }: { web: ReactNode; app: ReactNode }) {
  return <>{purchaseLinksAllowed(usePlatform()) ? web : app}</>;
}
