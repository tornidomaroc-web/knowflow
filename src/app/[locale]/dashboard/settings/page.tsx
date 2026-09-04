import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlement'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/dashboard/SettingsPanel'
import { DeleteAccountCard } from '@/components/dashboard/DeleteAccountCard'
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

  return (
    <SettingsPanel
      email={user.email || ''}
      isPro={isPro}
      renewsOn={renewsOn}
      upgradeHref={`/${safeLocale}/pricing`}
      labels={{
        title: t.dashboard.settings.title,
        account: t.dashboard.settings.account,
        email: t.dashboard.settings.email,
        plan: t.dashboard.settings.plan,
        free: t.dashboard.settings.free,
        pro: t.dashboard.settings.pro,
        renews: t.dashboard.settings.renews,
        upgrade: t.dashboard.settings.upgrade,
        activeSubscription: t.dashboard.settings.activeSubscription,
      }}
    >
      <DeleteAccountCard
        homeHref={`/${safeLocale}`}
        labels={t.dashboard.settings.deleteAccount}
      />
    </SettingsPanel>
  )
}
