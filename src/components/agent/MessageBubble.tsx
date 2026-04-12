import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] p-4 font-[family-name:var(--font-sans)] text-sm whitespace-pre-wrap rounded-none ${
          isUser 
            ? 'bg-[#1a2e1e] text-white border-l-2 border-[var(--accent-color)]' 
            : 'bg-[#0c1510] text-[var(--muted-color)] border-l-2 border-transparent'
        }`}
        style={!isUser ? { borderLeftColor: 'var(--muted-color)' } : {}}
      >
        <ReactMarkdown
          components={{
            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
            strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            li: ({children}) => <li className="text-sm">{children}</li>,
            code: ({children}) => <code className="bg-[#070d0a] px-1 py-0.5 rounded text-[#2eff8c] text-xs font-mono">{children}</code>,
            h1: ({children}) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
            h2: ({children}) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
            h3: ({children}) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && <span className="animate-pulse inline-block mt-2 font-bold text-[var(--accent-color)]">▋</span>}
      </div>
    </div>
  );
}
