import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlement'
import { FREE_LIMITS, PRO_LIMITS } from './limits'

// B1 fix: pick the limit set from the user's entitlement instead of always
// applying FREE_LIMITS. Resolution lives in exactly one place so every check
// stays consistent. getEntitlement is RLS-scoped, so userId is always the
// logged-in caller.
async function limitsFor(userId: string) {
  const { tier } = await getEntitlement(userId)
  return tier === 'pro' ? PRO_LIMITS : FREE_LIMITS
}

export async function checkKBLimit(userId: string): Promise<boolean> {
  const limits = await limitsFor(userId)
  const supabase = await createClient()
  const { count } = await supabase
    .from('knowledge_bases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) < limits.knowledge_bases
}

export async function checkDocumentLimit(kbId: string, userId: string): Promise<boolean> {
  const limits = await limitsFor(userId)
  const supabase = await createClient()
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('kb_id', kbId)
  return (count ?? 0) < limits.documents
}

export async function checkConversationLimit(userId: string): Promise<boolean> {
  const limits = await limitsFor(userId)
  const supabase = await createClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
  return (count ?? 0) < limits.conversations_per_month
}
