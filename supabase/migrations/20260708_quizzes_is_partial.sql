-- Phase 4 (P4.1 follow-up): persist whether a generated quiz covered only the
-- FIRST PART of a long document, so a cached read reports it truthfully instead
-- of always assuming false.
--
-- Named `..._quizzes_is_partial` (NOT `..._quiz_is_partial`) on purpose: migrations
-- apply in lexicographic filename order, and `quizzes.sql` < `quizzes_is_partial.sql`,
-- so this ALTER sorts AFTER the table-creating `20260708_quizzes.sql` on a clean
-- from-scratch apply. (`quiz_is_partial` would have sorted BEFORE it — the ALTER
-- would run against a table that doesn't exist yet.)
--
-- ADDITIVE + IDEMPOTENT (`add column if not exists`), mirroring exactly the
-- `usage_counters.quiz_count` add in 20260708_quizzes.sql. No new RLS policy: the
-- existing "Users can manage own quizzes" policy already covers the new column
-- (select/update by document→kb→user ownership). Default false so every existing
-- row is well-defined. This is a PLAN — Abo Jad applies it manually and verifies
-- the live DB matches after (standing rule §5).
alter table quizzes
  add column if not exists is_partial boolean not null default false;
