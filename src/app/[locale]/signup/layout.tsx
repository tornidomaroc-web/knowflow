import type { ReactNode } from 'react';
import { currentPlatform } from '@/lib/platform-server';
import { PlatformProvider } from '@/components/platform/PlatformProvider';

/**
 * This layout exists for one reason: the page below is a client component
 * and cannot read the request, but its Google button must know which shell
 * it is in (hidden inside the app; STORE_PATH.md step a, src/lib/platform.ts).
 * The platform is read from the request here and handed down through
 * context, so server markup and hydration agree.
 *
 * Reading the request also turns this route from a prerendered page into one
 * rendered per request. That is deliberate and necessary: a prerendered page
 * is built once as the web variant and served from the CDN to everyone, the
 * app included. The cost is one small page no longer served from cache.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const platform = await currentPlatform();
  return <PlatformProvider platform={platform}>{children}</PlatformProvider>;
}
