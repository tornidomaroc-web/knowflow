import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DropZone } from '@/components/upload/DropZone'
import { DashboardShell } from '@/components/layout/DashboardShell'
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
 */
export const metadata: Metadata = {
  title: 'Upload: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function UploadPreview({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">upload · preview</span>
        <span className="text-faint">{safeLocale} · idle, then ready with a queued name (#124)</span>
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
      </DashboardShell>
    </div>
  )
}
