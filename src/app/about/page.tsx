import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24">
      <div className="max-w-3xl mx-auto px-6 space-y-24">
        <section className="text-center">
          <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-6">We believe knowledge should work for you.</h1>
          <p className="text-lg text-[var(--muted-color)] leading-relaxed">KnowFlow turns your documents into intelligent agents that respond, learn, and execute — in Arabic and English.</p>
        </section>

        <section>
          <h2 className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-4">Our Mission</h2>
          <p className="text-2xl font-[family-name:var(--font-playfair)] leading-relaxed">We're building the first AI knowledge platform designed for Arabic-speaking businesses and teams.</p>
        </section>

        <section>
          <h2 className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--accent-color)] mb-8">Built on the shoulders of giants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)]">
              <h3 className="font-bold mb-2">MarkItDown by Microsoft</h3>
              <p className="text-sm text-[var(--muted-color)] font-[family-name:var(--font-mono)]">document intelligence</p>
            </div>
            <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)]">
              <h3 className="font-bold mb-2">Hermes Agent by NousResearch</h3>
              <p className="text-sm text-[var(--muted-color)] font-[family-name:var(--font-mono)]">autonomous learning</p>
            </div>
            <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)]">
              <h3 className="font-bold mb-2">Archon Workflows</h3>
              <p className="text-sm text-[var(--muted-color)] font-[family-name:var(--font-mono)]">deterministic execution</p>
            </div>
            <div className="border border-[var(--border-color)] p-6 bg-[var(--input-bg)]">
              <h3 className="font-bold mb-2">Claude by Anthropic</h3>
              <p className="text-sm text-[var(--muted-color)] font-[family-name:var(--font-mono)]">language understanding</p>
            </div>
          </div>
        </section>

        <section className="text-center pt-12 border-t border-[var(--border-color)]">
          <h2 className="text-3xl font-[family-name:var(--font-playfair)] font-bold mb-8">Ready to transform your knowledge?</h2>
          <Link href="/signup" className="inline-block bg-[var(--accent-color)] text-black px-8 py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
            Start Free
          </Link>
        </section>
      </div>
    </div>
  );
}
