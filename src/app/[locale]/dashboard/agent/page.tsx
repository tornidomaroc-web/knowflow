import { createClient } from '@/lib/supabase/server';
import { KBSelector } from '@/components/agent/KBSelector';
import { AgentEmptyState } from '@/components/agent/AgentEmptyState';
import { Locale, locales, useTranslation } from '@/lib/i18n';
import type { KnowledgeBase } from '@/types';

// Thin server wrapper: data only. The chat UI (KBSelector) is a client island;
// the no-subjects case renders the dumb <AgentEmptyState/> (Phase 8 reuse).
export default async function AgentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en';
  const t = useTranslation(safeLocale);

  const supabase = await createClient();

  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });

  if (!kbs || kbs.length === 0) {
    return (
      <AgentEmptyState
        newHref={`/${safeLocale}/dashboard/knowledge/new`}
        labels={{
          title: t.dashboard.nav.knowledge,
          prompt: t.dashboard.home.newKbDesc,
          cta: t.dashboard.home.newSubject,
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/*
        The <Database> generic types `language` as `string | null` because
        knowledge_bases.language is bare `text` with NO check constraint — the
        'ar' | 'en' | 'both' domain is held by the APP (the typed <select> in the
        KB-create form is the sole writer), not by the database. This narrowing
        cast asserts that application invariant; it is not DB-guaranteed, so a
        row written outside the web app could violate it.
      */}
      <KBSelector kbs={kbs as KnowledgeBase[]} />
    </div>
  );
}
