import Link from 'next/link';
import { useTranslation, Locale } from '@/lib/i18n';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  return (
    <>
      {/* 1. HERO */}
      {/* #108: `pt-12` on a phone, `pt-24` from lg. The hero opens directly under a
          65px sticky header, and 96px of nothing before the first word is a
          desktop measurement applied to a 390px screen. The 48px this returns
          goes to the card. */}
      <section className="relative overflow-hidden border-b border-border bg-background pt-12 lg:pt-24 pb-32">
        <div
          className="absolute inset-0 z-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }}
        />
        {/*
          #109, THE FAINT GOLD SHAPES. INLINE STYLE, NOT UTILITIES, AND THAT IS THE
          POINT. `bg-primary/8` would not be generated for a bare var() colour --
          the defect #104 and #107 both landed on -- and a decoration that silently
          fails to render is worse than none, because nothing tells you. An inline
          `background` with `var(--primary)` cannot be dropped by a build, and it
          re-resolves per theme like every other token.

          0.08 IS DERIVED, NOT CHOSEN. These sit BEHIND text, so the number that
          binds is the contrast at the gradient's brightest point. On --raised, the
          worst ground of the two, --muted-foreground measures 4.76:1 at 0.08 and
          4.41:1 at 0.12 -- under AA. 0.08 is the last step that clears it on both
          palettes (dark 4.76, light 4.71). Over the hero's own ground it is 5.77
          and 5.11, with headings never below 12:1 anywhere.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-0"
          style={{ top: '-7rem', insetInlineEnd: '-7rem', width: '26rem', height: '26rem', opacity: 0.08, background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-0"
          style={{ bottom: '-9rem', insetInlineStart: '-9rem', width: '22rem', height: '22rem', opacity: 0.08, background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        />
        {/* #108: A GRID, NOT A ROW, and the reason is the phone. The ruling puts
            the answer card ABOVE the CTA buttons, which on a phone means it has
            to sit INSIDE the copy column, between the words and the buttons.
            A flex row cannot do that and keep the desktop's two columns; explicit
            grid placement can. Below lg this is one column and the source order
            IS the reading order: copy, card, buttons. From lg the card moves to
            the second column and spans both rows, which is where the terminal it
            replaces used to stand. */}
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 items-center gap-x-16 gap-y-6 lg:gap-y-10">
          <div className={`lg:col-start-1 lg:row-start-1 text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="inline-block rounded-full border border-border bg-surface px-3 py-1 mb-4 sm:mb-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.hero.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8 leading-tight">
              {t.hero.title}
            </h1>
            {/* #106: carried out of use case 01 before that block was deleted, not retyped.
                It is the one line on this page written in the student's own voice. */}
            {/* #108: `hero.subtitle` and `hero.note` no longer print here, and the
                reason is measured rather than aesthetic. The card below is 300px
                tall on a phone and only 81px of first screen were spare, so
                something had to go for the buttons to stay above the fold. The
                two that went are the two the card makes redundant: the subtitle
                DESCRIBED an answer with its sources, and the card SHOWS one.
                `hero.note` is deleted; `hero.subtitle` survives as a key because
                layout.tsx still serves it as the page description. */}
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              {t.hero.hook}
            </p>
          </div>

          {/* #108, THE ANSWER CARD. It replaces the terminal, which was a picture of
              a command line this product does not have. This is the product's own
              chat, composed from the same parts: ChatBox puts its messages on
              `bg-background` inside a `bg-surface` shell, MessageBubble gives the
              student `bg-primary` and the answer `border-border bg-surface`, and
              the citation chips are its own — `[n] filename`, file-level, never a
              page. Deliberately NOT font-mono: register #92 is why the terminal
              needed a scoped exception, and a card with no mono anywhere cannot
              have that defect. It does not move; the reveal is #49's, in L4. */}
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 w-full max-w-lg mx-auto lg:max-w-none">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              <div className="space-y-4 bg-background p-3 sm:space-y-6 sm:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="flex justify-end">
                  <div dir="auto" className="max-w-[85%] rounded-2xl bg-primary p-4 text-sm text-primary-foreground shadow-soft sm:max-w-[75%]">
                    {t.answer.question}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <div dir="auto" className="max-w-[85%] rounded-2xl border border-border bg-surface p-4 text-sm text-foreground shadow-soft sm:max-w-[75%]">
                    {t.answer.body}
                  </div>
                  {/* `dir="ltr"` on the row, as MessageBubble has it: the bracketed
                      index must stay left of its filename in both languages. */}
                  <div className="flex flex-wrap gap-2 px-1" dir="ltr">
                    {t.answer.files.map((file, idx) => (
                      <span
                        key={file}
                        className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        [{idx + 1}] {file}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`lg:col-start-1 lg:row-start-2 flex flex-col items-center ${isRtl ? 'lg:items-end' : 'lg:items-start'}`}>
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t.howItWorks.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.howItWorks.steps.map((step, idx) => (
              <div key={idx} className={`rounded-2xl border border-border bg-raised p-8 shadow-card ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
                <span className="block text-primary text-sm font-semibold mb-4">{step.step}</span>
                <h3 className="text-xl sm:text-2xl font-semibold mb-4">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CTA SECTION */}
      {/* #109: `overflow-hidden` is load-bearing now that a shape overhangs the
          section; without it the shape widens the document and the page scrolls
          sideways on a phone. */}
      <section className="relative overflow-hidden border-b border-border bg-raised py-32">
        {/* #109: a shape, not a wash. The flat `bg-primary opacity-[0.04]` tinted
            the whole section evenly, which reads as a slightly wrong colour rather
            than as anything; the same gold as a radial reads as light falling on
            the section. Same derived 0.08 ceiling, measured on --raised, which is
            the worst ground the shapes sit on. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ opacity: 0.08, background: 'radial-gradient(60% 80% at 50% 45%, var(--primary) 0%, transparent 70%)' }}
        />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-10">{t.cta.title}</h2>
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
