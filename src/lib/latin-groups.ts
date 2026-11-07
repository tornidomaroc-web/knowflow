/**
 * A BRACKETED LATIN GROUP INSIDE AN ARABIC ANSWER (finding (b) of 2026-11-07).
 *
 * In a right-to-left paragraph the bidi algorithm gives the brackets of
 * "(Aerobic Respiration)" to the Arabic around them, not to the English inside:
 * they are drawn mirrored, and when the line breaks inside the group each line
 * shows a lone bracket (the owner's iPhone). The answer card draws each such
 * group as its own left-to-right isolate (<bdi dir="ltr">), so the brackets
 * belong to the English and read the right way round. A SHORT group (at most
 * SHORT_GROUP characters inside its brackets) is also kept on one line, as an
 * inline-block no wider than the line: it moves to the next line whole, and a
 * group wider than the line still wraps inside its own box, never past the
 * card. A longer group flows with the text and wraps like it, its brackets
 * still its own. scripts/design-c/pr4.mjs (check 10) reads all of it.
 *
 * Only in an answer whose first strong letter is Arabic or Hebrew (the
 * answer card is dir="auto", so that is exactly when it reads right to left).
 * A group holding an Arabic letter, a bracket, a newline or a citation "[n]"
 * is left as written.
 */
export const SHORT_GROUP = 30;

const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/;
const GROUP = /\(([^()[\]\n]+)\)/g;

/** True when the first strong letter of `text` is right to left (what dir="auto" decides). */
export function readsRightToLeft(text: string): boolean {
  for (const ch of text) {
    if (RTL_LETTER.test(ch)) return true;
    if (LATIN_LETTER.test(ch)) return false;
  }
  return false;
}

export type Piece = string | { group: string; short: boolean };

/** `text` cut into plain runs and bracketed Latin groups (brackets included). */
export function splitLatinGroups(text: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(GROUP)) {
    const inner = m[1];
    if (!LATIN_LETTER.test(inner) || RTL_LETTER.test(inner)) continue;
    const start = m.index ?? 0;
    if (start > at) out.push(text.slice(at, start));
    out.push({ group: m[0], short: inner.length <= SHORT_GROUP });
    at = start + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
