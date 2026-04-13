export default function RefundPage() {
  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24">
      <div className="max-w-3xl mx-auto px-6 prose prose-invert prose-p:text-[var(--muted-color)] prose-headings:font-[family-name:var(--font-playfair)]">
        <h1 className="text-5xl font-bold mb-4">Refund Policy</h1>
        <p className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-12">Last updated: April 2025</p>

        <h2 className="text-2xl mt-8 mb-4">Section 1 — Free Plan</h2>
        <p className="mb-6">No charges apply to the free plan. No refund is necessary.</p>

        <h2 className="text-2xl mt-8 mb-4">Section 2 — Pro Plan</h2>
        <p className="mb-6">We offer a 7-day refund window from the date of first charge. To request a refund, contact us at support@tryknowflow.com with your account email. Refunds are processed within 5–10 business days.</p>

        <h2 className="text-2xl mt-8 mb-4">Section 3 — No Refunds After 7 Days</h2>
        <p className="mb-6">After 7 days from the charge date, refunds will not be issued. You may cancel your subscription at any time to avoid future charges.</p>

        <h2 className="text-2xl mt-8 mb-4">Section 4 — Contact</h2>
        <p className="mb-6">For any billing questions, contact: support@tryknowflow.com</p>
      </div>
    </div>
  );
}
