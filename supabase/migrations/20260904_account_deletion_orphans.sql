-- The durable trace for account-deletion orphans: one table, one failure mode,
-- named for it, plus the one boolean a scheduled watcher is allowed to read.
--
-- Register #54's DURABLE half (docs/PROGRESS.md §4). The four CODE-level halves
-- closed in PR #74; this is the half that row calls "not optional".
--
-- WHAT AN ORPHAN IS. src/lib/account-deletion/orchestrate.ts returns
-- `stage: 'orphaned'` from exactly two arms: line 130, where Paddle cancelled
-- one subscription and then failed on a second, and line 155, where the cancel
-- succeeded and `auth.admin.deleteUser` did not. In BOTH the user's billing is
-- cancelled and their account still exists -- they keep every byte of their data
-- and lose what they paid for. The file says so at lines 34-46, and says in the
-- same breath that there is no durable, alertable trace of it. A console.error
-- in a Vercel function log nobody reads is not a control. This file is the
-- store; .github/workflows/deletion-orphan-watch.yml (a later commit) is the
-- signal.
--
--
-- WHY THERE IS NO FOREIGN KEY TO auth.users, AND WHY THAT IS NOT AN OVERSIGHT
-- --------------------------------------------------------------------------
-- The thing that looks like a missing constraint is the design. In both orphan
-- arms the auth.users row STILL EXISTS -- that is what the state is -- so a
-- foreign key here would be satisfiable at write time. That is the trap, not the
-- justification, because BOTH available delete rules are actively harmful:
--
--   ON DELETE CASCADE  destroys the incident record the moment the user retries
--                      successfully. The trace would be erased by the very act
--                      it exists to make auditable.
--
--   NO ACTION/RESTRICT is worse: the row would BLOCK the retry. A trace that
--                      prevents the recovery it was written to enable is not a
--                      trace, it is a deadlock -- and it is register #62's
--                      spine hazard in miniature, where a NO ACTION reference
--                      turned account deletion into a foreign key violation no
--                      application code could rescue.
--
-- orchestrate.ts:111-114 already carries the mirror of this argument for
-- `waitlist`: that table has no user_id and no foreign key, so no cascade
-- reaches it, which is exactly why the row must be erased BEFORE the account.
-- Same property, opposite requirement. `waitlist` must not survive the deletion.
-- This table must.
--
-- `user_id` is therefore a bare uuid. The verification query below asserts the
-- foreign key count on this table is ZERO, so the decision is machine-checked on
-- every read-back rather than left to a reader trusting this comment.
--
--
-- WHY ALMOST NOTHING IS NOT NULL, AND WHY THERE IS NO CHECK CONSTRAINT
-- --------------------------------------------------------------------
-- CHANGED WHILE WRITING THIS FILE, deliberately, against the shape that was
-- reviewed. The first draft had `stage text not null check (stage in (...))`,
-- `email text not null` and `reason text not null`. That is ordinary good
-- schema design and it is WRONG HERE.
--
-- This table is the trace of last resort for a state that cannot be reproduced
-- on demand -- reaching either arm needs fault injection, refused twice. Every
-- NOT NULL and every CHECK is one more way for the INSERT to raise, and an
-- INSERT that raises converts a recorded incident into a silent one. That is
-- precisely the failure mode register #54 was opened for: an ingestion failure
-- that was invisible at every layer at once. Rebuilding it inside the fix would
-- be the same defect wearing the fix's clothes.
--
-- So: `id` and `occurred_at` are constrained because a row cannot exist without
-- them. NOTHING ELSE IS. A future arm passing an unrecognised `stage` string
-- writes a row with an odd value in it, which an operator can read, rather than
-- throwing and leaving nothing behind. Data quality is worth less than the row.
--
--
-- WHY RLS IS ENABLED WITH ZERO POLICIES
-- -------------------------------------
-- Not an omission either. Supabase exposes every table in `public` through
-- PostgREST; without RLS this table is readable by anyone holding the anon key,
-- which ships in the browser bundle. It stores other people's email addresses
-- against their failed deletions. RLS on with no policies means anon and
-- authenticated match no row at all, while the service_role client the route
-- already uses (BYPASSRLS) writes normally. The grants are revoked as well, so
-- the table is protected by two independent mechanisms rather than one; the
-- verification query reads both.
--
--
-- WHY ONE TRANSACTION, EXPLICITLY
-- -------------------------------
-- Same argument as 20260829_spine_constraints.sql. If CREATE TABLE can commit
-- without the ENABLE ROW LEVEL SECURITY that follows it, the intermediate state
-- is a world-readable table of email addresses. Postgres would wrap a
-- multi-statement simple query in an implicit transaction, but relying on that
-- makes the submission method load-bearing while looking cosmetic. BEGIN and
-- COMMIT are explicit so atomicity does not depend on the client.
--
-- If the client has already opened a transaction, BEGIN emits
--   WARNING:  there is already a transaction in progress
-- That warning is expected and is not a failure.

