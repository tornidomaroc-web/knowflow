import { Fragment } from 'react';
import { readsRightToLeft, splitLatinRuns } from '@/lib/latin-groups';
import { splitKeepWhole } from '@/lib/keep-together';

/**
 * A SENTENCE WHOSE LATIN RUNS STAY WHOLE AND IN ORDER (src/lib/latin-groups.ts,
 * `splitLatinRuns`). Only when the sentence reads right to left (its first
 * strong letter is Arabic, as dir="auto" decides): each Latin run is drawn as
 * a left-to-right isolate (`<bdi dir="ltr">`), so ".zip" reads ".zip" and a
 * list keeps its order; a SHORT run (at most 30 characters) is also kept on
 * one line (`white-space: nowrap`). A longer run wraps inside its isolate,
 * its order intact. A left-to-right sentence is returned as it is.
 *
 * Inline, not #310's inline-block: an inline-block is an atomic box with a
 * line-break opportunity on each side, so in "وVoyage AI" the "و" glued to the
 * name could end one line with "Voyage AI" starting the next. An inline
 * isolate adds no break opportunity: the Arabic letter and the Latin one stay
 * joined as the text has them. The run's 30-character cap keeps it narrower
 * than any line it is drawn in (390 pt phone, red refusal box included).
 *
 * The text is not changed: no character is added, removed or replaced, so the
 * approved strings stay byte-identical (the DOM's textContent equals `text`).
 * scripts/design-c/latin-runs.mjs (check 15) reads it.
 */
export function LatinText({ text }: { text: string }) {
  // A left-to-right sentence: only the KEEP_WHOLE names ("Voyage AI") are
  // kept on one line, as a nowrap piece; no character changes (PR #322 review).
  if (!readsRightToLeft(text)) {
    const kept = splitKeepWhole(text);
    if (kept.length === 1 && typeof kept[0] === 'string') return <>{text}</>;
    return (
      <>
        {kept.map((p, i) =>
          typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <span key={i} data-kf-keep="" className="whitespace-nowrap">{p.keep}</span>
        )}
      </>
    );
  }
  return (
    <>
      {splitLatinRuns(text).map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <bdi key={i} dir="ltr" data-kf-latin={p.short ? 'short' : 'long'} className={p.short ? 'whitespace-nowrap' : undefined}>
            {p.run}
          </bdi>
        )
      )}
    </>
  );
}
