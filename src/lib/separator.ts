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
