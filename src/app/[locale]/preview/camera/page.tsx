import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DropZone } from '@/components/upload/DropZone'
import { AiConsentProvider } from '@/components/ai-consent/AiConsentProvider'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { MaterialCard } from '@/components/materials/MaterialCard'
import { resolvePlatform } from '@/lib/platform'
import { currentShellVersion } from '@/lib/platform-server'
import { Locale, locales, useTranslation } from '@/lib/i18n'

/**
 * DESIGN PREVIEW for the camera screen ("صوّر صفحاتك"), as the other preview
 * routes: the real components in the real shell, no auth, no Supabase client,
 * nothing sent, a 404 on production through the VERCEL_ENV gate.
 *
 * `?platform=native` is the app; which shell is read from the request's user
 * agent (`KnowFlowApp/2` is offered the camera; `KnowFlowApp/1`, build 8, is
 * not); no `platform` is the web. Shell 1 and the web must show today's
 * upload tile exactly. `?view=`:
 *   page    the subject page's upload control (the default);
 *   choice  the upload sheet open, its two tiles;
 *   empty   the camera screen with no page yet;
 *   ten     the camera screen with ten drawn pages (full);
 *   three   three drawn pages, the second and third marked by a 422;
 *   unread  the finished state of a material saved without pages 2 and 4;
 *   consent the permission sheet as the camera's first send opens it, for a
 *           student who gave the text permission only (version 1).
 * The drawn pages are SVG paper, not photos.
 */
export const metadata: Metadata = {
  title: 'Camera: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const VIEWS = ['page', 'choice', 'empty', 'ten', 'three', 'unread', 'consent'] as const
type View = (typeof VIEWS)[number]

export default async function CameraPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; platform?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const sp = await searchParams
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : 'page'
  const platform = resolvePlatform(sp.platform)
  // The shell's version from the request's own user agent, as the dashboard
  // layout reads it: KnowFlowApp/2 is offered the camera, KnowFlowApp/1 not.
  const shell = platform === 'native' ? await currentShellVersion() : 0
  const ar = safeLocale === 'ar'
  const sd = t.dashboard.subjectDetail
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
  const previewCamera =
    view === 'choice' ? ({ open: 'choice' } as const)
      : view === 'empty' ? ({ open: 'camera', camera: { pages: 0 } } as const)
        : view === 'ten' ? ({ open: 'camera', camera: { pages: 10 } } as const)
          : view === 'three' ? ({ open: 'camera', camera: { pages: 3, problems: { 2: 'no-text', 3: 'not-read' }, message: 'noneRead' } } as const)
            : view === 'unread' ? ({ open: 'unread', name: `${t.dashboard.upload.camera.defaultName} 2026-11-18.md`, unread: [{ n: 2, problem: 'no-text' }, { n: 4, problem: 'not-read' }] } as const)
              : undefined

  const page = (
    <div className="min-h-screen">
      <PlatformProvider platform={platform} shell={shell}>
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
        <div className="mx-auto max-w-4xl space-y-6 [text-wrap:balance]">
          <DropZone kbId="00000000-0000-0000-0000-000000000000" previewCamera={previewCamera} />
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
      </DashboardShell>
      </PlatformProvider>
    </div>
  )
  // The camera's first send, for a student who gave the text permission only:
  // the sheet opens with the photos sentence; in preview mode it saves nowhere.
  return view === 'consent' ? (
    <AiConsentProvider initialConsented initialPhotosConsented={false} previewPhotos labels={t.dashboard.aiConsent} privacyHref={`/${safeLocale}/privacy`} preview>
      {page}
    </AiConsentProvider>
  ) : (
    page
  )
}
