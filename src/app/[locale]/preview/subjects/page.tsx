import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SubjectsList } from '@/components/dashboard/SubjectsList'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { buildSubjectsLabels } from '@/lib/subjects-props'
import { emptyStats, type SubjectStats } from '@/lib/subject-stats'

/**
 * DESIGN PREVIEW for the subjects screen (register #85, SIGNED_IN_FEATURES.md
 * 2.1): the real component in the real chrome, literal data, no auth, no
 * Supabase client, a 404 on production through the VERCEL_ENV gate.
 * `?state=zero` shows the empty account.
 */
export const metadata: Metadata = {
  title: 'Subjects: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const stats = (s: Partial<SubjectStats>): SubjectStats => ({ ...emptyStats(), ...s })

export default async function SubjectsPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ state?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const { state } = await searchParams
  const ar = safeLocale === 'ar'

  const subjects = state === 'zero' ? [] : [
    {
      id: 's1', name: ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics', description: ar ? 'الفصل الأول، د. العلوي' : 'Semester 1, Dr. Alaoui', language: 'ar',
      href: '#', askHref: '#', createdAt: '2026-09-02T10:00:00Z',
      stats: stats({ materials: 8, ready: 8, summarised: 6, quizzed: 3, lastActivityAt: '2026-09-24T21:40:00Z', lastActivityIsAsk: true }),
    },
    {
      id: 's2', name: ar ? 'الكيمياء العضوية' : 'Organic Chemistry', description: null, language: 'en',
      href: '#', askHref: '#', createdAt: '2026-09-05T10:00:00Z',
      stats: stats({ materials: 7, ready: 6, processing: 1, summarised: 7, quizzed: 7, lastActivityAt: '2026-09-23T09:05:00Z', lastActivityIsAsk: false }),
    },
    {
      id: 's3', name: ar ? 'الإحصاء' : 'Statistics', description: ar ? 'تمارين ومحاضرات' : 'Lectures and problem sets', language: 'both',
      href: '#', askHref: '#', createdAt: '2026-09-10T10:00:00Z',
      stats: stats({ materials: 5, ready: 5, summarised: 1, quizzed: 0, lastActivityAt: '2026-09-12T16:12:00Z', lastActivityIsAsk: false }),
    },
    {
      id: 's4', name: ar ? 'تاريخ الفلسفة' : 'History of Philosophy', description: null, language: 'ar',
      href: '#', askHref: '#', createdAt: '2026-09-20T10:00:00Z',
      stats: emptyStats(),
    },
  ]

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">subjects · preview</span>
        <span className="text-faint">{state === 'zero' ? 'zero' : 'full'} · {safeLocale}</span>
      </div>
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
        <SubjectsList subjects={subjects} newHref="#" locale={safeLocale} labels={buildSubjectsLabels(t)} />
      </DashboardShell>
    </div>
  )
}
