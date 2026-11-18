import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { IapProvider } from '@/components/iap/IapProvider'
import { Paywall } from '@/components/iap/Paywall'
import { PAYWALL_STATES, type PaywallState } from '@/lib/iap/flow'
import { iapAllowed } from '@/lib/platform'
import { currentShellVersion } from '@/lib/platform-server'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { proFigures } from '@/lib/iap/figures'

/**
 * DESIGN PREVIEW for the paywall (iOS 1.1, item 4d), the same idea as the
 * other preview routes: the real component in the real shell, no auth, no
 * Supabase client, no plugin, and a 404 on production (`VERCEL_ENV`).
 *
 * `?state=` draws one state (src/lib/iap/flow.ts, PAYWALL_STATES). The price
 * is a fixed string shaped like StoreKit's `displayPrice` for the US
 * storefront, the one value a preview must invent; the live page never types
 * a price. `?price=` replaces it with another storefront's shape (#338, check
 * 25: "$9.99", "9,99 €", "US$9.99", "٣٫٦٧ ر.س.", "MAD 99.00"); at most 24
 * characters. Like the live page, it answers 404 to any shell but 2 and to the
 * web: there is no shell-1 or web paywall to draw.
 *
 * The figures are the live ones (src/lib/iap/figures.ts), read from the
 * limits code exactly as the live page reads them.
 */
export const metadata: Metadata = {
  title: 'Paywall: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function ProPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ state?: string; price?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  if (!iapAllowed(await currentShellVersion())) notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const sp = await searchParams
  const state: PaywallState = PAYWALL_STATES.includes(sp.state as PaywallState) ? (sp.state as PaywallState) : 'ready'
  const shape = typeof sp.price === 'string' && sp.price.length > 0 && sp.price.length <= 24 ? sp.price : '$9.99'
  const price = state === 'loading' || state === 'unavailable' ? null : shape

  const labels = {
    dashboard: t.dashboard.nav.dashboard,
    knowledge: t.dashboard.nav.knowledge,
    agent: t.dashboard.nav.agent,
    settings: t.dashboard.nav.settings,
    appearance: t.nav.appearance,
    themeDark: t.nav.themeDark,
    themeLight: t.nav.themeLight,
    signOut: t.dashboard.nav.signOut,
  }

  return (
    <PlatformProvider platform="native" shell={2}>
      <IapProvider userId="00000000-0000-4000-8000-000000000000" offer={!state.startsWith('pro-')} locale={safeLocale} offerLabel={t.dashboard.iap.offerButton} preview>
        <DashboardShell locale={safeLocale} email="student@example.com" isPro={state.startsWith('pro-')} labels={labels} activeNav="settings" platform="native">
          <Paywall
            labels={t.dashboard.iap}
            figures={proFigures()}
            userId="00000000-0000-4000-8000-000000000000"
            pro={state === 'pro-apple' ? 'apple' : state === 'pro-web' ? 'web' : null}
            termsHref={`/${safeLocale}/terms`}
            privacyHref={`/${safeLocale}/privacy`}
            preview={{ state, price }}
          />
        </DashboardShell>
      </IapProvider>
    </PlatformProvider>
  )
}
