import '@/app/globals.css';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { locales, Locale, useTranslation } from '@/lib/i18n';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from '@/lib/theme';

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
  const title = `${SITE_NAME} · ${t.hero.title}`;
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
      // `ar_AR` IS CORRECT AND WAS LEFT ALONE ON PURPOSE. It was raised as a bug
      // on the reading that `AR` is the ISO 3166 code for Argentina, which it is
      // — but og:locale is not ISO. It is Facebook's own `ll_CC` registry, and
      // `ar_AR` is one of exactly two deliberate non-ISO entries in it (the
      // other is `es_LA`), used as the umbrella locale for Arabic; the published
      // list gives it under the heading "Arabic". Verified 2026-09-13 against
      // Facebook's locale list rather than from memory. Since the channel this
      // matters for is a WhatsApp share, the crawler reading this tag is Meta's
      // own, so Meta's registry is the authority and not a stand-in for one.
      // Changing this to `ar` (not `ll_CC` at all) or `ar_MA` (not in the list)
      // would take a working value and make it unrecognised.
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
    // `data-theme` is the server's default and the boot script's target: the
    // script in <head> replaces it from the kf-theme cookie before first paint,
    // which is why `suppressHydrationWarning` is on this element and only this
    // one (register #46; `src/lib/theme.ts` has the rule).
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={rubik.variable}
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
