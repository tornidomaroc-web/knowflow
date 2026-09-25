import { createClient } from '@/lib/supabase/server';
import { SubjectsList } from '@/components/dashboard/SubjectsList';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';
import { emptyStats, subjectStats } from '@/lib/subject-stats';
import { buildSubjectsLabels } from '@/lib/subjects-props';

// Thin server wrapper: data only. Presentation lives in <SubjectsList/> (dumb,
// prop-driven) so it can be reused/storybooked in Phase 8.
export default async function KnowledgeBasesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = resolveLocale(locale);
  const t = useTranslation(safeLocale);

  const supabase = await createClient();

  // Register #85 (SIGNED_IN_FEATURES.md 2.1): the three reads that make a card
  // say how far along the course is, in one Promise.all, all scoped by RLS.
  // `quizzes` has no kb_id, so it is joined through the documents' ids in JS.
  const [{ data: kbs }, { data: docs }, { data: convos }] = await Promise.all([
    supabase.from('knowledge_bases').select('*').order('created_at', { ascending: false }),
    supabase.from('documents').select('id, kb_id, status, summary_generated_at, created_at'),
    supabase.from('conversations').select('kb_id, created_at'),
  ]);
  const docIds = (docs ?? []).map((d) => d.id);
  const { data: quizzes } = docIds.length
    ? await supabase.from('quizzes').select('document_id').in('document_id', docIds)
    : { data: [] as { document_id: string }[] };

  const stats = subjectStats(docs ?? [], quizzes ?? [], convos ?? []);

  const subjects = (kbs ?? []).map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    language: kb.language,
    href: `/${safeLocale}/dashboard/knowledge/${kb.id}`,
    askHref: `/${safeLocale}/dashboard/agent?kb=${kb.id}`,
    createdAt: kb.created_at,
    stats: stats.get(kb.id) ?? emptyStats(),
  }));

  return (
    <SubjectsList
      subjects={subjects}
      newHref={`/${safeLocale}/dashboard/knowledge/new`}
      locale={safeLocale}
      labels={buildSubjectsLabels(t)}
    />
  );
}
