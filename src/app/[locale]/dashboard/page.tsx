import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentHome } from '@/components/dashboard/StudentHome'
import { TimeZoneSync } from '@/components/dashboard/TimeZoneSync'
import type { ActivityItem } from '@/components/dashboard/RecentActivity'
import { getCurrentStreak, TIME_ZONE_COOKIE } from '@/lib/streak'
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n'
import { pluralize } from '@/lib/i18n/plural'
import { getEntitlement } from '@/lib/entitlement'
import { FREE_LIMITS, PRO_LIMITS } from '@/lib/limits'
import { DAILY_CAPS } from '@/lib/rate-limit'
import { formatDate } from '@/lib/format-date'
import { buildHomeLabels, buildHomeProgress, buildHrefs, buildOnboarding, buildQuotas } from '@/lib/home-props'
import { currentPlatform } from '@/lib/platform-server'

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
  const safeLocale: Locale = resolveLocale(locale)
  const t = useTranslation(safeLocale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLocale}/login`)
  // Which shell asked: inside the app the home carries no Upgrade link
  // (Apple 3.1.1(a); src/lib/platform.ts).
  const platform = await currentPlatform()

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
    // #129: every row, with what `hasNoText` reads, so one pass gives the
    // "files" stat (answerable files) and the progress base (failed and
    // no-text files left out). `buildHomeProgress` in home-props does both.
    supabase.from('documents').select('id, kb_id, status, chunk_count, embedding_status, summary_generated_at'),
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
  const { answerable, subjects } = buildHomeProgress(materialRows.data ?? [], subjectRows.data ?? [])

  const stats = [
    { label: t.dashboard.home.knowledgeBases, value: kbCount ?? 0, desc: t.dashboard.home.knowledgeBasesDesc },
    // #129 (a): the files Ask can answer from, which is what the label says.
    { label: t.dashboard.home.documents, value: answerable, desc: t.dashboard.home.documentsDesc },
    { label: t.dashboard.home.conversations, value: convosCount ?? 0, desc: t.dashboard.home.conversationsDesc },
  ]

  return (
    <>
      {/* Writes the IANA zone cookie, then refreshes once. Renders nothing. */}
      <TimeZoneSync />
      <StudentHome
        stats={stats}
        streak={streak} // P5.3: real number, or null while the zone is unknown (honest ghost).
        {...buildHrefs(safeLocale, platform)}
        // Register #85 (2.4): the most recent conversation, from the read the
        // home already makes. Null for an account that has not asked yet.
        continueCard={
          recentActivity?.[0]
            ? {
                subject: recentActivity[0].knowledge_bases?.name ?? t.dashboard.home.unknownKb,
                date: formatDate(recentActivity[0].created_at, safeLocale),
                href: `/${safeLocale}/dashboard/agent`,
              }
            : null
        }
        locale={safeLocale}
        isPro={isPro}
        quotas={buildQuotas(t.dashboard.home, used, caps)}
        subjects={subjects}
        subjectsUsed={kbCount ?? 0}
        subjectsLimit={structural.knowledge_bases}
        onboarding={buildOnboarding(t.dashboard.home, safeLocale, {
          subjects: kbCount ?? 0,
          // Every file, on purpose (#129): this step says a file was uploaded,
          // which is true of a failed or no-text one too.
          materials: docsCount ?? 0,
          conversations: convosCount ?? 0,
        })}
        labels={buildHomeLabels({
          home: t.dashboard.home,
          subjectsNavLabel: t.dashboard.nav.knowledge,
          cont: t.dashboard.continueCard,
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
