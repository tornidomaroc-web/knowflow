'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui';
import { MessageBubble, Citation } from './MessageBubble';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';

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

/**
 * `atob` ALONE IS NOT A BASE64 DECODER FOR TEXT, AND THAT IS THE WHOLE BUG.
 *
 * This line used to read `atob(header)` and hand the result straight to
 * `JSON.parse`. `atob` returns a BINARY STRING - one character per byte, each in
 * U+0000..U+00FF - which is Latin-1 by definition. The server encodes with
 * `Buffer.from(JSON.stringify(citations))` (api/agent/route.ts), and
 * `Buffer.from(string)` defaults to UTF-8, so every non-ASCII character crossed
 * the `X-Citations` header as multiple bytes and arrived as that many separate
 * characters. An Arabic filename rendered as mojibake in the citation pills.
 *
 * THE CORRUPTION WAS ONLY EVER IN THIS HOP. Storage, the database and every
 * normal HTML render of the same filename were always correct - which is why
 * nothing upstream needs touching, and why the fix is one expression.
 *
 * IT WAS BROWSER-ONLY, WHICH IS WHY IT SURVIVED UNTIL SOMEONE LOOKED AT A PHONE.
 * The `Buffer.from(header, 'base64').toString()` fallback below defaults to UTF-8
 * and has always been correct, so no server-side test could reproduce this. The
 * two branches now agree instead of disagreeing.
 *
 * AND IT WAS NEVER ONLY ARABIC. UTF-8 and Latin-1 coincide exactly on
 * U+0000..U+007F, so pure-ASCII filenames were unaffected and are byte-identical
 * after this change. Everything above U+007F was broken: accented Latin
 * (`é`, `ñ`), Cyrillic, Hebrew, CJK, and emoji alike.
 */
function decodeCitations(header: string | null): Citation[] | undefined {
  if (!header) return undefined;
  try {
    // base64 -> bytes -> UTF-8. `TextDecoder` is the mirror of the `TextEncoder`
    // the route already uses, and it reconstructs surrogate pairs correctly, so
    // characters outside the BMP survive the round trip.
    const json =
      typeof atob === 'function'
        ? new TextDecoder().decode(Uint8Array.from(atob(header), (c) => c.charCodeAt(0)))
        : Buffer.from(header, 'base64').toString();
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function ChatBox({ kbId, kbName, initialConversationId, initialMessages, onConversationCreated }: ChatBoxProps) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = resolveLocale(params.locale);
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
        body: JSON.stringify({ message: userMsg.content, kb_id: kbId, conversation_id: conversationId, locale: safeLocale }),
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
    /*
      THE MAGIC NUMBER THAT USED TO BE HERE IS GONE AND MUST NOT COME BACK.
      This read `h-[calc(100dvh-100px)]`. A leaf component cannot know how much
      chrome sits above and below it, and this one guessed wrong by 135px: the
      real total is 72px of <main> top padding + 61px of the KBSelector subject
      bar + 2px of card border + 96px of <main> bottom padding. The card
      therefore ended 35px past the bottom of the viewport with a fixed 57px nav
      over it, and `elementFromPoint` at the Send button's centre returned a nav
      link instead of the button.

      The height now belongs to the page (dashboard/agent/page.tsx), which is the
      only place that can see the layout it lives in. Here we simply fill what we
      are given. `min-h-0` is load-bearing, not tidiness: a flex item defaults to
      `min-height: auto`, which resolves to min-content and would refuse to
      shrink below the full un-scrolled message list — reintroducing the same
      overflow from the inside.
    */
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
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
