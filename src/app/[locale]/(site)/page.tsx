import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';
import { keepDotWithBefore, keepLastTwo, sentences } from '@/lib/separator';
import {
  ClayArrow,
  ClayBrandMark,
  ClayFeatureAnswers,
  ClayFeatureQuiz,
  ClayFeatureStreak,
  ClayFeatureSummary,
  ClayStepAnswer,
  ClayStepAsk,
  ClayStepUpload,
} from '@/components/clay/ClayIcons';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { Reveal } from '@/components/landing/Reveal';

/**
 * THE LANDING, AS THE SHOWPIECE (Part C, 2026-09-25; docs/design/VISUAL_LANGUAGE.md),
 * IN CLAY (design "C", PR 2: the owner-approved artboard Landing.dc.html,
 * 2026-11-04).
 *
 * Five sections, each one idea: the hero shows the product WORKING in the
 * dark answer card (the question writes itself, the answer sweeps in, the
 * sources appear, the study kit pops), three steps with a clay picture each,
 * four things you get as clay tiles, Arabic-first with English beside it in
 * one card, and one last invitation on a dark card. Sections rise as they
 * enter the viewport (`Reveal`), and every motion has its base state as its
 * final state, so with reduced motion the page is simply there. No images,
 * no library: inline SVG and CSS. The artboard draws a plain page, so the
 * hero's grid lines and its three drifting shapes are gone (and Parallax
 * with them).
 *
 * Everything #108 and #109 measured about the fold still holds: the answer
 * card sits between the words and the buttons on a phone, and the two buttons
 * stay side by side.
 *
 * WEB ONLY. The app never shows this page: the middleware sends the app's
 * request for it to the dashboard (Apple 3.1.1(a)), so its "free" lines stay
 * here.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const L = t.landing;
  const mark = isRtl ? '؟' : '?';

  // ONE picture per card, and it is the card's meaning (review 2026-09-25,
  // #122): a summary is a page, a quiz is a checklist, an answer with its
  // source is a page that talks, a streak is a flame.
  const features = [
    { Art: ClayFeatureSummary, ...L.features[0] },
    { Art: ClayFeatureQuiz, ...L.features[1] },
    { Art: ClayFeatureAnswers, ...L.features[2] },
    { Art: ClayFeatureStreak, ...L.features[3] },
  ];
  // The steps are upload, ask, get the answer: a cloud, a bubble, a page with a tick.
  const stepArt = [
    { key: 'upload-cloud', art: <ClayStepUpload /> },
    { key: 'ask-bubble', art: <ClayStepAsk mark={mark} /> },
    { key: 'answer-page', art: <ClayStepAnswer /> },
  ];

  const eyebrow = 'text-[0.8125rem] font-bold text-accent';
  const h2 = 'mt-1 text-[1.75rem] font-extrabold leading-tight text-foreground sm:text-4xl lg:text-5xl';

  return (
    // Every line on the landing is balanced (text-wrap is inherited), so no
    // heading or card ends on a word alone; the design-c render asserts it.
    <div data-kf-landing className="[text-wrap:balance]">
      {/* 1. HERO */}
      <section className="pt-3.5 pb-[1.875rem] lg:pt-16 lg:pb-24">
        <div className="mx-auto grid max-w-7xl items-center gap-x-16 gap-y-4 px-[1.125rem] md:px-6 lg:grid-cols-2 lg:gap-y-8">
          <div className={`flex flex-col items-start gap-4 text-start lg:col-start-1 lg:row-start-1 ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={dir}>
            <span className="rise kf-pill inline-flex h-[2.125rem] items-center gap-2 rounded-full px-3.5 text-[0.8125rem] font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-mint" />
              {keepDotWithBefore(t.hero.badge)}
            </span>
            {/* One line per sentence, in both languages and at every width
                (the owner's review, 2026-11-05): "أي سؤال." stays whole. */}
            <h1 data-kf-hero-title className="rise rise-1 text-[2.375rem] font-extrabold leading-[1.2] text-foreground sm:text-5xl lg:text-6xl">
              {sentences(t.hero.title).map((s, i) => (
                <span key={i} className="block">{i > 0 ? ' ' : null}{s}</span>
              ))}
            </h1>
            <p className="rise rise-2 text-[1.0625rem] font-medium text-muted-foreground lg:text-lg">{t.hero.hook}</p>
          </div>

          <div className="rise rise-2 w-full lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <HeroDemo
              rtl={isRtl}
              copy={{ question: t.answer.question, body: t.answer.body, files: t.answer.files, summaryReady: L.kitSummary, quizReady: L.kitQuiz }}
            />
          </div>

          <div className="rise rise-3 mt-1 flex flex-col gap-3 lg:col-start-1 lg:row-start-2" dir={dir}>
            <div className="flex gap-2.5">
              <Link href={`/${locale}/signup`} className="kf-gold inline-flex min-h-[3.375rem] flex-1 items-center justify-center gap-2 rounded-full px-4 text-base font-extrabold lg:flex-none lg:px-8">
                {t.hero.cta1}
                <ClayArrow className="rtl:-scale-x-100" />
              </Link>
              <Link href="#how-it-works" className="kf-pill inline-flex min-h-[3.375rem] flex-1 items-center justify-center rounded-full px-4 text-base font-bold text-foreground lg:flex-none lg:px-8">
                {t.hero.cta2}
              </Link>
            </div>
            <p className={`text-center text-[0.8125rem] font-medium text-muted-foreground ${isRtl ? 'lg:text-right' : 'lg:text-left'}`}>{keepDotWithBefore(t.hero.disclaimer)}</p>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS: three steps, a clay picture each. */}
      <section id="how-it-works" className="scroll-mt-20 py-[1.625rem] lg:py-20">
        <div className="mx-auto max-w-7xl px-[1.125rem] md:px-6" dir={dir}>
          <Reveal className="mb-3.5">
            <p className={eyebrow}>{L.howEyebrow}</p>
            <h2 className={h2}>{t.howItWorks.title}</h2>
          </Reveal>
          <ol className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {t.howItWorks.steps.map((step, idx) => (
              <Reveal key={idx} as="li" delay={(idx + 1) as 1 | 2 | 3} className="kf-card flex items-center gap-3.5 rounded-3xl p-4">
                <span className="shrink-0" data-art={stepArt[idx].key}>{stepArt[idx].art}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-foreground">
                    <span className="kf-gold-sm inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full text-[0.8125rem]">{idx + 1}</span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-[1.55] text-muted-foreground">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. WHAT YOU GET: four clay tiles. */}
      <section className="py-[1.625rem] lg:py-20">
        <div className="mx-auto max-w-7xl px-[1.125rem] md:px-6" dir={dir}>
          <Reveal className="mb-3.5">
            <p className={eyebrow}>{L.featuresEyebrow}</p>
            <h2 className={h2}>{L.featuresTitle}</h2>
            <p className="mt-3.5 max-w-2xl text-[0.9375rem] font-medium leading-[1.6] text-muted-foreground">{L.featuresDesc}</p>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {features.map(({ Art, title, desc }, i) => (
              // ONE STRUCTURE PER TILE (the owner's review, 2026-11-05): the icon
              // box, a title block that keeps two lines' room (top-aligned),
              // then the description, which so starts at the same height in
              // every tile of a row, at 390 and at 1280, in both languages.
              <Reveal key={title} delay={(i + 1) as 1 | 2 | 3 | 4} className="kf-card flex flex-col gap-1 rounded-[1.375rem] p-3.5">
                <span data-kf-tile-icon className="block h-[2.875rem] shrink-0"><Art /></span>
                {/* 15 pt in Arabic (the artboard); 14 pt in English, whose longer
                    first words ("Summaries") would otherwise stand alone in a
                    143 pt column. 2.7em = two lines of 1.35. */}
                <h3 className={`mt-1.5 min-h-[2.7em] font-extrabold leading-[1.35] text-foreground ${isRtl ? 'text-[0.9375rem]' : 'text-sm'}`}>{title}</h3>
                <p className="text-[0.8125rem] font-medium leading-[1.45] text-muted-foreground">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ARABIC FIRST: the same product in both scripts, in one card. Each
          pair reads in its own direction: the question at its start, the
          answer at its end. */}
      <section className="py-[1.625rem] lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-3.5 px-[1.125rem] md:px-6 lg:grid-cols-2 lg:gap-10" dir={dir}>
          <Reveal>
            <p className={eyebrow}>{L.bilingualEyebrow}</p>
            <h2 className={h2}>{L.bilingualTitle}</h2>
            <p className="mt-3.5 max-w-xl text-[0.9375rem] font-medium leading-[1.6] text-muted-foreground">{L.bilingualDesc}</p>
          </Reveal>
          <Reveal delay={2} className="kf-card flex flex-col gap-2.5 rounded-3xl p-4">
            <div className="flex flex-col gap-2.5" dir="rtl" lang="ar">
              <p className="kf-gold self-start rounded-[1.125rem] rounded-ee-md px-3.5 py-2.5 text-sm font-bold">{L.sampleArQ}</p>
              <p className="self-end max-w-[88%] rounded-[1.125rem] rounded-es-md bg-raised px-3.5 py-2.5 text-sm font-medium leading-[1.55] text-foreground">{L.sampleArA}</p>
            </div>
            <div className="mt-1.5 flex flex-col gap-2.5" dir="ltr" lang="en">
              <p className="kf-gold self-start rounded-[1.125rem] rounded-ee-md px-3.5 py-2.5 text-sm font-bold">{L.sampleEnQ}</p>
              <p className="self-end max-w-[88%] rounded-[1.125rem] rounded-es-md bg-raised px-3.5 py-2.5 text-sm font-medium leading-[1.55] text-foreground">{L.sampleEnA}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5. CTA, on the dark card. */}
      <section className="px-[1.125rem] pt-4 md:px-6 lg:pt-10">
        <Reveal className="kf-ask mx-auto flex max-w-3xl flex-col items-center gap-3.5 rounded-[1.875rem] px-5 py-7 text-center lg:py-14">
          <ClayBrandMark />
          <h2 className="text-[1.625rem] font-extrabold text-[color:var(--clay-ask-fg)] lg:text-4xl">{keepLastTwo(t.cta.title)}</h2>
          <Link href={`/${locale}/signup`} className="kf-gold inline-flex min-h-[3.375rem] items-center justify-center rounded-full px-[1.875rem] text-base font-extrabold">
            {t.cta.button}
          </Link>
          <p className="text-[0.8125rem] font-medium text-[color:var(--clay-ask-muted)]">{keepDotWithBefore(t.cta.note)}</p>
        </Reveal>
      </section>
    </div>
  );
}
