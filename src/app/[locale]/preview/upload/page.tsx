import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DropZone } from '@/components/upload/DropZone'
import { AiConsentProvider } from '@/components/ai-consent/AiConsentProvider'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { MaterialCard } from '@/components/materials/MaterialCard'
import { resolvePlatform } from '@/lib/platform'
import { Locale, locales, useTranslation } from '@/lib/i18n'

/**
 * DESIGN PREVIEW for the drop zone (register #113), the same idea as the
 * other preview routes: the real component in the real chrome, no auth, no
 * Supabase client, a 404 on production through the VERCEL_ENV gate.
 *
 * Only the idle state can be looked at here: the moving states need a file
 * to be sent, which is a production write and a paid embedding call, and the
 * proof (`scripts/verify-upload-progress.mjs`) holds those from the module
 * and the source instead. The kb id is a literal that no upload will reach.
 *
 * Activation 5: `?state=` shows ONE drop zone frozen in a state the audit
 * never rendered, with nothing sent: `processing` (12 s in, no clock),
 * `failed` (the reply when processing fails), `consent` (the picked file held
 * under the open permission sheet, which saves nowhere here) and `declined`
 * (the tile again after "Not now"). Under it the subject's files, as the
 * subject page lists them, so a state is seen with the list it sits above.
 *
 * `?platform=native` renders the app's shell (the tab bar, no top bar), as
 * the other previews do, so the app images are the app (the owner's review
 * of #315).
 */
export const metadata: Metadata = {
  title: 'Upload: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const STATES = ['processing', 'failed', 'consent', 'declined'] as const
type State = (typeof STATES)[number]

export default async function UploadPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ state?: string; platform?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const sp = await searchParams
  const raw = sp.state
  const state: State | null = STATES.includes(raw as State) ? (raw as State) : null
  const platform = resolvePlatform(sp.platform)
  const ar = safeLocale === 'ar'
  const name = ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf'
  const sd = t.dashboard.subjectDetail
  // Two ready files already in the subject (literal data, nothing read).
  const files = [
    { id: 'f1', filename: ar ? 'مبادئ-الاقتصاد-الجزئي.md' : 'Microeconomics-Principles.pdf', type: ar ? 'md' : 'pdf', added: '2026-09-23T21:30:00Z', summary: true, quiz: true },
    { id: 'f2', filename: ar ? 'ملاحظات المحاضرة 5.docx' : 'Lecture-5-notes.docx', type: 'docx', added: '2026-09-24T10:00:00Z', summary: false, quiz: true },
  ]
  const cardLabels = {
    statusReady: sd.statusReady, statusProcessing: sd.statusProcessing, statusError: sd.statusError,
    statusNoText: sd.statusNoText, noTextLine: sd.noTextLine, someNoTextLine: sd.someNoTextLine,
    noTextFix: sd.noTextFix, checklist: sd.checklist, summaryDone: sd.summaryDone, summaryTodo: sd.summaryTodo,
    quizDone: sd.quizDone, quizTodo: sd.quizTodo, added: sd.added, fileTypes: sd.fileTypes,
  }

  const page = (
    <div className="min-h-screen">
      <div className={sp.platform ? 'hidden' : 'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs'}>
        <span className="font-semibold text-foreground">upload · preview</span>
        <span className="text-faint">{safeLocale} · idle, then ready with a queued name (#124)</span>
      </div>
      <PlatformProvider platform={platform}>
      <DashboardShell
        platform={platform}
        activeNav="knowledge"
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
        {state ? (
          <div className="mx-auto max-w-4xl space-y-6 [text-wrap:balance]">
            <DropZone kbId="00000000-0000-0000-0000-000000000000" previewFile={{ name, size: 1_200_000, state }} />
            <section data-kf-preview-files="" className="space-y-3">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">{t.dashboard.kbDetail.documents}</h2>
              <div className="space-y-3">
                {files.map((f) => (
                  <MaterialCard
                    key={f.id}
                    filename={f.filename}
                    fileType={f.type}
                    status="ready"
                    addedAt={f.added}
                    locale={safeLocale}
                    hasSummary={f.summary}
                    hasQuiz={f.quiz}
                    noText={false}
                    labels={cardLabels}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <DropZone kbId="00000000-0000-0000-0000-000000000000" />
          {/* #124: the queued-file row, as it shows once a file is picked. The
              moving states still need a real upload; `previewFile` only sets
              the finished state, and sends nothing. */}
          <DropZone
            kbId="00000000-0000-0000-0000-000000000000"
            previewFile={{ name: safeLocale === 'ar' ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', size: 1_200_000 }}
          />
          <DropZone
            kbId="00000000-0000-0000-0000-000000000000"
            previewFile={{
              name: safeLocale === 'ar'
                ? 'ملاحظات المحاضرة الخامسة عن مرونة الطلب السعرية والدخلية والتقاطعية - النسخة النهائية 12.pdf'
                : 'Lecture 5 notes on price, income and cross elasticity of demand - final version 12.pdf',
              size: 3_400_000,
            }}
          />
        </div>
        )}
      </DashboardShell>
      </PlatformProvider>
    </div>
  )
  // The sheet opens at once over the held file, as it does after a pick; in
  // preview mode it saves nowhere.
  return state === 'consent' ? (
    <AiConsentProvider initialConsented={false} labels={t.dashboard.aiConsent} privacyHref={`/${safeLocale}/privacy`} preview previewHeld={name}>
      {page}
    </AiConsentProvider>
  ) : (
    page
  )
}
