/**
 * THE THEME, AND HOW IT IS CHOSEN (register #46, ruled 2026-09-25).
 *
 * The product is dark by default (register #101) and now carries a real light
 * theme and a toggle. The choice lives in ONE cookie, `kf-theme`, and lands on
 * `<html data-theme="…">` before first paint through the inline script below,
 * so a student who chose light never sees a dark flash, and a page that is
 * prerendered static (every marketing page) needs no server read to honour it.
 *
 * WHY A COOKIE AND NOT localStorage. A cookie travels with the request, so a
 * server render can read it later if a screen ever needs to; localStorage
 * cannot be read on the server at all. The cookie is not read by any server
 * code today, and it does not have to be for the attribute to be right, because
 * the script runs first.
 *
 * WHY THE SCRIPT IS A STRING AND NOT A COMPONENT. It has to run before React
 * hydrates, in the `<head>`, with no imports, so it is inlined verbatim. It is
 * also executed by `scripts/verify-theme.mjs` against a fake document, which is
 * the only way an inline script gets a test.
 */
export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'kf-theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_THEME: Theme = 'dark';

export function resolveTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

/**
 * Runs in `<head>` before paint. Order of precedence:
 *   1. `?theme=light|dark` in the URL, which also WRITES the cookie. This is
 *      how a link can open the app in a theme (the preview route uses it), and
 *      it is no more than a student could do from the toggle.
 *   2. The `kf-theme` cookie.
 *   3. Dark.
 * It sets `data-theme` on <html>, which every token in globals.css keys off.
 * `color-scheme` follows through CSS (`:root` / `[data-theme]` in globals.css),
 * so form controls, scrollbars and the UA's own surfaces match.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var m=/[?&]theme=(light|dark)\\b/.exec(location.search);var t=m?m[1]:null;if(t){document.cookie='${THEME_COOKIE}='+t+';path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax'}else{var c=/(?:^|; )${THEME_COOKIE}=(light|dark)/.exec(document.cookie);t=c?c[1]:'dark'}d.setAttribute('data-theme',t)}catch(e){}})()`;

/** The client half of the toggle: apply now, and remember. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
}

/** What the document shows right now; the toggle's initial state after hydration. */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return resolveTheme(document.documentElement.getAttribute('data-theme'));
}
