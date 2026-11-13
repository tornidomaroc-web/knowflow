/**
 * THE LONGEST QUESTION ASK TAKES (fix/ai-cost-caps, 2026-11-13).
 *
 * `/api/agent` took a question of any length: the Ask box has no maxLength and
 * the route checked only that a message existed. The whole question is
 * embedded by Voyage AI, sent to Anthropic, stored in `messages` and replayed
 * as history, so one pasted chapter was one very expensive question that still
 * counted as one of the day's.
 *
 * 4,000 characters is about a page of prose: far beyond a question (the route
 * budgets 1,200 tokens for a whole conversation's history), and at the route's
 * own estimator (2 Arabic characters a token) at most about 2,000 input tokens,
 * 0.002 USD at Haiku 4.5's 1 USD per million. The ingestion service's own
 * /embed cap (MAX_EMBED_CHARS, 32,000) stays as the second wall behind it.
 *
 * Counted in code points, so an emoji or any character outside the BMP is one
 * character, as a student would count it. No server import: the chat reads
 * `QUESTION_TOO_LONG` too.
 */
export const MAX_QUESTION_CHARS = 4000;

/** `X-KF-Refusal` on the 413: the chat puts the question back in the box. */
export const QUESTION_TOO_LONG = 'question-too-long';

export function questionChars(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}
