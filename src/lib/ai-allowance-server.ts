/**
 * The I/O half of the AI allowance (src/lib/ai-allowance.ts has the rules).
 *
 * BOTH THE READ AND THE WRITE USE THE SERVICE ROLE, server side only. The
 * student's session can read its own `ai_spend` rows (RLS) and nothing else:
 * no INSERT, UPDATE or DELETE grant, no policy for them, and no function a
 * student may execute (supabase/migrations/20261115_ai_spend.sql). There is
 * no write function at all, so there is no RPC a client could call with a
 * negative amount; the table's own check refuses a negative, NaN or infinite
 * `usd` even from the service role, and the service role itself holds only
 * SELECT and INSERT, so the ledger is append-only for the server too.
 *
 * ORDER IN EVERY ROUTE: consent, then `checkAiAllowance`, then the daily
 * counter, then the provider. A refused call is never recorded and never
 * counted against the day.
 *
 * KNOWN BOUND: the check and the write are not one transaction, so requests
 * already in flight when the ceiling is crossed still finish and are
 * recorded. The overshoot is at most the calls one account can have in
 * flight at once, which the burst guard and the daily caps keep small.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEntitlement } from '@/lib/entitlement';
import type { Locale } from '@/lib/i18n';
import { TEMPORARILY_UNAVAILABLE } from '@/lib/limit-messages';
import {
  AI_ALLOWANCE_REFUSAL,
  aiAllowanceRefusalMessage,
  allowanceVerdict,
  allowanceWindowStart,
  isRecordableUsd,
  type AiSpendKind,
} from '@/lib/ai-allowance';

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface AllowanceCheck {
  allowed: boolean;
  status?: 429 | 503;
  error?: string;
  code?: string;
}

/** The account's spend in the window, or null when it cannot be read. */
export async function spentInWindow(userId: string, now: Date = new Date()): Promise<number | null> {
  const admin = serviceClient();
  if (!admin) {
    console.error('ai-allowance: service role not configured; the allowance cannot be read');
    return null;
  }
  const { data, error } = await admin.rpc('ai_spend_since', {
    p_user: userId,
    p_since: allowanceWindowStart(now).toISOString(),
  });
  if (error) {
    console.error('ai-allowance: ai_spend_since failed', error.message);
    return null;
  }
  const spent = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(spent) ? spent : null;
}

/**
 * Before every paid call. Fails CLOSED: an unreadable ledger refuses with 503,
 * as `enforceLimit` does for an unreadable counter.
 */
export async function checkAiAllowance(userId: string, locale: Locale): Promise<AllowanceCheck> {
  const { tier } = await getEntitlement(userId);
  const verdict = allowanceVerdict(await spentInWindow(userId), tier);
  if (verdict.allowed) return { allowed: true };
  if (verdict.reason === 'unread') {
    return { allowed: false, status: 503, error: TEMPORARILY_UNAVAILABLE[locale] };
  }
  return {
    allowed: false,
    status: 429,
    error: aiAllowanceRefusalMessage(locale),
    code: AI_ALLOWANCE_REFUSAL,
  };
}

/**
 * After a call the provider billed. Never throws and never changes the
 * response: the student already has the answer. A failed write is logged with
 * the tag `kf-spend-lost` so the lost amount can be found in the logs.
 */
export async function recordAiSpend(
  userId: string,
  kind: AiSpendKind,
  usd: number,
  estimated = false
): Promise<void> {
  try {
    if (!isRecordableUsd(usd)) {
      console.error(JSON.stringify({ tag: 'kf-spend-lost', reason: 'unrecordable usd', user_id: userId, kind, usd: String(usd) }));
      return;
    }
    if (usd === 0) return;
    const admin = serviceClient();
    if (!admin) {
      console.error(JSON.stringify({ tag: 'kf-spend-lost', reason: 'no service role', user_id: userId, kind, usd }));
      return;
    }
    const { error } = await admin.from('ai_spend').insert({ user_id: userId, kind, usd, estimated });
    if (error) {
      console.error(JSON.stringify({ tag: 'kf-spend-lost', reason: error.message, user_id: userId, kind, usd }));
    }
  } catch (e) {
    console.error(JSON.stringify({ tag: 'kf-spend-lost', reason: String(e), user_id: userId, kind, usd }));
  }
}
