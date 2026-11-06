import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { FileName } from '@/components/ui/FileName';
import { ClayChipFile } from '@/components/clay/ClayIcons';
import { isolatedPageLabel, pageLabelParts, type ChunkPages, type PageLabelStrings } from '@/lib/citation-pages';

export interface Citation extends ChunkPages {
  index: number;
  document_id: string;
  chunk_id: string;
  filename: string;
  similarity: number;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
  /**
   * Step Redesign-2: where a source pill goes, the material's card on its
   * subject page (`/dashboard/knowledge/<kb>#material-<document id>`). Without
   * it the pills stay labels, as before.
   */
  sourceHref?: (c: Citation) => string;
  /** The heading over the source pills ("Sources" / "المصادر"). */
  sourcesLabel?: string;
  /** G2: the words of a pill's page or slide label; without them no label is drawn. */
  pageLabels?: PageLabelStrings;
}

/**
 * One turn of the conversation. The student's bubble is gold and sits at the
 * end of the line; the answer is a clay card at the start, with its sources
 * under it as pills that open the material (Step Redesign-2). The pill row
 * stays dir="ltr" (register #124): the "[1]" index sits left of the name in
 * both languages, and FileName keeps the name one unit. The pill shows the
 * name without its extension (Step Store-Fix-1); its title keeps the full name.
 *
 * Whitespace (Step Store-Fix-2). ReactMarkdown puts a newline text node
 * between every two blocks; under `whitespace-pre-wrap` each of those drew a
 * blank line, so an answer's heading and paragraphs sat a whole empty line
 * apart on top of their margins (ar/04 of run 38618442205). The answer's
 * bubble now wraps whitespace normally; inside a paragraph a single newline
 * still breaks the line (`whitespace-pre-line`), as it did. Not on a list
 * item: a loose item holds its paragraphs between newline nodes too. The
 * student's own bubble keeps `pre-wrap`: what they typed is shown as typed.
 */
export function MessageBubble({ role, content, isStreaming, citations, sourceHref, sourcesLabel, pageLabels }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Design "C", PR 4: the question a gold clay bubble at the end, the
            answer a clay card at the start, each with its tail corner on
            the side it speaks from (the landing's answer card, Landing.dc.html).
            The card's padding and margins are the same as before, so the
            blocks inside it keep their 8 px rhythm (render-fix2's gap check). */}
        <div
          dir="auto"
          data-kf-bubble={isUser ? 'question' : 'answer'}
          className={`rounded-[1.25rem] p-4 text-sm ${
            isUser ? 'whitespace-pre-wrap' : ''
          } ${
            isUser
              ? 'kf-bubble-user rounded-ee-md bg-primary text-primary-foreground'
              : 'kf-card !rounded-[1.25rem] !rounded-es-md bg-surface text-foreground'
          }`}
        >
          {/* Markdown marks inherit the bubble's text color so they read on both
              the gold user bubble and the surface assistant bubble. */}
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className={`mb-2 last:mb-0 ${isUser ? '' : 'whitespace-pre-line'}`}>{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="mb-2 list-inside list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-inside list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              // `font-mono` DROPPED, not remapped. Tailwind's stock mono stack is
              // Latin-only, and this span holds arbitrary model output — in an
              // Arabic-first product that is frequently Arabic, which would render
              // in an arbitrary system fallback. Unlike the landing terminal the
              // content is unknown, so it cannot be scoped; and no theme `mono`
              // ordering is correct on every platform (see page.tsx). The span keeps
              // its fill, padding and size, so code still reads as code. Register #92.
              code: ({ children }) => (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
              ),
              h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-1 text-sm font-bold">{children}</h3>,
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="mt-2 inline-block animate-pulse font-bold text-primary">▋</span>
          )}
        </div>
        {!isUser && !isStreaming && citations && citations.length > 0 && (
          <>
            {sourcesLabel && <p className="px-1 text-[11px] font-semibold text-muted-foreground">{sourcesLabel}</p>}
            {/* Each source a clay pill with a small file chip, as the landing's
                answer card draws them; 44 pt tall when it is a link. The row
                stays dir="ltr" (register #124): "[1]" sits left of the name in
                both languages, and FileName keeps the name one unit. */}
            <div className="flex flex-wrap gap-2 px-1" dir="ltr">
              {citations.map((c, i) => {
                // G2: the page or slide, only when it is known (never a guess).
                // #307 review (2026-11-06): the name takes line 1 at the pill's
                // full width, balanced so no line is a lone word; the label sits
                // on line 2 under it, smaller and muted, at the same start edge,
                // with no separator. Its own run (dir="auto": "ص 12" reads right
                // to left) with the range in a left-to-right isolate, so "3-4"
                // never shows as "4-3" after an Arabic word. A source with no
                // page keeps the one-line pill as before. design-c's check 9
                // reads all of it (pr4.mjs).
                const page = pageLabels ? pageLabelParts(c, pageLabels) : null;
                const name = (
                  <span data-kf-source-name="" className="[text-wrap:balance]">
                    [{c.index}] <FileName name={c.filename} inline withoutExtension />
                  </span>
                );
                const body = (
                  <>
                    <ClayChipFile tone={i % 2 ? 'blue' : 'peach'} />
                    {page ? (
                      <span className="flex min-w-0 flex-col items-start py-1.5 leading-tight">
                        {name}
                        <span
                          data-kf-source-page=""
                          data-kf-page-from={page.range ? page.from : undefined}
                          data-kf-page-to={page.range ? page.to : undefined}
                          dir="auto"
                          className="whitespace-nowrap text-[0.917em] font-medium text-muted-foreground"
                        >
                          {page.before}
                          {page.range && <bdi dir="ltr">{page.range}</bdi>}
                          {page.after}
                        </span>
                      </span>
                    ) : (
                      name
                    )}
                  </>
                );
                const pageText = pageLabels ? isolatedPageLabel(c, pageLabels) : null;
                const title = `${c.filename}${pageText ? ` · ${pageText}` : ''} · ${(c.similarity * 100).toFixed(0)}% match`;
                // With a destination the pill is a link to the material.
                return sourceHref ? (
                  <Link key={c.chunk_id} href={sourceHref(c)} title={title} data-kf-source="" className="kf-pill inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {body}
                  </Link>
                ) : (
                  <span key={c.chunk_id} title={title} className="kf-pill inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-muted-foreground">
                    {body}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
