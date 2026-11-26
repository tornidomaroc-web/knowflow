import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { DashboardSkeleton } from '@/components/skeleton/DashboardSkeletons'
import { SKELETON_ROUTES, type SkeletonRoute } from '@/components/skeleton/routes'
import { resolvePlatform } from '@/lib/platform'
import { Locale, locales, useTranslation } from '@/lib/i18n'

/**
 * DESIGN PREVIEW for the loading screens (item 4j): each dashboard segment's
 * `loading.tsx` skeleton in the real chrome, as the router shows it between
 * the tap and the screen. `?route=home|subjects|subject|ask|settings`,
 * `?platform=native|web`. No auth, no Supabase client, no data; a 404 on
 * production through the VERCEL_ENV gate, like every preview route.
 */
export const metadata: Metadata = {
  title: 'Loading screens: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

/** The tab each screen belongs to, as the real pathname would mark it. */
const TAB: Record<SkeletonRoute, string> = {
  home: 'dashboard',
  subjects: 'knowledge',
  subject: 'knowledge',
  ask: 'agent',
  settings: 'settings',
}

export default async function SkeletonPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ route?: string; platform?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const { route: rawRoute, platform: rawPlatform } = await searchParams
  const route = SKELETON_ROUTES.find((r) => r === rawRoute)
  if (!route) notFound()
  const platform = resolvePlatform(rawPlatform)

  return (
    <PlatformProvider platform={platform}>
      <DashboardShell
        platform={platform}
        activeNav={TAB[route]}
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
        <DashboardSkeleton route={route} />
      </DashboardShell>
    </PlatformProvider>
  )
}
