import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useTranslation, type Locale } from '@/lib/i18n';
import { purchaseLinksAllowed } from '@/lib/platform';
import { currentPlatform } from '@/lib/platform-server';

/**
 * The public site's shell (#107): the header on the landing and on the six
 * marketing and legal pages, and the footer the landing used to keep to itself.
 *
 * WHY A ROUTE GROUP AND NOT SEVEN EDITS. `(site)` changes no URL — every page
 * under it keeps the path it had. It buys the one thing seven copies could not:
 * a page CANNOT be added to this part of the app without the header, which is
 * how the six ended up without one. The signed-in and auth routes stay outside
 * it and keep their own chrome.
 *
 * The labels are read here, on the server, and handed to the header as props,
 * so the client bundle never pulls in either dictionary.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = useTranslation(locale);
  // Which shell asked. Inside the app the header carries no Pricing link
  // (Apple 3.1.1(a)). Reading the request here makes every page under this
  // layout render per request instead of from the CDN, which is the cost of
  // serving two variants from one build without ever caching either
  // (src/lib/platform.ts, CACHING). The landing and /pricing themselves never
  // reach the app: the middleware sends it to the dashboard.
  const showPricing = purchaseLinksAllowed(await currentPlatform());

  return (
    // `min-h-screen` lives HERE and nowhere below it. Each page used to carry
    // its own, which under a header and a footer would have guaranteed a scroll
    // on every short page — the Refund policy is four paragraphs long.
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      <SiteHeader
        locale={locale}
        showPricing={showPricing}
        labels={{
          home: t.nav.home,
          howItWorks: t.nav.howItWorks,
          pricing: t.nav.pricing,
          about: t.nav.about,
          signIn: t.nav.signIn,
          getStarted: t.nav.getStarted,
          menu: t.nav.menu,
          appearance: t.nav.appearance,
          themeDark: t.nav.themeDark,
          themeLight: t.nav.themeLight,
        }}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter
        locale={locale}
        labels={{
          home: t.nav.home,
          privacy: t.footer.privacy,
          terms: t.footer.terms,
          refund: t.footer.refund,
          support: t.footer.support,
          github: t.footer.github,
          copyright: t.footer.copyright,
        }}
      />
    </div>
  );
}
