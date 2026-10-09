import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AiConsentProvider } from '@/components/ai-consent/AiConsentProvider'
import { AiConsentCard } from '@/components/ai-consent/AiConsentCard'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'

/**
 * DESIGN PREVIEW for the AI permission of Apple 5.1.2(i) (STORE_PATH.md S4),
 * the same idea as the other preview routes: the real components in the real
 * chrome, no auth, a 404 on production through the VERCEL_ENV gate.
 *
 * The sheet opens at once, over the Settings card in its "not allowed" state.
 * In preview mode the provider saves nowhere: "I agree" closes the sheet and
 * turns the card to "allowed", "Withdraw" turns it back, and nothing leaves the
 * page. `?state=on` starts with the permission given and the sheet closed.
 */
export const metadata: Metadata = {
  title: 'AI permission: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function AiConsentPreview({
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
  const on = (await searchParams).state === 'on'

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">ai-consent · preview</span>
        <span className="text-faint">{safeLocale} · {on ? 'allowed, sheet closed' : 'first ask, sheet open'}</span>
      </div>
      <AiConsentProvider
        initialConsented={on}
        labels={t.dashboard.aiConsent}
        privacyHref={`/${safeLocale}/privacy`}
        preview
      >
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
          <div className="mx-auto max-w-2xl space-y-6">
            <AiConsentCard />
          </div>
        </DashboardShell>
      </AiConsentProvider>
    </div>
  )
}
