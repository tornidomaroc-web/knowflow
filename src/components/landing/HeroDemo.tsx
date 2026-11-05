import { FileName } from '@/components/ui/FileName';
import { parenGroups } from '@/lib/separator';
import { ClayCheck, ClayChipFile, ClayQuiz, ClaySummary } from '@/components/clay/ClayIcons';

export interface HeroDemoCopy {
  question: string;
  body: string;
  files: string[];
  /** The two study-kit chips that pop in after the answer. */
  summaryReady: string;
  quizReady: string;
}

/**
 * THE PRODUCT WORKING, IN THE HERO (Part C; register #49's reveal, extended),
 * on the dark clay answer card (design "C", PR 2, Landing.dc.html).
 *
 * Four beats, all CSS, no client child: the question WRITES itself in
 * (`hero-type`: a clip that opens from the inline start, so it runs the
 * right way in RTL through a `[dir="rtl"]` rule), the answer SWEEPS in
 * (`landing-sweep`, unchanged from #49: a mask, never per-word spans), the
 * source chips FADE in (`landing-fade`), and two study-kit chips POP in
 * (`hero-pop`). Every beat's base state is its final state and each has a
 * reduce rule, so with reduced motion the card is simply complete.
 *
 * The words are the owner's real question, answer and files (#108); the
 * two kit chips name what the product makes from the same files. The card is
 * dark in both themes, as the home's ask card is; the question is a gold clay
 * bubble and the answer a cream one with its sources (`.kf-ask-bubble`).
 */
export function HeroDemo({ copy, rtl }: { copy: HeroDemoCopy; rtl: boolean }) {
  return (
    <div className="hero-card kf-ask flex flex-col gap-3 rounded-[1.75rem] p-[1.125rem] sm:p-6" dir={rtl ? 'rtl' : 'ltr'}>
      <p dir="auto" className="hero-type kf-gold max-w-[85%] self-start rounded-[1.25rem] rounded-ee-md px-3.5 py-3 text-[0.9375rem] font-bold">
        {copy.question}
      </p>
      <div className="landing-sweep kf-ask-bubble flex max-w-[92%] flex-col gap-2.5 self-end rounded-[1.25rem] rounded-es-md p-3.5">
        {/* A parenthesised amount, "(600 درهم)", never splits across two lines
            (the owner's review, 2026-11-05): each group is one no-wrap span. */}
        <p dir="auto" className="text-[0.9375rem] font-medium leading-[1.6]">
          {parenGroups(copy.body).map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part))}
        </p>
        {/* Each chip names its file and nothing else (#108: the file, never the
            page). FileName isolates it, so a Latin extension stays at its end. */}
        <div className="flex flex-wrap gap-1.5">
          {copy.files.map((file, idx) => (
            <span key={file} className="landing-fade kf-ask-chip inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold">
              <ClayChipFile tone={idx % 2 ? 'blue' : 'peach'} />
              <FileName name={file} inline />
            </span>
          ))}
        </div>
      </div>
      {/* Hidden below sm: #109 keeps the two CTAs above a 360px fold, and this row
          costs the 48px that would push them under it. On a desk it is the fourth beat. */}
      <div className="hidden flex-wrap gap-2 pt-1 sm:flex">
        <span className="hero-pop kf-ask-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
          <ClaySummary width={18} height={18} />
          {copy.summaryReady}
          <ClayCheck width={16} height={16} />
        </span>
        <span className="hero-pop hero-pop-2 kf-ask-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
          <ClayQuiz width={18} height={18} />
          {copy.quizReady}
          <ClayCheck width={16} height={16} />
        </span>
      </div>
    </div>
  );
}
