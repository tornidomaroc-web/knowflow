'use client';

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ENDONYM, locales, switchLocaleHref, type Locale } from '@/lib/i18n';

/**
 * Settings' language choice (design "C", PR 2, Prefs.dc.html): two equal
 * options in a pressed-in well, the current language a gold clay pill
 * (`.kf-seg`, globals.css). The same as the Appearance control beside it, and
 * announced the same way: a radio group, each option a radio with
 * `aria-checked`.
 *
 * THE BEHAVIOUR IS TODAY'S. The locale is the path, so each option is a LINK
 * to this page in that language, and the middleware remembers whichever is
 * followed (register #83). Plain `<a>`s, not `<Link>`s: a switch must reach
 * the middleware as a page load, never as a prefetch or a cached payload
 * (#136). `lang` on each so a screen reader says it right.
 *
 * The keys a radio group answers to: one tab stop (the current language), the
 * arrow keys move to the other one and choose it, and Space chooses as Enter
 * does on a link. Choosing is following the link, so the page loads.
 *
 * ITEM 4J: THE CHOICE SHOWS AT ONCE. That page load is a full round trip
 * (the middleware, the session, the whole dashboard), and the old page stayed
 * as it was until the new one arrived, so a student tapped again. The tapped
 * option now takes the gold pill on the tap; the link is followed as before.
 * A page restored from the back-forward cache shows its own language again.
 */
export function LanguageSegment({ locale, pathname, label }: { locale: Locale; pathname: string; label: string }) {
  const href = (l: Locale) => (l === locale ? pathname : switchLocaleHref(locale, pathname));
  // The option shown as chosen: the page's language, or the one just tapped.
  const [chosen, setChosen] = useState<Locale>(locale);
  useEffect(() => {
    setChosen(locale);
    const restored = (e: PageTransitionEvent) => { if (e.persisted) setChosen(locale); };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, [locale]);
  // A plain tap only: a modified click opens another tab and leaves this page as it is.
  const onClick = (e: MouseEvent<HTMLAnchorElement>, l: Locale) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    setChosen(l);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, l: Locale) => {
    if (e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const other = locales[(locales.indexOf(l) + 1) % locales.length];
    setChosen(other);
    window.location.assign(href(other));
  };
  return (
    <div role="radiogroup" aria-label={label} className="kf-seg grid grid-cols-2 gap-1.5 rounded-[1.375rem] p-1.5">
      {locales.map((l) => {
        const selected = l === locale;
        return (
          <a
            key={l}
            href={selected ? pathname : switchLocaleHref(locale, pathname)}
            lang={l}
            role="radio"
            aria-checked={l === chosen}
            tabIndex={selected ? 0 : -1}
            onClick={(e) => onClick(e, l)}
            onKeyDown={(e) => onKeyDown(e, l)}
            className="kf-seg-opt inline-flex min-h-[3rem] items-center justify-center rounded-[1.0625rem] px-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ENDONYM[l]}
          </a>
        );
      })}
    </div>
  );
}
