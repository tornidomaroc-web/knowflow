import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlement'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
import { CancelSubscriptionCard } from '@/components/dashboard/CancelSubscriptionCard'
import { readScheduledCancellation } from '@/lib/subscription/cancel'
import { paddleClient } from '@/lib/paddle'
import { Locale, locales, useTranslation } from '@/lib/i18n'

// Thin server wrapper: auth + entitlement only. Presentation lives in the dumb
// <SettingsPanel/> (Phase 8 reuse).
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en'
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
    ? new Date(expiresAt).toLocaleDateString(safeLocale === 'ar' ? 'ar' : 'en-GB')
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
    ? new Date(cancelsAt).toLocaleDateString(safeLocale === 'ar' ? 'ar' : 'en-GB')
    : null

  return (
    <SettingsPanel
      email={user.email || ''}
      isPro={isPro}
      renewsOn={renewsOn}
      cancelsOn={cancelsOn}
      upgradeHref={`/${safeLocale}/pricing`}
      labels={{
        title: t.dashboard.settings.title,
        account: t.dashboard.settings.account,
        email: t.dashboard.settings.email,
        plan: t.dashboard.settings.plan,
        free: t.dashboard.settings.free,
        pro: t.dashboard.settings.pro,
        renews: t.dashboard.settings.renews,
        cancels: t.dashboard.settings.cancels,
        upgrade: t.dashboard.settings.upgrade,
        activeSubscription: t.dashboard.settings.activeSubscription,
      }}
    >
      {/* ABOVE the delete card, deliberately. Register #70 is that the only way
          to stop being billed was to destroy the account; a customer looking for
          the gentler exit must meet it before the destructive one, not after. */}
      {isPro && (
        <CancelSubscriptionCard
          labels={t.dashboard.settings.cancelSubscription}
          accessUntil={cancelsOn ?? renewsOn}
          alreadyScheduled={Boolean(cancelsAt)}
        />
      )}

      <DeleteAccountCard
        homeHref={`/${safeLocale}`}
        labels={t.dashboard.settings.deleteAccount}
      />
    </SettingsPanel>
  )
}
