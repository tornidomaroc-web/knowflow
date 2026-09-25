import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlement'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
import { CancelSubscriptionCard } from '@/components/dashboard/CancelSubscriptionCard'
import { readScheduledCancellation } from '@/lib/subscription/cancel'
import { paddleClient } from '@/lib/paddle'
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n'
import { SUPPORT_EMAIL, withSupportEmail } from '@/lib/site'
import { purchaseLinksAllowed } from '@/lib/platform'
import { formatDate } from '@/lib/format-date'

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
  const { tier, expiresAt } = await getEntitlement(user.id)
  const isPro = tier === 'pro'
  const renewsOn = expiresAt
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
  const cancelsAt = isPro ? await readScheduledCancellation(supabase, paddleClient, user.id) : null
  const cancelsOn = cancelsAt
    ? formatDate(cancelsAt, safeLocale)
    : null

  const s = t.dashboard.settings
  return (
    <SettingsPanel
      email={user.email || ''}
      isPro={isPro}
      renewsOn={renewsOn}
      cancelsOn={cancelsOn}
      // Apple 3.1.1(a): inside the store build the plan card is status only.
      // `purchaseLinksAllowed()` reads the build-time flag (src/lib/platform.ts).
      upgradeHref={purchaseLinksAllowed() ? `/${safeLocale}/pricing` : null}
      locale={safeLocale}
      pathname={`/${safeLocale}/dashboard/settings`}
      // Apple 5.1.1(i): the privacy policy must be linked "within the app in an
      // easily accessible manner", not only from the marketing footer.
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
      // ABOVE the delete card, deliberately. Register #70 is that the only way
      // to stop being billed was to destroy the account; a customer looking for
      // the gentler exit must meet it before the destructive one, not after.
      subscriptionCard={
        isPro ? (
          <CancelSubscriptionCard
            labels={withSupportEmail(s.cancelSubscription)}
            accessUntil={cancelsOn ?? renewsOn}
            alreadyScheduled={Boolean(cancelsAt)}
          />
        ) : null
      }
      deleteCard={
        <DeleteAccountCard homeHref={`/${safeLocale}`} labels={withSupportEmail(s.deleteAccount)} />
      }
    />
  )
}
