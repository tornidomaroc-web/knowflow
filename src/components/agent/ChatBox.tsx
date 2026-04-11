'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBoxProps {
  kbId: string;
  kbName: string;
}

export function ChatBox({ kbId, kbName }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, kb_id: kbId, conversation_id: conversationId }),
      });

      if (!res.ok) throw new Error('API Error');
      
      const newConvoId = res.headers.get('X-Conversation-Id');
      if (newConvoId && !conversationId) setConversationId(newConvoId);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m));
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Connection error.' }]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] border border-[var(--border-color)] bg-[#070d0a]">
      <div className="p-4 border-b border-[var(--border-color)] bg-[#0c1510]">
        <h2 className="font-[family-name:var(--font-mono)] text-[var(--muted-color)] uppercase tracking-widest text-xs">
          Chatting with: {kbName}
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.map((m, i) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} isStreaming={isLoading && m.role === 'assistant' && i === messages.length - 1} />
        ))}
        {messages.length === 0 && (
          <div className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-center mt-10">Start typing to ask questions.</div>
        )}
      </div>

      <div className="p-4 bg-[#0c1510] border-t border-[var(--border-color)] flex gap-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question (Cmd+Enter to send)..."
          className="flex-1 resize-none bg-[var(--bg-color)] border border-[var(--border-color)] p-3 text-white font-[family-name:var(--font-sans)] text-sm focus:outline-none focus:border-[var(--accent-color)]"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-[var(--accent-color)] text-[#070d0a] px-6 font-[family-name:var(--font-mono)] uppercase text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
