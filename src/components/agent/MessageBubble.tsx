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
        {content}
        {isStreaming && <span className="animate-pulse">▋</span>}
      </div>
    </div>
  );
}
