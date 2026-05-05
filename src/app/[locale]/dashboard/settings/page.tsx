import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Locale, locales, useTranslation } from '@/lib/i18n'

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

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', user.id)
    .single()

  const isPro = subscription?.status === 'pro'

  return (
    <div className="text-white max-w-2xl">
      <h1 className="text-3xl font-bold mb-8"
          style={{fontFamily: 'var(--font-playfair)'}}>
        {t.dashboard.settings.title}
      </h1>
      <div className="border border-[#1a2e1e] p-6 mb-4">
        <h2 className="text-sm uppercase tracking-widest text-[#6b7d6e] mb-4"
            style={{fontFamily: 'var(--font-mono)'}}>
          {t.dashboard.settings.account}
        </h2>
        <p className="text-[#6b7d6e] text-sm">{t.dashboard.settings.email}</p>
        <p className="text-white mt-1">{user.email}</p>
      </div>
      <div className="border border-[#1a2e1e] p-6">
        <h2 className="text-sm uppercase tracking-widest text-[#6b7d6e] mb-4"
            style={{fontFamily: 'var(--font-mono)'}}>
          {t.dashboard.settings.plan}
        </h2>
        <div className="flex flex-col gap-3 mt-1">
          <div className="text-[#2eff8c] text-sm flex gap-3 items-center">
            <span className="font-bold">{isPro ? t.dashboard.settings.pro : t.dashboard.settings.free}</span>
            {isPro && subscription?.current_period_end && (
              <span className="text-[#6b7d6e] text-xs">
                {t.dashboard.settings.renews} {new Date(subscription.current_period_end).toLocaleDateString(safeLocale === 'ar' ? 'ar' : 'en-GB')}
              </span>
            )}
          </div>
          {!isPro && (
            <a href={`/${safeLocale}/pricing`} className="text-[#2eff8c] border border-[#2eff8c] px-3 py-1.5 text-xs text-center w-max hover:bg-[#2eff8c] hover:text-black transition-colors uppercase tracking-widest font-[family-name:var(--font-mono)]">
              {t.dashboard.settings.upgrade}
            </a>
          )}
          {isPro && (
            <span className="text-[#6b7d6e] text-xs uppercase tracking-widest font-[family-name:var(--font-mono)]">
              {t.dashboard.settings.activeSubscription}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
