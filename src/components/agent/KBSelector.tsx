'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClayClock } from '@/components/clay/ClayIcons';
import type { KnowledgeBase } from '@/types';
import { Sheet } from '@/components/ui';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';
import { ChatBox } from './ChatBox';
import type { Citation } from './MessageBubble';
import { ConversationSidebar } from './ConversationSidebar';
import { createClient } from '@/lib/supabase/client';
import { initialAskSubject } from '@/lib/material-text';
import { SubjectChips, AskNoAnswerableSubject } from './SubjectChips';
import { sampleQuestionFor } from '@/lib/sample-file';

export interface Conversation {
  id: string;
  kb_id: string;
  created_at: string;
  knowledge_bases: { name: string } | null;
}

export interface MaterialName {
  id: string;
  kb_id: string;
  filename: string;
  /** The first sentence of the material's summary, or null (#121, defect 4). */
  lead: string | null;
}

/**
 * `answerableIds` (register #129 (c)): the subjects holding a file Ask can
 * answer from (`answerableSubjectIds`, on #128's rule). Only they are offered
 * in the subject bar or opened by `?kb=`. The FULL `kbs` list is kept for
 * history: a past conversation in any subject still opens with its messages.
 */
/**
 * `preview` (the design preview only, src/app/[locale]/preview/ask): the
 * history and each conversation's messages as literal data, so the real
 * screen can be rendered with no session. With it nothing is read from
 * Supabase; without it (the real page) nothing here changes.
 */
export interface KBSelectorPreview {
  conversations: Conversation[];
  messages: Record<string, { role: string; content: string; citations?: Citation[] }[]>;
  /** Open on this conversation, as if it had been picked from the history. */
  open?: string;
  /** Open the phone's history drawer at once. */
  drawer?: boolean;
}

