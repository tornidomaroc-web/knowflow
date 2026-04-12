import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] selection:bg-[var(--accent-color)] selection:text-black">
      {/* 1. NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--border-color)] bg-[var(--bg-color)]/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-wider">
            Know<span className="text-[var(--accent-color)]">Flow</span>
          </div>
          <div className="hidden md:flex items-center space-x-8 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest text-[var(--muted-color)]">
            <Link href="#how-it-works" className="hover:text-[var(--accent-color)] transition-colors">How it works</Link>
            <Link href="/pricing" className="hover:text-[var(--accent-color)] transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-[var(--accent-color)] transition-colors">Docs</Link>
          </div>
          <Link href="/signup" className="hidden border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-black md:inline-flex items-center justify-center px-6 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* 2. HERO */}
      <section className="relative pt-24 pb-32 overflow-hidden border-b border-[var(--border-color)]">
        <div 
          className="absolute inset-0 z-0 opacity-10" 
          style={{ backgroundImage: 'linear-gradient(to right, var(--border-color) 1px, transparent 1px), linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }} 
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-block border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-1 mb-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
              Open Source · MIT License
            </div>
            <h1 className="text-5xl lg:text-7xl font-[family-name:var(--font-playfair)] font-bold tracking-tight mb-8 leading-tight">
              Your documents.<br />
              <span className="text-[var(--muted-color)] italic">Your agent.</span><br />
              <span className="text-[var(--accent-color)]">Your language.</span>
            </h1>
            <p className="text-lg text-[var(--muted-color)] mb-10 max-w-2xl mx-auto lg:mx-0">
              Upload any file. Define your goal. Get an agent that responds, learns, and executes — in Arabic and English.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 font-[family-name:var(--font-mono)] uppercase text-sm tracking-widest">
              <Link href="/signup" className="w-full sm:w-auto bg-[var(--accent-color)] text-black px-8 py-4 hover:opacity-90 transition-opacity whitespace-nowrap">
                Start Free
              </Link>
              <Link href="/about" className="w-full sm:w-auto border border-[var(--border-color)] bg-[var(--input-bg)] text-white px-8 py-4 hover:border-[var(--accent-color)] transition-colors whitespace-nowrap">
                View Docs
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg lg:max-w-none mx-auto">
            <div className="border border-[var(--border-color)] bg-[var(--input-bg)] font-[family-name:var(--font-mono)] text-sm overflow-hidden shadow-2xl">
              <div className="flex items-center px-4 py-3 border-b border-[var(--border-color)] bg-[#070d0a] space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 opacity-50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 opacity-50"></div>
                <span className="pl-4 text-[var(--muted-color)] text-xs tracking-widest">agent@knowflow</span>
              </div>
              <div className="p-6 space-y-4 text-green-400">
                <p><span className="text-[var(--muted-color)]">&gt;</span> markitdown ingest ./policy.pdf</p>
                <p className="text-[var(--muted-color)]">[OK] Document indexed in 0.4s.</p>
                <p><span className="text-[var(--muted-color)]">&gt;</span> ask "ما هي سياسة الإجازات؟"</p>
                <p className="animate-pulse">▋</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STATS BAR */}
      <section className="border-b border-[var(--border-color)] bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
          <div className="py-10 lg:py-12 px-6 text-center">
            <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold text-[var(--accent-color)] mb-2">Any Format</h3>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">PDF · DOCX · XLSX · MP3</p>
          </div>
          <div className="py-10 lg:py-12 px-6 text-center">
            <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold text-[var(--accent-color)] mb-2">Arabic First</h3>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">RTL Native</p>
          </div>
          <div className="py-10 lg:py-12 px-6 text-center">
            <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold text-[var(--accent-color)] mb-2">0 Lines of Code</h3>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">No technical skills needed</p>
          </div>
          <div className="py-10 lg:py-12 px-6 text-center">
            <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold text-[var(--accent-color)] mb-2">Learns</h3>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">Improves with every question</p>
          </div>
        </div>
      </section>

      {/* 4. FEATURES */}
      <section className="py-24 border-b border-[var(--border-color)] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border-color)] border border-[var(--border-color)]">
            {[
              { id: '01', title: 'Ingest anything' },
              { id: '02', title: 'Persistent memory' },
              { id: '03', title: 'Telegram · Slack · API' },
              { id: '04', title: 'Deterministic workflows' },
              { id: '05', title: 'Multi-tenant ready' },
              { id: '06', title: 'Arabic first' },
            ].map((feature) => (
              <div key={feature.id} className="bg-[var(--bg-color)] p-12 hover:bg-[var(--input-bg)] transition-colors">
                <span className="block font-[family-name:var(--font-mono)] text-[var(--muted-color)] text-sm mb-4">{feature.id}</span>
                <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-bold">{feature.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-b border-[var(--border-color)] bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">How it works</h2>
            <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest text-[var(--muted-color)]">Three steps to your agent</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-[var(--border-color)] bg-[var(--bg-color)] p-8">
              <span className="text-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm mb-4 block">Step 1</span>
              <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-4">Upload your content</h3>
              <p className="text-[var(--muted-color)] text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest">→ powered by MarkItDown</p>
            </div>
            <div className="border border-[var(--border-color)] bg-[var(--bg-color)] p-8">
              <span className="text-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm mb-4 block">Step 2</span>
              <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-4">Agent learns</h3>
              <p className="text-[var(--muted-color)] text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest">→ powered by Hermes Agent</p>
            </div>
            <div className="border border-[var(--border-color)] bg-[var(--bg-color)] p-8">
              <span className="text-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm mb-4 block">Step 3</span>
              <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-4">Executes precisely</h3>
              <p className="text-[var(--muted-color)] text-sm font-[family-name:var(--font-mono)] uppercase tracking-widest">→ powered by Archon Workflows</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="py-32 border-b border-[var(--border-color)] relative">
        <div className="absolute inset-0 bg-[var(--accent-color)] opacity-[0.03]"></div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-10">Ready to start?</h2>
          <form className="flex flex-col sm:flex-row max-w-lg mx-auto font-[family-name:var(--font-mono)] text-sm">
            <input 
              type="email" 
              placeholder="name@company.com" 
              className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] px-6 py-4 focus:outline-none focus:border-[var(--accent-color)]"
            />
            <button type="button" className="bg-[var(--accent-color)] text-black px-8 py-4 uppercase tracking-widest font-bold hover:opacity-90 transition-opacity mt-4 sm:mt-0">
              Start Now
            </button>
          </form>
          <p className="mt-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
            Open Source · MIT License
          </p>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-12 bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="font-[family-name:var(--font-playfair)] text-xl font-bold tracking-wider mb-6 md:mb-0">
            Know<span className="text-[var(--accent-color)]">Flow</span>
          </div>
          <div className="flex space-x-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="https://github.com/tornidomaroc-web/knowflow" className="hover:text-[var(--accent-color)] transition-colors">GitHub</Link>
          </div>
          <div className="mt-6 md:mt-0 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-color)]">
            &copy; {new Date().getFullYear()} KnowFlow. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
