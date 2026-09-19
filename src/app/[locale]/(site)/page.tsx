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
        {/* #108: A GRID, NOT A ROW, and the reason is the phone. The ruling puts
            the answer card ABOVE the CTA buttons, which on a phone means it has
            to sit INSIDE the copy column, between the words and the buttons.
            A flex row cannot do that and keep the desktop's two columns; explicit
            grid placement can. Below lg this is one column and the source order
            IS the reading order: copy, card, buttons. From lg the card moves to
            the second column and spans both rows, which is where the terminal it
            replaces used to stand. */}
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 items-center gap-x-16 gap-y-10">
          <div className={`lg:col-start-1 lg:row-start-1 text-center ${isRtl ? 'lg:text-right' : 'lg:text-left'}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="inline-block rounded-full border border-border bg-surface px-3 py-1 mb-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.hero.badge}
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
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
              <div className="space-y-6 bg-background p-4 sm:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
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
                        className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
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
