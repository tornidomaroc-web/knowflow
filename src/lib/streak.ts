/**
 * Phase 5 (P5.3) — the single read path over `study_events`.
 *
 * The mirror of `study-events.ts`: that file is the only writer, this is the only
 * reader. Both go through an RPC and neither touches the table directly.
 *
 * All day arithmetic happens in Postgres (`current_streak`, 20260710_current_streak.sql),
 * not here. This function's whole job is to hand a validated-downstream zone name to
 * that RPC and to turn a failure into `null` rather than a lie. Bucketing in JS would
 * mean shipping the tz database to the client or trusting the Node server's own zone
 * — the first is heavy, the second is the `current_date` bug INVARIANT 2 exists to
 * prevent.
 *
 * ============================================================================
 * NULL IS NOT ZERO. THIS IS THE WHOLE CONTRACT.
 * ============================================================================
 * `StudentHome`'s `streak` prop is `number | null`, and the two are different
 * claims:
 *   null → "not measured" — renders the ghost placeholder, promises nothing;
 *   0    → "measured, and you have studied on no recent day" — a real, earned zero.
 *
 * The standing rule (`docs/PROGRESS.md` §5, "Honest placeholders") is that a feature
 * that cannot measure must read as NOT MEASURED, never as a working zero. So every
 * failure here — no zone yet, RPC error, a non-numeric return — yields `null`. A
 * student whose streak we could not compute sees a dash, not a 0 that tells them
 * their 40-day streak is gone.
 *
 * This is the same fail-open posture as `recordStudyEvent` and the same asymmetry
 * with `enforceLimit`: a study-log failure must never be reported to the student as
 * a fact about their studying.
 */
import type { createClient } from '@/lib/supabase/server';

// Matches `v_tz`'s initial value in current_streak(). Named in both places on
// purpose; if they ever drift, the streak silently buckets in two different zones.
export const DEFAULT_TIME_ZONE = 'Africa/Casablanca';

// The cookie the client writes its IANA zone name into. Read by the dashboard
// server component. Not `httpOnly` — it is written by JS and carries no secret; it
// is a display preference, and the DB validates it before use.
export const TIME_ZONE_COOKIE = 'kf_tz';

// Same structural type as study-events.ts. Passed in rather than constructed so the
// caller's authenticated, request-scoped client is reused.
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The current study streak for the authenticated user, in `timeZone`.
 *
 * `timeZone` is an IANA name (`Africa/Casablanca`, `Asia/Dubai`), NEVER a numeric
 * offset — Morocco drops to UTC+0 for Ramadan, so a stored offset misfiles the month
 * students study hardest. It is passed straight to the RPC as a bound parameter and
 * validated there against `pg_timezone_names`; a bogus or hostile name falls back to
 * DEFAULT_TIME_ZONE inside Postgres rather than raising at the student.
 *
 * Returns `null` when the streak cannot be measured — including when `timeZone` is
 * absent, which is the first-paint state before the client has written its cookie.
 */
export async function getCurrentStreak(
  supabase: ServerSupabaseClient,
  timeZone: string | undefined
): Promise<number | null> {
  // No zone yet → genuinely not measured. Do NOT silently substitute the default
  // here: that would render a confident number bucketed in a zone the student may
  // not be in. The client writes the cookie and refreshes; one render later this is
  // a real number. The DB's fallback is for an INVALID zone, which is a different
  // situation from NO zone.
  if (!timeZone) return null;

  try {
    const { data, error } = await supabase.rpc('current_streak', { p_time_zone: timeZone });
    if (error) {
      console.error('current_streak failed; showing "not measured"', { timeZone, error });
      return null;
    }
    // The RPC returns integer. Anything else means the migration on the live DB does
    // not match this file — report not-measured rather than coerce a surprise.
    if (typeof data !== 'number') {
      console.error('current_streak returned a non-number; showing "not measured"', { data });
      return null;
    }
    return data;
  } catch (e) {
    console.error('current_streak threw; showing "not measured"', { timeZone, error: e });
    return null;
  }
}
