import type { Metadata } from 'next'
import type React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { RateRow } from '@/components/review/RateRow'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
import { CancelSubscriptionCard } from '@/components/dashboard/CancelSubscriptionCard'
import { StudyReminderCard } from '@/components/reminder/StudyReminderCard'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { SUPPORT_EMAIL, withSupportEmail } from '@/lib/site'
import { formatDate } from '@/lib/format-date'
import { iapAllowed } from '@/lib/platform'
import { currentShellVersion } from '@/lib/platform-server'
import { IapProvider } from '@/components/iap/IapProvider'
import { ProOfferCard } from '@/components/iap/ProOffer'
import { AppStoreDeleteNote, AppStoreManageCard } from '@/components/iap/AppStoreManage'

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
 *
 * In-app Pro (iOS 1.1, item 4d): with the app's user agent at shell 2
 * (`KnowFlowApp/2`) the page draws what shell 2 draws, as if the StoreKit
 * plugin answered: a free account gets the Pro offer card. `?plan=apple` is a
 * Pro bought in the app (R1: the App Store manage card instead of the Paddle
 * cancel card; R2: the delete card's App Store line), on every shell. Every
 * URL that existed before draws exactly what it drew.
 *
 * Sign in with Apple (item 4f): `?account=apple` is an account with an Apple
 * identity whose server holds the Apple key. With `&delete=open` the delete
 * card is drawn open: at shell 2 with the KnowFlowApple plugin (design-c's
 * stub) that is the Apple step, elsewhere the typed email. `&delete=fallback`
 * draws Apple's refusal with the email field, `&delete=done` the line shown
 * when Apple's access was not ended.
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
  searchParams: Promise<{ plan?: string; platform?: string; theme?: string; reminder?: string; account?: string; delete?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()

  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const s = t.dashboard.settings

  const { plan, platform, theme, reminder, account, delete: deleteView } = await searchParams
  const appleAccount = account === 'apple'
  const deleteState = deleteView === 'open' ? 'open' : deleteView === 'fallback' ? 'apple-fallback' : deleteView === 'done' ? 'apple-done' : undefined
  const apple = plan === 'apple'
  const isPro = plan === 'pro' || apple
  const native = platform === 'native'
  // Shell 2 only, from the request's own user agent (the dashboard's reading).
  const iap = native && iapAllowed(await currentShellVersion())
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
      <div className={platform ? 'hidden' : 'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs'}>
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

      <PlatformProvider platform={native ? 'native' : 'web'}>
      <MaybeIap on={iap} locale={safeLocale} offerLabel={t.dashboard.iap.offerButton}>
      <DashboardShell locale={safeLocale} email="student@example.com" isPro={isPro} labels={labels} activeNav="settings" platform={native ? 'native' : 'web'}>
        <SettingsPanel
          email="student@example.com"
          isPro={isPro}
          renewsOn={isPro && !apple ? renewsOn : null}
          cancelsOn={null}
          upgradeHref={native ? null : `/${safeLocale}/pricing`}
          locale={safeLocale}
          pathname={`/${safeLocale}/preview/settings?${qs({})}`}
          privacyHref={`/${safeLocale}/privacy`}
          termsHref={`/${safeLocale}/terms`}
          supportEmail={SUPPORT_EMAIL}
          labels={{
            title: s.title,
            subtitle: native ? s.subtitleApp : s.subtitle,
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
          // The study reminder as the app shows it (STORE_PATH.md S3(a)), off;
          // in preview mode the card talks to no plugin.
          // Step Redesign-3: `?reminder=on` shows it switched on, its time read
          // in the page's language ("7:00 م" / "7:00 pm") beside the picker.
          reminderCard={native ? <StudyReminderCard labels={t.dashboard.studyReminder} locale={safeLocale} preview={reminder === 'on' ? 'on' : 'off'} /> : null}
          subscriptionCard={
            apple ? (
              <AppStoreManageCard labels={t.dashboard.iap} />
            ) : isPro ? (
              <CancelSubscriptionCard labels={withSupportEmail(s.cancelSubscription)} accessUntil={renewsOn} alreadyScheduled={false} />
            ) : null
          }
          iapMarked={iap}
          proOfferCard={iap && !isPro ? <ProOfferCard title={t.dashboard.iap.title} body={t.dashboard.iap.offerBody} button={t.dashboard.iap.offerButton} /> : undefined}
          signOutRow={<SignOutButton locale={safeLocale} label={t.dashboard.nav.signOut} variant="row" />}
          rateRow={<RateRow label={s.rate} description={s.rateDesc} />}
          deleteCard={<DeleteAccountCard homeHref={`/${safeLocale}`} showBillingNote={isPro && !apple} labels={withSupportEmail(s.deleteAccount)} appleNote={apple ? <AppStoreDeleteNote labels={t.dashboard.iap} /> : undefined} {...(appleAccount ? { appleAccount: true, appleConfirm: true } : {})} {...(deleteState ? { previewState: deleteState } : {})} />}
        />
      </DashboardShell>
      </MaybeIap>
      </PlatformProvider>
    </div>
  )
}

/** Shell 2's provider, as the dashboard layout mounts it; a bare fragment otherwise. */
function MaybeIap({ on, locale, offerLabel, children }: { on: boolean; locale: string; offerLabel: string; children: React.ReactNode }) {
  if (!on) return <>{children}</>
  return (
    <IapProvider userId="00000000-0000-4000-8000-000000000000" offer locale={locale} offerLabel={offerLabel} preview>
      {children}
    </IapProvider>
  )
}
