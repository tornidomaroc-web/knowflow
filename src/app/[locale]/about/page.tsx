import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 space-y-24">
        <section className="text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">{t.about.title}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{t.about.subtitle}</p>
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wide font-medium text-primary mb-4">{t.about.missionLabel}</h2>
          <p className="text-2xl leading-relaxed">{t.about.mission}</p>
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wide font-medium text-primary mb-8">{t.about.giants}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {t.about.tools.map((tool, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-surface shadow-soft p-6">
                <h3 className="font-semibold mb-2">{tool.title}</h3>
                <p className="text-sm text-muted-foreground">{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center pt-12 border-t border-border">
          <h2 className="text-3xl font-semibold mb-8">{t.about.ctaTitle}</h2>
          <Link href={`/${locale}/signup`} className="inline-block rounded-xl bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold hover:bg-primary-hover transition-colors">
            {t.about.cta}
          </Link>
        </section>
      </div>
    </div>
  );
}
