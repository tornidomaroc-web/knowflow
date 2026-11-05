'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { ClayClose, ClayMenu } from '@/components/clay/ClayIcons';
import { ENDONYM, otherLocale, switchLocaleHref, type Locale } from '@/lib/i18n';
import { ThemeToggle } from './ThemeToggle';

export interface SiteHeaderLabels {
  /** The wordmark, which is the product name in both dictionaries. */
  home: string;
  howItWorks: string;
  pricing: string;
  about: string;
  signIn: string;
  getStarted: string;
  /** Screen-reader only: the hamburger's name. Never rendered as text. */
  menu: string;
  appearance: string;
  themeDark: string;
  themeLight: string;
}

/**
 * The public site's header, shared by the landing and the six marketing and
 * legal pages through `[locale]/(site)/layout.tsx` (#107).
 *
 * WHY A CLIENT COMPONENT. Two things here need the browser: the disclosure
 * menu below `md` (register #48), and the language switch, which has to know
 * the CURRENT path to offer the same page in the other language rather than
 * dumping the student on the landing. `usePathname()` supplies it and is
 * correct during the server render too, so the switch's href is in the HTML.
 *
 * The dictionary is NOT imported here: labels arrive as props from the server
 * layout, so neither locale's dictionary is pulled into the client bundle.
 */
export function SiteHeader({ locale, labels, showPricing }: { locale: Locale; labels: SiteHeaderLabels; showPricing: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // The header lives in a layout, so it survives navigation: without this, the
  // menu a student opened stays open on top of the page they just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Same page, other language. The label and the href rule live in
  // `@/lib/i18n` since the dashboard's sidebar and mobile nav carry the same
  // control (register #83 (b)); the middleware remembers whichever is followed.
  const other = otherLocale(locale);
  const switchHref = switchLocaleHref(locale, pathname);

  const links = [
    // ABSOLUTE, not the bare `#how-it-works` the landing carried alone. This
    // header now stands on seven pages, and on six of them a bare fragment
    // scrolls the page the student is already on to nothing.
    { href: `/${locale}#how-it-works`, label: labels.howItWorks },
    // Absent inside the app: a link to the pricing page is a call to action
    // toward a purchase outside in-app purchase (Apple 3.1.1(a)). The layout
    // decides from the request (`purchaseLinksAllowed(await currentPlatform())`).
    ...(showPricing ? [{ href: `/${locale}/pricing`, label: labels.pricing }] : []),
    { href: `/${locale}/about`, label: labels.about },
  ];


  return (
    // No blur behind the bar (design "C" forbids a backdrop blur anywhere).
    // --header is opaque enough on its own: its 0.90 was derived
    // for contrast over content scrolling beneath (#107), not from the blur.
    // Design "C", PR 2 (Landing.dc.html): no hairline under it; the real app
    // icon as a tile beside the name, and the two controls as clay tiles.
    <header className="sticky top-0 z-50 bg-header pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-[1.125rem] md:px-6 h-[4.75rem] md:h-20 flex items-center justify-between gap-4">
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-xl text-[1.3125rem] font-extrabold leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandIcon size={40} radius={12} />
          {labels.home}
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {/*
            `lang` and no `dir`. The label is a single Latin or single Arabic
            run, which the bidi algorithm already lays out correctly inside the
            opposite direction; `dir` would additionally move the label to the
            other edge of its own box and break it out of the row it sits in.
            `lang` is what a screen reader needs to pronounce the word.

            A plain `<a>`, not a `<Link>` (register #136): a Link is prefetched,
            and the switch must reach the middleware as a page load every time.
          */}
          <a
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {ENDONYM[other]}
          </a>
          <ThemeToggle
            variant="clay"
            labels={{ appearance: labels.appearance, dark: labels.themeDark, light: labels.themeLight }}
          />
          <Link href={`/${locale}/login`} className="text-muted-foreground transition-colors hover:text-foreground">
            {labels.signIn}
          </Link>
          <Link
            href={`/${locale}/signup`}
            className="kf-gold inline-flex min-h-[2.75rem] items-center justify-center rounded-full px-6 font-bold transition-colors"
          >
            {labels.getStarted}
          </Link>
        </div>

        {/*
          Register #48. Below `md` this header used to be a wordmark and nothing
          else: no links, no CTA, and no control to open any. The disclosure
          pattern, not a modal — a navigation menu is not a dialog, so it does
          not trap focus or hide the page from a screen reader; it names itself
          with aria-expanded and hands the panel back with aria-controls.
        */}
        {/* The theme toggle sits beside the menu below md: one tap, no menu. */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle
            variant="clay"
            labels={{ appearance: labels.appearance, dark: labels.themeDark, light: labels.themeLight }}
          />
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={labels.menu}
            className="kf-pill inline-flex h-11 w-11 items-center justify-center rounded-[0.875rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? <ClayClose /> : <ClayMenu />}
          </button>
        </div>
      </div>

      {/* Rendered in both states so `aria-controls` always resolves to it. */}
      <div id="site-menu" hidden={!open} className="md:hidden bg-background">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col text-base font-medium">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="min-h-[2.75rem] flex items-center text-muted-foreground transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={`/${locale}/login`}
            className="min-h-[2.75rem] flex items-center text-muted-foreground transition-colors hover:text-primary"
          >
            {labels.signIn}
          </Link>
          <a
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="min-h-[2.75rem] flex items-center text-muted-foreground transition-colors hover:text-primary"
          >
            {ENDONYM[other]}
          </a>
          {/* Last, and the only filled control: the one thing this menu is for. */}
          <Link
            href={`/${locale}/signup`}
            className="kf-gold mt-3 inline-flex min-h-[3rem] items-center justify-center rounded-full px-6 text-base font-extrabold transition-colors"
          >
            {labels.getStarted}
          </Link>
        </nav>
      </div>
    </header>
  );
}
