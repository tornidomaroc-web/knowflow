import { Locale } from '@/lib/i18n';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={`max-w-3xl mx-auto px-6 prose prose-invert prose-p:text-[var(--muted-color)] prose-headings:font-[family-name:var(--font-playfair)] ${isRtl ? 'text-right' : 'text-left'}`}>
        <h1 className="text-5xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-12">Last updated: April 2026</p>

        <h2 className="text-2xl mt-8 mb-4">Information We Collect</h2>
        <p className="mb-6">We collect information you provide directly to us when you create an account, upload documents, or communicate with us. This includes your name, email, and the content of documents you upload to your knowledge bases.</p>

        <h2 className="text-2xl mt-8 mb-4">How We Use Your Information</h2>
        <p className="mb-6">We use the information we collect to operate our platform, process your documents into intelligent agents, and improve our services. We do not sell your personal data or document content.</p>

        <h2 className="text-2xl mt-8 mb-4">Data Storage and Security</h2>
        <p className="mb-6">We use industry-standard security measures to protect your information. Your documents are stored securely and are only accessible to you and the AI agents you explicitly authorize.</p>

        <h2 className="text-2xl mt-8 mb-4">Your Rights</h2>
        <p className="mb-6">You have the right to access, update, or delete your personal information and documents at any time through your dashboard settings.</p>

        <h2 className="text-2xl mt-8 mb-4">Contact Us</h2>
        <p className="mb-6">If you have any questions about this Privacy Policy, please contact us at privacy@knowflow.ai.</p>
      </div>
    </div>
  );
}
