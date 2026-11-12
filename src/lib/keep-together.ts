/**
 * PHRASES THAT NEVER SPLIT ACROSS TWO LINES (the owner's review of #305,
 * 2026-11-05): the AI permission sheet broke "الذكاء / الاصطناعي" and
 * "أيّ / منهما". At render time the space inside each phrase becomes a
 * no-break space (U+00A0); the dictionary's approved words are not changed.
 * A phrase that sits inside a longer word ("بالذكاء الاصطناعي") is matched
 * there too, since the space is the same space.
 *
 * scripts/design-c/pr4.mjs reads this list (KEEP_TOGETHER) and fails a render
 * on which any of these phrases spans two lines.
 */
export const KEEP_TOGETHER = ['الذكاء الاصطناعي', 'أيّ منهما', 'أيٌّ منهما', 'a ready question', 'سؤال جاهز'] as const;

const PATTERN = new RegExp(KEEP_TOGETHER.map((p) => p.split(' ').join('[ \\u00A0]+')).join('|'), 'g');

export function keepTogether(text: string): string {
  return text.replace(PATTERN, (m) => m.replace(/ +/g, ' '));
}

/**
 * NAMES KEPT ON ONE LINE WITHOUT CHANGING A CHARACTER (the owner's review of
 * PR #322 at d9647f5, 2026-11-12): the en declined sentence broke "Voyage" /
 * "AI.". In a right-to-left sentence LatinText already draws "Voyage AI" as
 * a short left-to-right isolate on one line (#316); in a left-to-right one
 * there is no Latin run to cut (the whole sentence is Latin), so these names
 * are drawn as their own nowrap piece by LatinText. Not a no-break space:
 * ios-signed-in.yml reads "Voyage AI" with a plain space in the consent sheet.
 * scripts/design-c/sample.mjs (check 18) reads the list.
 */
export const KEEP_WHOLE = ['Voyage AI'] as const;

export type Kept = string | { keep: string };

/** `text` cut into plain pieces and the KEEP_WHOLE names it holds; joined, it is `text`. */
export function splitKeepWhole(text: string): Kept[] {
  const out: Kept[] = [];
  // The names hold no regex character (letters and a space).
  const re = new RegExp(KEEP_WHOLE.join('|'), 'g');
  let at = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > at) out.push(text.slice(at, start));
    out.push({ keep: m[0] });
    at = start + m[0].length;
  }
  if (at < text.length || !out.length) out.push(text.slice(at));
  return out;
}