export function KBSelector({ kbs, materials = [], answerableIds, preview, sampleKbIds = [] }: { kbs: KnowledgeBase[]; materials?: MaterialName[]; answerableIds: string[]; preview?: KBSelectorPreview; /** The subjects holding the sample file (audit cause 9): the ready question is offered there only. */ sampleKbIds?: string[] }) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = resolveLocale(params.locale);
  const t = useTranslation(safeLocale);
  const isRtl = safeLocale === 'ar';

  // `?kb=` preselects a subject (register #85): the subject cards and the
  // subject page link here with it. An unknown id, or a subject Ask cannot
  // answer from (#129), falls back to the first that it can, else none.
  const searchParams = useSearchParams();
  const wanted = searchParams.get('kb');
  const answerable = new Set(answerableIds);
  const firstAnswerable = () => initialAskSubject(kbs.map((k) => k.id), answerable, null);
  const opened = preview?.open ? preview.conversations.find((c) => c.id === preview.open) : undefined;
  // Activation 5 (cause #6): a `?kb=` that names one of the student's
  // subjects with no file to answer from opens THAT subject, on the way to
  // its upload tile (ChatBox `answerable={false}`), instead of quietly
  // switching to another subject. It still offers no composer there.
  const wantedEmpty = wanted && !answerable.has(wanted) && kbs.some((k) => k.id === wanted) ? wanted : null;
  const [selectedId, setSelectedId] = useState(() => opened?.kb_id ?? wantedEmpty ?? initialAskSubject(kbs.map((k) => k.id), answerable, wanted));
  // The subject bar offers the subjects Ask can answer from (#129 (c)) and,
  // always, the selected one (the owner's review of #315): a subject opened
  // by `?kb=` or from the history with no file to answer from still shows as
  // the gold chip, so "Asking about Statistics" has its chip.
  const offered = kbs.filter((k) => answerable.has(k.id) || k.id === selectedId);
  const [conversations, setConversations] = useState<Conversation[]>(preview?.conversations ?? []);
  const [mountKey, setMountKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(preview?.drawer ?? false);
  const [selection, setSelection] = useState<{
    conversationId: string | null;
    messages: { role: string; content: string; citations?: Citation[] }[] | null;
  }>(opened ? { conversationId: opened.id, messages: preview?.messages[opened.id] ?? [] } : { conversationId: null, messages: null });

  const fetchConversations = useCallback(async () => {
    if (preview) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('conversations')
      .select('id, kb_id, created_at, knowledge_bases(name)')
      .order('created_at', { ascending: false });
    if (data) setConversations(data as unknown as Conversation[]);
  }, [preview]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedId(conv.kb_id);
    if (preview) {
      setSelection({ conversationId: conv.id, messages: preview.messages[conv.id] ?? [] });
      setMountKey(k => k + 1);
      setDrawerOpen(false);
      return;
    }
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
    // A new question never starts in a subject Ask cannot answer from, even
    // after reading an old conversation there (#129 (c)).
    if (!answerable.has(selectedId)) setSelectedId(firstAnswerable());
    setSelection({ conversationId: null, messages: null });
    setMountKey(k => k + 1); // explicit new → remount with empty chat
    setDrawerOpen(false); // close the mobile history drawer after starting
  };

  const selectedKb = kbs.find(k => k.id === selectedId);
  // Activation 5 (the owner's review of #315): in a subject with no file to
  // answer from and no conversation open, the card holds only the way to the
  // upload tile, so it is sized to that content instead of stretching to the
  // tab bar. ChatBox reports a later `no_material` refusal the same way.
  const [refusedIds, setRefusedIds] = useState<string[]>([]);
  const compact = Boolean(selectedKb) && (!answerable.has(selectedId) || refusedIds.includes(selectedId)) && !selection.messages?.length;

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
    /* Design "C", PR 4: one clay card and no hairline in it. On a desk the
       history is a pressed-in column at the card's start; on a phone it is
       the drawer behind the clock button. */
    <div data-kf-ask-card="" data-kf-ask-compact={compact ? '' : undefined} className={`kf-card flex min-h-0 overflow-hidden rounded-xl bg-surface ${compact ? 'flex-none' : 'flex-1 [&:has([data-kf-ask-fit])]:flex-none'}`}>
      {/* Desktop: persistent history column. Mobile: the same list lives in the Sheet below. */}
      <div data-kf-history="column" className="kf-well my-2 ms-2 hidden w-64 shrink-0 overflow-hidden rounded-[1.25rem] md:block">{sidebar}</div>
      {/* Mobile-only: display:none on this wrapper removes the fixed Sheet (and
          its focusable list) from the desktop DOM/tab order entirely. */}
      <div className="md:hidden">
        <Sheet
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          side={isRtl ? 'right' : 'left'}
          label={t.dashboard.agent.history}
          initialFocus="panel"
          className="rounded-e-[1.75rem]"
        >
          <div data-kf-history="drawer" className="h-full">{sidebar}</div>
        </Sheet>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 bg-surface p-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.dashboard.agent.history}
            data-kf-history-open=""
            className="kf-pill inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <ClayClock width={22} height={22} />
          </button>
          {/* Single-subject scope: picking a subject switches the active one (and
              resets the conversation). Never a multi-select / cross-subject search.
              #129 (c): only subjects Ask can answer from are offered. */}
          <SubjectChips
            subjects={offered}
            selectedId={selectedId}
            onPick={(id) => { setSelectedId(id); setSelection({ conversationId: null, messages: null }); setMountKey(k => k + 1); }}
          />
        </div>
        {!selectedKb && (
          <AskNoAnswerableSubject
            href={`/${safeLocale}/dashboard/knowledge`}
            labels={{ title: t.dashboard.home.step2Title, cta: t.dashboard.upload.uploadButton }}
          />
        )}
        {selectedKb && (
          <ChatBox
            key={`${selectedKb.id}-${mountKey}`}
            kbId={selectedKb.id}
            kbName={selectedKb.name}
            materials={materials.filter((m) => m.kb_id === selectedKb.id).map((m) => ({ filename: m.filename, lead: m.lead }))}
            initialConversationId={selection.conversationId}
            initialMessages={selection.messages}
            answerable={answerable.has(selectedKb.id)}
            compact={compact}
            sampleQuestion={sampleQuestionFor(selectedKb.id, sampleKbIds, t.dashboard.agent.sampleQuestion)}
            onNoMaterial={() => setRefusedIds((ids) => (ids.includes(selectedKb.id) ? ids : [...ids, selectedKb.id]))}
            onConversationCreated={(id) => { setSelection(s => ({ ...s, conversationId: id })); fetchConversations(); }}
          />
        )}
      </div>
    </div>
  );
}
