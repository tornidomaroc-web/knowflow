import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation, Locale } from '@/lib/i18n';
import { ChatPages, Flame, QuizCheck, SparkBook, Trophy, UploadCloud } from '@/components/illustrations';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { Reveal } from '@/components/landing/Reveal';
import { Parallax } from '@/components/landing/Parallax';

/**
 * THE LANDING, AS THE SHOWPIECE (Part C, 2026-09-25; docs/design/VISUAL_LANGUAGE.md).
 *
 * Five sections, each one idea: the hero shows the product WORKING (the
 * question writes itself, the answer sweeps in, the sources appear, the study
 * kit pops), three steps with an illustration each, four things you get,
 * Arabic-first with English beside it, and one last invitation. Sections
 * rise as they enter the viewport (`Reveal`), the hero's shapes drift with
 * the scroll on a desk (`Parallax`), and every one of those motions has its
 * base state as its final state, so with reduced motion the page is simply
 * there. No images, no library: inline SVG and CSS transforms, for a
 * mid-range phone.
 *
 * Everything #108 and #109 measured about the fold still holds: the answer
 * card sits between the words and the buttons on a phone, and the two buttons
 * stay side by side.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const L = t.landing;

  // ONE picture per card, and it is the card's meaning (review 2026-09-25,
  // #122): a summary is a book that sparks, a quiz is a checklist, an answer
  // with its source is pages that talk, a streak is a flame.
  const features = [
    { art: <SparkBook size={72} />, ...L.features[0] },
    { art: <QuizCheck size={72} />, ...L.features[1] },
    { art: <ChatPages size={72} />, ...L.features[2] },
    { art: <Flame size={72} />, ...L.features[3] },
  ];
  // The steps are upload, ask, get the answer: a cloud, pages that talk, a book
  // that sparks. The first version had the book on upload and the cloud on ask.
  const stepArt = [<UploadCloud key="a" size={72} />, <ChatPages key="b" size={72} />, <SparkBook key="c" size={72} />];
  const stepTint = ['bg-mint-subtle text-mint', 'bg-sky-subtle text-sky', 'bg-violet-subtle text-violet'];

  return (
    <>
      <Parallax />

      {/* 1. HERO */}
      <section className="relative overflow-hidden border-b border-border bg-background pt-10 pb-24 lg:pt-20 lg:pb-32">
        <div
          className="absolute inset-0 z-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }}
        />
        {/* Three floating shapes at three depths. 0.08 gold is #109's measured
            ceiling under text; the tints are used at the same opacity. */}
        <div aria-hidden="true" data-depth="0.12" className="hero-float pointer-events-none absolute z-0" style={{ top: '-7rem', insetInlineEnd: '-7rem', width: '26rem', height: '26rem', opacity: 0.08, background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
        <div aria-hidden="true" data-depth="0.22" className="hero-float hero-float-2 pointer-events-none absolute z-0" style={{ bottom: '-9rem', insetInlineStart: '-9rem', width: '22rem', height: '22rem', opacity: 0.08, background: 'radial-gradient(circle, var(--violet) 0%, transparent 70%)' }} />
        <div aria-hidden="true" data-depth="0.3" className="hero-float hero-float-3 pointer-events-none absolute z-0 hidden lg:block" style={{ top: '40%', insetInlineStart: '38%', width: '14rem', height: '14rem', opacity: 0.08, background: 'radial-gradient(circle, var(--mint) 0%, transparent 70%)' }} />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-x-16 gap-y-6 px-6 lg:grid-cols-2 lg:gap-y-10">
          <div className={`text-center lg:col-start-1 lg:row-start-1 ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={dir}>
            <div className="rise mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground sm:mb-6">
              <span className="h-2 w-2 rounded-full bg-mint" />
              {t.hero.badge}
            </div>
            <h1 className="rise rise-1 mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-7xl">
              {t.hero.title}
            </h1>
            <p className="rise rise-2 mx-auto max-w-2xl text-lg text-muted-foreground lg:mx-0">{t.hero.hook}</p>
          </div>

          <div className="rise rise-2 mx-auto w-full max-w-lg lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:max-w-none">
            <HeroDemo
              rtl={isRtl}
              copy={{ question: t.answer.question, body: t.answer.body, files: t.answer.files, summaryReady: L.kitSummary, quizReady: L.kitQuiz }}
            />
          </div>

          <div className={`rise rise-3 flex flex-col items-center lg:col-start-1 lg:row-start-2 ${isRtl ? 'lg:items-end' : 'lg:items-start'}`}>
            <div className={`flex w-full flex-wrap items-center justify-center gap-3 text-sm font-medium sm:gap-4 ${isRtl ? 'lg:justify-end' : 'lg:justify-start'}`}>
              <Link href={`/${locale}/signup`} className="pressable liftable whitespace-nowrap rounded-xl bg-primary px-5 py-4 text-center text-primary-foreground transition-colors hover:bg-primary-hover sm:px-8">
                {t.hero.cta1}
              </Link>
              <Link href="#how-it-works" className="pressable whitespace-nowrap rounded-xl border border-border bg-surface px-5 py-4 text-center text-foreground transition-colors hover:border-primary sm:px-8">
                {t.hero.cta2}
              </Link>
            </div>
            <p className={`mt-4 text-center text-xs text-muted-foreground ${isRtl ? 'lg:text-right' : 'lg:text-left'}`}>{t.hero.disclaimer}</p>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS: three steps, an illustration each. */}
      <section id="how-it-works" className="scroll-mt-16 border-b border-border bg-surface py-20 md:scroll-mt-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase text-accent">{L.howEyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl lg:text-5xl">{t.howItWorks.title}</h2>
          </Reveal>
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {t.howItWorks.steps.map((step, idx) => (
              <Reveal key={idx} as="li" delay={(idx + 1) as 1 | 2 | 3} className="liftable rounded-2xl border border-border bg-raised p-7 shadow-card">
                <div className="flex items-start justify-between gap-4" dir={dir}>
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${stepTint[idx]}`}>{idx + 1}</span>
                  {stepArt[idx]}
                </div>
                <h3 className="mt-5 text-xl font-semibold sm:text-2xl" dir={dir}>{step.title}</h3>
                <p className="mt-2 text-muted-foreground" dir={dir}>{step.desc}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. WHAT YOU GET: four tiles. */}
      <section className="border-b border-border bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase text-accent">{L.featuresEyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl lg:text-5xl">{L.featuresTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{L.featuresDesc}</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i + 1) as 1 | 2 | 3 | 4} className="liftable flex flex-col rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-start" dir={dir}>{f.art}</div>
                <h3 className="mt-5 text-lg font-semibold" dir={dir}>{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground" dir={dir}>{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ARABIC FIRST: the same product in both scripts, side by side. */}
      <section className="border-b border-border bg-surface py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase text-accent" dir={dir}>{L.bilingualEyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl lg:text-5xl" dir={dir}>{L.bilingualTitle}</h2>
            <p className="mt-4 max-w-xl text-muted-foreground" dir={dir}>{L.bilingualDesc}</p>
          </Reveal>
          <Reveal delay={2} className="grid gap-4">
            <div className="liftable rounded-2xl border border-border bg-background p-5 shadow-soft" dir="rtl" lang="ar">
              <div className="flex justify-end"><span className="rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{L.sampleArQ}</span></div>
              <div className="mt-3 max-w-[85%] rounded-2xl border border-border bg-surface p-3 text-sm text-foreground">{L.sampleArA}</div>
            </div>
            <div className="liftable rounded-2xl border border-border bg-background p-5 shadow-soft" dir="ltr" lang="en">
              <div className="flex justify-end"><span className="rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{L.sampleEnQ}</span></div>
              <div className="mt-3 max-w-[85%] rounded-2xl border border-border bg-surface p-3 text-sm text-foreground">{L.sampleEnA}</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5. CTA */}
      <section className="relative overflow-hidden border-b border-border bg-raised py-24 lg:py-32">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ opacity: 0.08, background: 'radial-gradient(60% 80% at 50% 45%, var(--primary) 0%, transparent 70%)' }} />
        <Reveal className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          <Trophy size={112} />
          <h2 className="mt-6 text-3xl font-bold sm:text-4xl lg:text-5xl">{t.cta.title}</h2>
          <Link href={`/${locale}/signup`} className="pressable liftable mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-10 py-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">
            {t.cta.button}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
          <p className="mt-6 text-xs text-muted-foreground">{t.cta.note}</p>
        </Reveal>
      </section>
    </>
  );
}
