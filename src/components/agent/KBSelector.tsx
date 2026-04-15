'use client';

import { useState, useEffect, useCallback } from 'react';
import type { KnowledgeBase } from '@/types';
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
  const [selectedId, setSelectedId] = useState(kbs[0]?.id || '');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [mountKey, setMountKey] = useState(0);
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
  };

  const handleNewConversation = () => {
    setSelection({ conversationId: null, messages: null });
    setMountKey(k => k + 1); // explicit new → remount with empty chat
  };

  const selectedKb = kbs.find(k => k.id === selectedId);

  if (!kbs.length) return null;

  return (
    <div className="flex flex-1 h-full overflow-hidden border border-[var(--border-color)]">
      <ConversationSidebar
        activeId={selection.conversationId}
        conversations={conversations}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex space-x-2 overflow-x-auto p-3 border-b border-[var(--border-color)] bg-[#0c1510] scrollbar-hide">
          {kbs.map(kb => (
            <button
              key={kb.id}
              onClick={() => { setSelectedId(kb.id); setSelection({ conversationId: null, messages: null }); setMountKey(k => k + 1); }}
              className={`px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest whitespace-nowrap border transition-colors ${
                selectedId === kb.id
                  ? 'bg-[var(--accent-color)] text-[#070d0a] border-[var(--accent-color)]'
                  : 'bg-[#0c1510] text-[var(--muted-color)] border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-white'
              }`}
            >
              {kb.name}
            </button>
          ))}
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
