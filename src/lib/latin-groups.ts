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

/**
 * BARE LATIN RUNS IN A RIGHT-TO-LEFT SENTENCE (the drop zone and the AI
 * permission sheet, after activation 5's renders). Not only bracketed groups:
 * "يقبل KnowFlow ملفات PDF, DOCX, PPTX, XLSX, TXT, MD فقط، وهذا الملف من نوع
 * .zip." broke the list over two lines (its order scrambled around the
 * Arabic) and drew ".zip" as "zip."; the declined sentence broke "Voyage" /
 * "AI.". A run is a Latin word, or a leading "." and a Latin word (".zip"),
 * then any further Latin words, digits and the separators between them
 * (space, comma, dot, hyphen, underscore, apostrophe, slash, plus, "&"). It
 * ends on a letter or a digit, so a sentence's own "." or "،" stays with the
 * Arabic. A bracketed Latin group is still one piece, brackets included, as
 * splitLatinGroups() cuts it.
 *
 * `short` is the same cap as a bracketed group's: at most SHORT_GROUP
 * characters (the run's own; a group's inside its brackets). The caller
 * draws every run as a left-to-right isolate, and a short one on one line.
 */
export type Run = string | { run: string; short: boolean };

const RUN = /\.?[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ0-9]*(?:[ ,.\-_'’/+&]+[A-Za-zÀ-ɏ0-9]+)*/g;

export function splitLatinRuns(text: string): Run[] {
  const out: Run[] = [];
  const plain = (s: string) => {
    let at = 0;
    for (const m of s.matchAll(RUN)) {
      const start = m.index ?? 0;
      if (start > at) out.push(s.slice(at, start));
      out.push({ run: m[0], short: m[0].length <= SHORT_GROUP });
      at = start + m[0].length;
    }
    if (at < s.length) out.push(s.slice(at));
  };
  for (const p of splitLatinGroups(text)) {
    if (typeof p === 'string') plain(p);
    else out.push({ run: p.group, short: p.short });
  }
  return out;
}
