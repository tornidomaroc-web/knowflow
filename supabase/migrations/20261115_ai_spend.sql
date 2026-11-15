-- The AI allowance's ledger (src/lib/ai-allowance.ts): one row per call that
-- Anthropic or Voyage AI billed, written by the server after the call, read
-- by the server before every paid call to sum the account's spend in the last
-- 30 days.
--
-- ONE ROW PER CALL, NOT A PERIOD TOTAL: the window is rolling (the 30 days
-- before now), which a stored total cannot answer; every amount stays
-- auditable and can be re-priced if a rate changes; and an append-only table
-- has no row a writer could lower. The heaviest account writes about 80 rows
-- a day (Pro: 25 questions x 2, 5 summaries, 5 quizzes, 20 uploads), about
-- 2,400 in a window, which the (user_id, at) index sums at once.
--
-- WHO MAY DO WHAT:
--   anon           nothing.
--   authenticated  SELECT, of its own rows only (RLS). No INSERT, UPDATE or
--                  DELETE grant and no policy for them, so a student can
--                  neither add, lower nor reset their own spend.
--   service_role   SELECT and INSERT only: the server writes, and even the
--                  server cannot UPDATE or DELETE a row (append-only).
--                  Account deletion still removes the rows, by the foreign
--                  key's ON DELETE CASCADE.
-- There is NO write function. The only function, ai_spend_since, reads, and
-- only service_role may execute it. A negative, NaN or infinite usd is refused
-- by the column type and the table's own check, for every role.
--
-- Idempotent: safe to run more than once.

create table if not exists public.ai_spend (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  usd numeric(12, 6) not null,
  estimated boolean not null default false
);

alter table public.ai_spend drop constraint if exists ai_spend_kind_check;
alter table public.ai_spend add constraint ai_spend_kind_check
  check (kind in ('answer', 'summary', 'quiz', 'query_embed', 'upload_embed'));
-- NaN is greater than every number in Postgres, so `usd <= 10` refuses it
-- (23514). numeric(12, 6) cannot hold 'Infinity' or '-Infinity' at all: the
-- type refuses them first (22003, numeric field overflow).
alter table public.ai_spend drop constraint if exists ai_spend_usd_check;
alter table public.ai_spend add constraint ai_spend_usd_check
  check (usd >= 0 and usd <= 10);

create index if not exists ai_spend_user_at on public.ai_spend (user_id, at);

alter table public.ai_spend enable row level security;

drop policy if exists "Users can read own ai spend" on public.ai_spend;
create policy "Users can read own ai spend" on public.ai_spend
  for select using (auth.uid() = user_id);

-- Supabase's default privileges grant every table to anon, authenticated and
-- service_role; take them all back, then give exactly the above.
revoke all on table public.ai_spend from public, anon, authenticated, service_role;
grant select on table public.ai_spend to authenticated;
grant select, insert on table public.ai_spend to service_role;

-- The window's sum, for the server's check (src/lib/ai-allowance-server.ts).
-- SECURITY INVOKER: run as service_role, which bypasses RLS and holds SELECT.
create or replace function public.ai_spend_since(p_user uuid, p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(usd), 0) from public.ai_spend where user_id = p_user and at >= p_since;
$$;

revoke all on function public.ai_spend_since(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_since(uuid, timestamptz) to service_role;

-- VERIFY (read-only; run after the statements above):
-- select 'table' as what, relname || ' rls=' || relrowsecurity as value from pg_class where oid = 'public.ai_spend'::regclass
-- union all
-- select 'grant', r || ': ' || string_agg(p || '=' || has_table_privilege(r, 'public.ai_spend', p)::text, ' ' order by o)
--   from (values ('anon'), ('authenticated'), ('service_role')) as rr(r),
--        (values ('SELECT', 1), ('INSERT', 2), ('UPDATE', 3), ('DELETE', 4)) as pp(p, o)
--  group by r
-- union all
-- select 'policy', policyname || ' cmd=' || cmd from pg_policies where schemaname = 'public' and tablename = 'ai_spend'
-- union all
-- select 'check', conname || '=' || pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.ai_spend'::regclass and contype = 'c'
-- union all
-- select 'execute', r || '=' || has_function_privilege(r, 'public.ai_spend_since(uuid, timestamptz)', 'EXECUTE')::text
--   from (values ('anon'), ('authenticated'), ('service_role')) as rr(r)
-- order by 1, 2;
--
-- Expected rows (10):
--   check   | ai_spend_kind_check=CHECK ((kind = ANY (ARRAY['answer'::text, 'summary'::text, 'quiz'::text, 'query_embed'::text, 'upload_embed'::text])))
--   check   | ai_spend_usd_check=CHECK (((usd >= (0)::numeric) AND (usd <= (10)::numeric)))
--   execute | anon=false
--   execute | authenticated=false
--   execute | service_role=true
--   grant   | anon: SELECT=false INSERT=false UPDATE=false DELETE=false
--   grant   | authenticated: SELECT=true INSERT=false UPDATE=false DELETE=false
--   grant   | service_role: SELECT=true INSERT=true UPDATE=false DELETE=false
--   policy  | Users can read own ai spend cmd=SELECT
--   table   | ai_spend rls=true
