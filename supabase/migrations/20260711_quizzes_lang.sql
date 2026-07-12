-- Phase 4 / register #31 (per-language quizzes): give `quizzes` a `lang` column
-- and move generate-once from `unique (document_id)` to `unique (document_id, lang)`,
-- so one document can hold an Arabic quiz AND an English quiz — each language its
-- own immutable generate-once row, never a regenerate or overwrite of the other
-- (register #26's no-regenerate rule is preserved, not weakened).
--
-- ⚠️ THIS MIGRATION RECORDS A SCHEMA CHANGE THAT WAS ALREADY APPLIED LIVE,
--    OUT OF BAND, ON 2026-07-11 — the repo did not have it. This is a REGISTER #23
--    RECURRENCE with the polarity reversed: #23 was the live DB running BEHIND the
--    repo's migrations; here the live DB ran AHEAD of them. PR #43 (merge `38e57a2`)
--    shipped `/api/quiz/generate` keyed on `(document_id, lang)` — it selects
--    `.eq('lang', lang)` and inserts `lang` — but committed NO migration, so a
--    rebuild from `supabase/migrations/` produced a `quizzes` table with no `lang`
--    column and a still-live `unique (document_id)` that ACTIVELY FORBIDS a second
--    language. Repo and live have been out of sync since. This file closes that gap.
--
-- Because the live DB ALREADY has every object below, this migration is written to
-- be a CLEAN NO-OP when re-run there, while still being the correct from-scratch
-- transform on an empty rebuild. It is a PLAN — Abo Jad applies/re-runs it manually
-- and verifies the live DB matches after (standing rule §5).
--
-- ✅ CONSTRAINT NAMES VERIFIED 2026-07-12 AGAINST THE LIVE DB (Abo Jad). The
--    `drop constraint if exists` guards below match on NAME, so a name mismatch would
--    make the drop silently miss and the add create a SECOND, redundant unique
--    constraint — no error, but a duplicate index. That hole DOES NOT APPLY here: the
--    live names match this file exactly (`quizzes_lang_valid`,
--    `quizzes_document_id_lang_unique`), because the constraints were created through
--    the SQL editor with explicit names rather than letting Postgres auto-name them
--    (which would have produced `quizzes_document_id_lang_key`). Live also has
--    `lang text not null default 'ar'::text` and NO `quizzes_document_id_unique` —
--    so re-running this file against live is a confirmed clean idempotent no-op.
--
--    On any environment whose provenance is UNKNOWN (a fresh project, a restore, a DB
--    someone else migrated), re-run this check before applying — the guarantee above
--    is about OUR live DB, not about Postgres in general:
--
--      select conname, contype, pg_get_constraintdef(oid)
--      from pg_constraint where conrelid = 'quizzes'::regclass order by conname;
--
-- Named `..._quizzes_lang` and dated 20260711 so it sorts AFTER both the table-creating
-- `20260708_quizzes.sql` and `20260708_quizzes_is_partial.sql` (and after
-- `20260710_current_streak.sql`) on a clean from-scratch apply — the same
-- sorts-after-its-table trap `20260708_quizzes_is_partial.sql` documents.

-- 1. The language this quiz's questions are written in. ADDITIVE + IDEMPOTENT
--    (`add column if not exists`), mirroring `quizzes.is_partial` in
--    20260708_quizzes_is_partial.sql. Default 'ar' so any pre-existing row is
--    well-defined and the column can be NOT NULL in one statement; the route always
--    supplies `lang` explicitly (fail-closed whitelist to 'ar'|'en' server-side), so
--    the default is a backfill device, never the live write path.
alter table quizzes
  add column if not exists lang text not null default 'ar';

-- 2. Fail-closed value guard, matching the route's server-side whitelist exactly.
--    Postgres has no `add constraint if not exists`, and this repo has no DO-block
--    precedent, so idempotency is drop-then-add: dropping a constraint that isn't
--    there is a no-op, and re-adding it is deterministic. Re-running against live
--    re-validates the existing rows — which is a FEATURE: if any live row somehow
--    holds a lang outside ('ar','en'), this ERRORS rather than silently accepting it.
alter table quizzes drop constraint if exists quizzes_lang_valid;
alter table quizzes
  add constraint quizzes_lang_valid check (lang in ('ar', 'en'));

-- 3. Retire the old single-column generate-once key. This is the statement that
--    matters most on a from-scratch rebuild: `20260708_quizzes.sql` still declares
--    `constraint quizzes_document_id_unique unique (document_id)`, which would make
--    the second language's INSERT fail with 23505 forever. On live it is already
--    gone (two rows, lang='ar' + lang='en', coexist for one document), so this is a
--    no-op there.
alter table quizzes drop constraint if exists quizzes_document_id_unique;

-- 4. Generate-once, now PER LANGUAGE. Same drop-then-add idempotency as (2). The
--    route depends on this: a 23505 from the quizzes insert is how it detects a
--    concurrent generation for the same (document, language) and falls back to the
--    cached row instead of paying for a second Claude call.
alter table quizzes drop constraint if exists quizzes_document_id_lang_unique;
alter table quizzes
  add constraint quizzes_document_id_lang_unique unique (document_id, lang);
