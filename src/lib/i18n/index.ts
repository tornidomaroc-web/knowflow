import { en } from './locales/en';
import { ar } from './locales/ar';

export type Locale = 'en' | 'ar';
export const locales = ['en', 'ar'] as const;

/**
 * ONE DEFAULT, AND IT IS ARABIC (register #83 (c), ruled 2026-09-25).
 *
 * Until this change the product had two: `middleware.ts` sent a browser it
 * could not place to `/ar`, while this constant and every client and server
 * fallback said `'en'`. A browser advertising French, ordinary in Morocco,
 * landed on `/ar` by one rule and was answered in English by the others. The
 * market is Morocco and the Gulf, so Arabic is the answer, and every fallback
 * now reads it from here through `resolveLocale` rather than restating it.
 */
export const defaultLocale: Locale = 'ar';

/**
 * THE REMEMBERED CHOICE (register #83 (a)). The middleware writes this cookie
 * with the locale of every page a student opens, so the language they last
 * used is the language `tryknowflow.com/` opens in next time, ahead of
 * `Accept-Language`. One year, because a choice of language does not expire.
 */
export const LOCALE_COOKIE = 'kf-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Any value from a URL, a form or a cookie, collapsed to a locale this app has. */
export function resolveLocale(value: unknown): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

/**
 * A language's name in its OWN language does not translate, so these are not
 * dictionary entries: "English" is English in the Arabic UI and "العربية" is
 * Arabic in the English one. The pair a student on the wrong locale has to
 * recognise is exactly the pair they cannot read in the other language.
 */
export const ENDONYM: Record<Locale, string> = { en: 'English', ar: 'العربية' };

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ar' : 'en';
}

/**
 * The same page in the other language. `usePathname()` carries no query string
 * and no hash, so a switch drops both; nothing in this app reads either on the
 * way in. A path without a locale prefix (never the case under `[locale]`, kept
 * for safety) goes to the other language's landing.
 */
export function switchLocaleHref(locale: Locale, pathname: string): string {
  const other = otherLocale(locale);
  return locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
    ? `/${other}${pathname.slice(locale.length + 1)}`
    : `/${other}`;
}

const dictionaries = {
  en,
  ar,
};

export function useTranslation(locale: Locale) {
  return dictionaries[locale] || dictionaries[defaultLocale];
}
