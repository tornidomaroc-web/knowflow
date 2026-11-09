import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { resolvePlatform } from '@/lib/platform'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import NewKnowledgeBasePage from '../../dashboard/knowledge/new/page'

/**
 * DESIGN PREVIEW for the new-subject form (#123, batch 2): the REAL page
 * component, in the real chrome, with no session. Submitting it asks Supabase
 * for the user, finds none, and shows `newKb.errorAuth`; it never reaches
 * /api/check-limit or an insert. 404 on production through the VERCEL_ENV
 * gate, as the other preview routes. `?platform=native` shows it as the app
 * renders it (the tab bar, no top bar), as the other previews.
 */
export const metadata: Metadata = {
  title: 'New subject: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function NewSubjectPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ platform?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const { platform: rawPlatform } = await searchParams
  const platform = resolvePlatform(rawPlatform)

  return (
    <div className="min-h-screen">
      <div className={rawPlatform ? 'hidden' : 'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs'}>
        <span className="font-semibold text-foreground">new subject · preview</span>
        <span className="text-faint">{safeLocale}</span>
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
        <NewKnowledgeBasePage params={Promise.resolve({ locale: safeLocale })} />
      </DashboardShell>
      </PlatformProvider>
    </div>
  )
}
