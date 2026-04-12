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
        <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#070d0a] prose-pre:border prose-pre:border-[var(--border-color)]">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {isStreaming && <span className="animate-pulse inline-block mt-2 font-bold text-[var(--accent-color)]">▋</span>}
      </div>
    </div>
  );
}
