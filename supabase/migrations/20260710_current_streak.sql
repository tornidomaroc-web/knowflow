-- Phase 5 (P5.3): `current_streak(text)` — the read path over `study_events`.
--
-- P5.1 built the substrate, P5.2 wired the four emitters. This is the query the
-- home placeholder has been waiting for since P2.2 (register #14).
--
-- ============================================================================
-- WHY THE ZONE IS A PARAMETER AND NOT A COLUMN
-- ============================================================================
-- INVARIANT 2 of 20260709_study_events.sql stores the INSTANT and buckets it into
-- days in the STUDENT'S timezone at READ time. This function is that read time.
--
-- The zone is supplied per call, from the browser (`Intl.DateTimeFormat()
-- .resolvedOptions().timeZone`), rather than read from a `profiles.timezone`
-- column. That was decided against on evidence: `001_initial_schema.sql:11` grants
--   create policy "Users can manage own profile" on profiles for all using (auth.uid() = id)
-- — a single `for all` policy — and the signup page already writes `profiles` from
-- the browser with the anon key. A `profiles.timezone` column would therefore be
-- just as client-writable as a parameter is client-supplied, buying ZERO forgery
-- resistance, while adding a staleness bug: a student who moves Casablanca → Dubai
-- and never edits a settings field is bucketed in the wrong zone silently and
-- permanently. A per-request zone is at least always current.
--
-- What a hostile zone buys: re-bucketing EXISTING history to shift day boundaries,
-- by at most ~26h end to end. It can never fabricate a day on which nothing
-- happened — two events more than 48h apart land in non-adjacent days under every
-- zone on Earth. While a streak grants nothing this is self-cheating (the same
-- reasoning that reframed register #29). It STOPS being acceptable the moment a
-- streak earns something (Phase 9's AdMob: an ad-free day), at which point the zone
-- must stop being client-asserted. That is the SAME trigger as revoking
-- `record_study_event`'s grant from `authenticated` — register #36, one entry.
--
-- ============================================================================
-- WHY AN IANA NAME, NEVER A NUMERIC OFFSET
-- ============================================================================
-- `Africa/Casablanca` is UTC+1 year-round EXCEPT that it reverts to UTC+0 for
-- Ramadan — precisely the month this audience studies hardest. A stored `+60` would
-- misfile an entire month of streaks every year. A zone NAME survives DST, Ramadan,
-- and any future decree, because Postgres resolves it against the tz database at
-- evaluation time. Never store or pass the offset.
--
-- ============================================================================
-- SECURITY INVOKER, DELIBERATELY — the opposite choice from record_study_event
-- ============================================================================
-- The WRITE path is SECURITY DEFINER because it must stamp `occurred_at` and
-- `user_id` beyond the caller's reach. The READ path needs no such power: it reads
-- only the caller's own rows, which the "Users can read own study events" SELECT
-- policy already scopes. Running it INVOKER means RLS still applies inside the
-- function, so a bug here cannot leak another student's history. The explicit
-- `user_id = auth.uid()` filter is belt-and-braces AND the index prefix; RLS is the
-- guarantee. `set search_path = public` is pinned regardless.
--
-- ============================================================================
-- FAIL SOFT ON A BAD ZONE. NEVER RAISE AT THE STUDENT.
-- ============================================================================
-- An unvalidated name reaching `at time zone` is both an error surface (a bogus
-- string raises `invalid_parameter_value` and would surface as a 500 on the home
-- page) and, if it were ever interpolated rather than parameterized, an injection
-- surface. We validate against `pg_timezone_names` and fall back to the documented
-- default. A student with an exotic or spoofed zone sees a streak bucketed in
-- Casablanca time, never an error page. The zone is never concatenated into SQL.
create or replace function current_streak(p_time_zone text)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  -- The documented fallback. Named here, once, so the TS layer and this function
  -- cannot disagree about what "unknown zone" means.
  v_tz text := 'Africa/Casablanca';
  v_today date;
  v_day date;
  v_prev date := null;
  v_streak integer := 0;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Validated, not trusted. `pg_timezone_names` is the tz database as Postgres
  -- actually knows it, so this accepts exactly the names `at time zone` accepts.
  if p_time_zone is not null and exists (
    select 1 from pg_timezone_names where name = p_time_zone
  ) then
    v_tz := p_time_zone;
  end if;

  -- "Today" in the STUDENT'S zone, not the server's. `now()` is an instant;
  -- `at time zone v_tz` renders it as that zone's wall clock; `::date` takes the
  -- calendar day. This is the only place the current day is defined.
  v_today := (now() at time zone v_tz)::date;

  -- Newest first, walk backwards until a gap. This is verbatim the access pattern
  -- `study_events_user_id_occurred_at_idx (user_id, occurred_at desc)` was built
  -- for: `user_id` is the index prefix and `occurred_at desc` is its order, so the
  -- planner walks the index and this loop STREAMS. The `exit` below stops reading
  -- at the first gap, so a student with three years of history and a broken streak
  -- reads a handful of rows, not three years of them.
  --
  -- Bucketing happens per row, in the loop, rather than in a `distinct` subquery on
  -- the expression — a `distinct` would force a full read + sort of the user's
  -- entire history before the first row could be examined, defeating the early exit.
  for v_row in
    select occurred_at
    from study_events
    where user_id = auth.uid()
    order by occurred_at desc
  loop
    v_day := (v_row.occurred_at at time zone v_tz)::date;

    if v_prev is null then
      -- THE GRACE WINDOW. The newest study day must be TODAY or YESTERDAY.
      --
      -- If it is today, today is earned and counted. If it is yesterday, the streak
      -- SURVIVES until today ends: a streak that snaps at 00:01, before the student
      -- has had any chance to study, punishes them for sleeping. Today is simply not
      -- counted yet — the number shown is the run through yesterday, every day of
      -- which was actually earned.
      --
      -- So neither bad claim is made: we never break a streak the student still has
      -- time to keep, and we never show a day the student has not yet earned.
      -- Anything older than yesterday is a real, expired gap: 0.
      if v_day = v_today or v_day = v_today - 1 then
        v_streak := 1;
        v_prev := v_day;
      else
        return 0;
      end if;
    elsif v_day = v_prev then
      -- Several events on one local day (the common case: a student uploads, asks,
      -- and quizzes in one sitting). One day, one increment. This is also why no
      -- `unique(user_id, day, kind)` upsert is needed to dedupe at write time — the
      -- READ dedupes, and the write keeps the instant. See INVARIANT 2.
      continue;
    elsif v_day = v_prev - 1 then
      v_streak := v_streak + 1;
      v_prev := v_day;
    else
      -- A gap. Everything older is irrelevant to the CURRENT streak.
      exit;
    end if;
  end loop;

  -- No rows at all falls through with v_streak = 0, which is correct: a student who
  -- has never studied has a streak of zero. That is distinct from NULL ("not
  -- measured"), which only the TS layer produces, and only when the zone is unknown.
  return v_streak;
end;
$$;

-- Callable from a browser, like `record_study_event`. Safe: SECURITY INVOKER means
-- the caller's own RLS applies, so this grant exposes nothing the SELECT policy does
-- not already expose.
grant execute on function current_streak(text) to authenticated;

-- This file is a PLAN, not a fact. Abo Jad applies it manually in the Supabase SQL
-- editor and then VERIFIES the live DB matches (the function's existence, its
-- prosecdef = false, its proconfig search_path=public, and the grant) via
-- information_schema / pg_proc — the standing rule from register #23: a written
-- migration file is never an applied one.
