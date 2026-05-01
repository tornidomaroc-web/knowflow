import { useTranslation, Locale } from '@/lib/i18n';

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">{t.legal.terms.title}</h1>
        <p className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--muted-color)] mb-12">{t.legal.terms.lastUpdated}</p>
        <p className="text-lg text-[var(--muted-color)] mb-12">{t.legal.terms.intro}</p>
        {t.legal.terms.sections.map((section, idx) => (
          <div key={idx} className="mb-10">
            <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-4">{section.heading}</h2>
            <p className="text-[var(--muted-color)]">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
