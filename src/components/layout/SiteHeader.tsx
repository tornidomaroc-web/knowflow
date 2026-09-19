'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { locales, type Locale } from '@/lib/i18n';

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
}

/**
 * A language's name in its OWN language does not translate, so these are not
 * dictionary entries: "English" is English in the Arabic UI and "العربية" is
 * Arabic in the English one. Two dictionary keys would have held four strings
 * with only two distinct values, and the pair that matters — the one a student
 * on the wrong locale has to recognise — would have been the pair they cannot
 * read. Register #83 asked for the switcher; this is the label half of it.
 */
const ENDONYM: Record<Locale, string> = { en: 'English', ar: 'العربية' };

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
export function SiteHeader({ locale, labels }: { locale: Locale; labels: SiteHeaderLabels }) {
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

  const other: Locale = locale === 'en' ? 'ar' : 'en';
  /**
   * Same page, other language. `usePathname()` carries no query string, so a
   * switch drops one — the only query this shell ever sees is a campaign tag,
   * and no page here reads one. It does not carry the hash either, which is
   * what a browser gives us: the fragment never reaches the server.
   */
  const switchHref = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
    ? `/${other}${pathname.slice(locale.length + 1)}`
    : `/${other}`;

  const links = [
    // ABSOLUTE, not the bare `#how-it-works` the landing carried alone. This
    // header now stands on seven pages, and on six of them a bare fragment
    // scrolls the page the student is already on to nothing.
    { href: `/${locale}#how-it-works`, label: labels.howItWorks },
    { href: `/${locale}/pricing`, label: labels.pricing },
    { href: `/${locale}/about`, label: labels.about },
  ];

  const wordmark = (
    <>
      {labels.home.replace('Flow', '')}
      <span className="text-primary">Flow</span>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-header backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between gap-4">
        <Link
          href={`/${locale}`}
          className="rounded-md text-2xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {wordmark}
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
          */}
          <Link
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {ENDONYM[other]}
          </Link>
          <Link href={`/${locale}/login`} className="text-muted-foreground transition-colors hover:text-primary">
            {labels.signIn}
          </Link>
          <Link
            href={`/${locale}/signup`}
            className="inline-flex items-center justify-center rounded-xl border border-primary px-6 py-2 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
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
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={labels.menu}
          className="md:hidden -me-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Rendered in both states so `aria-controls` always resolves to it. */}
      <div id="site-menu" hidden={!open} className="md:hidden border-t border-border bg-background">
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
          <Link
            href={switchHref}
            hrefLang={other}
            lang={other}
            className="min-h-[2.75rem] flex items-center text-muted-foreground transition-colors hover:text-primary"
          >
            {ENDONYM[other]}
          </Link>
          {/* Last, and the only filled control: the one thing this menu is for. */}
          <Link
            href={`/${locale}/signup`}
            className="mt-3 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {labels.getStarted}
          </Link>
        </nav>
      </div>
    </header>
  );
}
