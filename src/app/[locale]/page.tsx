import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen font-sans selection:bg-primary selection:text-primary-foreground">
      {/* 1. NAV */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">
            {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#how-it-works" className="transition-colors hover:text-primary">{t.nav.howItWorks}</Link>
            <Link href={`/${locale}/pricing`} className="transition-colors hover:text-primary">{t.nav.pricing}</Link>
            <Link href={`/${locale}/about`} className="transition-colors hover:text-primary">{t.nav.docs}</Link>
          </div>
          <Link href={`/${locale}/signup`} className="hidden md:inline-flex items-center justify-center rounded-xl border border-primary px-6 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            {t.nav.getStarted}
          </Link>
        </div>
      </nav>

      {/* 2. HERO */}
      <section className="relative overflow-hidden border-b border-border pt-24 pb-32">
        <div
          className="absolute inset-0 z-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }}
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className={`flex-1 text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="inline-block rounded-full border border-border bg-surface px-3 py-1 mb-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.hero.badge}
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
              {t.hero.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto lg:mx-0">
              {t.hero.subtitle}
            </p>
            <p className="text-base text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0">
              {t.hero.note}
            </p>
            <div className={`flex flex-col items-center ${isRtl ? 'lg:items-end' : 'lg:items-start'}`}>
              <div className={`flex flex-col sm:flex-row items-center justify-center ${isRtl ? 'lg:justify-end' : 'lg:justify-start'} gap-4 text-sm font-medium w-full`}>
                <Link href={`/${locale}/signup`} className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground px-8 py-4 hover:bg-primary-hover transition-colors whitespace-nowrap text-center">
                  {t.hero.cta1}
                </Link>
                <Link href="#how-it-works" className="w-full sm:w-auto rounded-xl border border-border bg-surface text-foreground px-8 py-4 hover:border-primary transition-colors whitespace-nowrap text-center">
                  {t.hero.cta2}
                </Link>
              </div>
              <p className={`mt-4 text-xs text-muted-foreground text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`}>
                {t.hero.disclaimer}
              </p>
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg lg:max-w-none mx-auto">
            <div className="rounded-2xl border border-border bg-surface font-mono text-sm overflow-hidden shadow-card">
              <div className="flex items-center px-4 py-3 border-b border-border bg-muted gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ps-4 text-muted-foreground text-xs">ask@knowflow</span>
              </div>
              <div className="p-6 space-y-4 text-foreground" dir="ltr">
                <p><span className="text-muted-foreground">&gt;</span> upload ./biology-notes.pdf</p>
                <p className="text-muted-foreground">[OK] Ready in 0.4s.</p>
                <p><span className="text-muted-foreground">&gt;</span> ask &quot;ما الفرق بين الانقسام المتساوي والمنصّف؟&quot;</p>
                <p className="animate-pulse text-primary">▋</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY KNOWFLOW */}
      <section className="py-16 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold">{t.features.title}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border rounded-2xl overflow-hidden bg-background" dir={isRtl ? "rtl" : "ltr"}>
            {t.features.items.map((item, idx) => (
              <div key={idx} className="py-10 px-6 text-center">
                <h3 className="text-xl font-semibold text-primary mb-4">{item.title}</h3>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. USE CASES */}
      <section className="py-24 border-b border-border relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t.usecases.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {t.usecases.items.map((feature) => (
              <div key={feature.num} className={`bg-background p-12 hover:bg-surface transition-colors ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
                <span className="block text-primary text-sm font-semibold mb-4">{feature.num}</span>
                <h3 className="text-2xl font-semibold mb-4">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t.howItWorks.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.howItWorks.steps.map((step, idx) => (
              <div key={idx} className={`rounded-2xl border border-border bg-background p-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
                <span className="block text-primary text-sm font-semibold mb-4">{step.step}</span>
                <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="py-32 border-b border-border relative">
        <div className="absolute inset-0 bg-primary opacity-[0.04]"></div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl font-bold mb-10">{t.cta.title}</h2>
          <Link
            href={`/${locale}/signup`}
            className="inline-block rounded-xl bg-primary text-primary-foreground px-10 py-4 text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            {t.cta.button}
          </Link>
          <p className="mt-8 text-xs text-muted-foreground">
            {t.cta.note}
          </p>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-12 bg-surface">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6" dir={isRtl ? "rtl" : "ltr"}>
          <div className="text-xl font-bold tracking-tight">
            {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs font-medium text-muted-foreground">
            <Link href={`/${locale}/privacy`} className="transition-colors hover:text-foreground">{t.footer.privacy}</Link>
            <Link href={`/${locale}/terms`} className="transition-colors hover:text-foreground">{t.footer.terms}</Link>
            <Link href={`/${locale}/refund`} className="transition-colors hover:text-foreground">{t.footer.refund}</Link>
            <Link href={`/${locale}/contact`} className="transition-colors hover:text-foreground">{t.footer.support}</Link>
            <Link href="https://github.com/tornidomaroc-web/knowflow" className="transition-colors hover:text-primary">{t.footer.github}</Link>
          </div>
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {t.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
