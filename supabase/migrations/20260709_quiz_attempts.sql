-- Phase 4 (P4.2): quiz attempts — the record of a graded submission.
--
-- Context. P4.2 originally withheld `correct_index` from the grading response on
-- the theory that revealing it would leak the answer key across repeated
-- submissions. That theory did not survive review: the per-item `is_correct`
-- flags are THEMSELVES the oracle. With at most 5 options, submitting index 0 for
-- every item, then 1, then 2, then 3, exposes the whole key in at most four
-- requests (anything still unmatched is 4 by elimination). Hiding `correct_index`
-- moved extraction from one request to four; it never prevented it.
--
-- Because RLS scopes every submission to the caller's OWN quiz over their OWN
-- document, a student doing this is cheating themselves at their own study
-- material — there is no cross-user exposure and no second party defrauded. The
-- cost is PEDAGOGICAL, not security. So the decision (Abo Jad, 2026-07-09) is to
-- stop pretending: allow multiple attempts, and reveal the correct answers from
-- the FIRST submission onward, because feedback is where the learning happens.
--
-- This table exists to RECORD attempts, not to gate them. Nothing in the P4.2
-- route reads it; the insert is bookkeeping and a failed insert must never fail a
-- student's already-computed grade.
--
-- Keyed to `quiz_id`, NOT `document_id` (register #28): the taking layer stays
-- quiz-keyed so a future KB-level ("whole subject") study session composed of
-- per-document quizzes remains ONE additive migration away rather than a rework.
--
-- Score/total only — deliberately NO per-item answer persistence. Storing each
-- selected_index would be a larger surface (and a second answer-shaped table) for
-- a capability nothing needs yet. Revisit only when a real feature (per-question
-- progress, "you keep missing Q3") demands it.
--
-- This file is a PLAN, not a fact. Abo Jad applies it manually in the Supabase SQL
-- editor and then VERIFIES the live DB matches via information_schema — the
-- standing rule from register #23 (a written migration file is never an applied
-- one). Named `20260709_...` so it sorts AFTER both 20260708_quizzes.sql (which
-- creates `quizzes`) and 20260708_quizzes_is_partial.sql on a clean from-scratch
-- apply; this table's FK requires `quizzes` to exist first.
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  score int not null,
  total int not null,
  created_at timestamptz default now(),

  -- Integrity CHECKs (RLS guards ownership, not validity — these guard validity).
  -- `total > 0` is not merely cosmetic: the P4.2 route refuses to grade a quiz
  -- with zero items (409, register #30's orphan-quiz window), so a persisted
  -- 0-of-0 attempt would mean the route's guard had been bypassed. The DB says so
  -- too, rather than trusting the route to stay correct.
  constraint quiz_attempt_score_non_negative check (score >= 0),
  constraint quiz_attempt_total_positive check (total > 0),
  constraint quiz_attempt_score_within_total check (score <= total)
);

-- Ownership is resolved THREE hops up (quiz_attempt.quiz_id → quizzes.document_id
-- → documents.kb_id → knowledge_bases.user_id) — the identical depth-chain shape
-- already used by the "Users can manage own quiz_items" policy in
-- 20260708_quizzes.sql. No user_id column: the chain is the single source of
-- ownership truth, exactly as for quizzes and quiz_items.
alter table quiz_attempts enable row level security;
create policy "Users can manage own quiz_attempts" on quiz_attempts for all using (
  auth.uid() = (
    select user_id from knowledge_bases
    where id = (
      select kb_id from documents
      where id = (select document_id from quizzes where id = quiz_id)
    )
  )
);

-- Attempts are read back per quiz, newest first, whenever a history view is built
-- (P4.3 or later). Index the FK so that read does not seq-scan as attempts grow.
create index quiz_attempts_quiz_id_created_at_idx
  on quiz_attempts (quiz_id, created_at desc);
