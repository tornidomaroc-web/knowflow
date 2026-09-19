import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useTranslation, type Locale } from '@/lib/i18n';

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

  return (
    // `min-h-screen` lives HERE and nowhere below it. Each page used to carry
    // its own, which under a header and a footer would have guaranteed a scroll
    // on every short page — the Refund policy is four paragraphs long.
    <div className="flex min-h-screen flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      <SiteHeader
        locale={locale}
        labels={{
          home: t.nav.home,
          howItWorks: t.nav.howItWorks,
          pricing: t.nav.pricing,
          about: t.nav.about,
          signIn: t.nav.signIn,
          getStarted: t.nav.getStarted,
          menu: t.nav.menu,
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
