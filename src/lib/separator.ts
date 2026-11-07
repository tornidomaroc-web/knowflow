/**
 * A no-break space before each " · " separator, at render time, so a line that
 * wraps never STARTS with the dot (the owner's rule, 2026-11-04; asserted by
 * the design-c render's line checks). The dictionary strings stay as the
 * owner approved them: only the space before the dot changes, in the page.
 */
export const keepDotWithBefore = (s: string) => s.replace(/ · /g, '\u00a0· ');

/**
 * A no-break space between the last two words, so a short heading that wraps
 * never ends on a word alone (the same rule). For headings of a few words
 * only: the bound pair must fit the line.
 */
export const keepLastTwo = (s: string) => s.replace(/ (\S+)$/, '\u00a0$1');

/**
 * The sentences of a short line, each kept whole (the owner's review of PR 2,
 * 2026-11-05): the hero title breaks BY SENTENCE in both languages, so
 * "أي سؤال." never loses "أي" to the line above. The string is the approved
 * copy, unchanged; only where it may break changes.
 */
export const sentences = (s: string) => s.split(/(?<=[.؟?!])\s+/).filter(Boolean);

/**
 * A string cut around its parenthesised groups: the odd entries are the
 * groups, "(600 درهم)", which the page sets in a no-wrap span so a group never
 * splits across two lines (the same review; asserted by the design-c render).
 */
export const parenGroups = (s: string) => s.split(/(\([^()]*\))/);

/**
 * A citation marker never STARTS a line (the review of PR #310, 2026-11-07:
 * "[1]." sat alone on the last line of an Arabic answer at 390 px; the owner
 * rejects a line holding only a marker). The space before "[1]" or "[1][2]"
 * becomes a no-break space, and a word joiner (U+2060, invisible, no width)
 * ties a marker to a bracket or marker it touches and to the punctuation
 * right after it. Render time only, in the answer card (MessageBubble): the
 * stored answer, the markers' numbers and the source pills are unchanged.
 * A newline before a marker is left alone (a line the answer itself breaks).
 */
const MARKER = /\[[0-9\u0660-\u0669]+\]/.source;
const PUNCT = /[.,;:!?\u060C\u061B\u061F]/.source;
const SPACE_BEFORE = new RegExp(`[ \\t]+(?=${MARKER})`, 'g');
const TOUCHING = new RegExp(`(?<=[^\\s\\u2060])(?=${MARKER})`, 'g');
const PUNCT_AFTER = new RegExp(`(?<=${MARKER})(?=${PUNCT})`, 'g');
const LEADING = new RegExp(`^[ \\t]*((?:${MARKER})+${PUNCT}*)`);

export const keepMarkersWithBefore = (s: string) =>
  s.replace(SPACE_BEFORE, '\u00a0').replace(TOUCHING, '\u2060').replace(PUNCT_AFTER, '\u2060');

/**
 * The markers (and their punctuation) that open `s`, after at most a space,
 * and the rest: for a marker right after a short Latin group, which the card
 * draws as one box with the group (src/lib/latin-groups.ts).
 */
export function leadingMarkers(s: string): { markers: string; rest: string } | null {
  const m = LEADING.exec(s);
  return m ? { markers: m[1], rest: s.slice(m[0].length) } : null;
}