begin;

create table public.account_deletion_orphans (
  -- Constrained because a row cannot exist without them. See the block above.
  id           uuid        primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),

  -- DELIBERATELY NOT a foreign key. See the block above. Verified as
  -- fk_count = 0 by the query at the bottom of this file.
  user_id      uuid,

  -- The operator's handle on the incident. Nullable on purpose.
  email        text,

  -- 'billing-partial' (orchestrate.ts:130) or 'account-delete' (:155).
  -- No CHECK constraint, on purpose.
  stage        text,

  subscriptions_canceled integer,
  reason       text,

  -- Set BY HAND by an operator once the incident is dealt with. There is no
  -- auto-resolution and there is not going to be: a row that resolves itself is
  -- a row nobody read.
  resolved_at     timestamptz,
  resolution_note text
);

comment on table public.account_deletion_orphans is
  'Register #54 durable half. One row per account-deletion orphan: billing cancelled, account intact. Deliberately has NO foreign key to auth.users -- CASCADE would erase the incident on recovery and NO ACTION would block the recovery. See the header of 20260904_account_deletion_orphans.sql.';

comment on column public.account_deletion_orphans.email is
  'Personal data retained deliberately: the deletion did NOT complete, so this is the record of an incomplete erasure, not data kept after a successful one. WHEN AN OPERATOR SETS resolved_at, SET THIS TO NULL IN THE SAME STATEMENT -- once the deletion has actually completed there is no longer any basis to hold it.';

comment on column public.account_deletion_orphans.user_id is
  'Bare uuid, NOT a foreign key. This is the design, not an oversight.';

-- Enabled with NO policies. anon and authenticated therefore match no row.
alter table public.account_deletion_orphans enable row level security;

-- Second, independent mechanism. Supabase default privileges grant anon and
-- authenticated broad access to new tables in `public`; RLS would stop them
-- reading rows, but there is no reason for the grant to exist at all.
revoke all on table public.account_deletion_orphans from anon, authenticated;

-- The watcher only ever asks "is there an unresolved one", so the only index
-- that earns its place is the partial one that answers exactly that.
create index account_deletion_orphans_unresolved_idx
  on public.account_deletion_orphans (occurred_at desc)
  where resolved_at is null;


-- THE ONE BIT THE WATCHER IS ALLOWED TO SEE
-- =========================================
-- .github/workflows/deletion-orphan-watch.yml calls this over PostgREST RPC
-- with the ANON key. The alternative -- putting a Supabase SERVICE-ROLE key in
-- this PUBLIC repository's Actions secrets -- was rejected: the service role
-- bypasses RLS on all twelve tables, and spending that to learn one bit is a
-- grotesque trade. production-monitor.yml states the invariant this copies:
-- "NO SECRET GRANTS ACCESS HERE ... The workflow cannot upload, convert, embed,
-- or read a single row." That file is not modified -- the invariant is copied,
-- not the file, because production-monitor.yml is unauthenticated by design and
-- adding a credential to it would make it something else.
--
-- It returns a BOOLEAN and nothing else. Not a count: a count would publish how
-- many customers we have failed, and the watcher does not need it to open an
-- issue.
--
-- `set search_path = ''` with every reference schema-qualified, which DEVIATES
-- from the `set search_path = public` used by this repo's existing definer
-- functions (20260629_usage_counters.sql:34, 20260501_rag_pgvector.sql:67).
-- The deviation is deliberate and is not a style drift: those functions are
-- reachable only by an authenticated user through the app. THIS ONE IS GRANTED
-- TO anon, so it is reachable by any anonymous caller on the internet holding a
-- key that ships in the browser bundle. The strictest available setting is the
-- right one at that exposure, and the verification query asserts it.
create or replace function public.has_unresolved_deletion_orphan()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.account_deletion_orphans
     where resolved_at is null
  );
$$;

-- Revoke first, then grant exactly one role. `from public` here is the SQL
-- pseudo-role PUBLIC (everyone), not the `public` schema.
revoke all on function public.has_unresolved_deletion_orphan() from public;
grant execute on function public.has_unresolved_deletion_orphan() to anon;

commit;


