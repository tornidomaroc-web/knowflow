import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] selection:bg-[var(--accent-color)] selection:text-black">
      {/* 1. NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--border-color)] bg-[var(--bg-color)]/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-wider">
            {t.nav.home.replace('Flow', '')}<span className="text-[var(--accent-color)]">Flow</span>
          </div>
          <div className="hidden md:flex items-center space-x-8 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest text-[var(--muted-color)]">
            <Link href="#how-it-works" className="hover:text-[var(--accent-color)] transition-colors">{t.nav.howItWorks}</Link>
            <Link href={`/${locale}/pricing`} className="hover:text-[var(--accent-color)] transition-colors">{t.nav.pricing}</Link>
            <Link href={`/${locale}/about`} className="hover:text-[var(--accent-color)] transition-colors">{t.nav.docs}</Link>
          </div>
          <Link href={`/${locale}/signup`} className="hidden border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-black md:inline-flex items-center justify-center px-6 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors">
            {t.nav.getStarted}
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
          <div className={`flex-1 text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="inline-block border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-1 mb-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
              {t.hero.badge}
            </div>
            <h1 className="text-5xl lg:text-7xl font-[family-name:var(--font-playfair)] font-bold tracking-tight mb-8 leading-tight">
              {t.hero.title}
            </h1>
            <p className={`text-lg text-[var(--muted-color)] mb-4 max-w-2xl mx-auto ${isRtl ? 'lg:mx-0' : 'lg:mx-0'}`}>
              {t.hero.subtitle}
            </p>
            <p className={`text-base text-[var(--muted-color)] mb-10 max-w-2xl mx-auto ${isRtl ? 'lg:mx-0' : 'lg:mx-0'}`}>
              {t.hero.note}
            </p>
            <div className={`flex flex-col items-center ${isRtl ? 'lg:items-end' : 'lg:items-start'}`}>
              <div className={`flex flex-col sm:flex-row items-center justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'} gap-4 font-[family-name:var(--font-mono)] uppercase text-sm tracking-widest w-full`}>
                <Link href={`/${locale}/signup`} className="w-full sm:w-auto bg-[var(--accent-color)] text-black px-8 py-4 hover:opacity-90 transition-opacity whitespace-nowrap text-center">
                  {t.hero.cta1}
                </Link>
                <Link href="#how-it-works" className="w-full sm:w-auto border border-[var(--border-color)] bg-[var(--input-bg)] text-white px-8 py-4 hover:border-[var(--accent-color)] transition-colors whitespace-nowrap text-center">
                  {t.hero.cta2}
                </Link>
              </div>
              <p className={`mt-4 text-xs tracking-widest text-[var(--muted-color)] text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`}>
                {t.hero.disclaimer}
              </p>
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg lg:max-w-none mx-auto">
            <div className="border border-[var(--border-color)] bg-[var(--input-bg)] font-[family-name:var(--font-mono)] text-sm overflow-hidden shadow-2xl">
              <div className="flex items-center px-4 py-3 border-b border-[var(--border-color)] bg-[#070d0a] space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 opacity-50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 opacity-50"></div>
                <span className="pl-4 text-[var(--muted-color)] text-xs tracking-widest">ask@knowflow</span>
              </div>
              <div className="p-6 space-y-4 text-green-400" dir="ltr">
                <p><span className="text-[var(--muted-color)]">&gt;</span> upload ./biology-notes.pdf</p>
                <p className="text-[var(--muted-color)]">[OK] Ready in 0.4s.</p>
                <p><span className="text-[var(--muted-color)]">&gt;</span> ask "ما الفرق بين الانقسام المتساوي والمنصّف؟"</p>
                <p className="animate-pulse">▋</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY KNOWFLOW */}
      <section className="py-16 border-b border-[var(--border-color)] bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-[family-name:var(--font-playfair)] font-bold text-white">{t.features.title}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)] border border-[var(--border-color)] bg-[var(--bg-color)]" dir={isRtl ? "rtl" : "ltr"}>
            {t.features.items.map((item, idx) => (
              <div key={idx} className="py-10 px-6 text-center">
                <h3 className="text-xl font-[family-name:var(--font-playfair)] font-bold text-[var(--accent-color)] mb-4">{item.title}</h3>
                <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. USE CASES */}
      <section className="py-24 border-b border-[var(--border-color)] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-[family-name:var(--font-playfair)] font-bold text-white mb-4">{t.usecases.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-color)] border border-[var(--border-color)]">
            {t.usecases.items.map((feature) => (
              <div key={feature.num} className={`bg-[var(--bg-color)] p-12 hover:bg-[var(--input-bg)] transition-colors ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
                <span className="block font-[family-name:var(--font-mono)] text-[var(--accent-color)] text-sm mb-4">{feature.num}</span>
                <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-[var(--muted-color)]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-b border-[var(--border-color)] bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">{t.howItWorks.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.howItWorks.steps.map((step, idx) => (
              <div key={idx} className={`border border-[var(--border-color)] bg-[var(--bg-color)] p-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
                <span className="text-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm mb-4 block">{step.step}</span>
                <h3 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-4">{step.title}</h3>
                <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="py-32 border-b border-[var(--border-color)] relative">
        <div className="absolute inset-0 bg-[var(--accent-color)] opacity-[0.03]"></div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-10">{t.cta.title}</h2>
          <Link
            href={`/${locale}/signup`}
            className="inline-block bg-[var(--accent-color)] text-black px-10 py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-widest font-bold hover:opacity-90 transition-opacity"
          >
            {t.cta.button}
          </Link>
          <p className="mt-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
            {t.cta.note}
          </p>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-12 bg-[var(--input-bg)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between" dir={isRtl ? "rtl" : "ltr"}>
          <div className="font-[family-name:var(--font-playfair)] text-xl font-bold tracking-wider mb-6 md:mb-0">
            {t.nav.home.replace('Flow', '')}<span className="text-[var(--accent-color)]">Flow</span>
          </div>
          <div className="flex space-x-6 font-[family-name:var(--font-mono)] text-xs flex-wrap justify-center uppercase tracking-widest text-[var(--muted-color)] gap-4 space-x-0 sm:space-x-6 sm:gap-0">
            <Link href={`/${locale}/privacy`} className="hover:text-white transition-colors">{t.footer.privacy}</Link>
            <Link href={`/${locale}/terms`} className="hover:text-white transition-colors">{t.footer.terms}</Link>
            <Link href={`/${locale}/refund`} className="hover:text-white transition-colors">{t.footer.refund}</Link>
            <Link href="https://github.com/tornidomaroc-web/knowflow" className="hover:text-[var(--accent-color)] transition-colors">{t.footer.github}</Link>
          </div>
          <div className="mt-6 md:mt-0 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-color)]">
            &copy; {new Date().getFullYear()} {t.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
