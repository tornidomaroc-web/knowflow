import { Locale } from '@/lib/i18n';
import { SUPPORT_EMAIL } from '@/lib/site';
import { PlatformText } from '@/components/platform/PlatformText';
import { AppStoreTerms } from '@/components/legal/AppStoreTerms';

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start [text-wrap:pretty]">
        <h1 className="text-[2rem] leading-[1.2] sm:text-5xl font-bold mb-4 text-foreground">Terms of Service</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: November 2026</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Acceptance of Terms</h2>
        <p className="mb-6">By accessing or using KnowFlow, you agree to be bound by these Terms of Service. They are an agreement between you and Abdelfettah Amellah, who operates KnowFlow; the contact address at the end of this page reaches the person responsible for it. If you do not agree to these terms, please do not use our platform.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Use of Service</h2>
        <p className="mb-6">You agree to use KnowFlow only for lawful purposes. You must not misuse the platform, attempt to reverse engineer our proprietary algorithms, or disrupt the service for other users.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">User Content</h2>
        <p className="mb-6">You retain full ownership of all documents and data you upload to your knowledge bases. You grant us the necessary licenses solely to process and serve this content back to you via your agents.</p>

        {/* Step Wording-1: the app's variant names no plan. It no longer says "nothing is sold inside this app": from build 9 the app sells KnowFlow Pro through the App Store (the section below). */}
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground"><PlatformText web="Payment Terms" app="Payments" /></h2>
        <p className="mb-6"><PlatformText web="Subscriptions to our Pro plan are billed on a monthly basis. You may cancel your subscription at any time without penalty, and you will retain access until the end of your billing cycle." app="Any payment made for a KnowFlow account is governed by the terms shown when it is made." /></p>

        {/* Apple 3.1.2 (item 4j, store step 1): the web always; the app only where the KnowFlowStore plugin answers (build 9). */}
        <AppStoreTerms />

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Limitation of Liability</h2>
        <p className="mb-6">KnowFlow and its AI agents attempt to provide accurate responses, but we cannot guarantee absolute correctness. We are not liable for any damages resulting from business decisions based on agent outputs.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Changes to Terms</h2>
        <p className="mb-6">We reserve the right to modify these terms at any time. We will notify you of any significant changes via email or an alert on the dashboard.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Contact</h2>
        <p className="mb-6">For legal inquiries regarding these terms, please contact {SUPPORT_EMAIL}.</p>
      </div>
    </div>
  );
}
