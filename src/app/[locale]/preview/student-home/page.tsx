import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StudentHome, type SubjectProgress } from '@/components/dashboard/StudentHome'
import type { ActivityItem } from '@/components/dashboard/RecentActivity'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { pluralize } from '@/lib/i18n/plural'
import { FREE_LIMITS } from '@/lib/limits'
import { DAILY_CAPS } from '@/lib/rate-limit'
import { buildHomeLabels, buildHrefs, buildOnboarding, buildQuotas } from '@/lib/home-props'
import { DashboardShell } from '@/components/layout/DashboardShell'

/**
 * DESIGN PREVIEW for the student home (#85) — the surface Abo Jad judges on.
 *
 * WHY A ROUTE AND NOT A SCREENSHOT. He has to see the real component, in the real
 * type, at real breakpoints, in both scripts, with RTL mirroring actually applied.
 * A picture proves none of that, and a local dev server is forbidden here because
 * local dev writes to the PRODUCTION database.
 *
 * WHAT MAKES IT SAFE. There is NO auth check and NO Supabase client on this route,
 * and that is not an oversight — it is the point. Every value below is a literal
 * written in this file. The route cannot read a student's data because it never
 * opens a connection, and it cannot write because it has nothing to write with.
 * It renders exactly the component the dashboard renders, differing only in where
 * the numbers came from.
 *
 * ZERO IS THE DEFAULT STATE, DELIBERATELY. Register #91 records the embedding key
 * last used 2026-08-10 and every conversation on the live account is months old,
 * so an empty account is what the next student actually sees. `?state=full` shows
 * the populated version; the bare URL shows the one that matters.
 *
 * NOT FOR PRODUCTION AS-IS. `noindex` keeps it out of search, but merging this PR
 * publishes the path. Either gate or delete it at merge — the register records
 * that as an open decision rather than leaving it to be discovered.
 */
