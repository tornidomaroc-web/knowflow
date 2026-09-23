import { useTranslation, Locale } from '@/lib/i18n';
import { SUPPORT_EMAIL } from '@/lib/site';
import { ContactActions } from '@/components/site/ContactActions';

/**
 * One honest route (register #19, 2026-09-23): the address, printed in plain
 * text, a `mailto:` button, and a copy button for a device with no mail app.
 * The form that stood here was inert by design (`type="button"`, no handler)
 * and is gone; a form that sends needs a mail service and a key, and a form
 * that opens the mail app with its fields fails on the same devices `mailto:`
 * does, while looking as if it worked.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-xl mx-auto px-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">{t.contact.title}</h1>
        <p className="text-muted-foreground mb-8">{t.contact.intro}</p>

        <div className="rounded-xl border border-border bg-surface shadow-soft p-6 mb-6">
          {/* Left-to-right and selectable in both locales: it is an address, not prose. */}
          <p dir="ltr" className="select-all break-all text-lg font-semibold text-foreground mb-5">
            {SUPPORT_EMAIL}
          </p>
          <ContactActions
            email={SUPPORT_EMAIL}
            labels={{
              emailButton: t.contact.emailButton,
              copyButton: t.contact.copyButton,
              copied: t.contact.copied,
              copyFailed: t.contact.copyFailed,
            }}
          />
        </div>

        <p className="text-sm text-muted-foreground mb-3">{t.contact.noMailApp}</p>
        <p className="text-sm text-muted-foreground">{t.contact.tip}</p>
      </div>
    </div>
  );
}
