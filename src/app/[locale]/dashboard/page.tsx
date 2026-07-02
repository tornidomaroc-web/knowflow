import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentHome } from '@/components/dashboard/StudentHome'
import type { ActivityItem } from '@/components/dashboard/RecentActivity'
import { Locale, locales, useTranslation } from '@/lib/i18n'

// Thin server wrapper: auth + data only. Presentation lives in <StudentHome/>
// (dumb, prop-driven) so it can be reused/storybooked in Phase 8.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en'
  const t = useTranslation(safeLocale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLocale}/login`)

  const [{ count: kbCount }, { count: docsCount }, { count: convosCount }] = await Promise.all([
    supabase.from('knowledge_bases').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentActivity } = await supabase
    .from('conversations')
    .select('id, created_at, platform, knowledge_bases(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  const stats = [
    { label: t.dashboard.home.knowledgeBases, value: kbCount ?? 0, desc: t.dashboard.home.knowledgeBasesDesc },
    { label: t.dashboard.home.documents, value: docsCount ?? 0, desc: t.dashboard.home.documentsDesc },
    { label: t.dashboard.home.conversations, value: convosCount ?? 0, desc: t.dashboard.home.conversationsDesc },
  ]

  return (
    <StudentHome
      stats={stats}
      streak={0} // Phase 5 wires real streak tracking; placeholder renders 0.
      askHref={`/${safeLocale}/dashboard/agent`}
      newSubjectHref={`/${safeLocale}/dashboard/knowledge/new`}
      subjectsHref={`/${safeLocale}/dashboard/knowledge`}
      labels={{
        welcome: t.dashboard.home.welcome,
        askTitle: t.dashboard.home.talkAgentTitle,
        askDesc: t.dashboard.home.talkAgentDesc,
        newSubject: t.dashboard.home.newSubject,
        newSubjectDesc: t.dashboard.home.newKbDesc,
        subjects: t.dashboard.nav.knowledge,
        streakLabel: t.dashboard.home.streakLabel,
        streakUnit: t.dashboard.home.streakUnit,
        recentActivity: t.dashboard.home.recentActivity,
        activity: {
          noActivity: t.dashboard.home.noActivity,
          conversation: t.dashboard.home.conversation,
          showLess: t.dashboard.home.showLess,
          viewAll: t.dashboard.home.viewAll,
          unknownKb: t.dashboard.home.unknownKb,
        },
      }}
      recentActivity={(recentActivity ?? []) as never[] as ActivityItem[]}
    />
  )
}
