import { LOCALE_COOKIE, locales, type Locale } from '@/lib/i18n';

export { LOCALE_COOKIE };

/**
 * WHICH LANGUAGE AN AUTH LANDING OPENS IN (register #132).
 *
 * `/api/auth/callback` used to land every link and every provider return on an
 * UNPREFIXED path, and left the language to the middleware's rule for a path
 * without one (#83): the `kf-locale` cookie, else the browser's first
 * `Accept-Language` tag, else Arabic. That rule is right for a first visit and
 * wrong for a mail link opened on a second device: the student chose a language
 * at signup, and the phone that opens the mail has no cookie, so its own
 * language won. Witnessed 2026-09-28: a signup at /ar/signup confirmed on an
 * iPhone opened the dashboard in English.
 *
 * The order here is #83's order with the ACCOUNT'S choice inserted where the
 * browser's guess used to come:
 *
 *   1. the `kf-locale` cookie: this device's latest choice, which the middleware
 *      would honour first anyway. A student who signed up in Arabic and later
 *      switched to English on this device keeps English here; the stored
 *      choice is only for a device that has none.
 *   2. the account's stored choice, written into user metadata by the signup
 *      page and read back from the verified user. Survives the device change.
 *   3. a `locale` the LINK itself carries. Nothing sends one today; the mail
 *      templates can (`{{ .Data.locale }}`, the same metadata, row #134), and
 *      it is the only signal a REFUSED link has, since no user is known then.
 *   4. none: the path stays unprefixed and the middleware decides as before,
 *      so an account with no stored choice (Google, or older than this rule)
 *      behaves exactly as it did.
 *
 * Every candidate is collapsed to one of `locales` or dropped. The prefix can
 * therefore only ever be `/ar` or `/en`, and the path it is put in front of is
 * one this route composes itself, so a hand-edited link or a crafted metadata
 * value can neither redirect off-origin nor produce a path this app lacks.
 * This is deliberately NOT `resolveLocale`: that falls back to Arabic, which
 * would take the decision away from the middleware for every account without a
 * stored choice and change their landing.
 */
export function landingLocale(input: {
  cookie?: unknown;
  stored?: unknown;
  link?: unknown;
}): Locale | null {
  for (const candidate of [input.cookie, input.stored, input.link]) {
    if (locales.includes(candidate as Locale)) return candidate as Locale;
  }
  return null;
}

/** `/dashboard` with `ar` is `/ar/dashboard`; with null it is `/dashboard`, untouched. */
export function localisePath(path: string, locale: Locale | null): string {
  return locale ? `/${locale}${path}` : path;
}
