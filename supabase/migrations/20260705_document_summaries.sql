-- Phase 3 (per-document summaries): schema foundation.
-- Adds on-demand, generate-once summaries stored on the document row, plus a
-- dedicated daily summary counter so summarization (a paid Claude call over the
-- FULL document) is bounded independently of the query cap — a heavy summary must
-- not silently drain a user's question quota (see docs/PROGRESS.md Phase 3).
--
-- This migration is ADDITIVE and IDEMPOTENT (`add column if not exists`,
-- `create or replace function`), so it is safe to run once against the live DB
-- regardless of any hand-applied drift. It touches the fail-closed rate-limit
-- primitive (increment_usage) — the two existing branches are reproduced verbatim.
--
-- No new RLS policies are required:
--   * documents  — the existing "Users can manage own documents" policy already
--     covers the new columns (select/update by KB ownership).
--   * usage_counters — reads stay read-own; the new summary_count is written only
--     through increment_usage(), which is SECURITY DEFINER and bypasses RLS, so
--     users still cannot tamper with their own counters.

-- 1. Per-document summary, generated on demand from documents.markdown_content and
--    persisted (generate-once, read-many — the primary cost control). A null
--    `summary` means "not generated yet". `summary_is_partial` is true only when
--    the source exceeded the model input cap and the summary honestly covers just
--    the first part of the document (never a silent truncation).
alter table documents
  add column if not exists summary text,
  add column if not exists summary_generated_at timestamptz,
  add column if not exists summary_model text,
  add column if not exists summary_is_partial boolean not null default false;

-- 2. Dedicated daily summary counter (B7 family), parallel to query_count /
--    upload_count. Separate column = separate cap, so summaries and questions are
--    bounded independently.
alter table usage_counters
  add column if not exists summary_count int not null default 0;

-- 3. Extend the atomic increment primitive with a 'summary' branch. The 'query'
--    and 'upload' branches are UNCHANGED (reproduced verbatim from
--    20260629_usage_counters.sql). Still SECURITY DEFINER with a pinned
--    search_path; auth.uid() still resolves to the caller, so a user can only ever
--    increment their OWN row. Any unknown kind still raises (fail closed).
create or replace function increment_usage(p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_kind = 'query' then
    insert into usage_counters (user_id, day, query_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set query_count = usage_counters.query_count + 1
    returning query_count into v_count;
  elsif p_kind = 'upload' then
    insert into usage_counters (user_id, day, upload_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set upload_count = usage_counters.upload_count + 1
    returning upload_count into v_count;
  elsif p_kind = 'summary' then
    insert into usage_counters (user_id, day, summary_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set summary_count = usage_counters.summary_count + 1
    returning summary_count into v_count;
  else
    raise exception 'invalid usage kind: %', p_kind;
  end if;

  return v_count;
end;
$$;

grant execute on function increment_usage(text) to authenticated;
