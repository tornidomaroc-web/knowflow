import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PlatformProvider } from '@/components/platform/PlatformProvider';

/**
 * THE APP'S VARIANT OF THE STATIC PAGES (STORE_PATH.md step a).
 *
 * The app is a native shell over tryknowflow.com, and inside it the pages must
 * carry no purchase link and no Google button (Apple 3.1.1(a); Google refuses
 * OAuth in an embedded web view). The pages a signed-out student meets are
 * prerendered and served from the CDN, so they cannot read the request; the
 * middleware reads it instead and REWRITES an app request for `/<locale>/login`
 * to `/<locale>/native/login`, and so on for signup and the legal pages. The
 * browser URL stays `/<locale>/login`; the response is the page under this
 * folder, prerendered like its web twin and cached at its own path. The two
 * variants never share a cache key, so neither can be served to the other
 * shell, and the web's pages are untouched.
 *
 * Every page here RE-EXPORTS its web twin: there is one page, rendered under
 * two layouts. This layout hands `'native'` to the client components through
 * context (the Google button reads it); `native/(site)/layout.tsx` renders the
 * site chrome without the Pricing link. Nothing under this folder may read the
 * request (`currentPlatform()`, `headers()`, `cookies()`): that would turn the
 * variant dynamic, and `scripts/verify-platform-gate.mjs` fails on it.
 *
 * A direct visit to a `/native/` path without the app's marker is answered
 * with the 404 page by the middleware; with the marker it is the same content
 * as the rewrite. Not indexed either way.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NativeVariantLayout({ children }: { children: ReactNode }) {
  return <PlatformProvider platform="native">{children}</PlatformProvider>;
}
