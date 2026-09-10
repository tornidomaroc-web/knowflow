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
  // A document that FAILED to ingest must not consume the user's quota. Every
  // failure path in /api/ingest leaves its row behind at status='error' rather
  // than deleting it (the row is the only record that the attempt happened), so
  // an unfiltered count charges the user for our own outages: during the
  // 2026-07-23 ingestion incident every retry burned another slot, and the free
  // tier's 10 would have been exhausted by roughly a day of failures — surfacing
  // as "You've reached this subject's limit of 10 materials", a message that
  // reads as a product limit rather than as a bug. Register #54.
  //
  // This does not open a quota bypass: /api/ingest still runs enforceLimit's
  // daily upload cap (B7) before any work, so failures are bounded per day.
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('kb_id', kbId)
    .neq('status', 'error')
  return { allowed: (count ?? 0) < limits.documents, limit: limits.documents, tier }
}

/**
 * The month the conversation quota is counted over: `[start, nextStart)`.
 *
 * Both boundaries come from ONE function so the copy can never contradict the
 * check. `monthlyConversationMessage` states when the quota returns, and it
 * returns exactly when `start` next moves — if these were computed in two places
 * they could disagree, and the student would be told a time at which they are
 * still refused.
 *
 * NOTE (arithmetic is the server's LOCAL time, not UTC — preserved deliberately).
 * `setDate`/`setHours` are local-time setters. On Vercel `TZ` is UTC, so in
 * production this IS a UTC month; it is not guaranteed to be one by the code.
 * Making it UTC-explicit would SHIFT the window for any non-UTC deployment, which
 * is a behaviour change and not this change's business — it belongs with register
 * #80(a), which already owns the monthly cap. Until then, `nextStart` is derived
 * with the same local-time arithmetic as `start`, so the pair stays consistent
 * with itself and with the count under any `TZ`.
 */
export function conversationMonthWindow(now: Date = new Date()): { start: Date; nextStart: Date } {
  const start = new Date(now)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  const nextStart = new Date(start)
  nextStart.setMonth(nextStart.getMonth() + 1)
  return { start, nextStart }
}

export async function checkConversationLimit(userId: string): Promise<LimitCheck> {
  const { tier, limits } = await limitsFor(userId)
  const supabase = await createClient()
  const { start: startOfMonth } = conversationMonthWindow()

  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
  return { allowed: (count ?? 0) < limits.conversations_per_month, limit: limits.conversations_per_month, tier }
}
