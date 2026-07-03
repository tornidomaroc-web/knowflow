import { Locale } from '@/lib/i18n';

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="bg-background text-foreground min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start">
        <h1 className="text-5xl font-bold mb-4 text-foreground">Terms of Service</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: April 2026</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Acceptance of Terms</h2>
        <p className="mb-6">By accessing or using KnowFlow, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Use of Service</h2>
        <p className="mb-6">You agree to use KnowFlow only for lawful purposes. You must not misuse the platform, attempt to reverse engineer our proprietary algorithms, or disrupt the service for other users.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">User Content</h2>
        <p className="mb-6">You retain full ownership of all documents and data you upload to your knowledge bases. You grant us the necessary licenses solely to process and serve this content back to you via your agents.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Payment Terms</h2>
        <p className="mb-6">Subscriptions to our Pro plan are billed on a monthly basis. You may cancel your subscription at any time without penalty, and you will retain access until the end of your billing cycle.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Limitation of Liability</h2>
        <p className="mb-6">KnowFlow and its AI agents attempt to provide accurate responses, but we cannot guarantee absolute correctness. We are not liable for any damages resulting from business decisions based on agent outputs.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Changes to Terms</h2>
        <p className="mb-6">We reserve the right to modify these terms at any time. We will notify you of any significant changes via email or an alert on the dashboard.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Contact</h2>
        <p className="mb-6">For legal inquiries regarding these terms, please contact legal@knowflow.ai.</p>
      </div>
    </div>
  );
}
