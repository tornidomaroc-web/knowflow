-- The sample file (audit cause 9, docs/plans/sample-file.md section 4): one
-- boolean on the document row.
--
-- /api/sample creates one ready document per student from committed text and
-- embeddings and marks it with this column. Two readers use it:
--   * the day's uploads (src/lib/upload-allowance.ts, keptUploadsToday) do not
--     count a row where it is true, so the sample never uses one of the 5;
--   * /api/sample itself, to answer "you already have it" without creating a
--     second one, and Ask, to offer the ready question in that subject.
--
-- The plan's approved statement was
--
--   alter table public.documents
--     add column is_sample boolean not null default false;
--
-- and this file keeps exactly that column, written so it can be re-run:
-- `add column if not exists`, as 20261103_documents_page_counts.sql does.
--
-- ADDITIVE ONLY. A NOT NULL column with a constant default is a
-- catalogue-only change on Postgres 11 and later (no table rewrite): every
-- existing row reads false, and every insert that does not name the column
-- (the upload route, the ingestion service) writes false.
--
-- NO NEW POLICY OR GRANT. The existing "Users can manage own documents"
-- policy covers the column. What it does NOT protect, as the plan states: a
-- student can write their own document rows, so they could set is_sample on a
-- real upload and free one of the day's 5 places, as they can today by
-- setting status to 'error'. Both are bounded by the atomic attempt ceiling
-- (increment_usage), which this change does not touch.
--
-- APPLIED BY HAND, BEFORE THE CODE MERGES (docs/plans/sample-file.md,
-- section 11, with the verify query).

alter table public.documents
  add column if not exists is_sample boolean not null default false;

comment on column public.documents.is_sample is
  'True for the one sample file /api/sample creates. Not counted in the day''s uploads (src/lib/upload-allowance.ts).';
