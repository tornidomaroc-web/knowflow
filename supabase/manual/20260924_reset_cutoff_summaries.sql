-- Register #114: summaries saved cut off before the fix. NOT A MIGRATION.
--
-- This file is deliberately outside supabase/migrations/ and is not listed in
-- migration-order.txt. It changes data, not schema, and must never replay on a
-- fresh database. The owner runs it by hand in the Supabase SQL editor, the same
-- route the 2026-07 P3 verification used to null a summary (PROGRESS.md section 4,
-- row 44). NOTHING HERE HAS BEEN RUN.
--
-- WHY IT IS NEEDED. The fix stops new cut-off summaries from being saved. It does
-- not repair old ones: a stored summary is returned as-is forever (register #26,
-- generate-once with no regenerate path), so a student holding a cut-off summary
-- can never get a whole one unless the row is reset. Resetting brings the
-- "Summarize this material" button back. The next generation costs the student
-- one daily summary credit and us about $0.02 for a document of that size.
--
-- WHY THE DATABASE CANNOT SAY WHICH ROWS ARE CUT OFF. `documents` stores the
-- text, time, model and `summary_is_partial` (which means the INPUT was capped,
-- not the output). No stop reason is stored. The `kf-usage` line for summaries
-- only exists since 08cce1a (#185, 2026-09-23), and Vercel Hobby keeps logs for
-- one hour, so the logs cannot name them either. What remains is the text itself:
-- a summary cut at the old 1,024-token ceiling stops mid-sentence, and its length
-- sits near that ceiling (about 1,600 characters in Arabic, about 4,000+ in
-- English).
--
-- STEP 1 -- READ ONLY. Lists every stored summary that does not end on sentence
-- punctuation, with its length and last 60 characters, so each can be judged by
-- eye. It changes nothing.

select
  d.id,
  d.filename,
  d.summary_generated_at,
  length(d.summary)      as summary_chars,
  right(d.summary, 60)   as summary_tail
from documents d
where d.summary is not null
  and d.summary !~ '[.!?؟…"»)\]]\s*$'
order by d.summary_generated_at;

-- For scale, the number of stored summaries of any kind (the most there can be):
select count(*) as stored_summaries from documents where summary is not null;

-- STEP 2 -- WRITES. Resets only the rows named in the list, never a pattern. The
-- one row known for certain is the 2026-09-24 measurement's Arabic summary of
-- "مبادئ-الاقتصاد-الجزئي.md" (subject abojad007): its kf-usage line recorded
-- stop_reason "max_tokens" and it ends mid-word ("إذا كانت المرونة أك"). Add any
-- other id from STEP 1 only after reading its tail. `summary is not null` makes a
-- second run a no-op; `returning` shows exactly what changed.
--
-- begin;
-- update documents
--    set summary = null,
--        summary_generated_at = null,
--        summary_model = null,
--        summary_is_partial = false
--  where id in (
--          'c4be038f-c330-427e-872b-ea627340df91'
--        )
--    and summary is not null
-- returning id, filename;
-- commit;
