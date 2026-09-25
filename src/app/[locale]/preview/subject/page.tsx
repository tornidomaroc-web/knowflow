import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SubjectHeader } from '@/components/materials/SubjectHeader'
import { MaterialCard } from '@/components/materials/MaterialCard'
import { DropZone } from '@/components/upload/DropZone'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { emptyStats } from '@/lib/subject-stats'

/**
 * DESIGN PREVIEW for the subject page (register #85, SIGNED_IN_FEATURES.md
 * 2.2): the header, the drop zone (idle, #113) and three material cards with
 * their study-kit checklists, in the real chrome, with literal data. The
 * summary and quiz sections are not rendered here: they are client islands
 * that read a document through Supabase on open, and this route opens no
 * client. 404 on production through the VERCEL_ENV gate.
 */
export const metadata: Metadata = {
  title: 'Subject: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function SubjectPreview({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const ar = safeLocale === 'ar'
  const sd = t.dashboard.subjectDetail

  const materials = [
    { id: 'd1', filename: ar ? 'مبادئ-الاقتصاد-الجزئي.md' : 'Microeconomics-Principles.pdf', type: ar ? 'md' : 'pdf', chunks: 22, status: 'ready', added: '2026-09-23T21:30:00Z', summary: true, quiz: true },
    { id: 'd2', filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved-Exercises-Ch3.pdf', type: 'pdf', chunks: 14, status: 'ready', added: '2026-09-22T18:00:00Z', summary: true, quiz: false },
    { id: 'd3', filename: ar ? 'شرائح المحاضرة 4.pptx' : 'Lecture-4-slides.pptx', type: 'pptx', chunks: 0, status: 'processing', added: '2026-09-25T08:10:00Z', summary: false, quiz: false },
    // #123: a ready material with no summary yet, and a failed one, so the
    // study kit's summaryTodo and the statusError chip can be looked at.
    { id: 'd4', filename: ar ? 'ملاحظات المحاضرة 5.docx' : 'Lecture-5-notes.docx', type: 'docx', chunks: 9, status: 'ready', added: '2026-09-24T10:00:00Z', summary: false, quiz: true },
    { id: 'd5', filename: ar ? 'جدول الأسعار.xlsx' : 'Price-table.xlsx', type: 'xlsx', chunks: 0, status: 'error', added: '2026-09-24T09:00:00Z', summary: false, quiz: false },
  ]
  const stats = { ...emptyStats(), materials: 5, ready: 3, processing: 1, failed: 1, summarised: 2, quizzed: 2 }
  const cardLabels = {
    chunks: t.dashboard.kbDetail.chunks,
    statusReady: sd.statusReady,
    statusProcessing: sd.statusProcessing,
    statusError: sd.statusError,
    checklist: sd.checklist,
    summaryDone: sd.summaryDone,
    summaryTodo: sd.summaryTodo,
    quizDone: sd.quizDone,
    quizTodo: sd.quizTodo,
    added: sd.added,
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">subject · preview</span>
        <span className="text-faint">{safeLocale}</span>
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
        <div className="mx-auto max-w-4xl space-y-6">
          <SubjectHeader
            name={ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics'}
            description={ar ? 'الفصل الأول، د. العلوي' : 'Semester 1, Dr. Alaoui'}
            stats={stats}
            askHref="#"
            labels={{
              materials: t.dashboard.home.documents,
              summarised: t.dashboard.subjects.summarised,
              quizzed: t.dashboard.subjects.quizzed,
              stillProcessing: sd.stillProcessing,
              askAbout: sd.askAbout,
            }}
          />
          <DropZone kbId="00000000-0000-0000-0000-000000000000" />
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">{t.dashboard.kbDetail.documents}</h2>
            <div className="space-y-3">
              {materials.map((m) => (
                <MaterialCard
                  key={m.id}
                  filename={m.filename}
                  fileType={m.type}
                  chunkCount={m.chunks}
                  status={m.status}
                  addedAt={m.added}
                  locale={safeLocale}
                  hasSummary={m.summary}
                  hasQuiz={m.quiz}
                  labels={cardLabels}
                />
              ))}
            </div>
          </section>
        </div>
      </DashboardShell>
    </div>
  )
}
