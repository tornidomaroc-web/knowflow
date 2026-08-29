-- Ownership-spine constraints: SET NOT NULL on the five spine links, and rebuild
-- conversations_user_id_fkey with ON DELETE CASCADE.
--
-- Register #62 (docs/PROGRESS.md §4). This is a PRODUCTION REPAIR, not a schema
-- change. Read the next two blocks before concluding the file does nothing.
--
--
-- WHY THIS FILE LOOKS LIKE A NO-OP, AND IS NOT
-- --------------------------------------------
-- Applied to a database built from this folder, every statement below IS a
-- no-op. 001_initial_schema.sql already declares all five columns `not null`.
-- The owner-run live read of 2026-08-24 (register #62) found production
-- declaring all five NULLABLE. The repository has said `not null` since April
-- and has been wrong about it since April.
--
-- So this file does not change what the repository claims. It changes what
-- PRODUCTION enforces, and it lives in the folder so the repair is reviewable,
-- attributable and dated -- not so that a rebuild-from-scratch behaves
-- differently. A rebuild is identical with or without it.
--
-- The one thing the folder therefore CANNOT tell you is whether this was ever
-- applied. That is register #62's whole finding, and the standing rule in
-- PROGRESS.md §5 is the counterweight: A MIGRATION FILE IS A PLAN, NOT A FACT.
-- The verification query at the bottom of this file is the fact. Run it.
--
--
-- WHY THE TWO REPAIRS SHIP TOGETHER
-- ---------------------------------
-- They are not independent, and neither is sufficient on its own:
--
--   1. A cascade only fires along a NON-NULL foreign key. A row whose spine
--      link is NULL is unreachable from any user, survives account deletion
--      with its children, and -- because RLS keys on the same chain, where NULL
--      evaluates to NULL rather than true -- is invisible to everyone,
--      permanently, while containing user content.
--
--   2. conversations.user_id -> profiles is the only NO ACTION foreign key in
--      `public`. Deleting an account cascades auth.users -> profiles (live
--      CASCADE), and that profiles delete is then checked against this NO
--      ACTION reference. It does not block TODAY only because the kb_id cascade
--      has already removed the conversation rows first.
--
-- Combine the two and the interaction is the real hazard: a conversation with
-- kb_id IS NULL is NOT removed by the kb_id cascade, so the profiles delete
-- hits a live NO ACTION reference and raises a foreign key violation. Account
-- deletion fails outright, and no application code can rescue it. Fixing the
-- nullability without the delete rule leaves the unreachable-row hazard in (1);
-- fixing the delete rule without the nullability leaves that failure reachable
-- from any row written before this migration lands.
--
--
-- PRECONDITION, MEASURED RATHER THAN ASSUMED
-- ------------------------------------------
-- A NULL census and an orphan census were run live (2026-08-24, re-run
-- 2026-08-29) and returned ZERO on all five links in both directions: no NULLs,
-- and no non-null value pointing at a missing parent. No data repair is owed.
--
-- That measurement is POINT-IN-TIME and this migration is not. The columns
-- still accept a NULL until the moment these ALTERs commit. If a NULL is
-- written in the interval, SET NOT NULL raises and the whole transaction
-- aborts -- which is the correct outcome, and the failure is a FINDING, NOT A
-- FLAKE. Do not re-run it hoping for a different result: a failure here means a
-- row with a broken ownership link now exists in production and has to be found
-- and resolved before this is attempted again.
--
--
-- WHY ONE TRANSACTION, EXPLICITLY
-- -------------------------------
-- Between the DROP and the ADD there is NO foreign key on conversations.user_id
-- at all. If those two statements can be separated by a failure, production is
-- left with an unenforced ownership link and nothing in the repository records
-- that it happened. Postgres would in fact wrap a multi-statement simple query
-- in an implicit transaction, but relying on that makes the submission method
-- load-bearing while looking cosmetic: it holds in the SQL editor and stops
-- holding the moment someone pastes these statements one at a time. The BEGIN
-- and COMMIT below are explicit so atomicity does not depend on the client.
--
-- If the client has already opened a transaction, BEGIN emits
--   WARNING:  there is already a transaction in progress
-- That warning is expected here and is not a failure.
--
-- The foreign key is added VALIDATED in the same transaction rather than as NOT
-- VALID followed by VALIDATE CONSTRAINT. That split exists to avoid holding a
-- long lock on a large table; `conversations` holds 17 rows, so it would buy
-- nothing and would cost the atomicity argued for above.

begin;

-- Fail fast rather than queue behind an open transaction. Every statement here
-- takes ACCESS EXCLUSIVE, and a blocked ALTER blocks every subsequent read of
-- the table queued behind it. Being told to try again beats an unbounded wait
-- that looks, from the application side, exactly like an outage.
set local lock_timeout = '5s';

-- The five ownership-spine links (register #62, second cell).
alter table public.knowledge_bases alter column user_id         set not null;
alter table public.documents       alter column kb_id           set not null;
alter table public.conversations   alter column kb_id           set not null;
alter table public.conversations   alter column user_id         set not null;
alter table public.messages        alter column conversation_id set not null;

-- The only NO ACTION foreign key in `public`.
--
-- Dropped WITHOUT `if exists`, deliberately. The constraint name is an
-- assumption -- verified live on 2026-08-29, and generated by Postgres from the
-- inline reference in 001_initial_schema.sql -- and `if exists` would turn a
-- wrong assumption from a loud abort into a silent no-op followed by ADD
-- creating a SECOND, duplicate foreign key. Let it fail.
--
-- Re-added under the same name, so the live constraint set is unchanged apart
-- from its delete rule and a later read matches what register #62 recorded.
alter table public.conversations drop constraint conversations_user_id_fkey;

alter table public.conversations
  add constraint conversations_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

commit;


-- VERIFICATION -- run SEPARATELY, AFTER the transaction above has committed.
-- =========================================================================
-- Deliberately not part of the migration. PROGRESS.md §5 requires the live
-- database be checked rather than the file trusted, and a check that runs
-- inside the transaction it is checking proves nothing about committed state.
-- Expect exactly ELEVEN rows, every `ok` true.
--
-- IT CHECKS ALL SIX SPINE FOREIGN KEYS, NOT THE ONE THIS FILE REBUILDS. That is
-- deliberate and it is the correction of an earlier, narrower version of this
-- query. The migration changes one delete rule, but the property the migration
-- EXISTS for -- that deleting an account cascades cleanly from auth.users down
-- to messages -- rests on a chain of six links. Verifying the one link this
-- file touched and carrying the other five from a read taken at some earlier
-- hour would leave six fresh facts and five remembered ones interleaved in one
-- dependency chain with nothing marking which is which. That is register #62 in
-- miniature, and it is what produced the near-miss the register was opened for.
-- Re-reading all six costs one query.
--
-- It is written to FAIL CLOSED. The expected set drives the result and the
-- database is LEFT JOINed onto it, so a constraint that is absent -- a DROP
-- whose ADD never ran -- renders as `MISSING` / `ok = false` rather than
-- vanishing from the output. A shorter result set that a reader has to notice
-- by counting is exactly the wrong-result-passing-as-green shape this repo has
-- closed twice (registers #40, #52).
--
--   with expected(kind, target) as (
--     values ('nullability'::text, 'knowledge_bases.user_id'::text),
--            ('nullability', 'documents.kb_id'),
--            ('nullability', 'conversations.kb_id'),
--            ('nullability', 'conversations.user_id'),
--            ('nullability', 'messages.conversation_id'),
--            ('delete_rule', 'profiles_id_fkey'),
--            ('delete_rule', 'knowledge_bases_user_id_fkey'),
--            ('delete_rule', 'documents_kb_id_fkey'),
--            ('delete_rule', 'conversations_kb_id_fkey'),
--            ('delete_rule', 'conversations_user_id_fkey'),
--            ('delete_rule', 'messages_conversation_id_fkey')
--   ),
--   observed(kind, target, value) as (
--     select 'nullability'::text,
--            (table_name || '.' || column_name)::text,
--            is_nullable::text
--       from information_schema.columns
--      where table_schema = 'public'
--     union all
--     select 'delete_rule'::text,
--            conname::text,
--            confdeltype::text
--       from pg_constraint
--      where connamespace = 'public'::regnamespace
--        and contype = 'f'
--   )
--   select e.kind,
--          e.target,
--          coalesce(o.value, 'MISSING') as observed,
--          case e.kind
--            when 'nullability' then coalesce(o.value, '') = 'NO'
--            else                    coalesce(o.value, '') = 'c'
--          end as ok
--     from expected e
--     left join observed o
--       on o.kind = e.kind and o.target = e.target
--    order by e.kind, e.target;
--
-- confdeltype 'c' is CASCADE, 'a' is NO ACTION. Five of the six delete rules
-- were already CASCADE before this migration and are re-read here rather than
-- assumed; only `conversations_user_id_fkey` is changed by the file above.
--
-- Paste the result into register #62 TOGETHER WITH THE COMMIT SHA IT WAS RUN
-- FROM. This branch is squash-merged, so the commit whose bytes were executed
-- does not appear in main's ancestry and "which SQL did I actually run" should
-- not have to be inferred later.
--
-- Until that result exists, this file is a plan and #62's spine item is OPEN.
-- Merging the PR does not close it and must not be read as closing it.
