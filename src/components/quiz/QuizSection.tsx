'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';

// Only the fields this section needs from a document, mirroring SummarySection's
// SummaryDoc rather than accepting a whole `Document`.
//
// A quiz CANNOT be seeded from the document row the way a summary can: a summary
// is a column on `documents` (already fetched by the page), but a quiz lives in
// its own `quizzes` + `quiz_items` tables. So this component obtains the quiz by
// calling POST /api/quiz/generate, which returns the CACHED quiz (`cached: true`,
// no Claude call, no counter charge) whenever one already exists.
//
// SECURITY / register #29 — read this before adding any query here. This component
// performs NO client-side Supabase read against `quizzes` or `quiz_items`, and it
// must never gain one. That is what closes #29 STRUCTURALLY rather than by
// discipline: there is no client read of the answer table, so no `select('*')` can
// leak `correct_index`. The only way this UI ever sees a correct answer is inside a
// grading response, for an item the student actually attempted.
interface QuizDoc {
  id: string;
  status: string;
}

// Exactly what /api/quiz/generate returns per item. Deliberately NOT imported from
// `@/types` as `ClientQuizItem`: this is JSON off the wire, so any type here is an
// assertion, not a check (the lesson recorded in register #29). It documents the
// shape; it does not enforce it. The enforcement lives in the route's select list.
interface QuizItemView {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  position: number;
}

// Exactly what /api/quiz/submit returns per item. `correct_index` is OPTIONAL — it
// is present only for items the student attempted with an in-range choice, and is
// ABSENT (not null) otherwise.
interface GradedResultView {
  item_id: string;
  selected_index: number | null;
  is_correct: boolean;
  correct_index?: number;
}

type Phase = 'idle' | 'loading' | 'taking' | 'submitting' | 'result';

// TRAP 1 (register #29 / P4.3 spec). `correct_index` is optional AND 0 is a valid,
// common answer index. A truthiness test — `if (r.correct_index)` — silently
// misreads a correct answer of 0 as "not revealed", so the first option could never
// be shown as the right one. Test for KEY PRESENCE, never for truthiness.
function revealedIndex(r: GradedResultView): number | null {
  return 'correct_index' in r && r.correct_index !== undefined ? r.correct_index : null;
}

// TRAP 2. /api/quiz/submit echoes `selected_index` VERBATIM, including a value the
// route graded as out of range (it deliberately does not rewrite the client's own
// input). Rendering `options[99]` would print nothing or crash a `.map`. Anything
// outside the item's own options is treated as "no answer" — which is exactly how
// the route graded it, and how it decided not to reveal the key.
function answeredIndex(r: GradedResultView, optionCount: number): number | null {
  const s = r.selected_index;
  if (s === null || s === undefined) return null;
  if (!Number.isInteger(s) || s < 0 || s >= optionCount) return null;
  return s;
}

