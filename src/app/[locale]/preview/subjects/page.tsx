import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SubjectsList } from '@/components/dashboard/SubjectsList'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { buildSubjectsLabels } from '@/lib/subjects-props'
import { emptyStats, subjectStats, type SubjectStats } from '@/lib/subject-stats'

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

// #129: two subjects computed from DOCUMENT ROWS by the real `subjectStats`,
// so the ring and the Ask button are the rule, not a literal. s1: four ready
// files with text (three summarised), one with no text, one failed -> 75% and
// Ask. s5: one file with no text and one failed -> a dash and no Ask.
const doc = (id: string, kb: string, status: string, chunk_count: number, embedding_status: string, summarised = false) =>
  ({ id, kb_id: kb, status, chunk_count, embedding_status, summary_generated_at: summarised ? '2026-09-20' : null, created_at: '2026-09-20T10:00:00Z' })
const fromRows = subjectStats([
  doc('a', 's1', 'ready', 12, 'ready', true), doc('b', 's1', 'ready', 9, 'ready', true), doc('c', 's1', 'ready', 7, 'ready', true), doc('d', 's1', 'ready', 5, 'ready'),
  doc('e', 's1', 'ready', 0, 'ready'), doc('f', 's1', 'error', 0, 'error'),
  doc('g', 's5', 'ready', 0, 'ready'), doc('h', 's5', 'error', 0, 'error'),
], [{ document_id: 'a' }], [])

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
      stats: { ...fromRows.get('s1')!, lastActivityAt: '2026-09-24T21:40:00Z', lastActivityIsAsk: true },
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
    {
      id: 's5', name: ar ? 'صور المحاضرات' : 'Lecture photos', description: null, language: 'ar',
      href: '#', askHref: '#', createdAt: '2026-09-26T10:00:00Z',
      stats: fromRows.get('s5')!,
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
