'use client';

import { createClient } from '@/lib/supabase/client';

interface Conversation {
  id: string;
  kb_id: string;
  created_at: string;
  knowledge_bases: { name: string } | null;
}

interface Props {
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  conversations: Conversation[];
}

export function ConversationSidebar({ activeId, onSelect, onNew, conversations }: Props) {
  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-[var(--border-color)] bg-[#0c1510] h-full overflow-hidden">
      <div className="p-3 border-b border-[var(--border-color)]">
        <button
          onClick={onNew}
          className="w-full py-2 px-3 bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
        >
          + New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-[var(--muted-color)] text-xs font-[family-name:var(--font-mono)]">No history yet.</p>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] transition-colors ${
              activeId === conv.id
                ? 'bg-[#1a2e20] text-white'
                : 'text-[var(--muted-color)] hover:bg-[#111c16] hover:text-white'
            }`}
          >
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider truncate">
              {conv.knowledge_bases?.name ?? 'Unknown KB'}
            </p>
            <p className="text-[10px] text-[var(--muted-color)] mt-1 font-[family-name:var(--font-sans)]">
              {new Date(conv.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