export function QuizSection({ doc }: { doc: QuizDoc }) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  // `useTranslation` is a plain dictionary lookup, not a React hook, despite the
  // name — register #25 tracks the rename across all 8 call sites. Following the
  // surrounding file's pattern here rather than refactoring someone else's code in
  // a feature PR.
  const q = useTranslation(safeLocale).dashboard.quiz;

  const [phase, setPhase] = useState<Phase>('idle');
  const [items, setItems] = useState<QuizItemView[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  // item_id -> chosen option index. Absent key = the student left it blank.
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [results, setResults] = useState<GradedResultView[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Status map for POST /api/quiz/generate. Its real set, read from the route:
  // 400 (missing document_id — unreachable from this UI), 401, 404, 409, 422,
  // 429 + 503 (both from enforceLimit), 500, 502. Note this is NOT summarize's
  // map: it is a superset (502) and 503 is a distinct fail-closed denial.
  const generateError = (status: number): string => {
    if (status === 401) return q.errors.session;
    if (status === 404) return q.errors.notFound;
    if (status === 409) return q.errors.processing;
    if (status === 422) return q.errors.notEnoughText;
    if (status === 429) return q.errors.limit;
    return q.errors.temporary; // 400 / 500 / 502 / 503 / anything else — retryable
  };

  // Status map for POST /api/quiz/submit. Its real set, read from the route:
  // 400, 401, 404, 409, 500. There is NO 422, NO 429 and NO 502 here — grading is
  // unpaid, so no limit can fire. And 409 means something ENTIRELY DIFFERENT from
  // summarize's 409: not "still processing" but "this quiz has no items and cannot
  // be graded" (register #30's orphan-quiz window). Copying summarize's map would
  // have shown the student the wrong sentence.
  const submitError = (status: number): string => {
    if (status === 400) return q.errors.badRequest;
    if (status === 401) return q.errors.session;
    if (status === 404) return q.errors.notFound;
    if (status === 409) return q.errors.incomplete;
    return q.errors.temporary; // 500 / anything else — retryable
  };

  // Generation is user-initiated only; never on page open. A cached quiz costs
  // nothing, but the FIRST call is a paid Haiku generation against the daily cap.
  const start = async () => {
    if (phase === 'loading') return;
    setPhase('loading');
    setError(null);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // locale drives the question language server-side (register #27). A quiz is
        // generate-once, so the language is fixed permanently at this moment
        // (register #31) — there is no regenerate path.
        body: JSON.stringify({ document_id: doc.id, locale: safeLocale }),
      });

      if (!res.ok) {
        setError(generateError(res.status));
        setPhase('idle');
        return;
      }

      const data = await res.json();
      const loaded: QuizItemView[] = (data.items ?? [])
        .slice()
        .sort((a: QuizItemView, b: QuizItemView) => a.position - b.position);

      // A quizzes row can exist with zero items (register #30's orphan window).
      // /api/quiz/submit would refuse it with a 409; say so now rather than letting
      // the student answer nothing and then fail.
      if (loaded.length === 0) {
        setError(q.errors.incomplete);
        setPhase('idle');
        return;
      }

      setItems(loaded);
      setQuizId(data.quiz?.id ?? null);
      setIsPartial(Boolean(data.is_partial));
      setSelections({});
      setResults([]);
      setPhase('taking');
    } catch {
      setError(q.errors.connection);
      setPhase('idle');
    }
  };

  const choose = (itemId: string, optionIndex: number) => {
    if (phase !== 'taking') return;
    setSelections((prev) => ({ ...prev, [itemId]: optionIndex }));
  };

  const submit = async () => {
    if (phase !== 'taking' || !quizId) return;
    setPhase('submitting');
    setError(null);
    try {
      // Send ONLY what the student actually selected. Never fabricate a selection
      // for a blank item: the route grades an unanswered item as incorrect and
      // reveals no answer for it, which is the honest outcome. Inventing a 0 here
      // would both lie about their answer and buy them a free answer reveal.
      const answers = Object.entries(selections).map(([item_id, selected_index]) => ({
        item_id,
        selected_index,
      }));

      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, answers }),
      });

      if (!res.ok) {
        setError(submitError(res.status));
        setPhase('taking');
        return;
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setScore(data.score ?? 0);
      setTotal(data.total ?? items.length);
      setPhase('result');
    } catch {
      setError(q.errors.connection);
      setPhase('taking');
    }
  };

  // Retake. Multiple attempts are allowed by design, and this costs nothing: we
  // already hold the items, so no route is called. Clearing `results` is what
  // returns the answers to hidden.
  const retake = () => {
    setSelections({});
    setResults([]);
    setScore(0);
    setTotal(0);
    setError(null);
    setPhase('taking');
  };

  // Only a fully-processed material has usable text; anything else gets a 409 from
  // the route, so we don't offer a quiz until it is ready. Mirrors SummarySection.
  if (doc.status !== 'ready') return null;

  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="mt-3">
        <button
          onClick={start}
          disabled={phase === 'loading'}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {phase === 'loading' ? q.starting : q.start}
        </button>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  const showingResults = phase === 'result';
  const resultFor = (itemId: string): GradedResultView | null =>
    results.find((r) => r.item_id === itemId) ?? null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {q.heading}
      </h3>

      {isPartial && (
        <p className="mb-3 rounded-lg bg-primary-subtle px-3 py-2 text-xs text-primary">
          {q.partialNotice}
        </p>
      )}

      {showingResults && (
        <p className="mb-3 text-sm font-medium text-foreground">
          {q.score}: {score} / {total}
        </p>
      )}

      <ol className="space-y-5">
        {items.map((item, qIndex) => {
          const result = showingResults ? resultFor(item.id) : null;
          const revealed = result ? revealedIndex(result) : null;
          const answered = result ? answeredIndex(result, item.options.length) : null;

          return (
            <li key={item.id} className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {qIndex + 1}. {item.question}
              </p>

              {/* An unattempted item in the results: the route revealed nothing for
                  it, so there is nothing to show but the honest fact. */}
              {showingResults && answered === null && (
                <p className="text-xs text-muted-foreground">{q.noAnswer}</p>
              )}

              <div className="space-y-1.5">
                {item.options.map((option, oIndex) => {
                  const chosen = showingResults
                    ? answered === oIndex
                    : selections[item.id] === oIndex;
                  const isRevealedCorrect = revealed !== null && revealed === oIndex;
                  const isWrongChoice = showingResults && chosen && !result?.is_correct;

                  // CORRECT reuses the existing `primary` tokens, NOT a raw green.
                  // `--primary` is already #047857 (emerald-700) and
                  // `--primary-subtle` is emerald-50, so a raw `green-700`
                  // (#15803d) would plant a second, subtly-different green beside
                  // the theme's own — precisely the drift P2.7 purged.
                  //
                  // INCORRECT stays raw Tailwind red, matching this codebase's
                  // actual precedent (statusColor's text-red-700 / text-amber-700
                  // and SummarySection's text-red-700). There is no semantic
                  // "danger" surface token to reuse.
                  let tone = 'border-border bg-surface text-foreground';
                  if (showingResults && isRevealedCorrect) {
                    tone = 'border-primary bg-primary-subtle font-medium text-primary';
                  } else if (isWrongChoice) {
                    tone = 'border-red-700 bg-red-50 text-red-700';
                  } else if (chosen) {
                    tone = 'border-primary bg-primary-subtle text-foreground';
                  }

                  return (
                    <label
                      key={oIndex}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone} ${
                        showingResults ? 'cursor-default' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={item.id}
                        checked={chosen}
                        disabled={showingResults || phase === 'submitting'}
                        onChange={() => choose(item.id, oIndex)}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0">{option}</span>
                    </label>
                  );
                })}
              </div>

              {/* The correct answer is shown only where the grading response
                  actually carried correct_index — i.e. only on items the student
                  attempted in range. Never inferred, never guessed. */}
              {showingResults && revealed !== null && !result?.is_correct && (
                <p className="text-xs text-primary">
                  {q.correctAnswer}: {item.options[revealed]}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className="mt-4">
        {showingResults ? (
          <button onClick={retake} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            {q.retake}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={phase === 'submitting'}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {phase === 'submitting' ? q.submitting : q.submit}
          </button>
        )}
      </div>
    </div>
  );
}
