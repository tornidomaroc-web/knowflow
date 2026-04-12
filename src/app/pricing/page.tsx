import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24">
      <div className="max-w-7xl mx-auto px-6 text-center mb-16">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">Simple, transparent pricing.</h1>
      </div>
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col">
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Free</h2>
          <div className="text-3xl font-bold mb-6">$0<span className="text-sm font-normal text-[var(--muted-color)]">/month</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• 1 Knowledge Base</li>
            <li>• 10 documents</li>
            <li>• 100 conversations/month</li>
            <li>• Web access only</li>
          </ul>
          <Link href="/signup" className="block text-center border border-[var(--border-color)] hover:border-[var(--accent-color)] py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors">
            Get Started
          </Link>
        </div>
        <div className="border-2 border-[var(--accent-color)] bg-[var(--input-bg)] p-8 flex flex-col relative">
          <div className="absolute top-0 right-0 bg-[var(--accent-color)] text-black px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest">Most Popular</div>
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Pro</h2>
          <div className="text-3xl font-bold mb-6">$49<span className="text-sm font-normal text-[var(--muted-color)]">/month</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• 10 Knowledge Bases</li>
            <li>• Unlimited documents</li>
            <li>• Unlimited conversations</li>
            <li>• Telegram + Slack + API</li>
            <li>• Priority support</li>
          </ul>
          <Link href="/signup" className="block text-center bg-[var(--accent-color)] text-black hover:opacity-90 py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest font-bold transition-opacity">
            Start Pro
          </Link>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col">
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Enterprise</h2>
          <div className="text-3xl font-bold mb-6">Custom</div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• Unlimited everything</li>
            <li>• Custom domain</li>
            <li>• Dedicated support</li>
            <li>• SLA guarantee</li>
          </ul>
          <Link href="/contact" className="block text-center border border-[var(--border-color)] hover:border-[var(--accent-color)] py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
