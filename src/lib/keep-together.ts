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
export const KEEP_TOGETHER = ['الذكاء الاصطناعي', 'أيّ منهما', 'أيٌّ منهما'] as const;

const PATTERN = new RegExp(KEEP_TOGETHER.map((p) => p.split(' ').join('[ \\u00A0]+')).join('|'), 'g');

export function keepTogether(text: string): string {
  return text.replace(PATTERN, (m) => m.replace(/ +/g, ' '));
}
