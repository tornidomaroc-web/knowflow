import { createClient } from '@/lib/supabase/server'
import { getEntitlement } from '@/lib/entitlement'
import { FREE_LIMITS, PRO_LIMITS } from './limits'
import type { Tier } from '@/types'

/**
 * Result of a limit check. Carries the resolved `tier` and the actual `limit`
 * that applied, so callers can build tier-correct, real-number messages (a Pro
 * user must never see a "Free plan" / free-limit message). Mirrors the
 * tier-aware shape used by rate-limit.ts.
 */
export interface LimitCheck {
  allowed: boolean
  limit: number
  tier: Tier
}

// B1 fix: pick the limit set from the user's entitlement instead of always
// applying FREE_LIMITS. Resolution lives in exactly one place so every check
// stays consistent. getEntitlement is RLS-scoped, so userId is always the
// logged-in caller.
async function limitsFor(userId: string) {
  const { tier } = await getEntitlement(userId)
  return { tier, limits: tier === 'pro' ? PRO_LIMITS : FREE_LIMITS }
}

export async function checkKBLimit(userId: string): Promise<LimitCheck> {
  const { tier, limits } = await limitsFor(userId)
  const supabase = await createClient()
  const { count } = await supabase
    .from('knowledge_bases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return { allowed: (count ?? 0) < limits.knowledge_bases, limit: limits.knowledge_bases, tier }
}

export async function checkDocumentLimit(kbId: string, userId: string): Promise<LimitCheck> {
  const { tier, limits } = await limitsFor(userId)
  const supabase = await createClient()
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('kb_id', kbId)
  return { allowed: (count ?? 0) < limits.documents, limit: limits.documents, tier }
}

export async function checkConversationLimit(userId: string): Promise<LimitCheck> {
  const { tier, limits } = await limitsFor(userId)
  const supabase = await createClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
  return { allowed: (count ?? 0) < limits.conversations_per_month, limit: limits.conversations_per_month, tier }
}
