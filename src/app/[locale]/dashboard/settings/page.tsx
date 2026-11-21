import { createClient } from '@/lib/supabase/server'
import { getEntitlementDetail } from '@/lib/entitlement'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { RateRow } from '@/components/review/RateRow'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
import { AiConsentCard } from '@/components/ai-consent/AiConsentCard'
import { StudyReminderCard } from '@/components/reminder/StudyReminderCard'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { studyReminderAllowed } from '@/lib/study-reminder'
import { CancelSubscriptionCard } from '@/components/dashboard/CancelSubscriptionCard'
import { readScheduledCancellation } from '@/lib/subscription/cancel'
import { deletionWouldCancelBilling } from '@/lib/subscription/billing-note'
import { paddleClient } from '@/lib/paddle'
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n'
import { SUPPORT_EMAIL, withSupportEmail } from '@/lib/site'
import { iapAllowed, purchaseLinksAllowed } from '@/lib/platform'
import { currentPlatform, currentShellVersion } from '@/lib/platform-server'
import { ProOfferCard } from '@/components/iap/ProOffer'
import { AppStoreDeleteNote, AppStoreManageCard } from '@/components/iap/AppStoreManage'
import { formatDate } from '@/lib/format-date'
import { appleConfirmConfigured } from '@/lib/auth/apple-revoke'

