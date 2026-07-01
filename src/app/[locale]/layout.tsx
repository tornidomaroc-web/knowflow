import '@/app/globals.css';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { locales, Locale, useTranslation } from '@/lib/i18n';
import { SITE_NAME, SITE_URL } from '@/lib/site';

// Rubik covers Latin + Arabic in a single family — fixes the prior fonts, which
// were Latin-only and left Arabic in an unstyled browser fallback.
const rubik = Rubik({ subsets: ['latin', 'arabic'], display: 'swap', variable: '--font-rubik' });

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};

  const t = useTranslation(locale as Locale);
  const title = `${SITE_NAME} — ${t.hero.title}`;
  const description = t.hero.subtitle;
  const url = `${SITE_URL}/${locale}`;

  const languages = Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}`]));

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: SITE_NAME,
    alternates: {
      canonical: url,
      languages: { ...languages, 'x-default': `${SITE_URL}/en` },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      alternateLocale: locales.filter((l) => l !== locale).map((l) => (l === 'ar' ? 'ar_AR' : 'en_US')),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={rubik.variable}>
      <body className="bg-[var(--bg-color)] text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
