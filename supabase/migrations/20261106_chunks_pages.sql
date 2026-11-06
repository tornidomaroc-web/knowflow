-- G2, the schema half: the page (PDF) or slide (.pptx) range of each chunk,
-- so Ask can show "p. 12", "pp. 3-4" or "slide 5" on a source pill and the
-- model can name the page it read.
--
-- The ingestion service fills them for every NEW upload
-- (services/ingestion/main.py, _page_layout and _assign_pages): a PDF's
-- chunk gets the pages its text lies on, a .pptx chunk its slides; every
-- other file, and every chunk stored before this change, stays NULL. NO
-- BACKFILL: an old material keeps showing its file name alone until it is
-- uploaded again. Until these columns exist the service's insert with them is
-- refused by PostgREST (PGRST204); the service then inserts the same chunks
-- without them (_persist), so the upload is unchanged.
--
-- Written as 20261103_documents_page_counts.sql was:
--   * `add column if not exists`, so a second run adds nothing;
--   * NAMED table constraints, each dropped if it exists in the same
--     statement that adds it, so a re-run replaces each check with itself and
--     the verify query below can read them by name;
--   * the four checks: page_start is 1 or more; page_end is not before
--     page_start; page_kind is 'page' or 'slide'; and the three columns are
--     all NULL or all set. A NULL passes a CHECK (it fails only on false), so
--     the first three hold for every existing row, and the fourth holds too
--     because every existing row has all three NULL.
--
-- ADDITIVE ONLY. Three nullable columns with no default: a catalogue-only
-- change, no table rewrite. Adding the checks reads every chunk row once to
-- validate them (all NULL), under the table lock, for a moment.
--
-- NO FUNCTION, POLICY OR GRANT CHANGES. match_chunks is NOT redefined (its
-- return type would have to change, which means DROP FUNCTION and the loss of
-- its EXECUTE grants); the Ask route reads the three columns by chunk id with
-- a second select under the existing "Users can read own chunks" policy. The
-- table-level grants on chunks cover new columns
-- (scripts/verify-public-grants.mjs).
--
-- One transaction. If the client has already opened one, BEGIN emits
--   WARNING:  there is already a transaction in progress
-- which is expected and is not a failure.

begin;

alter table public.chunks
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists page_kind text;

alter table public.chunks
  drop constraint if exists chunks_page_start_check,
  add constraint chunks_page_start_check
    check (page_start >= 1),
  drop constraint if exists chunks_page_end_check,
  add constraint chunks_page_end_check
    check (page_end >= page_start),
  drop constraint if exists chunks_page_kind_check,
  add constraint chunks_page_kind_check
    check (page_kind in ('page', 'slide')),
  drop constraint if exists chunks_page_all_or_none_check,
  add constraint chunks_page_all_or_none_check
    check ((page_start is null) = (page_end is null) and (page_start is null) = (page_kind is null));

comment on column public.chunks.page_start is
  'First page (PDF, 1-based physical page) or slide (.pptx, its own number) this chunk''s text lies on, set by the ingestion service at upload (G2). NULL for any other file and for every chunk stored before 2026-11-06.';
comment on column public.chunks.page_end is
  'Last page or slide this chunk''s text lies on; equals page_start when it lies on one. NULL whenever page_start is NULL.';
comment on column public.chunks.page_kind is
  '''page'' (PDF) or ''slide'' (.pptx). NULL whenever page_start is NULL.';

commit;


-- ===========================================================================
-- VERIFY -- read-only, run after the migration. Nothing below runs when the
-- file is applied; every line is a comment.
-- ===========================================================================
--
-- select c.column_name, c.data_type, c.is_nullable, c.column_default,
--        (select string_agg(k.conname || ': ' || pg_get_constraintdef(k.oid), '; ' order by k.conname)
--           from pg_constraint k
--          where k.conrelid = 'public.chunks'::regclass
--            and k.conname like 'chunks_page_%') as checks,
--        (select count(*) from public.chunks x where x.page_start is not null) as rows_with_pages
--   from information_schema.columns c
--  where c.table_schema = 'public' and c.table_name = 'chunks'
--    and c.column_name in ('page_start', 'page_end', 'page_kind')
--  order by c.column_name;
--
-- Expected: three rows, page_end (integer), page_kind (text), page_start
-- (integer), each `YES`, default NULL, rows_with_pages 0 right after the
-- migration, and on each row the same `checks` text:
--   chunks_page_all_or_none_check: CHECK ((((page_start IS NULL) = (page_end IS NULL)) AND ((page_start IS NULL) = (page_kind IS NULL))));
--   chunks_page_end_check: CHECK ((page_end >= page_start));
--   chunks_page_kind_check: CHECK ((page_kind = ANY (ARRAY['page'::text, 'slide'::text])));
--   chunks_page_start_check: CHECK ((page_start >= 1))
