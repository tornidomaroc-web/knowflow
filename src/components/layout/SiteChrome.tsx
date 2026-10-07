import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useTranslation, type Locale } from '@/lib/i18n';

/**
 * The public site's shell (#107): the header on the landing and on the six
 * marketing and legal pages, and the footer the landing used to keep to itself.
 *
 * ONE COMPONENT, TWO LAYOUTS (STORE_PATH.md step a). `(site)/layout.tsx`
 * renders it with `showPricing` for the web; `native/(site)/layout.tsx`
 * renders it without, for the pages the app's shell is rewritten to. Both
 * layouts are static and prerendered: the choice between them is the
 * middleware's, made per request from the app's user-agent marker, and each
 * variant lives at its own path and so at its own cache key
 * (`src/lib/platform.ts`, CACHING). Nothing here reads the request.
 *
 * The labels are read here, on the server, and handed to the header as props,
 * so the client bundle never pulls in either dictionary.
 */
export function SiteChrome({ locale, showPricing, children }: { locale: Locale; showPricing: boolean; children: ReactNode }) {
  const t = useTranslation(locale);

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
