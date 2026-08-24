import { Locale } from '@/lib/i18n';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start">
        <h1 className="text-5xl font-bold mb-4 text-foreground">Privacy Policy</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: August 2026</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Information We Collect</h2>
        <p className="mb-6">We collect information you provide directly to us when you create an account, upload documents, or communicate with us. This includes your name, email, and the content of documents you upload to your knowledge bases.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">How We Use Your Information</h2>
        <p className="mb-6">We use the information we collect to operate our platform, process your documents into intelligent agents, and improve our services. We do not sell your personal data or document content.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Data Storage and Security</h2>
        <p className="mb-6">We use industry-standard security measures to protect your information. Your documents are stored securely and are only accessible to you and the AI agents you explicitly authorize.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Your Rights</h2>
        <p className="mb-6">You can view the documents you have uploaded, and the email address on your account, from your dashboard.</p>
        <p className="mb-6"><strong>Self-service deletion is not available yet.</strong> The dashboard does not currently provide a way to delete your account or your documents, or to change your account details. We are building a self-service deletion path. No release date has been set, and we will not state one here until there is one.</p>
        <p className="mb-6">Until then, you can request deletion of your account and its associated data by emailing <a className="underline" href="mailto:privacy@knowflow.ai">privacy@knowflow.ai</a> from the address you registered with.</p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Contact Us</h2>
        <p className="mb-6">If you have any questions about this Privacy Policy, please contact us at privacy@knowflow.ai.</p>
      </div>
    </div>
  );
}
