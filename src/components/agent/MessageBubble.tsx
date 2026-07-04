import ReactMarkdown from 'react-markdown';

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
              code: ({ children }) => (
                <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs">{children}</code>
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
                [{c.index}] {c.filename}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
