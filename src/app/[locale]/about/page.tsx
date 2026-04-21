import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 space-y-24">
        <section className="text-center">
          <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-6">{t.about.title}</h1>
          <p className="text-lg text-[var(--muted-color)] leading-relaxed">{t.about.subtitle}</p>
        </section>

        <section>
          <h2 className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-4">{t.about.missionLabel}</h2>
          <p className="text-2xl font-[family-name:var(--font-playfair)] leading-relaxed">{t.about.mission}</p>
        </section>

        <section>
          <h2 className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-8">{t.about.giants}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {t.about.tools.map((tool, idx) => (
              <div key={idx} className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)]">
                <h3 className="font-bold mb-2">{tool.title}</h3>
                <p className="text-sm text-[var(--muted-color)] font-[family-name:var(--font-mono)]">{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center pt-12 border-t border-[var(--border-color)]">
          <h2 className="text-3xl font-[family-name:var(--font-playfair)] font-bold mb-8">{t.about.ctaTitle}</h2>
          <Link href={`/${locale}/signup`} className="inline-block bg-[var(--accent-color)] text-black px-8 py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
            {t.about.cta}
          </Link>
        </section>
      </div>
    </div>
  );
}
