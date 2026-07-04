'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';

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
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = locales.includes(params.locale) ? params.locale : 'en';
  const t = useTranslation(safeLocale);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="border-b border-border p-3">
        <button onClick={onNew} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'w-full')}>
          {t.dashboard.agent.newConversation}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">{t.dashboard.agent.noHistory}</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={cn(
              'w-full border-b border-border px-4 py-3 text-start transition-colors',
              activeId === conv.id
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <p className="truncate text-sm font-medium">
              {conv.knowledge_bases?.name ?? t.dashboard.home.unknownKb}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(conv.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
