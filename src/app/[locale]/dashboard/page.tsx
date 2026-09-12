import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentHome, type SubjectProgress } from '@/components/dashboard/StudentHome'
import { TimeZoneSync } from '@/components/dashboard/TimeZoneSync'
import type { ActivityItem } from '@/components/dashboard/RecentActivity'
import { getCurrentStreak, TIME_ZONE_COOKIE } from '@/lib/streak'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { pluralize } from '@/lib/i18n/plural'
import { getEntitlement } from '@/lib/entitlement'
import { FREE_LIMITS, PRO_LIMITS } from '@/lib/limits'
import { DAILY_CAPS } from '@/lib/rate-limit'
import { buildHomeLabels, buildHrefs, buildOnboarding, buildQuotas } from '@/lib/home-props'

// Thin server wrapper: auth + data only. Presentation lives in <StudentHome/>
// (dumb, prop-driven) so it can be reused/storybooked in Phase 8.
//
// EVERY QUERY BELOW IS A READ. Nothing on this page writes, and nothing may:
// local dev points at the PRODUCTION database, so a write here would fire against
// live data the moment anyone opened the screen.
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
  //
  // THE FOUR ADDED READS RIDE IN THE SAME Promise.all, so the screen gained data
  // without gaining a waterfall. Each is scoped by RLS to the caller.
  const [
    { count: kbCount },
    { count: docsCount },
    { count: convosCount },
    streak,
    entitlement,
    usageRow,
    subjectRows,
    materialRows,
  ] = await Promise.all([
    supabase.from('knowledge_bases').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    getCurrentStreak(supabase, timeZone),
    // Fail SOFT, and free is the safe direction to fail in: a Pro user briefly
    // shown free ceilings is a cosmetic wrong number, whereas a free user shown
    // Pro ceilings would be a promise the product does not keep.
    getEntitlement(user.id).catch(() => ({ tier: 'free' as const })),
    // usage_counters is read-own (no insert/update policy); `maybeSingle` because
    // a student who has done nothing TODAY has no row at all, which is a zero and
    // not an error.
    supabase
      .from('usage_counters')
      .select('query_count, upload_count')
      .eq('user_id', user.id)
      .eq('day', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
    supabase.from('knowledge_bases').select('id, name').order('created_at', { ascending: false }).limit(6),
    // Per-subject progress = materials that HAVE a summary. `summary_generated_at`
    // is written in the same update as `summary` (api/summarize/route.ts:200-205),
    // so its presence is the cheap test; selecting `summary` itself would drag the
    // whole summary text of every document across the wire for a null check.
    supabase.from('documents').select('kb_id, summary_generated_at').neq('status', 'error'),
  ])

  const { data: recentActivity } = await supabase
    .from('conversations')
    .select('id, created_at, platform, knowledge_bases(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  const isPro = entitlement.tier === 'pro'
  const structural = isPro ? PRO_LIMITS : FREE_LIMITS
  const caps = DAILY_CAPS[isPro ? 'pro' : 'free']

  const used = {
    query: usageRow?.data?.query_count ?? 0,
    upload: usageRow?.data?.upload_count ?? 0,
  }

  // Aggregated in JS rather than in SQL: the alternative is a view or an RPC, and
  // neither is worth a migration for a list capped at six rows.
  const perSubject = new Map<string, { materials: number; summarised: number }>()
  for (const row of materialRows.data ?? []) {
    const bucket = perSubject.get(row.kb_id) ?? { materials: 0, summarised: 0 }
    bucket.materials += 1
    if (row.summary_generated_at) bucket.summarised += 1
    perSubject.set(row.kb_id, bucket)
  }

  const subjects: SubjectProgress[] = (subjectRows.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    materials: perSubject.get(s.id)?.materials ?? 0,
    summarised: perSubject.get(s.id)?.summarised ?? 0,
  }))

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
        {...buildHrefs(safeLocale)}
        isPro={isPro}
        quotas={buildQuotas(t.dashboard.home, used, caps)}
        subjects={subjects}
        subjectsUsed={kbCount ?? 0}
        subjectsLimit={structural.knowledge_bases}
        onboarding={buildOnboarding(t.dashboard.home, safeLocale, {
          subjects: kbCount ?? 0,
          materials: docsCount ?? 0,
          conversations: convosCount ?? 0,
        })}
        labels={buildHomeLabels({
          home: t.dashboard.home,
          subjectsNavLabel: t.dashboard.nav.knowledge,
          isPro,
          // Form selection happens HERE, not in StudentHome. The component stays dumb
          // and prop-driven (it must remain storybookable in Phase 8), so it receives
          // a resolved string and never learns what a plural category is.
          //
          // `''` when the streak is null: the unit is not rendered beside the ghost,
          // so there is no form to choose. Passing the `other` form instead would be
          // a string that exists only to be discarded.
          streakUnit:
            streak === null ? '' : pluralize(safeLocale, streak, t.dashboard.home.streakUnit),
        })}
        recentActivity={(recentActivity ?? []) as never[] as ActivityItem[]}
      />
    </>
  )
}
