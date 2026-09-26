/**
 * How a file name is split for DISPLAY, and nothing else. Register #124.
 *
 * THE DEFECT. `<p dir="auto">تمارين محلولة - الفصل 3.pdf</p>` reads
 * "الفصل pdf.3": the paragraph is right-to-left, so the Unicode bidi algorithm
 * resolves the "3" as an Arabic-context number, the "." takes the paragraph's
 * direction because it sits between that number and Latin letters, and "pdf"
 * is laid out to the LEFT of ".3". The dot changes sides. The name a student
 * typed is displayed in an order they did not type.
 *
 * THE RULE. Everything after the LAST right-to-left letter is one left-to-right
 * run: the digit run, the dot and the extension stay together and read as the
 * unit "3.pdf", placed after the Arabic in reading order. Everything up to and
 * including that letter keeps the browser's own handling. A name with no
 * right-to-left letter is one left-to-right run, whatever the page's direction.
 *
 * `head + tail === name` always: no character is added, dropped or moved. The
 * isolation is done with markup (`<bdi>`), never with control characters, so
 * the text content of what is rendered is byte-identical to the stored name.
 */

// Right-to-left LETTERS only: Hebrew, Arabic (with the presentation forms),
// Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic Extended. Arabic-Indic
// digits and Arabic punctuation are deliberately outside these ranges: they are
// weak, and a trailing "٣.pdf" must travel with the extension as one unit.
const RTL_LETTER =
  /[֐-׿ؠ-يٮ-ۓەۺ-ۿܐ-ݿހ-޿߀-߿ࠀ-࡟ࢠ-ࣿיִ-﷿ﹰ-﻿]/u;

export type FileNameDirection = 'rtl' | 'ltr';

/**
 * The direction a name reads in, from its first strong letter, as `dir="auto"`
 * decides it. A name with no letter at all (digits, punctuation) is `ltr`.
 */
export function fileNameDirection(name: string): FileNameDirection {
  for (const ch of name) {
    if (RTL_LETTER.test(ch)) return 'rtl';
    if (/\p{L}/u.test(ch)) return 'ltr';
  }
  return 'ltr';
}

export interface FileNameParts {
  /** Up to and including the last right-to-left letter, plus the whitespace after it. May be ''. */
  head: string;
  /** Everything after `head`: digits, dots, brackets, the extension, Latin words. May be ''. */
  tail: string;
  dir: FileNameDirection;
}

export function splitFileNameForDisplay(name: string): FileNameParts {
  const dir = fileNameDirection(name);
  let last = -1;
  let i = 0;
  for (const ch of name) {
    if (RTL_LETTER.test(ch)) last = i + ch.length;
    i += ch.length;
  }
  if (last < 0) return { head: '', tail: name, dir };
  let cut = last;
  // Whitespace after the last letter stays with the head, so the tail is a
  // clean unit ("3.pdf", not " 3.pdf") and the head keeps its own spacing.
  while (cut < name.length && /\s/.test(name[cut])) cut += 1;
  return { head: name.slice(0, cut), tail: name.slice(cut), dir };
}