export const metadata: Metadata = {
  title: 'Student home: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type State = 'zero' | 'full'

export default async function StudentHomePreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ state?: string; theme?: string }>
}) {
  // ── THE GATE. A `noindex` tag is not access control: it asks crawlers not to
  //    list the path, and does nothing about anyone who has the URL. This route
  //    carries no user data and opens no Supabase client, so the risk is low -
  //    but "low" is not "nothing", and a half-finished design with fabricated
  //    student names should not be a public page on tryknowflow.com.
  //
  //    VERCEL_ENV is a SYSTEM variable Vercel sets itself ('production' on the
  //    production deployment, 'preview' on a PR deployment). Nothing had to be
  //    added to the project settings and no deploy configuration is touched.
  //
  //    FAIL-OPEN BY CHOICE, and the direction is deliberate: if VERCEL_ENV is
  //    ever absent the route stays reachable, which is exactly today's behaviour
  //    and no worse. A fail-closed guard would 404 the preview too, taking away
  //    the only surface on which this product's screens can be looked at without
  //    pointing a dev server at the production database.
  if (process.env.VERCEL_ENV === 'production') notFound()

  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const home = t.dashboard.home

  const { state: rawState, theme: rawTheme } = await searchParams
  const state: State = rawState === 'full' ? 'full' : 'zero'
  const full = state === 'full'
  // `?theme=` is now honoured by the boot script on <html> (`src/lib/theme.ts`),
  // which also writes the cookie, so this page no longer sets the attribute
  // itself; it only keeps the value in its own links.
  const theme: 'dark' | 'light' = rawTheme === 'light' ? 'light' : 'dark'

  const caps = DAILY_CAPS.free
  const counts = full
    ? { subjects: 4, materials: 23, conversations: 61 }
    : { subjects: 0, materials: 0, conversations: 0 }

  const subjects: SubjectProgress[] = full
    ? [
        { id: 's1', name: safeLocale === 'ar' ? 'الأحياء' : 'Cell Biology', materials: 8, summarised: 6 },
        { id: 's2', name: safeLocale === 'ar' ? 'الكيمياء العضوية' : 'Organic Chemistry', materials: 7, summarised: 7 },
        { id: 's3', name: safeLocale === 'ar' ? 'الإحصاء' : 'Statistics', materials: 5, summarised: 1 },
        { id: 's4', name: safeLocale === 'ar' ? 'تاريخ الفلسفة' : 'History of Philosophy', materials: 3, summarised: 0 },
      ]
    : []

  const recentActivity: ActivityItem[] = full
    ? [
        { id: 'c1', created_at: '2026-09-11T18:20:00Z', platform: 'web', knowledge_bases: { name: subjects[0].name } },
        { id: 'c2', created_at: '2026-09-11T09:05:00Z', platform: 'web', knowledge_bases: { name: subjects[1].name } },
        { id: 'c3', created_at: '2026-09-10T21:40:00Z', platform: 'web', knowledge_bases: { name: subjects[0].name } },
        { id: 'c4', created_at: '2026-09-09T16:12:00Z', platform: 'web', knowledge_bases: { name: subjects[2].name } },
        { id: 'c5', created_at: '2026-09-08T11:02:00Z', platform: 'web', knowledge_bases: { name: subjects[1].name } },
      ]
    : []

  // A brand-new account has its full allowance and a null streak (no timezone
  // cookie has been written yet), which is exactly what the ghost is for.
  const used = full ? { query: 3, upload: 1 } : { query: 0, upload: 0 }
  const streak = full ? 5 : null

  const stats = [
    { label: home.knowledgeBases, value: counts.subjects, desc: home.knowledgeBasesDesc },
    { label: home.documents, value: counts.materials, desc: home.documentsDesc },
    { label: home.conversations, value: counts.conversations, desc: home.conversationsDesc },
  ]

  const other: State = full ? 'zero' : 'full'
  const otherLocale: Locale = safeLocale === 'ar' ? 'en' : 'ar'
  const otherTheme = theme === 'dark' ? 'light' : 'dark'
  const qs = (o: Record<string, string>) =>
    new URLSearchParams({ state, theme, ...o }).toString()

  return (
    <div className="min-h-screen">
      {/* Preview chrome. Deliberately plain and clearly not part of the product,
          so it cannot be mistaken for a design decision. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">student home · preview</span>
        <span className="text-faint">
          {state} · {safeLocale} · {theme}
        </span>
        <Link
          href={`/${safeLocale}/preview/student-home?${qs({ state: other })}`}
          className="rounded-full border border-accent px-3 py-1 font-semibold text-accent"
        >
          {other} data
        </Link>
        <Link
          href={`/${otherLocale}/preview/student-home?${qs({})}`}
          className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground"
        >
          {otherLocale}
        </Link>
        <Link
          href={`/${safeLocale}/preview/student-home?${qs({ theme: otherTheme })}`}
          className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground"
        >
          {otherTheme}
        </Link>
      </div>

      {/* The real chrome (register #83 (b)): the sidebar and mobile nav carry
          the language switch, and this is the one place it can be seen without
          a session. The email is a literal. */}
      <DashboardShell
        locale={safeLocale}
        email="student@example.com"
        isPro={false}
        labels={{
          dashboard: t.dashboard.nav.dashboard,
          knowledge: t.dashboard.nav.knowledge,
          agent: t.dashboard.nav.agent,
          settings: t.dashboard.nav.settings,
          appearance: t.nav.appearance,
          themeDark: t.nav.themeDark,
          themeLight: t.nav.themeLight,
          signOut: t.dashboard.nav.signOut,
        }}
      >
        <StudentHome
          stats={stats}
          streak={streak}
          {...buildHrefs(safeLocale)}
          continueCard={
            full
              ? { subject: subjects[0].name, date: new Date(recentActivity[0].created_at).toLocaleDateString(safeLocale === 'ar' ? 'ar' : 'en-GB'), href: `/${safeLocale}/dashboard/agent` }
              : null
          }
          isPro={false}
          quotas={buildQuotas(home, used, caps)}
          subjects={subjects}
          subjectsUsed={counts.subjects}
          subjectsLimit={FREE_LIMITS.knowledge_bases}
          onboarding={buildOnboarding(home, safeLocale, counts)}
          labels={buildHomeLabels({
            home,
            subjectsNavLabel: t.dashboard.nav.knowledge,
            cont: t.dashboard.continueCard,
            isPro: false,
            streakUnit: streak === null ? '' : pluralize(safeLocale, streak, home.streakUnit),
          })}
          recentActivity={recentActivity}
        />
      </DashboardShell>
    </div>
  )
}
