import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-xl mx-auto px-6">
        <h1 className="text-5xl font-bold tracking-tight mb-12 text-center">{t.contact.title}</h1>

        <div className="grid grid-cols-1 gap-6 mb-12 text-sm">
          <div className="rounded-xl border border-border bg-surface shadow-soft p-6 text-center">
            <h2 className="text-muted-foreground uppercase tracking-wide mb-2 text-xs font-medium">{t.contact.general}</h2>
            <a href="mailto:hello@tryknowflow.com" className="text-primary hover:underline">hello@tryknowflow.com</a>
          </div>
        </div>

        {/*
          NOTE: this form is intentionally inert (no onSubmit / no handler) — the
          working contact path is the mailto above and the GitHub link below.
          Tracked as register #19; wire-or-make-mailto-only is a later decision,
          not part of this restyle. Do not add a fake submit handler.
        */}
        <form className="space-y-6 text-start">
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-wide font-medium mb-2">{t.contact.name}</label>
            <input type="text" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-wide font-medium mb-2">{t.contact.email}</label>
            <input type="email" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-wide font-medium mb-2">{t.contact.message}</label>
            <textarea rows={5} className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"></textarea>
          </div>
          <button type="button" className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-sm font-semibold hover:bg-primary-hover transition-colors">
            {t.contact.send}
          </button>
        </form>

        <div className="text-center mt-12">
          <Link href="https://github.com/tornidomaroc-web/knowflow" className="text-muted-foreground text-sm hover:text-primary underline transition-colors">
            {t.contact.githubText}
          </Link>
        </div>
      </div>
    </div>
  );
}
