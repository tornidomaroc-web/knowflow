-- The AI allowance's ledger gets one more kind of billed call: `page_read`, one
-- row per call /api/page-read made to Claude Haiku 5.5 that Anthropic billed
-- (an unbilled refusal or a failed call has none; a cut-off or empty page has
-- one). See src/lib/page-reader.ts and AI_SPEND_KINDS in src/lib/ai-allowance.ts.
--
-- ONLY THE KIND CHECK CHANGES. The table, its grants (authenticated SELECT of
-- its own rows; service_role SELECT and INSERT; anon nothing), its policy, the
-- usd check (0 to 10) and ai_spend_since are exactly as 20261115_ai_spend.sql
-- left them, and the VERIFY query below reads all of them again.
--
-- A NEW FILE, NOT AN EDIT OF 20261115, because that file is applied on
-- production as written. ORDER: after 20261115_ai_spend.sql. Running 20261115
-- again later would put its five-kind check back (and its ADD CONSTRAINT would
-- fail once a page_read row exists); if it is ever run again, run this file
-- right after it.
--
-- The drop and the add are one transaction, so the table is never without a
-- kind check, and a failed add leaves the old check in place. Every existing
-- row holds one of the five older kinds, which the new check still allows.
--
-- Idempotent: safe to run more than once.

begin;

alter table public.ai_spend drop constraint if exists ai_spend_kind_check;
alter table public.ai_spend add constraint ai_spend_kind_check
  check (kind in ('answer', 'summary', 'quiz', 'query_embed', 'upload_embed', 'page_read'));

commit;

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
--   check   | ai_spend_kind_check=CHECK ((kind = ANY (ARRAY['answer'::text, 'summary'::text, 'quiz'::text, 'query_embed'::text, 'upload_embed'::text, 'page_read'::text])))
--   check   | ai_spend_usd_check=CHECK (((usd >= (0)::numeric) AND (usd <= (10)::numeric)))
--   execute | anon=false
--   execute | authenticated=false
--   execute | service_role=true
--   grant   | anon: SELECT=false INSERT=false UPDATE=false DELETE=false
--   grant   | authenticated: SELECT=true INSERT=false UPDATE=false DELETE=false
--   grant   | service_role: SELECT=true INSERT=true UPDATE=false DELETE=false
--   policy  | Users can read own ai spend cmd=SELECT
--   table   | ai_spend rls=true
