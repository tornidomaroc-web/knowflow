import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import NewKnowledgeBasePage from '../../dashboard/knowledge/new/page'

/**
 * DESIGN PREVIEW for the new-subject form (#123, batch 2): the REAL page
 * component, in the real chrome, with no session. Submitting it asks Supabase
 * for the user, finds none, and shows `newKb.errorAuth`; it never reaches
 * /api/check-limit or an insert. 404 on production through the VERCEL_ENV
 * gate, as the other preview routes.
 */
export const metadata: Metadata = {
  title: 'New subject: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function NewSubjectPreview({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">new subject · preview</span>
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
        <NewKnowledgeBasePage params={Promise.resolve({ locale: safeLocale })} />
      </DashboardShell>
    </div>
  )
}
