import { headers } from 'next/headers';
import { platformFromHeaders, type Platform } from '@/lib/platform';

/**
 * The platform of the request a server component is rendering for.
 *
 * Reading `headers()` is what makes the route dynamic: a page that calls this
 * is rendered per request and never prerendered, which is the only correct
 * behaviour for a page whose markup depends on the marker (see the CACHING
 * note in `src/lib/platform.ts`). Call it only in pages and layouts that
 * really change on the marker; a page that does not should stay static.
 *
 * Kept apart from `platform.ts` so client components and the proof scripts,
 * which have no `next/headers`, can import the pure module.
 */
export async function currentPlatform(): Promise<Platform> {
  const h = await headers();
  return platformFromHeaders((name) => h.get(name));
}
