import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentHome } from '@/components/dashboard/StudentHome'
import { TimeZoneSync } from '@/components/dashboard/TimeZoneSync'
import type { ActivityItem } from '@/components/dashboard/RecentActivity'
import { getCurrentStreak, TIME_ZONE_COOKIE } from '@/lib/streak'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { pluralize } from '@/lib/i18n/plural'

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

  // P5.3: the student's IANA zone, written by <TimeZoneSync/> below. Read with the
  // same `next/headers` machinery `createClient()` already uses, which is what lets
  // this page stay a SERVER component — no client rewrite, no /api/streak route.
  //
  // Absent on the very first render (the cookie does not exist yet). That is not an
  // error: `getCurrentStreak` returns null, the placeholder renders its honest
  // ghost, and TimeZoneSync refreshes once the zone is known.
  const cookieStore = await cookies()
  const timeZone = cookieStore.get(TIME_ZONE_COOKIE)?.value

  // Streak joins the existing parallel fetch rather than adding a round trip.
  const [{ count: kbCount }, { count: docsCount }, { count: convosCount }, streak] = await Promise.all([
    supabase.from('knowledge_bases').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    getCurrentStreak(supabase, timeZone),
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
    <>
      {/* Writes the IANA zone cookie, then refreshes once. Renders nothing. */}
      <TimeZoneSync />
      <StudentHome
        stats={stats}
        streak={streak} // P5.3: real number, or null while the zone is unknown (honest ghost).
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
          // Form selection happens HERE, not in StudentHome. The component stays dumb
          // and prop-driven (it must remain storybookable in Phase 8), so it receives
          // a resolved string and never learns what a plural category is.
          //
          // `''` when the streak is null: the unit is not rendered beside the ghost,
          // so there is no form to choose. Passing the `other` form instead would be
          // a string that exists only to be discarded.
          streakUnit:
            streak === null ? '' : pluralize(safeLocale, streak, t.dashboard.home.streakUnit),
          streakZoneHint: t.dashboard.home.streakZoneHint,
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
    </>
  )
}
