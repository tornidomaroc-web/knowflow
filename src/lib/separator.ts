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
