import type { Locale } from '@/lib/i18n';

/**
 * ONE DATE FORMAT FOR THE WHOLE APP (register #121, defect 5).
 *
 * Dates appeared in three shapes on production: `toLocaleDateString()` with
 * no locale (the browser's), `'en-GB'` inside the Arabic UI, and `'ar'`
 * (which picks Eastern Arabic digits on most engines). Every date now goes
 * through here: `ar-u-nu-latn` for Arabic (the standard month names, يوليو and
 * أغسطس, which a Gulf student reads as well as a Moroccan one, with Western
 * digits; `ar-MA` gave the Moroccan يوليوز and غشت, review #122), and `en-GB`
 * for English, day-month-year in both.
 *
 * Wrap the result in `<bdi>` when it sits inside a sentence of the other
 * direction; the string itself carries no direction marks.
 */
export function formatDate(value: string | number | Date, locale: Locale): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * The home's date line (Step Redesign-2): the weekday and the day, derived
 * from the real date in the student's zone, never written by hand (the
 * mockup had "الأحد 12 أكتوبر" for a Monday). Western digits in both
 * languages, as formatDate. An unknown or invalid zone falls back to UTC.
 */
export function formatDayDate(value: string | number | Date, locale: Locale, timeZone?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { ...opts, timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', opts).format(d);
  }
}

