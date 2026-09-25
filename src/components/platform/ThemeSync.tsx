'use client';

import { useEffect } from 'react';
import { THEME_COOKIE, resolveTheme } from '@/lib/theme';

/**
 * THE SECOND HALF OF THE THEME BOOT, FOR THE ONE PAGE THAT NEEDS IT.
 *
 * The inline script in <head> sets `data-theme` before first paint, and on
 * every ordinary page that is the end of it: React hydrates the server's
 * <html> and leaves an attribute it never rendered alone. The 404 is not an
 * ordinary page. Next serves an unmatched URL as an error shell
 * (`<html id="__next_error__">`) that is CLIENT-RENDERED rather than
 * hydrated, and that render put the document back to the default after the
 * script had chosen light, whether or not the layout's JSX named the
 * attribute. Witnessed twice on the PR preview.
 *
 * So after mount this reads the same cookie the script read and restores the
 * attribute if the render lost it. On every other page it finds the attribute
 * already right and does nothing. It does not write the cookie: the script and
 * the toggle own that.
 */
export function ThemeSync() {
  useEffect(() => {
    const match = new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`).exec(document.cookie);
    const wanted = resolveTheme(match?.[1]);
    const html = document.documentElement;
    if (html.getAttribute('data-theme') !== wanted) html.setAttribute('data-theme', wanted);
  }, []);
  return null;
}
