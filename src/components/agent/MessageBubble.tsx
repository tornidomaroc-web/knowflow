import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { FileName } from '@/components/ui/FileName';

export interface Citation {
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
export function MessageBubble({ role, content, isStreaming, citations, sourceHref, sourcesLabel }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          dir="auto"
          className={`rounded-2xl p-4 text-sm ${
            isUser ? 'whitespace-pre-wrap' : ''
          } ${
            isUser
              ? 'kf-bubble-user bg-primary text-primary-foreground shadow-soft'
              : 'kf-card border border-border bg-surface text-foreground shadow-soft'
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
            <div className="flex flex-wrap gap-2 px-1" dir="ltr">
              {citations.map((c) => {
                const pill = (
                  <span
                    title={`${c.filename} · ${(c.similarity * 100).toFixed(0)}% match`}
                    className="cursor-default rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    [{c.index}] <FileName name={c.filename} inline withoutExtension />
                  </span>
                );
                // With a destination the pill is a link to the material, 44 pt tall
                // through its padding, and reads in the text colour.
                return sourceHref ? (
                  <Link key={c.chunk_id} href={sourceHref(c)} className="kf-tile inline-flex min-h-[2.75rem] items-center rounded-full bg-raised px-1 [&>span]:cursor-pointer [&>span]:border-0 [&>span]:text-xs [&>span]:text-foreground">
                    {pill}
                  </Link>
                ) : (
                  <span key={c.chunk_id} className="contents">{pill}</span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
