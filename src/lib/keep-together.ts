/**
 * PHRASES THAT NEVER SPLIT ACROSS TWO LINES (the owner's review of #305,
 * 2026-11-05): the AI permission sheet broke "الذكاء / الاصطناعي" and
 * "أيّ / منهما". At render time the space inside each phrase becomes a
 * no-break space (U+00A0); the dictionary's approved words are not changed.
 * A phrase that sits inside a longer word ("بالذكاء الاصطناعي") is matched
 * there too, since the space is the same space.
 *
 * "صوّر الصفحات" joined the list in the owner's review of #336 at 60e9ce6
 * (2026-11-18): the camera's none-read message broke "صوّر / الصفحات".
 *
 * "من App Store" joined in the owner's review of #338 at 69f160f (2026-11-18):
 * at 390 pt the Arabic delete note (dashboard.iap.deleteNote) ended a line on
 * "من" and began the next with "App Store". The no-break space sits between
 * "من" and the left-to-right isolate LatinText draws "App Store" in. The
 * shorter set the owner approved the same day (docs/copy/ARABIC_STRINGS_app_v12.md)
 * no longer says "من App Store"; the entry stays as a guard for the next
 * string that does, and scripts/verify-iap-app.mjs proves it on a planted note.
 *
 * scripts/design-c/pr4.mjs reads this list (KEEP_TOGETHER) and fails a render
 * on which any of these phrases spans two lines.
 */
export const KEEP_TOGETHER = ['الذكاء الاصطناعي', 'أيّ منهما', 'أيٌّ منهما', 'a ready question', 'سؤال جاهز', 'صوّر الصفحات', 'من App Store'] as const;

const PATTERN = new RegExp(KEEP_TOGETHER.map((p) => p.split(' ').join('[ \\u00A0]+')).join('|'), 'g');

export function keepTogether(text: string): string {
  return text.replace(PATTERN, (m) => m.replace(/ +/g, ' '));
}

/**
 * PHRASES KEPT ON ONE LINE IN THE PAYWALL ONLY (the owner's render review of
 * #338's merge, design-c 44420154517, 2026-11-19): at 360 pt the Arabic 3.1.2
 * disclosure ended a line on "بـ24" and began the next with "ساعة"; at 390 the
 * Arabic other-account message broke "سجّل / الدخول"; the English disclosure
 * broke "Apple / Account" twice and the unavailable message "Try / again".
 *
 * A list of its own, NOT KEEP_TOGETHER: design-c's phrase check (pr4.mjs)
 * holds EVERY screen to KEEP_TOGETHER, and "Try again" and "سجّل الدخول" stand
 * outside the paywall too (the limit refusals, the auth pages), where this
 * change must not reach. keepTogetherPaywall() is called by
 * src/components/iap/Paywall.tsx alone (the paywall is shell 2 only), so the
 * web and build 8 stay the same picture (design-c check 22). The method is
 * KEEP_TOGETHER's: the space inside a phrase becomes a no-break space; no
 * string is changed.
 *
 * scripts/design-c/iap.mjs (check 26) reads this list: a paywall render on
 * which one of these phrases spans two lines fails, and on every AFTER
 * paywall render each phrase present is forced onto two lines and must be
 * flagged.
 */
export const KEEP_TOGETHER_PAYWALL = ['بـ24 ساعة', 'سجّل الدخول', 'Apple Account', 'Try again'] as const;

const PAYWALL_PATTERN = new RegExp(KEEP_TOGETHER_PAYWALL.map((p) => p.split(' ').join('[ \\u00A0]+')).join('|'), 'g');

/** keepTogether(), plus the paywall's own phrases. */
export function keepTogetherPaywall(text: string): string {
  return keepTogether(text).replace(PAYWALL_PATTERN, (m) => m.replace(/ +/g, ' '));
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
