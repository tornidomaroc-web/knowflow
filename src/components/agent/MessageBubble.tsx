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
}

export function MessageBubble({ role, content, isStreaming, citations }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[75%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          dir="auto"
          className={`whitespace-pre-wrap rounded-2xl p-4 text-sm shadow-soft ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-surface text-foreground'
          }`}
        >
          {/* Markdown marks inherit the bubble's text color so they read on both
              the emerald user bubble and the light assistant bubble. */}
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
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
          <div className="flex flex-wrap gap-2 px-1" dir="ltr">
            {citations.map((c) => (
              <span
                key={c.chunk_id}
                title={`${c.filename} · ${(c.similarity * 100).toFixed(0)}% match`}
                className="cursor-default rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                [{c.index}] <FileName name={c.filename} inline />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
