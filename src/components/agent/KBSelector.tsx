'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import type { KnowledgeBase } from '@/types';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';
import { ChatBox } from './ChatBox';
import { ConversationSidebar } from './ConversationSidebar';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  id: string;
  kb_id: string;
  created_at: string;
  knowledge_bases: { name: string } | null;
}

export function KBSelector({ kbs }: { kbs: KnowledgeBase[] }) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  const t = useTranslation(safeLocale);
  const isRtl = safeLocale === 'ar';

  const [selectedId, setSelectedId] = useState(kbs[0]?.id || '');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [mountKey, setMountKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selection, setSelection] = useState<{
    conversationId: string | null;
    messages: { role: string; content: string }[] | null;
  }>({ conversationId: null, messages: null });

  const fetchConversations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('conversations')
      .select('id, kb_id, created_at, knowledge_bases(name)')
      .order('created_at', { ascending: false });
    if (data) setConversations(data as unknown as Conversation[]);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedId(conv.kb_id);
    const supabase = createClient();
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    // Set both atomically so ChatBox remounts with correct data
    setSelection({ conversationId: conv.id, messages: msgs ?? [] });
    setMountKey(k => k + 1); // explicit selection → remount with loaded history
    setDrawerOpen(false); // close the mobile history drawer after picking
  };

  const handleNewConversation = () => {
    setSelection({ conversationId: null, messages: null });
    setMountKey(k => k + 1); // explicit new → remount with empty chat
    setDrawerOpen(false); // close the mobile history drawer after starting
  };

  const selectedKb = kbs.find(k => k.id === selectedId);

  if (!kbs.length) return null;

  const sidebar = (
    <ConversationSidebar
      activeId={selection.conversationId}
      conversations={conversations}
      onSelect={handleSelectConversation}
      onNew={handleNewConversation}
    />
  );

  return (
    <div className="flex h-full flex-1 overflow-hidden rounded-xl border border-border bg-surface">
      {/* Desktop: persistent history column. Mobile: the same list lives in the Sheet below. */}
      <div className="hidden h-full w-64 shrink-0 border-e border-border md:block">{sidebar}</div>
      {/* Mobile-only: display:none on this wrapper removes the fixed Sheet (and
          its focusable list) from the desktop DOM/tab order entirely. */}
      <div className="md:hidden">
        <Sheet
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          side={isRtl ? 'right' : 'left'}
          label={t.dashboard.agent.history}
        >
          {sidebar}
        </Sheet>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface p-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.dashboard.agent.history}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Single-subject scope: picking a subject switches the active one (and
              resets the conversation). Never a multi-select / cross-subject search. */}
          <div className="flex gap-2 overflow-x-auto">
            {kbs.map(kb => (
              <button
                key={kb.id}
                onClick={() => { setSelectedId(kb.id); setSelection({ conversationId: null, messages: null }); setMountKey(k => k + 1); }}
                aria-pressed={selectedId === kb.id}
                className={cn(
                  'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  selectedId === kb.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
                )}
              >
                {kb.name}
              </button>
            ))}
          </div>
        </div>
        {selectedKb && (
          <ChatBox
            key={`${selectedKb.id}-${mountKey}`}
            kbId={selectedKb.id}
            kbName={selectedKb.name}
            initialConversationId={selection.conversationId}
            initialMessages={selection.messages}
            onConversationCreated={(id) => { setSelection(s => ({ ...s, conversationId: id })); fetchConversations(); }}
          />
        )}
      </div>
    </div>
  );
}
