-- Register #137, step 1 (audit). READ-ONLY: every statement below selects from
-- the catalog; nothing is written, no user row is read. Paste the whole file
-- into the Supabase SQL editor on the production project. The editor runs it
-- as its own role (section `0.who`, which this read proves) and shows the last
-- statement's grid, so the file is ONE statement: a union of sections, each
-- aggregated into a single cell, because the grid renders 14 rows at a time.
--
-- Sections:
--   0.who        current_user / session_user of the editor (the grantor our
--                hand-applied migrations create tables under).
--   1.relations  every relation in public: kind, owner, relacl, RLS on/forced.
--   2.privs      has_table_privilege matrix, anon/authenticated/service_role x
--                SELECT/INSERT/UPDATE/DELETE, per public table (membership-aware,
--                unlike reading relacl by eye).
--   3.policies   every policy in public: command, permissive, roles, USING, CHECK.
--   4.defacl     pg_default_acl: grantor, schema (0 = every schema), object
--                type, ACL.
--   5.functions  every non-extension function in public: definer/invoker,
--                owner, proacl, proconfig, whether its body contains a write verb.
--   6.definers   SECURITY DEFINER functions in ANY non-system schema whose body
--                names a public.<table> AND contains a write verb: a REVOKE on
--                the table does not stop these.
--   7.triggers   non-internal triggers on public tables and on auth.users.
--   8.views      views in public and their reloptions (security_invoker).
--   9.colacl     column-level ACLs on public tables (expected none).
--  10.sequences  sequences in public: owner, relacl.
--  11.roles      the API/admin roles: login, superuser, bypassrls, inherit, and
--                memberships (who can SET ROLE to whom).
--  12.schema     the ACL on schema public itself.
with
w0 as (
  select '0.who' as section, format('current_user=%s session_user=%s', current_user, session_user) as value
),
w1 as (
  select '1.relations' as section,
         string_agg(format('%s | kind=%s owner=%s rls=%s forced=%s acl=%s',
                           c.relname, c.relkind, pg_get_userbyid(c.relowner),
                           c.relrowsecurity, c.relforcerowsecurity, coalesce(c.relacl::text, '<null: owner-only default>')),
                    E'\n' order by c.relname) as value
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
),
w2 as (
  select '2.privs' as section,
         string_agg(format('%s | %s: %s', t.relname, r.r,
                           (select string_agg(p.p || '=' || has_table_privilege(r.r, ('public.' || quote_ident(t.relname)), p.p)::text, ' ' order by p.o)
                              from (values ('SELECT', 1), ('INSERT', 2), ('UPDATE', 3), ('DELETE', 4)) as p(p, o))),
                    E'\n' order by t.relname, r.o) as value
    from (select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')) t,
         (values ('anon', 1), ('authenticated', 2), ('service_role', 3)) as r(r, o)
),
w3 as (
  select '3.policies' as section,
         string_agg(format('%s | %s | cmd=%s permissive=%s roles=%s using=%s check=%s',
                           tablename, policyname, cmd, permissive, array_to_string(roles, ','),
                           coalesce(qual, '-'), coalesce(with_check, '-')),
                    E'\n' order by tablename, policyname) as value
    from pg_policies where schemaname = 'public'
),
w4 as (
  select '4.defacl' as section,
         string_agg(format('grantor=%s schema=%s type=%s acl=%s',
                           pg_get_userbyid(d.defaclrole),
                           case when d.defaclnamespace = 0 then '<every schema>' else n.nspname end,
                           d.defaclobjtype::text, d.defaclacl::text),
                    E'\n' order by 1) as value
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
),
w5 as (
  select '5.functions' as section,
         string_agg(format('%s(%s) | definer=%s volatile=%s owner=%s acl=%s config=%s writes=%s',
                           p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef, p.provolatile,
                           pg_get_userbyid(p.proowner), coalesce(p.proacl::text, '<null: PUBLIC execute>'),
                           coalesce(p.proconfig::text, '-'),
                           (p.prosrc ~* '\m(insert|update|delete|truncate)\M')),
                    E'\n' order by p.proname) as value
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     -- functions that belong to an extension (pgvector's operators, when the
     -- extension lives in public) are the extension's, not ours: left out.
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
),
w6 as (
  select '6.definers' as section,
         coalesce(string_agg(format('%s.%s(%s) | owner=%s acl=%s config=%s',
                           n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
                           pg_get_userbyid(p.proowner), coalesce(p.proacl::text, '<null: PUBLIC execute>'),
                           coalesce(p.proconfig::text, '-')),
                    E'\n' order by n.nspname, p.proname), '<none>') as value
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef
     and n.nspname not in ('pg_catalog', 'information_schema')
     and p.prosrc ~* '\m(insert|update|delete|truncate)\M'
     and (n.nspname = 'public' or p.prosrc ~* 'public\.')
),
w7 as (
  select '7.triggers' as section,
         coalesce(string_agg(format('%s | %s | fn=%s enabled=%s',
                           t.tgrelid::regclass::text, t.tgname, t.tgfoid::regproc::text, t.tgenabled),
                    E'\n' order by t.tgrelid::regclass::text, t.tgname), '<none>') as value
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
),
w8 as (
  select '8.views' as section,
         coalesce(string_agg(format('%s | owner=%s reloptions=%s', c.relname, pg_get_userbyid(c.relowner), coalesce(c.reloptions::text, '-')),
                    E'\n' order by c.relname), '<none>') as value
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
),
w9 as (
  select '9.colacl' as section,
         coalesce(string_agg(format('%s.%s acl=%s', c.relname, a.attname, a.attacl::text), E'\n' order by c.relname, a.attnum), '<none>') as value
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and a.attacl is not null and not a.attisdropped
),
w10 as (
  select '10.sequences' as section,
         coalesce(string_agg(format('%s | owner=%s acl=%s', c.relname, pg_get_userbyid(c.relowner), coalesce(c.relacl::text, '<null>')),
                    E'\n' order by c.relname), '<none>') as value
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'S'
),
w11 as (
  select '11.roles' as section,
         (select string_agg(format('%s | login=%s super=%s bypassrls=%s inherit=%s createrole=%s memberof=%s',
                                   r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolinherit, r.rolcreaterole,
                                   coalesce((select string_agg(g.rolname, ',' order by g.rolname)
                                               from pg_auth_members m join pg_roles g on g.oid = m.roleid
                                              where m.member = r.oid), '-')),
                            E'\n' order by r.rolname)
            from pg_roles r
           where r.rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres', 'supabase_admin',
                               'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'pgbouncer', 'supabase_read_only_user')) as value
),
w12 as (
  select '12.schema' as section, format('public | owner=%s acl=%s', pg_get_userbyid(nspowner), coalesce(nspacl::text, '<null>')) as value
    from pg_namespace where nspname = 'public'
)
select section, value from w0
union all select section, value from w1
union all select section, value from w2
union all select section, value from w3
union all select section, value from w4
union all select section, value from w5
union all select section, value from w6
union all select section, value from w7
union all select section, value from w8
union all select section, value from w9
union all select section, value from w10
union all select section, value from w11
union all select section, value from w12
order by section;
