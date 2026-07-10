/**
 * Phase 5 (P5.2) — the single write path to `study_events`.
 *
 * Every emitter in the product goes through this function. It exists so that the
 * three rules that make the streak substrate trustworthy are enforced in ONE
 * place instead of being re-argued at four call sites.
 *
 * ============================================================================
 * RULE 1: RPC ONLY. NEVER `from('study_events').insert(...)`.
 * ============================================================================
 * `record_study_event` is SECURITY DEFINER: it stamps `occurred_at` with `now()`
 * server-side and takes `user_id` from `auth.uid()`. Neither value is a parameter,
 * so a caller cannot supply either one. A direct insert would put both under
 * client control, and since the browser holds the anon key it could BACKDATE 365
 * rows and manufacture a year-long streak. `study_events` has a read-own SELECT
 * policy and NO insert/update/delete policy precisely so that RLS denies the
 * direct path — this function is the only door, and the DB agrees.
 *
 * The RPC's exact signature, read from 20260709_study_events.sql:112 —
 *   record_study_event(p_kind text) returns uuid
 * The parameter name `p_kind` is load-bearing: supabase-js sends named arguments,
 * so a typo here is a runtime "function does not exist", not a type error.
 *
 * ============================================================================
 * RULE 2: FAIL OPEN, LOUDLY.
 * ============================================================================
 * This returns `void` and never throws. A student's grade, summary, answer, or
 * upload must NEVER fail because a bookkeeping row did not land. That is the exact
 * OPPOSITE of `enforceLimit`, which fails CLOSED — and the asymmetry is the point:
 * `usage_counters` is a SPEND ledger where a lost write costs real money, so
 * denying is safe. `study_events` is a STUDY log where a lost write costs the
 * student credit they earned, so denying is harmful. Never conflate the two.
 *
 * But loudly, because this is a USER-VISIBLE substrate, unlike the `quiz_attempts`
 * table it replaces. A dropped row is not an invisible accounting rounding error;
 * it is telling a student they studied 29 days when they studied 30. The mitigation
 * is event MULTIPLICITY, not a fail-closed write: a real study day almost always
 * produces several of the four kinds, and the day survives if ANY of them lands.
 *
 * We deliberately do NOT add a `unique(user_id, day, kind)` upsert to get
 * idempotency. It would require a server-computed `day` column, which reintroduces
 * exactly the `current_date`/UTC timezone bug that INVARIANT 2 of the migration
 * exists to prevent: a UTC+1 student studying at 00:30 local would be bucketed into
 * the previous day, permanently and unfixably.
 */
import type { createClient } from '@/lib/supabase/server';
import type { StudyEventKind } from '@/types';

// The request-scoped server client, structurally. Taken as a PARAMETER rather than
// created here on purpose: /api/agent emits from inside a ReadableStream that runs
// AFTER the response headers are flushed, where `cookies()` is no longer available
// to build a fresh client. Reusing the caller's already-authenticated instance is
// the only thing that works in that position — and it is also one less client per
// request everywhere else.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Record one study action for the CURRENT authenticated user.
 *
 * `kind` is typed to `StudyEventKind`, so the four values are checked at compile
 * time against the same union the CHECK constraint and the RPC's fail-closed
 * `raise exception` mirror. Three independent guards, one list.
 *
 * Callers should `await` this on their success path and then return their real
 * result unconditionally — there is no failure to handle, by design.
 */
export async function recordStudyEvent(
  supabase: ServerSupabaseClient,
  kind: StudyEventKind
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_study_event', { p_kind: kind });
    if (error) {
      // Loud: a lost study event is a user-visible undercount of the streak.
      console.error('record_study_event failed; study event LOST', { kind, error });
    }
  } catch (e) {
    // The RPC can also throw (network, aborted request after a streamed response).
    // Swallow it here so no caller ever has to wrap this in its own try/catch.
    console.error('record_study_event threw; study event LOST', { kind, error: e });
  }
}