// Thin server wrapper: auth + entitlement only. Presentation lives in the dumb
// <SettingsPanel/> (Phase 8 reuse).
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const safeLocale: Locale = resolveLocale(locale)
  const t = useTranslation(safeLocale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLocale}/login`)

  // Derive entitlement via getEntitlement (single source of truth), not a raw
  // subscription.status === 'pro' check: the webhook now writes faithful Paddle
  // statuses, so === 'pro' would show paying users as free. expiresAt is the
  // current_period_end when pro, else null. maybeSingle inside getEntitlement
  // also avoids the throw for users with no subscription row.
  //
  // In-app Pro (#337, R1): the same read also says WHERE Pro comes from. A Pro
  // that is Apple's alone is managed in the App Store, so it gets no Paddle
  // cancel card, no Paddle round trip, and no "Renews" date (the App Store
  // owns the renewal; this table does not know whether auto-renew is on).
  const { entitlement: { tier, expiresAt }, sources } = await getEntitlementDetail(user.id)
  const isPro = tier === 'pro'
  const appleOnly = isPro && sources.apple && !sources.paddle
  const renewsOn = expiresAt && !appleOnly
    ? formatDate(expiresAt, safeLocale)
    : null

  // Asked of PADDLE, not of our table, because our table has no column for it
  // and adding one was refused: Paddle already knows, and a second copy is a
  // second thing that can drift. Register #70.
  //
  // THE DEGRADATION RULE IS PART OF THE DESIGN, not an accident of error
  // handling: readScheduledCancellation never throws and returns null when
  // Paddle is unreachable, so this page falls back to the plain entitlement and
  // NEVER becomes an error page. A settings page that still shows a customer
  // their email address is worth more than one that fails closed on a billing
  // read. Only asked when the user is actually Pro; a free user has nothing
  // scheduled and should not cost a Paddle round trip on every render.
  const cancelsAt = isPro && !appleOnly ? await readScheduledCancellation(supabase, paddleClient, user.id) : null
  const cancelsOn = cancelsAt
    ? formatDate(cancelsAt, safeLocale)
    : null

  const s = t.dashboard.settings
  // The study reminder is the app's alone (src/lib/study-reminder.ts); the
  // platform comes from this request, like the plan card's below.
  const platform = await currentPlatform()
  // In-app Pro's surfaces exist from shell 2 on (src/lib/platform.ts, iapAllowed).
  const iap = iapAllowed(await currentShellVersion())
  // Sign in with Apple (item 4f): an account with an Apple identity may
  // confirm its deletion with Apple instead of typing its address, where the
  // server holds the Apple key; the card decides after mount whether the
  // plugin answers. Read from the session, never from the request.
  const appleAccount = (user.identities ?? []).some((i) => i.provider === 'apple')
  return (
    <SettingsPanel
      email={user.email || ''}
      isPro={isPro}
      renewsOn={renewsOn}
      cancelsOn={cancelsOn}
      // Apple 3.1.1(a): inside the app the plan card is status only. The
      // platform is read from this request (src/lib/platform.ts), which also
      // keeps this page rendered per request rather than cached.
      upgradeHref={purchaseLinksAllowed(await currentPlatform()) ? `/${safeLocale}/pricing` : null}
      locale={safeLocale}
      pathname={`/${safeLocale}/dashboard/settings`}
      // Apple 5.1.1(i): the privacy policy must be linked "within the app in an
      // easily accessible manner", not only from the marketing footer.
      privacyHref={`/${safeLocale}/privacy`}
      termsHref={`/${safeLocale}/terms`}
      supportEmail={SUPPORT_EMAIL}
      labels={{
        title: s.title,
        // Step Wording-1: inside the app no plan is shown, so none is named.
        subtitle: purchaseLinksAllowed(platform) ? s.subtitle : s.subtitleApp,
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
      // ABOVE the delete card, deliberately. Register #70 is that the only way
      // to stop being billed was to destroy the account; a customer looking for
      // the gentler exit must meet it before the destructive one, not after.
      // STORE_PATH.md S3(a): the daily reminder lives on the phone, so the web
      // never renders it; the card also hides itself in an app build without
      // the plugin.
      reminderCard={
        studyReminderAllowed(platform) ? (
          <StudyReminderCard labels={t.dashboard.studyReminder} locale={safeLocale} />
        ) : null
      }
      consentCard={<AiConsentCard />}
      subscriptionCard={
        appleOnly ? (
          <AppStoreManageCard labels={t.dashboard.iap} />
        ) : isPro ? (
          <>
            <CancelSubscriptionCard
              labels={withSupportEmail(s.cancelSubscription)}
              accessUntil={cancelsOn ?? renewsOn}
              alreadyScheduled={Boolean(cancelsAt)}
            />
            {/* Pro from both sources: the Paddle card for Paddle's part, the
                App Store's for Apple's. Paddle-only renders exactly as before. */}
            {sources.apple ? <AppStoreManageCard labels={t.dashboard.iap} /> : null}
          </>
        ) : null
      }
      // Shell 2, a free account: the offer card in the plan card's place. It
      // shows only once the StoreKit plugin answers (the Android shell also
      // says KnowFlowApp/2 and has none).
      iapMarked={iap}
      proOfferCard={iap && !isPro ? (
        <ProOfferCard title={t.dashboard.iap.title} body={t.dashboard.iap.offerBody} button={t.dashboard.iap.offerButton} />
      ) : undefined}
      signOutRow={<SignOutButton locale={safeLocale} label={t.dashboard.nav.signOut} variant="row" />}
      // In-app rating (item 4h): Apple's write-review link, drawn only once the
      // KnowFlowReview plugin answers (src/components/review/RateRow.tsx).
      rateRow={<RateRow label={s.rate} description={s.rateDesc} />}
      deleteCard={
        <DeleteAccountCard
          homeHref={`/${safeLocale}`}
          labels={withSupportEmail(s.deleteAccount)}
          showBillingNote={await deletionWouldCancelBilling(supabase, user.id)}
          // R2 (Apple 5.1.1(v)): while Apple may still bill this account,
          // deleting it does not stop that billing, and the card says so.
          appleNote={sources.appleBilling ? <AppStoreDeleteNote labels={t.dashboard.iap} /> : undefined}
          appleAccount={appleAccount}
          appleConfirm={appleAccount && appleConfirmConfigured()}
        />
      }
    />
  )
}
