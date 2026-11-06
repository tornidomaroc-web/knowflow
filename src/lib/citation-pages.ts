/**
 * G2: the page (PDF) or slide (.pptx) a cited chunk lies on.
 *
 * The ingestion service stores `page_start`, `page_end` and `page_kind` on each
 * NEW chunk (supabase/migrations/20261106_chunks_pages.sql); every older
 * chunk, and every file that is not a PDF or a .pptx, has all three NULL. One
 * rule decides what is shown and what the model is told, here, so the pill and
 * the context can never disagree: a page is known only when all three are
 * valid; otherwise there is NO label at all (never a guess).
 */

export type PageKind = 'page' | 'slide';

export interface ChunkPages {
  page_start?: number | null;
  page_end?: number | null;
  page_kind?: PageKind | string | null;
}

export interface KnownPages {
  start: number;
  end: number;
  kind: PageKind;
}

const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1;

/** The chunk's pages when all three columns are valid, else null. */
export function knownPages(c: ChunkPages | null | undefined): KnownPages | null {
  if (!c) return null;
  const { page_start: s, page_end: e, page_kind: k } = c;
  if (!whole(s) || !whole(e) || e < s || (k !== 'page' && k !== 'slide')) return null;
  return { start: s, end: e, kind: k };
}

/** The pill's words (dashboard.agent.sourcePage / sourcePages / sourceSlide / sourceSlides). */
export interface PageLabelStrings {
  sourcePage: string;
  sourcePages: string;
  sourceSlide: string;
  sourceSlides: string;
}

/**
 * "p. 12", "pp. 3-4", "slide 5", "slides 5-6" (or the Arabic drafts), with
 * Western digits; null when the page is not known. A position is named, not a
 * count, so no plural rule applies: one page or a range is all that changes.
 */
export function pageLabel(c: ChunkPages | null | undefined, s: PageLabelStrings): string | null {
  const p = knownPages(c);
  if (!p) return null;
  const one = p.start === p.end;
  const tpl = p.kind === 'slide' ? (one ? s.sourceSlide : s.sourceSlides) : one ? s.sourcePage : s.sourcePages;
  return tpl.replace('{n}', String(p.start)).replace('{from}', String(p.start)).replace('{to}', String(p.end));
}

/** The label the MODEL sees in its context, in English whatever the answer's language. */
export function contextPageLabel(c: ChunkPages | null | undefined): string | null {
  return pageLabel(c, { sourcePage: 'p. {n}', sourcePages: 'pp. {from}-{to}', sourceSlide: 'slide {n}', sourceSlides: 'slides {from}-{to}' });
}
