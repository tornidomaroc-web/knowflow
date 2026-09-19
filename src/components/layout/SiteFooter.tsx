import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

export interface SiteFooterLabels {
  home: string;
  privacy: string;
  terms: string;
  refund: string;
  support: string;
  github: string;
  copyright: string;
}

/**
 * The public site's footer (#107), lifted OUT of the landing page unchanged and
 * given to the six marketing and legal pages, which had no internal links at
 * all: Privacy, Terms and Refund were reachable from the landing and from
 * nowhere else. That is a reachability problem for documents a buyer has to be
 * able to find, not a navigation preference.
 *
 * NOT a client component, deliberately. It is rendered by the server layout, so
 * `getFullYear()` runs once on the server even on the pricing page, which is
 * itself `'use client'` — the year is never a hydration mismatch.
 */
export function SiteFooter({ locale, labels }: { locale: Locale; labels: SiteFooterLabels }) {
  const links = [
    { href: `/${locale}/privacy`, label: labels.privacy },
    { href: `/${locale}/terms`, label: labels.terms },
    { href: `/${locale}/refund`, label: labels.refund },
    { href: `/${locale}/contact`, label: labels.support },
  ];

  return (
    <footer className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-xl font-bold tracking-tight">
          {labels.home.replace('Flow', '')}
          <span className="text-primary">Flow</span>
        </div>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs font-medium text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <Link
            href="https://github.com/tornidomaroc-web/knowflow"
            className="transition-colors hover:text-primary"
          >
            {labels.github}
          </Link>
        </div>
        <div className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {labels.copyright}
        </div>
      </div>
    </footer>
  );
}
