import type { Locale } from '@/lib/i18n';

/**
 * ONE DATE FORMAT FOR THE WHOLE APP (register #121, defect 5).
 *
 * Dates appeared in three shapes on production: `toLocaleDateString()` with
 * no locale (the browser's), `'en-GB'` inside the Arabic UI, and `'ar'`
 * (which picks Eastern Arabic digits on most engines). Every date now goes
 * through here: `ar-MA` for Arabic, which Morocco reads with Western digits
 * and Arabic month names, and `en-GB` for English, day-month-year in both.
 *
 * Wrap the result in `<bdi>` when it sits inside a sentence of the other
 * direction; the string itself carries no direction marks.
 */
export function formatDate(value: string | number | Date, locale: Locale): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}
