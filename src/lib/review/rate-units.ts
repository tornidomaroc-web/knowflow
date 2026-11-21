import { readsRightToLeft } from '@/lib/latin-groups';

/**
 * THE RATING ROW'S DESCRIPTION, CUT INTO KEEP-TOGETHER UNITS (fix 2 of #345,
 * the owner's review of the design-c 44865033100 renders): at 390 and 360 the
 * English line broke "write a / review", and at 360 the Arabic one split a
 * verb from its object. RateRow draws each unit on one line (nowrap) and lets
 * a line break only between units, with text-wrap: balance on the line box.
 *
 * The cut is by WORD INDEX on the approved value (dashboard.settings.rateDesc,
 * docs/copy/ARABIC_STRINGS_app_v15.md); no word is typed here, so the string
 * stays the dictionary's own. English words 1-3 / 4-7 / 8-11 (the second
 * unit holds the whole "write ... review" phrase, the third the store's
 * name); Arabic 1-2 / 3-5 / 6-8 (a unit begins with the conjunction or the
 * preposition, never ends on one).
 * The units joined with single spaces are the value byte for byte.
 *
 * A value of any other shape (a future copy change) comes back whole, one
 * unit: the row then wraps as plain text rather than at a wrong word.
 * scripts/verify-review.mjs (section 7) and design-c check 31 hold it.
 */
const SHAPE = { ltr: [3, 4, 4], rtl: [2, 3, 3] } as const;

export function rateDescUnits(text: string): string[] {
  const words = text.split(' ');
  const shape = readsRightToLeft(text) ? SHAPE.rtl : SHAPE.ltr;
  const total = shape.reduce((a, b) => a + b, 0);
  if (words.length !== total || words.some((w) => w === '')) return [text];
  const out: string[] = [];
  let at = 0;
  for (const n of shape) {
    out.push(words.slice(at, at + n).join(' '));
    at += n;
  }
  return out;
}
