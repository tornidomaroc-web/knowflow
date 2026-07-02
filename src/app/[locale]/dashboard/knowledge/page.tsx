import { createClient } from '@/lib/supabase/server';
import { SubjectsList } from '@/components/dashboard/SubjectsList';
import { Locale, locales, useTranslation } from '@/lib/i18n';

// Thin server wrapper: data only. Presentation lives in <SubjectsList/> (dumb,
// prop-driven) so it can be reused/storybooked in Phase 8.
export default async function KnowledgeBasesPage({
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

  const subjects = (kbs ?? []).map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    language: kb.language,
    href: `/${safeLocale}/dashboard/knowledge/${kb.id}`,
    createdAt: kb.created_at,
  }));

  return (
    <SubjectsList
      subjects={subjects}
      newHref={`/${safeLocale}/dashboard/knowledge/new`}
      labels={{
        title: t.dashboard.nav.knowledge,
        newSubject: t.dashboard.home.newSubject,
        emptyPrompt: t.dashboard.home.newKbDesc,
      }}
    />
  );
}
