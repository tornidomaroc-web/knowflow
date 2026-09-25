import { BookOpen, CheckCircle2, ListChecks } from 'lucide-react';

export interface HeroDemoCopy {
  question: string;
  body: string;
  files: string[];
  /** The two study-kit chips that pop in after the answer. */
  summaryReady: string;
  quizReady: string;
}

/**
 * THE PRODUCT WORKING, IN THE HERO (Part C; register #49's reveal, extended).
 *
 * Four beats, all CSS, no client child: the question WRITES itself in
 * (`hero-type`: a clip that opens from the inline start, so it runs the
 * right way in RTL through a `[dir="rtl"]` rule), the answer SWEEPS in
 * (`landing-sweep`, unchanged from #49: a mask, never per-word spans), the
 * citation chips FADE in (`landing-fade`), and two study-kit chips POP in
 * (`hero-pop`). Every beat's base state is its final state and each has a
 * reduce rule, so with reduced motion the card is simply complete.
 *
 * The words are the owner's real question, answer and files (#108); the
 * two kit chips name what the product makes from the same files.
 */
export function HeroDemo({ copy, rtl }: { copy: HeroDemoCopy; rtl: boolean }) {
  return (
    <div className="hero-card overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-coral" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint" />
      </div>
      <div className="space-y-4 bg-background p-3 sm:space-y-5 sm:p-6" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="flex justify-end">
          <div dir="auto" className="hero-type max-w-[85%] rounded-2xl bg-primary p-4 text-sm text-primary-foreground shadow-soft sm:max-w-[75%]">
            {copy.question}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2">
          <div dir="auto" className="landing-sweep max-w-[85%] rounded-2xl border border-border bg-surface p-4 text-sm text-foreground shadow-soft sm:max-w-[75%]">
            {copy.body}
          </div>
          {/* `dir="ltr"` on the row, as MessageBubble has it: the bracketed
              index must stay left of its filename in both languages. */}
          <div className="flex flex-wrap gap-2 px-1" dir="ltr">
            {copy.files.map((file, idx) => (
              <span key={file} className="landing-fade rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                [{idx + 1}] {file}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <span className="hero-pop inline-flex items-center gap-1.5 rounded-full bg-mint-subtle px-3 py-1 text-xs font-semibold text-mint">
            <BookOpen className="h-3.5 w-3.5" />
            {copy.summaryReady}
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
          <span className="hero-pop hero-pop-2 inline-flex items-center gap-1.5 rounded-full bg-violet-subtle px-3 py-1 text-xs font-semibold text-violet">
            <ListChecks className="h-3.5 w-3.5" />
            {copy.quizReady}
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
