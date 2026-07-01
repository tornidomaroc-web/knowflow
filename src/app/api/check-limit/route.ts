import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkKBLimit } from '@/lib/limits-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ canCreate: false, error: 'Unauthorized' }, { status: 401 })
  }

  const kb = await checkKBLimit(user.id)
  return NextResponse.json({ canCreate: kb.allowed, limit: kb.limit, tier: kb.tier })
}
