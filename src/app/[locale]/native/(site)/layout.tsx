import type { ReactNode } from 'react';
import { SiteChrome } from '@/components/layout/SiteChrome';
import type { Locale } from '@/lib/i18n';

/**
 * The app's variant of the public site's chrome: the same `SiteChrome` as
 * `(site)/layout.tsx`, without the Pricing link (Apple 3.1.1(a)). Static;
 * see `native/layout.tsx` for how a request reaches it.
 */
export default async function NativeSiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <SiteChrome locale={locale} showPricing={false}>{children}</SiteChrome>;
}
