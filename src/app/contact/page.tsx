import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24">
      <div className="max-w-xl mx-auto px-6">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-12 text-center">Get in touch.</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 font-[family-name:var(--font-mono)] text-sm">
          <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)] text-center">
            <h2 className="text-[var(--muted-color)] uppercase tracking-widest mb-2 text-xs">General</h2>
            <a href="mailto:hello@knowflow.ai" className="text-[var(--accent-color)] hover:underline">hello@knowflow.ai</a>
          </div>
          <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)] text-center">
            <h2 className="text-[var(--muted-color)] uppercase tracking-widest mb-2 text-xs">Enterprise</h2>
            <a href="mailto:enterprise@knowflow.ai" className="text-[var(--accent-color)] hover:underline">enterprise@knowflow.ai</a>
          </div>
        </div>

        <form className="space-y-6">
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">Name</label>
            <input type="text" className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]" />
          </div>
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">Email</label>
            <input type="email" className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]" />
          </div>
          <div>
            <label className="block text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest mb-2">Message</label>
            <textarea rows={5} className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] px-4 py-3 focus:outline-none focus:border-[var(--accent-color)]"></textarea>
          </div>
          <button type="button" className="w-full bg-[var(--accent-color)] text-black py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
            Send Message
          </button>
        </form>

        <div className="text-center mt-12">
          <Link href="https://github.com/tornidomaroc-web/knowflow" className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm hover:text-[var(--accent-color)] underline transition-colors">
            View on GitHub
          </Link>
        </div>
      </div>
    </div>
  );
}
