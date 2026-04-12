import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
        <p className="text-[#2eff8c] text-sm">Free</p>
      </div>
    </div>
  )
}
