import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { locales } from '@/lib/i18n';

const PUBLIC_PATHS = ['', '/about', '/contact', '/pricing', '/privacy', '/terms', '/refund'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.flatMap((path) => {
    const languages = Object.fromEntries(
      locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
    );
    return locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1.0 : 0.7,
      alternates: { languages },
    }));
  });
}
