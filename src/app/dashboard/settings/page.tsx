import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
        Settings
      </h1>
      <div className="border border-[#1a2e1e] p-6 mb-4">
        <h2 className="text-sm uppercase tracking-widest text-[#6b7d6e] mb-4"
            style={{fontFamily: 'var(--font-mono)'}}>
          Account
        </h2>
        <p className="text-[#6b7d6e] text-sm">Email</p>
        <p className="text-white mt-1">{user.email}</p>
      </div>
      <div className="border border-[#1a2e1e] p-6">
        <h2 className="text-sm uppercase tracking-widest text-[#6b7d6e] mb-4"
            style={{fontFamily: 'var(--font-mono)'}}>
          Plan
        </h2>
        <div className="flex flex-col gap-3 mt-1">
          <div className="text-[#2eff8c] text-sm flex gap-3 items-center">
            <span className="font-bold">{isPro ? 'Pro' : 'Free'}</span>
            {isPro && subscription?.current_period_end && (
              <span className="text-[#6b7d6e] text-xs">
                Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          {!isPro && (
            <a href="/pricing" className="text-[#2eff8c] border border-[#2eff8c] px-3 py-1.5 text-xs text-center w-max hover:bg-[#2eff8c] hover:text-black transition-colors uppercase tracking-widest font-[family-name:var(--font-mono)]">
              Upgrade to Pro
            </a>
          )}
          {isPro && (
            <span className="text-[#6b7d6e] text-xs uppercase tracking-widest font-[family-name:var(--font-mono)]">
              Active subscription
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
