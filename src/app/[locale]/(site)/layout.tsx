import type { ReactNode } from 'react';
import { SiteChrome } from '@/components/layout/SiteChrome';
import type { Locale } from '@/lib/i18n';

/**
 * The web's public site. WHY A ROUTE GROUP AND NOT SEVEN EDITS. `(site)`
 * changes no URL — every page under it keeps the path it had. It buys the one
 * thing seven copies could not: a page CANNOT be added to this part of the
 * app without the header, which is how the six ended up without one. The
 * signed-in and auth routes stay outside it and keep their own chrome.
 *
 * STATIC, ON PURPOSE. This layout reads nothing from the request, so every
 * page under it stays prerendered and served from the CDN exactly as before
 * STORE_PATH.md step a. The app's variant of these pages, without the Pricing
 * link, is `native/(site)/layout.tsx`, which the middleware rewrites an app
 * request to; the chrome itself is `SiteChrome`.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <SiteChrome locale={locale} showPricing>{children}</SiteChrome>;
}
