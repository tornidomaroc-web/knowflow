'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui';
import { MessageBubble, Citation } from './MessageBubble';
import { Locale, locales, useTranslation } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatBoxProps {
  kbId: string;
  kbName: string;
  initialConversationId?: string | null;
  initialMessages?: { role: string; content: string }[] | null;
  onConversationCreated?: (id: string) => void;
}

function decodeCitations(header: string | null): Citation[] | undefined {
  if (!header) return undefined;
  try {
    const json = typeof atob === 'function' ? atob(header) : Buffer.from(header, 'base64').toString();
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function ChatBox({ kbId, kbName, initialConversationId, initialMessages, onConversationCreated }: ChatBoxProps) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  const t = useTranslation(safeLocale);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages?.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content })) ?? []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
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

      // Surface the server's own message on a non-OK response — notably the
      // rate-limit 429, whose reason ("you've hit today's limit…") is sent as
      // text/plain and was previously swallowed into a misleading generic error.
      // Confined to the !res.ok branch: we render the body and return before the
      // SSE stream loop / decodeCitations / header reads below. Falls back to the
      // generic string only when the body is empty; genuine network/stream
      // failures still land in catch and keep the friendly fallback.
      if (!res.ok) {
        const body = (await res.text()).trim();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: body || t.dashboard.agent.connectionError,
        }]);
        setIsLoading(false);
        return;
      }

      const newConvoId = res.headers.get('X-Conversation-Id');
      if (newConvoId && !conversationId) {
        setConversationId(newConvoId);
        onConversationCreated?.(newConvoId);
      }

      const citations = decodeCitations(res.headers.get('X-Citations'));

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', citations }]);

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
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: t.dashboard.agent.connectionError }]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  return (
    <div className="flex h-[calc(100dvh-100px)] flex-col bg-surface">
      <div className="border-b border-border bg-surface p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.dashboard.agent.chatWith}: <span className="text-foreground">{kbName}</span>
        </h2>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto bg-background p-6" ref={scrollRef}>
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            citations={m.citations}
            isStreaming={isLoading && m.role === 'assistant' && i === messages.length - 1}
          />
        ))}
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-muted-foreground">{t.dashboard.agent.startTyping}</div>
        )}
      </div>

      <div className="flex gap-3 border-t border-border bg-surface p-4 pb-8 md:pb-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.dashboard.agent.askPlaceholder}
          className="flex-1 resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className={buttonVariants({ variant: 'primary' })}
        >
          {t.dashboard.agent.send}
        </button>
      </div>
    </div>
  );
}
