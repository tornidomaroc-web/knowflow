import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
import { CancelSubscriptionCard } from '@/components/dashboard/CancelSubscriptionCard'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { SUPPORT_EMAIL, withSupportEmail } from '@/lib/site'
import { formatDate } from '@/lib/format-date'

/**
 * DESIGN PREVIEW for Settings (register #46), the same idea as
 * `preview/student-home`: the real components, the real chrome, literal data,
 * NO auth and NO Supabase client, and a 404 on production through the
 * `VERCEL_ENV` gate (fail-open by choice; see that route for the reasoning).
 *
 * `?plan=pro` shows the Pro card and the cancel-subscription card;
 * `?platform=native` shows the plan card as the store build renders it, with
 * no purchase link (Apple 3.1.1(a)). The two cards below are client components
 * that only talk to the server when clicked, so they are safe to look at.
 */
export const metadata: Metadata = {
  title: 'Settings: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function SettingsPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ plan?: string; platform?: string; theme?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()

  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const s = t.dashboard.settings

  const { plan, platform, theme } = await searchParams
  const isPro = plan === 'pro'
  const native = platform === 'native'
  const otherLocale: Locale = safeLocale === 'ar' ? 'en' : 'ar'
  const qs = (o: Record<string, string>) =>
    new URLSearchParams({ plan: isPro ? 'pro' : 'free', platform: native ? 'native' : 'web', theme: theme ?? 'dark', ...o }).toString()

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

  const renewsOn = formatDate('2026-10-25T00:00:00Z', safeLocale)

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">settings · preview</span>
        <span className="text-faint">
          {isPro ? 'pro' : 'free'} · {native ? 'native' : 'web'} · {safeLocale}
        </span>
        <Link href={`/${safeLocale}/preview/settings?${qs({ plan: isPro ? 'free' : 'pro' })}`} className="rounded-full border border-accent px-3 py-1 font-semibold text-accent">
          {isPro ? 'free' : 'pro'}
        </Link>
        <Link href={`/${safeLocale}/preview/settings?${qs({ platform: native ? 'web' : 'native' })}`} className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground">
          {native ? 'web' : 'native'}
        </Link>
        <Link href={`/${otherLocale}/preview/settings?${qs({})}`} className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground">
          {otherLocale}
        </Link>
      </div>

      <DashboardShell locale={safeLocale} email="student@example.com" isPro={isPro} labels={labels}>
        <SettingsPanel
          email="student@example.com"
          isPro={isPro}
          renewsOn={isPro ? renewsOn : null}
          cancelsOn={null}
          upgradeHref={native ? null : `/${safeLocale}/pricing`}
          locale={safeLocale}
          pathname={`/${safeLocale}/preview/settings?${qs({})}`}
          privacyHref={`/${safeLocale}/privacy`}
          termsHref={`/${safeLocale}/terms`}
          supportEmail={SUPPORT_EMAIL}
          labels={{
            title: s.title,
            subtitle: s.subtitle,
            account: s.account,
            email: s.email,
            plan: s.plan,
            free: s.free,
            pro: s.pro,
            freePlanDesc: s.freePlanDesc,
            proPlanDesc: s.proPlanDesc,
            renews: s.renews,
            cancels: s.cancels,
            upgrade: s.upgrade,
            activeSubscription: s.activeSubscription,
            preferences: s.preferences,
            language: s.language,
            appearance: t.nav.appearance,
            themeDark: t.nav.themeDark,
            themeLight: t.nav.themeLight,
            helpLegal: s.helpLegal,
            privacyPolicy: s.privacyPolicy,
            terms: s.terms,
            support: s.support,
            supportDesc: s.supportDesc,
          }}
          subscriptionCard={
            isPro ? (
              <CancelSubscriptionCard labels={withSupportEmail(s.cancelSubscription)} accessUntil={renewsOn} alreadyScheduled={false} />
            ) : null
          }
          deleteCard={<DeleteAccountCard homeHref={`/${safeLocale}`} labels={withSupportEmail(s.deleteAccount)} />}
        />
      </DashboardShell>
    </div>
  )
}
