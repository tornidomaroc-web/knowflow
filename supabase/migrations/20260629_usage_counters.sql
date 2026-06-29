-- Phase 0 (B7): per-user daily usage counters for rate limiting.
-- The pre-revenue cost-control backstop: caps queries (Claude inference) and
-- uploads (ingestion/embedding) per user per day. Enforcement/caps live in
-- src/lib/rate-limit.ts; this migration is just the durable counter + the atomic
-- increment primitive.

create table usage_counters (
  user_id uuid references auth.users(id) on delete cascade not null,
  day date not null default current_date,
  query_count int not null default 0,
  upload_count int not null default 0,
  primary key (user_id, day)
);

alter table usage_counters enable row level security;

-- Read-own only. There is deliberately NO insert/update policy: all writes go
-- through increment_usage() below, which is SECURITY DEFINER and bypasses RLS.
-- Users therefore cannot tamper with their own counters to reset/lower them.
create policy "Users can read own usage" on usage_counters for select using (
  auth.uid() = user_id
);

-- Atomic increment. SECURITY DEFINER so it can write the counter even though the
-- caller has no insert/update policy; search_path is pinned to public to close
-- the standard definer search-path hole. auth.uid() still resolves to the
-- calling user (JWT claims survive the role switch), so a caller can only ever
-- increment their OWN row. Returns the new count for the day so the caller can
-- compare it against the tier cap.
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
  else
    raise exception 'invalid usage kind: %', p_kind;
  end if;

  return v_count;
end;
$$;

grant execute on function increment_usage(text) to authenticated;
