import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-xl mx-auto px-6">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-12 text-center">{t.contact.title}</h1>
        
        <div className="grid grid-cols-1 gap-6 mb-12 font-[family-name:var(--font-mono)] text-sm">
          <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)] text-center">
            <h2 className="text-[var(--muted-color)] uppercase tracking-widest mb-2 text-xs">{t.contact.general}</h2>
            <a href="mailto:hello@tryknowflow.com" className="text-[var(--accent-color)] hover:underline">hello@tryknowflow.com</a>
          </div>
        </div>

        <form className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">{t.contact.name}</label>
            <input type="text" className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]" />
          </div>
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">{t.contact.email}</label>
            <input type="email" className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]" />
          </div>
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">{t.contact.message}</label>
            <textarea rows={5} className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]"></textarea>
          </div>
          <button type="button" className="w-full bg-[var(--accent-color)] text-black py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
            {t.contact.send}
          </button>
        </form>

        <div className="text-center mt-12">
          <Link href="https://github.com/tornidomaroc-web/knowflow" className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm hover:text-[var(--accent-color)] underline transition-colors">
            {t.contact.githubText}
          </Link>
        </div>
      </div>
    </div>
  );
}
