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
 *
 * Design "C", PR 2 (Landing.dc.html): the name, the four links as 44 pt
 * targets, the copyright, centred on a phone. The artboard has no GitHub
 * link, so the footer no longer carries one (the label stays in the
 * dictionaries and the type, unused).
 */
export function SiteFooter({ locale, labels, showRefund = true }: { locale: Locale; labels: SiteFooterLabels; showRefund?: boolean }) {
  // Step Wording-1: the app sells nothing, so its chrome carries no Refund
  // link; the web keeps it (its twin page is neutral if reached anyway).
  const links = [
    { href: `/${locale}/privacy`, label: labels.privacy },
    { href: `/${locale}/terms`, label: labels.terms },
    ...(showRefund ? [{ href: `/${locale}/refund`, label: labels.refund }] : []),
    { href: `/${locale}/contact`, label: labels.support },
  ];

  return (
    <footer className="pt-[1.875rem] pb-10">
      <div className="max-w-7xl mx-auto px-[1.125rem] md:px-6 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
        <p className="text-lg font-extrabold text-foreground">{labels.home}</p>
        <nav className="flex flex-wrap justify-center gap-x-1.5 gap-y-1 text-sm font-medium text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-[2.75rem] items-center px-2 transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-[0.8125rem] text-muted-foreground">
          &copy; {new Date().getFullYear()} {labels.copyright}
        </p>
      </div>
    </footer>
  );
}
