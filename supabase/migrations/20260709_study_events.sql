-- Phase 5 (P5.1): `study_events` — the streak substrate.
--
-- Named by PIVOT_PLAN.md in three independent places (§7 row 5, line 65, line 105)
-- and by register #14. This is the table the home streak placeholder has been
-- waiting for since P2.2.
--
-- ============================================================================
-- INVARIANT 1: A STREAK'S SUBSTRATE MUST BE OWNED BY THE STREAK.
-- ============================================================================
-- There is NO foreign key to any content table. That is the entire point, and it
-- is the positive form of the argument that disqualified `quiz_attempts`
-- (register #33): that table cascaded quiz_attempts -> quizzes -> documents, so
-- deleting ONE material erased every attempt beneath it. Correct for
-- content-lifecycle data; catastrophic for a streak, which is an IMMUTABLE claim
-- about what the student DID. A student deleting a subject must NEVER lose the
-- fact that they studied.
--
-- The only cascade is from `auth.users`: if the account is gone, the history has
-- no subject and no reader. Nothing else may ever be allowed to reach in here.
-- Register #34 records the sibling rule: do not reuse `usage_counters` (the B7
-- cost ledger, owned by Phase 7's rate-limit tuning) as a streak substrate either.
--
-- ============================================================================
-- INVARIANT 2: STORE THE INSTANT. NEVER A SERVER-COMPUTED `day` COLUMN.
-- ============================================================================
-- `occurred_at timestamptz` is the truth; the streak buckets it into days in the
-- STUDENT'S timezone at READ time. `increment_usage` uses `current_date`, which is
-- server UTC. KnowFlow's audience is Arabic-speaking; Morocco is UTC+1. A student
-- studying at 00:30 local would be written to the PREVIOUS UTC day. In a
-- rate-limit ledger that is invisible (caps are approximate). In a streak it is a
-- USER-VISIBLE LIE: they study every night before bed and watch the streak break.
-- Bucketing the day at write time makes that bug PERMANENT and unfixable without a
-- backfill, because the instant is destroyed. So we keep the instant.
--
-- ============================================================================
-- INVARIANT 3: WRITE-VIA-RPC ONLY. NO INSERT POLICY. (See the PR for the argument.)
-- ============================================================================
-- Mirrors the discipline of `usage_counters`, which has a SELECT-own policy and
-- NO insert/update/delete policy, so RLS denies every direct write and all writes
-- flow through the SECURITY DEFINER `increment_usage`.
--
-- The reason is NOT "copy the neighbour". A direct-insert policy — even one with
-- `with check (user_id = auth.uid())` — would let the browser client set
-- `occurred_at` to ANY value, because RLS constrains WHICH ROWS you may write, not
-- WHAT VALUES you may put in them. A student could BACKDATE 365 rows in a single
-- request and manufacture a year-long streak that never happened. The RPC stamps
-- `occurred_at` server-side with `now()` and whitelists `kind`, so the worst a
-- caller can do is assert "I studied, now" — which requires one real call on one
-- real day, and cannot fabricate history.
--
-- The RPC is granted to `authenticated`, exactly as `increment_usage` is, so it
-- remains callable from a browser. That is deliberate and acceptable TODAY: a
-- streak grants nothing, so forging today's event is self-cheating, the same
-- reasoning that reframed register #29. It STOPS being acceptable the moment a
-- streak earns anything (Phase 9's AdMob: an ad-free day). At that point this
-- grant must be REVOKED from `authenticated` and the RPC called only from a
-- server route holding the service-role key. Recorded as register #36.
--
-- Immutability falls out for free: with no update or delete policy, RLS denies
-- both, so a student can read their history and add to today — never rewrite the
-- past.
create table study_events (
  id uuid primary key default gen_random_uuid(),

  -- The ONLY foreign key. Cascade from the account, and from nothing else.
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Which study action produced this event. Constrained by CHECK rather than by a
  -- Postgres enum: an enum needs `alter type ... add value` to extend (which could
  -- not run inside a transaction before PG12, and still cannot REMOVE a value),
  -- whereas a CHECK is a plain, reversible, reviewable constraint that lives beside
  -- the column. `increment_usage` already models kinds as `text` + a fail-closed
  -- `else raise exception`; this is the schema-level twin of that posture.
  --
  -- The four DECIDED values (2026-07-09). 'summary_read' is deliberately ABSENT:
  -- passively viewing stored text is not studying, and admitting it would make the
  -- streak farmable by opening a page.
  kind text not null,

  -- INVARIANT 2. The instant, never a bucketed day.
  occurred_at timestamptz not null default now(),

  constraint study_event_kind_valid check (
    kind in ('quiz_submitted', 'summary_generated', 'question_asked', 'material_uploaded')
  )
);

alter table study_events enable row level security;

-- READ-OWN ONLY. There is intentionally no insert/update/delete policy: RLS denies
-- what it does not permit, so this single policy makes the table append-only from
-- the outside and writable only through `record_study_event` below.
create policy "Users can read own study events" on study_events for select using (
  auth.uid() = user_id
);

-- A streak query reads ONE user's events, newest first, and walks backwards until
-- it finds a gap. This index serves exactly that access pattern.
create index study_events_user_id_occurred_at_idx
  on study_events (user_id, occurred_at desc);

-- The only write path. SECURITY DEFINER with a pinned search_path, `auth.uid()`
-- resolving to the caller so a user can only ever record their OWN event, and
-- `occurred_at` stamped server-side so history cannot be fabricated. Any unknown
-- kind raises — fail closed, exactly like `increment_usage`'s
-- `else raise exception 'invalid usage kind'`. The CHECK constraint would catch it
-- too; raising here makes the failure explicit and identical in shape to the
-- limiter's, rather than surfacing as an opaque constraint violation.
--
-- Returns the new row's id so a caller can log it. Callers are P5.2's emitters;
-- NOTHING calls this yet.
create or replace function record_study_event(p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_kind not in ('quiz_submitted', 'summary_generated', 'question_asked', 'material_uploaded') then
    raise exception 'invalid study event kind: %', p_kind;
  end if;

  insert into study_events (user_id, kind)
  values (v_user, p_kind)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function record_study_event(text) to authenticated;

-- This file is a PLAN, not a fact. Abo Jad applies it manually in the Supabase SQL
-- editor and then VERIFIES the live DB matches (table, CHECK, the single SELECT
-- policy and the ABSENCE of insert/update/delete policies, the index, and the
-- function's existence + grant) via information_schema / pg_policies — the standing
-- rule from register #23: a written migration file is never an applied one.
