/**
 * THE ANSWER PROMPT of /api/agent, built here so it can be read and tested
 * without calling any AI provider (scripts/verify-answer-prompt.mjs).
 *
 * G2 (page numbers): each retrieved passage is numbered as before, "[1]", and
 * its label names its file and, ONLY when the chunk's page is known
 * (src/lib/citation-pages.ts, knownPages), its page or slide: "(notes.pdf,
 * p. 12)", "(lecture.pptx, slides 5-6)". The rules let the answer name that
 * page and forbid naming a page for a passage whose label has none, so a
 * NULL page (every chunk stored before G2, every .docx, .txt, .xlsx, .md) can
 * never become an invented one.
 *
 * G4 (the file's own language): the answer keeps the student's language, as
 * before, but a technical term is written as the file writes it, once, beside
 * the translation, and names, formulas, code, units and quoted lines are
 * copied exactly, never translated.
 *
 * Finding (b) of 2026-11-07 (an Arabic answer on the owner's iPhone): the
 * answer opened with "وفقاً للمقطع المسترجع" ("according to the retrieved
 * passage") and added "(Aerobic Respiration)", a term the file does not
 * contain. The prompt no longer calls its passages "retrieved" (the opening
 * line and the user turn's heading), a rule forbids talking about passages,
 * retrieval, context, chunks or labels, and G4 adds a term in another
 * language ONLY when that exact term is in a cited passage.
 *
 * The G4 leak (open from #310, decided 2026-11-10): the rule's own example,
 * an Arabic word with "(mitochondria)" beside it, was a term from general
 * knowledge in brackets, the shape the rule forbids, and answers copied it.
 * The rule now has no concrete term example; it is stated in words only.
 */
import { contextPageLabel, type ChunkPages } from '@/lib/citation-pages';

export const SYSTEM_INSTRUCTIONS = `You are KnowFlow, an intelligent assistant that answers a student's questions strictly from the passages of the student's own files provided in the user message.

Rules:
- Always answer in the same language the user used (Arabic or English).
- Cite the passages you use with bracketed numbers like [1], [2] that match the numbered passages in the context.
- Each passage is labelled with its file, and with its page or slide when that is known, for example "(notes.pdf, p. 12)" or "(lecture.pptx, slide 5)". You may name that page or slide when you cite it. Never give a page or slide number for a passage whose label has none, and never guess one.
- Talk to the student about their files, never about how you were given them: never mention passages, retrieval, context, chunks or labels. Call the source the student's file, by its name when that helps, or simply answer.
- Keep the file's own terms: when you answer in a different language from the passage, write each technical term as the passage writes it, once, beside your translation. Add a term in another language ONLY when that exact term appears in a passage you cite; never add one from general knowledge, never invent a translation and never add a term the file does not contain.
- Never translate names of people, places or files, formulas, equations, code, units or quoted lines; copy them exactly as the passage writes them.
- If the answer is not present in the passages, say so clearly. Do not fabricate.
- Be concise. Prefer short, direct answers over long ones.`;

export interface PromptChunk extends ChunkPages {
  filename: string;
  content: string;
}

/** "(notes.pdf, p. 12)" when the page is known, "(notes.pdf)" when it is not. */
export function passageLabel(c: PromptChunk): string {
  const page = contextPageLabel(c);
  return page ? `(${c.filename}, ${page})` : `(${c.filename})`;
}

/** The numbered passages, "[1] (file, p. 3)\n<text>", separated as before. */
export function buildContextBlock(chunks: PromptChunk[]): string {
  return chunks.length
    ? chunks.map((c, i) => `[${i + 1}] ${passageLabel(c)}\n${c.content}`).join('\n\n---\n\n')
    : '(no relevant passages found)';
}

export function buildUserTurn(contextBlock: string, message: string): string {
  return `Passages from the student's files:\n\n${contextBlock}\n\n---\n\nQuestion: ${message}`;
}
