'use client';

import { useParams } from 'next/navigation';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';
import { UserName } from '@/components/ui/UserName';
import { ClayChat } from '@/components/clay/ClayIcons';

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
  const safeLocale: Locale = resolveLocale(params.locale);
  const t = useTranslation(safeLocale);

  // Design "C", PR 4: no row hairlines. Each past conversation is a clay
  // row with the chat glyph; the open one is the gold clay pill the tab bar
  // and the web sidebar use for "you are here", in ink.
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="p-3">
        <button onClick={onNew} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'w-full rounded-full')}>
          {/* The words carry their own "+" (agent.newConversation), so no plus coin. */}
          {t.dashboard.agent.newConversation}
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-1">
        {conversations.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">{t.dashboard.agent.noHistory}</p>
        )}
        {conversations.map((conv) => {
          const active = activeId === conv.id;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              aria-current={active ? 'true' : undefined}
              data-kf-conversation=""
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'kf-tab-active text-accent-foreground' : 'kf-row text-foreground',
              )}
            >
              <ClayChat width={22} height={22} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <UserName as="p" className="truncate text-sm font-semibold">
                  {conv.knowledge_bases?.name ?? t.dashboard.home.unknownKb}
                </UserName>
                <span className={cn('mt-0.5 block text-[11px]', active ? 'text-accent-foreground' : 'text-muted-foreground')}>
                  {formatDate(conv.created_at, safeLocale)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
