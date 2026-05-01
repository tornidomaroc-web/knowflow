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
      <div className={`max-w-[75%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          dir="auto"
          className={`p-4 font-[family-name:var(--font-sans)] text-sm whitespace-pre-wrap rounded-none ${
            isUser
              ? 'bg-[#1a2e1e] text-white border-l-2 border-[var(--accent-color)]'
              : 'bg-[#0c1510] text-[var(--muted-color)] border-l-2 border-transparent'
          }`}
          style={!isUser ? { borderLeftColor: 'var(--muted-color)' } : {}}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              code: ({ children }) => (
                <code className="bg-[#070d0a] px-1 py-0.5 rounded text-[#2eff8c] text-xs font-mono">
                  {children}
                </code>
              ),
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="animate-pulse inline-block mt-2 font-bold text-[var(--accent-color)]">▋</span>
          )}
        </div>

        {!isUser && !isStreaming && citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1" dir="ltr">
            {citations.map((c) => (
              <span
                key={c.chunk_id}
                title={`${c.filename} · ${(c.similarity * 100).toFixed(0)}% match`}
                className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--muted-color)] border border-[var(--border-color)] px-2 py-1 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-default"
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
