-- Register #137, PR A of three: dead write grants and `anon`.
--
-- WHAT THIS DOES, IN FOUR PARTS.
--
--   (1) `waitlist`, `usage_counters`, `study_events` lose INSERT, UPDATE and
--       DELETE for BOTH API roles. No application path writes any of the three
--       as `anon` or `authenticated`: `usage_counters` and `study_events` are
--       written only by the SECURITY DEFINER functions `increment_usage` and
--       `record_study_event` (owner `postgres`; a REVOKE on the table does not
--       touch a definer), reached from `src/lib/rate-limit.ts` and
--       `src/lib/study-events.ts` by `.rpc(...)`, and `waitlist` has had no
--       writer but the account-deletion DELETE as `service_role`
--       (`src/lib/account-deletion/orchestrate.ts`) since `2234aa0` on
--       2026-07-01. Row security already refused every direct client write to
--       the three (no INSERT/UPDATE/DELETE policy on the two ledgers; see
--       `20260629_usage_counters.sql`, `20260709_study_events.sql`); this takes
--       the privilege away as well, so no future policy can hand it back, the
--       posture `20261004_subscriptions_revoke_writes.sql` set for billing.
--
--   (2) `anon` loses INSERT, UPDATE and DELETE on every other table of ours in
--       `public`: `profiles`, `knowledge_bases`, `documents`, `conversations`,
--       `messages`, `chunks`, `quizzes`, `quiz_items`. Every policy on those
--       tables tests `auth.uid()`, which is NULL for `anon`, so `anon` has
--       never been able to write a row; the grant was Supabase's default and
--       nothing else. `subscriptions` and `account_deletion_orphans` already
--       carry this (`20261004`, `20260904`) and are not named here. The
--       Railway ingestion service writes `documents` and `chunks` with the
--       student's forwarded JWT, i.e. as `authenticated`, never as `anon`
--       (`services/ingestion/main.py`, `_user_client`: it refuses a request
--       without `X-Supabase-Token`), and every Next.js route that writes calls
--       `auth.getUser()` and answers 401 before its first write.
--       `authenticated` keeps every verb it holds today on these eight tables;
--       the unused ones are PR B.
--
--   (3) The policy `Anyone can join waitlist` (`003_waitlist.sql`, `FOR INSERT
--       WITH CHECK (true)`) is dropped. With (1) it permits nothing a grant
--       would let through, and keeping an open-INSERT policy on a table nobody
--       inserts into is the kind of thing a future GRANT would re-arm.
--
--   (4) PRODUCTION REPAIR, a no-op on a database built from this folder: the
--       five policies production carries that no migration ever wrote
--       (`docs/db-grants-audit-137.md` §1.1, read 2026-10-05) are dropped with
--       `if exists`, so the live schema and the repository agree. Each was a
--       second permissive `FOR ALL` policy testing the same ownership as the
--       repository's `Users can manage own ...` twin on the same table;
--       permissive policies combine with OR, so dropping the duplicate leaves
--       every row exactly as readable and writable as before.
--
-- WHAT IT DOES NOT DO. SELECT is untouched everywhere. `service_role` and
-- `postgres` are untouched. TRUNCATE, REFERENCES, TRIGGER and MAINTAIN stay as
-- they are (PostgREST exposes none of them; the API roles cannot log in). No
-- `authenticated` verb moves on the eight tables of (2) (PR B). Default
-- privileges, `profiles`, and EXECUTE from PUBLIC on the functions are PR C.
--
-- PRODUCTION BASELINE, read in the SQL editor on 2026-10-07 at ~07:10Z with
-- `scripts/sql/read-public-grants.sql` (as `postgres`), immediately before this
-- file is applied, and byte-identical to the audit's read of 2026-10-05
-- (`docs/db-grants-audit-137.md` §8): no grant, policy, owner or RLS flag moved
-- in between. The eleven tables named here, every one owner `postgres`, RLS on,
-- not forced, relacl:
--   {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- The six policies this file drops, exactly as pg_policies rendered them live
-- (cmd / permissive / roles / USING / WITH CHECK; `-` is NULL):
--   waitlist        | Anyone can join waitlist | INSERT | PERMISSIVE | public | using=- | check=true
--   profiles        | Users own profile        | ALL | PERMISSIVE | public | using=(auth.uid() = id) | check=-
--   knowledge_bases | Users own KBs            | ALL | PERMISSIVE | public | using=(auth.uid() = user_id) | check=-
--   conversations   | Users own conversations  | ALL | PERMISSIVE | public | using=(auth.uid() = user_id) | check=-
--   documents       | Users own documents      | ALL | PERMISSIVE | public | using=(kb_id IN ( SELECT knowledge_bases.id FROM knowledge_bases WHERE (knowledge_bases.user_id = auth.uid()))) | check=-
--   messages        | Users own messages       | ALL | PERMISSIVE | public | using=(conversation_id IN ( SELECT conversations.id FROM conversations WHERE (conversations.user_id = auth.uid()))) | check=-
-- No column-level ACL on any table, no non-internal trigger on any of the
-- eleven, no view, no sequence in public.
--
-- ROLLBACK, restoring that baseline exactly: the letters a, w, d on the roles
-- named, and the six policies recreated with the bodies above (no TO clause
-- is `roles=public`; FOR ALL with USING alone renders `check=-`, as live):
--   grant insert, update, delete on table public.waitlist, public.usage_counters, public.study_events to anon, authenticated;
--   grant insert, update, delete on table public.profiles, public.knowledge_bases, public.documents, public.conversations, public.messages, public.chunks, public.quizzes, public.quiz_items to anon;
--   create policy "Anyone can join waitlist" on public.waitlist for insert with check (true);
--   create policy "Users own profile" on public.profiles for all using (auth.uid() = id);
--   create policy "Users own KBs" on public.knowledge_bases for all using (auth.uid() = user_id);
--   create policy "Users own conversations" on public.conversations for all using (auth.uid() = user_id);
--   create policy "Users own documents" on public.documents for all using (kb_id IN ( SELECT knowledge_bases.id FROM knowledge_bases WHERE (knowledge_bases.user_id = auth.uid())));
--   create policy "Users own messages" on public.messages for all using (conversation_id IN ( SELECT conversations.id FROM conversations WHERE (conversations.user_id = auth.uid())));
--
-- PROOF. `scripts/verify-public-grants.mjs` (CI job `public-grants`) applies
-- this file with the rest of the manifest on Supabase's own image and asserts
-- the whole grants matrix (13 tables x 3 roles x 4 verbs), the policy set per
-- table, that every write this file forbids answers 42501 through PostgREST,
-- that the two definer functions still write for a signed-in student, and
-- that every verb `authenticated` keeps still works.

-- (1) the three tables nothing writes as an API role
revoke insert, update, delete on table
  public.waitlist, public.usage_counters, public.study_events
from anon, authenticated;

-- (2) anon, everywhere else
revoke insert, update, delete on table
  public.profiles, public.knowledge_bases, public.documents, public.conversations,
  public.messages, public.chunks, public.quizzes, public.quiz_items
from anon;

-- (3) the open anonymous INSERT policy with no caller
drop policy if exists "Anyone can join waitlist" on public.waitlist;

-- (4) production repair: the five hand-made duplicates (absent on a database
-- built from this folder, so `if exists`)
drop policy if exists "Users own profile" on public.profiles;
drop policy if exists "Users own KBs" on public.knowledge_bases;
drop policy if exists "Users own documents" on public.documents;
drop policy if exists "Users own conversations" on public.conversations;
drop policy if exists "Users own messages" on public.messages;
