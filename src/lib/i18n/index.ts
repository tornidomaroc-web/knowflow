import { en } from './locales/en';
import { ar } from './locales/ar';

export type Locale = 'en' | 'ar';
export const locales = ['en', 'ar'] as const;
export const defaultLocale: Locale = 'en';

const dictionaries = {
  en,
  ar,
};

export function useTranslation(locale: Locale) {
  return dictionaries[locale] || dictionaries[defaultLocale];
}
