import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <>
      {/* 1. HERO */}
      <section className="relative overflow-hidden border-b border-border bg-background pt-24 pb-32">
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
            {/* #106: carried out of use case 01 before that block was deleted, not retyped.
                It is the one line on this page written in the student's own voice. */}
            <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto lg:mx-0">
              {t.hero.hook}
            </p>
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
              {/* LEFT OFF THE TOKEN SWEEP DELIBERATELY (#93). These three dots are a
                  PICTURE of a terminal title bar, not state and not identity. Tokenising
                  them would make all three gold and destroy the thing they depict, and
                  they sit on bg-muted in both themes where they stay legible. The rule
                  "green and red are state only" is about MEANING; these mean nothing. */}
              <div className="flex items-center px-4 py-3 border-b border-border bg-muted gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ps-4 text-muted-foreground text-xs">ask@knowflow</span>
              </div>
              <div className="p-6 space-y-4 text-foreground" dir="ltr">
                <p><span className="text-muted-foreground">&gt;</span> upload ./biology-notes.pdf</p>
                <p className="text-muted-foreground">[OK]</p>
                {/* The container is `font-mono`, and Tailwind's stock mono stack is Latin-only
                    (ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono,
                    Courier New) — no face in it carries Arabic, so this question was rendering
                    in an arbitrary system fallback: the exact defect layout.tsx:9-10 claims to
                    have fixed. Scoped to `font-sans` (= var(--font-rubik)) rather than adding
                    Rubik to a theme `mono` stack, because NO ordering of that stack is correct
                    on every platform: Rubik before the generic costs Latin its monospace on
                    Android (the Phase-8 target), and Rubik after it lets Windows' Courier New —
                    which does carry Arabic — win instead of our face. Register #92. */}
                <p><span className="text-muted-foreground">&gt;</span> ask &quot;<span className="font-sans">ما الفرق بين الانقسام المتساوي والمنصّف؟</span>&quot;</p>
                <p className="animate-pulse text-primary">▋</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS */}
      {/* #107: the header is sticky, so without a scroll margin the anchor the
          nav and the hero's second button point at scrolls this section's TOP
          EDGE to y=0 and puts it behind the bar. MEASURED, because the first
          version of this comment claimed the heading went under and it does
          not: at 390 the h2 landed at y=96 either way, since the section's own
          py-24 is taller than the header. What the margin buys is the space
          above the heading — 96px of clearance instead of 31px. The two values
          are the two header heights, h-16 on a phone and h-20 from md up. */}
      <section id="how-it-works" className="scroll-mt-16 md:scroll-mt-20 py-24 border-b border-border bg-surface">
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

      {/* 3. CTA SECTION */}
      <section className="py-32 border-b border-border bg-raised relative">
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
    </>
  );
}