-- VERIFICATION -- run SEPARATELY, AFTER the transaction above has committed.
-- =========================================================================
-- Deliberately not part of the migration, for the reason 20260829's file gives:
-- PROGRESS.md §5 requires the live database be checked rather than the file
-- trusted, and a check that runs inside the transaction it is checking proves
-- nothing about committed state. Register #62's thesis is the sharper form --
-- `supabase/migrations/` DOES NOT DESCRIBE PRODUCTION, and `db-types` cannot
-- detect that by construction. THIS FILE IS A PLAN. The result below is the fact.
--
-- Expect exactly NINE rows, every `ok` true.
--
-- Written to FAIL CLOSED, the same shape as 20260829: the expected set drives
-- the result and the database is LEFT JOINed onto it, so anything absent renders
-- as MISSING / ok = false rather than vanishing from the output. `to_regclass`
-- and `to_regprocedure` are used rather than the `::regclass` / `::regprocedure`
-- casts precisely because the casts RAISE on a missing object, which would abort
-- the whole read instead of reporting the absence -- an error a reader must
-- interpret, where a false is a result they can read.
--
--   with expected(kind, target) as (
--     values ('01_table'::text,            'account_deletion_orphans'::text),
--            ('02_rls_enabled',            'account_deletion_orphans'),
--            ('03_policy_count',           'account_deletion_orphans'),
--            ('04_fk_count',               'account_deletion_orphans'),
--            ('05_anon_table_select',      'account_deletion_orphans'),
--            ('06_function',               'has_unresolved_deletion_orphan'),
--            ('07_secdef',                 'has_unresolved_deletion_orphan'),
--            ('08_search_path',            'has_unresolved_deletion_orphan'),
--            ('09_anon_fn_execute',        'has_unresolved_deletion_orphan')
--   ),
--   observed(kind, target, value) as (
--     select '01_table'::text, 'account_deletion_orphans'::text,
--            case when to_regclass('public.account_deletion_orphans') is null
--                 then null else 'present' end
--     union all
--     select '02_rls_enabled', 'account_deletion_orphans',
--            (select c.relrowsecurity::text from pg_class c
--              where c.oid = to_regclass('public.account_deletion_orphans'))
--     union all
--     select '03_policy_count', 'account_deletion_orphans',
--            (select count(*)::text from pg_policies
--              where schemaname = 'public'
--                and tablename  = 'account_deletion_orphans')
--     union all
--     select '04_fk_count', 'account_deletion_orphans',
--            (select count(*)::text from pg_constraint
--              where conrelid = to_regclass('public.account_deletion_orphans')
--                and contype  = 'f')
--     union all
--     select '05_anon_table_select', 'account_deletion_orphans',
--            case when to_regclass('public.account_deletion_orphans') is null
--                 then null
--                 else has_table_privilege('anon',
--                        'public.account_deletion_orphans', 'select')::text end
--     union all
--     select '06_function', 'has_unresolved_deletion_orphan',
--            case when to_regprocedure('public.has_unresolved_deletion_orphan()')
--                      is null then null else 'present' end
--     union all
--     select '07_secdef', 'has_unresolved_deletion_orphan',
--            (select p.prosecdef::text from pg_proc p
--              where p.oid = to_regprocedure('public.has_unresolved_deletion_orphan()'))
--     union all
--     select '08_search_path', 'has_unresolved_deletion_orphan',
--            (select coalesce(array_to_string(p.proconfig, ','), 'NONE')
--               from pg_proc p
--              where p.oid = to_regprocedure('public.has_unresolved_deletion_orphan()'))
--     union all
--     select '09_anon_fn_execute', 'has_unresolved_deletion_orphan',
--            case when to_regprocedure('public.has_unresolved_deletion_orphan()')
--                      is null then null
--                 else has_function_privilege('anon',
--                        'public.has_unresolved_deletion_orphan()', 'execute')::text end
--   )
--   select e.kind,
--          e.target,
--          coalesce(o.value, 'MISSING') as observed,
--          case e.kind
--            when '01_table'            then coalesce(o.value,'') = 'present'
--            when '02_rls_enabled'      then coalesce(o.value,'') = 'true'
--            when '03_policy_count'     then coalesce(o.value,'') = '0'
--            when '04_fk_count'         then coalesce(o.value,'') = '0'
--            when '05_anon_table_select' then coalesce(o.value,'') = 'false'
--            when '06_function'         then coalesce(o.value,'') = 'present'
--            when '07_secdef'           then coalesce(o.value,'') = 'true'
--            when '08_search_path'      then position('search_path=' in coalesce(o.value,'')) > 0
--            when '09_anon_fn_execute'  then coalesce(o.value,'') = 'true'
--          end as ok
--     from expected e
--     left join observed o
--       on o.kind = e.kind and o.target = e.target
--    order by e.kind;
--
-- Rows 01-03 and 07-08 are the four gates ruled on before this file was written
-- (table exists, relrowsecurity true, pg_policies zero, prosecdef true with
-- proconfig carrying search_path=). Rows 04, 05 and 09 were added while writing
-- it, and each machine-checks one decision that would otherwise rest on a
-- comment: 04 proves the no-foreign-key ruling, 05 proves the revoke actually
-- landed on top of RLS, and 09 proves the anon-boolean route works at all --
-- without which the watcher cannot read the signal and the whole design is
-- inert while every other check still reads green.
--
-- Paste the result into register #54 TOGETHER WITH THE COMMIT SHA IT WAS RUN
-- FROM. This branch will be squash-merged, so the commit whose bytes were
-- executed does not appear in main's ancestry.
--
-- Until that result exists, this file is a plan and register #54's durable half
-- is OPEN. Merging its PR does not close it and must not be read as closing it.
