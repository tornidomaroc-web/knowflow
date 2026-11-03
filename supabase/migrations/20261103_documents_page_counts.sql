-- Option C (no OCR), the schema half of PR #297: a PDF's page count and how
-- many of its pages have no text, stored on the document row.
--
-- The ingestion service counts them per upload (services/ingestion/main.py,
-- _pdf_page_counts: a page has text when it holds at least 10 letters) and
-- writes them with a separate best-effort update after the ready write
-- (_record_pages). Until these columns exist that update is refused by
-- PostgREST and logged; the upload is unchanged. Once they exist, the subject
-- page (select('*')) reads them and the material card shows "N of M pages
-- have no text" after a reload too, not only right after the upload.
--
-- Approved by the owner on 2026-11-03. The approved statement was
--
--   alter table public.documents
--     add column pages_total integer check (pages_total >= 0),
--     add column pages_no_text integer check (pages_no_text >= 0 and pages_no_text <= pages_total);
--
-- and this file keeps exactly its columns and its two checks, written in a
-- form that can be re-run and has known names:
--   * `add column if not exists`, as 20260501_rag_pgvector.sql and
--     20260705_document_summaries.sql do, so a second run adds nothing.
--   * The checks are NAMED table constraints (documents_pages_total_check,
--     documents_pages_no_text_check) instead of inline column checks, whose
--     names Postgres would choose. A known name is what the verify query
--     below reads and what a later change would drop. The second check
--     compares two columns, which is a table constraint by nature.
--   * `drop constraint if exists` before each `add constraint`, in the same
--     statement, so a re-run replaces each check with itself.
--
-- ADDITIVE ONLY. Both columns are nullable with no default: adding them is a
-- catalogue-only change (no table rewrite), every existing row reads NULL,
-- and the app treats NULL as "not counted" (src/lib/material-text.ts,
-- pagesWithoutText), so every existing material shows exactly as before.
-- A NULL in either column passes both checks (a CHECK fails only on false).
--
-- NO NEW POLICY OR GRANT. The existing "Users can manage own documents"
-- policy covers the new columns, and `authenticated` holds table-level
-- select/insert/update/delete on documents (scripts/verify-public-grants.mjs),
-- which the service's write (as the uploading user) needs.
--
-- One transaction: either both columns and both checks exist, or nothing
-- changed. If the client has already opened a transaction, BEGIN emits
--   WARNING:  there is already a transaction in progress
-- which is expected and is not a failure.

begin;

alter table public.documents
  add column if not exists pages_total integer,
  add column if not exists pages_no_text integer;

alter table public.documents
  drop constraint if exists documents_pages_total_check,
  add constraint documents_pages_total_check
    check (pages_total >= 0),
  drop constraint if exists documents_pages_no_text_check,
  add constraint documents_pages_no_text_check
    check (pages_no_text >= 0 and pages_no_text <= pages_total);

comment on column public.documents.pages_total is
  'Pages in this PDF, counted by the ingestion service at upload (Option C, PR #297). NULL for any file that is not a PDF, for a PDF that could not be counted, and for every row stored before 2026-11-03.';
comment on column public.documents.pages_no_text is
  'Pages of this PDF with no text (fewer than 10 letters), counted with pages_total. NULL whenever pages_total is NULL.';

commit;


-- ===========================================================================
-- VERIFY -- read-only, run after the migration. Nothing below runs when the
-- file is applied; every line is a comment.
-- ===========================================================================
--
-- select c.column_name, c.data_type, c.is_nullable, c.column_default,
--        (select string_agg(k.conname || ': ' || pg_get_constraintdef(k.oid), '; ' order by k.conname)
--           from pg_constraint k
--          where k.conrelid = 'public.documents'::regclass
--            and k.conname in ('documents_pages_total_check', 'documents_pages_no_text_check')) as checks
--   from information_schema.columns c
--  where c.table_schema = 'public' and c.table_name = 'documents'
--    and c.column_name in ('pages_total', 'pages_no_text')
--  order by c.column_name;
--
-- Expected: two rows, pages_no_text and pages_total, each `integer`, `YES`,
-- default NULL, and on each row the same `checks` text:
--   documents_pages_no_text_check: CHECK (((pages_no_text >= 0) AND (pages_no_text <= pages_total)));
--   documents_pages_total_check: CHECK ((pages_total >= 0))
