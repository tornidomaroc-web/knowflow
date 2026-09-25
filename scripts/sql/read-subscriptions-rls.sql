-- Register #126. READ-ONLY: this file only selects from the catalog. It is the
-- one query used on both sides of the #126 comparison:
--
--   (b) scripts/verify-subscriptions-rls.mjs runs it against a throwaway
--       database built from this repository's migrations on Supabase's own
--       postgres image, prints the rows, and asserts the ones the read path
--       depends on. That output is the EXPECTED side.
--   (a) the owner pastes the same text into the Supabase SQL editor on the
--       production project and compares the rows with (b)'s output. Every row
--       is one item: RLS on/forced, each policy, each grant, and the body of
--       the function every policy calls. A difference is the finding.
--
-- No user data is read: pg_class, pg_policies, has_table_privilege and
-- pg_get_functiondef return schema metadata only.
select 'rls_enabled' as item, relrowsecurity::text as value
  from pg_class where oid = 'public.subscriptions'::regclass
union all
select 'rls_forced', relforcerowsecurity::text
  from pg_class where oid = 'public.subscriptions'::regclass
union all
select 'policy:' || policyname,
       format('cmd=%s permissive=%s roles=%s using=%s check=%s',
              cmd, permissive, array_to_string(roles, ','),
              coalesce(qual, '-'), coalesce(with_check, '-'))
  from pg_policies where schemaname = 'public' and tablename = 'subscriptions'
union all
select 'grant:' || r || ':' || p, has_table_privilege(r, 'public.subscriptions', p)::text
  from unnest(array['anon', 'authenticated']) as r,
       unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
union all
select 'auth.uid()', regexp_replace(pg_get_functiondef('auth.uid()'::regprocedure), '\s+', ' ', 'g')
order by 1;
