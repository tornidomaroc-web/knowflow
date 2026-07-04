import { Locale } from '@/lib/i18n';

export default async function RefundPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start">
        <h1 className="text-5xl font-bold mb-4 text-foreground">Refund Policy</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: April 2025</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 1 — Free Plan</h2>
        <p className="mb-6">No charges apply to the free plan. No refund is necessary.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 2 — Pro Plan</h2>
        <p className="mb-6">We offer a 7-day refund window from the date of first charge. To request a refund, contact us at support@tryknowflow.com with your account email. Refunds are processed within 5–10 business days.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 3 — No Refunds After 7 Days</h2>
        <p className="mb-6">After 7 days from the charge date, refunds will not be issued. You may cancel your subscription at any time to avoid future charges.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 4 — Contact</h2>
        <p className="mb-6">For any billing questions, contact: support@tryknowflow.com</p>
      </div>
    </div>
  );
}
