import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEntitlementDetail } from '@/lib/entitlement'
import { Paywall } from '@/components/iap/Paywall'
import { proFigures } from '@/lib/iap/figures'
import { iapAllowed } from '@/lib/platform'
import { currentShellVersion } from '@/lib/platform-server'
import { Locale, resolveLocale, useTranslation } from '@/lib/i18n'

/**
 * THE PAYWALL (iOS 1.1, item 4d, app half). The app from shell 2 only
 * (`iapAllowed`, src/lib/platform.ts): the web sells on /pricing through
 * Paddle and build 8 has no StoreKit code, so both get a 404 here and no
 * screen of theirs links to it. Rendered per request (it reads the session
 * and the user agent), never cached under a key another shell shares.
 *
 * Already Pro: from Apple, the status and the App Store's Manage sheet; from
 * anywhere else, the status alone, no buy button and no word about where it
 * was bought (3.1.1 / 3.1.3(f): the app never points to another way to pay).
 */
export default async function ProPage({ params }: { params: Promise<{ locale: Locale }> }) {
  if (!iapAllowed(await currentShellVersion())) notFound()

  const { locale } = await params
  const safeLocale: Locale = resolveLocale(locale)
  const t = useTranslation(safeLocale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLocale}/login`)

  const { entitlement, sources } = await getEntitlementDetail(user.id)
  const pro = entitlement.tier !== 'pro' ? null : sources.apple ? 'apple' : 'web'

  return (
    <Paywall
      labels={t.dashboard.iap}
      figures={proFigures()}
      userId={user.id}
      pro={pro}
      termsHref={`/${safeLocale}/terms`}
      privacyHref={`/${safeLocale}/privacy`}
    />
  )
}
