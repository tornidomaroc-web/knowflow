import { Locale } from '@/lib/i18n';

export default async function RefundPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start">
        <h1 className="text-5xl font-bold mb-4 text-foreground">Refund Policy</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: September 2026</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 1: Free Plan</h2>
        <p className="mb-6">No charges apply to the free plan. No refund is necessary.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 2: Pro Plan</h2>
        <p className="mb-6">KnowFlow Pro is sold through Paddle, which is the merchant of record for every purchase, so refunds are requested from Paddle and decided by Paddle. To ask for one, contact Paddle Order Support at <a className="underline" href="https://paddle.net">paddle.net</a> with the email address on your account. You can also write to us at support@tryknowflow.com and we will raise it with Paddle for you. The <a className="underline" href="https://www.paddle.com/legal/refund-policy">refund policy Paddle publishes</a> applies; we do not add a separate window of our own.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 3: Cancelling</h2>
        <p className="mb-6">You can cancel your subscription at any time from Settings in your dashboard. Cancelling stops any future charge, and you keep Pro until the end of the period you have already paid for.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 4: Contact</h2>
        <p className="mb-6">For any billing questions, contact: support@tryknowflow.com</p>
      </div>
    </div>
  );
}
