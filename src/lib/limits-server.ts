import { createClient } from '@/lib/supabase/server'
import { FREE_LIMITS } from './limits'

export async function checkKBLimit(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('knowledge_bases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) < FREE_LIMITS.knowledge_bases
}

export async function checkDocumentLimit(kbId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('kb_id', kbId)
  return (count ?? 0) < FREE_LIMITS.documents
}

export async function checkConversationLimit(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
  return (count ?? 0) < FREE_LIMITS.conversations_per_month
}
