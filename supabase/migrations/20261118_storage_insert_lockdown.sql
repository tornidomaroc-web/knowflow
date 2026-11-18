-- STORAGE INSERT LOCKDOWN, STAGE 2 (the bucket `documents`).
--
-- APPLY BY HAND, ONLY AFTER the stage 1 code (fix/storage-server-writes:
-- src/lib/document-storage-server.ts) is LIVE ON PRODUCTION, and only with
-- the owner's explicit yes. Before that, /api/ingest, /api/page-read and
-- /api/sample still upload with the student's session to
-- {uid}/{kbId}/{documentId}/{name}, which this policy refuses: every upload
-- and every sample would fail with "nothing saved" / sample_failed.
--
-- WHAT IT CHANGES.
--   (a) The student's INSERT policy. 002_storage.sql let a signed-in student
--       insert ANY object whose first path segment is their id, so anyone
--       signed in could call the Storage API directly and store unlimited
--       objects of any size, which nothing removes (no delete policy). Now a
--       student may insert ONLY a camera photo, at the key /api/page-read
--       accepts (src/lib/page-reader.ts KEY_RE, checkPhotoKeys):
--         {own uid}/page-photos/{uuid}/{name}
--       name = [A-Za-z0-9][A-Za-z0-9_-]{0,63}, optionally .[A-Za-z0-9]{1,8}.
--       Everything else (a material's file, the sample PDF) is written by the
--       server with the service role, which no policy limits.
--   (b) At most 100 page-photos objects per student, counted under the
--       student's own SELECT policy (they see their own objects only). A
--       batch is at most 10 photos, /api/page-read deletes them once read and
--       the sweep (src/lib/page-photo-sweep.ts) removes batches abandoned for
--       an hour, so 100 is ten untouched batches. Uploads that run in parallel
--       can pass the count together, so the cap can be exceeded by the number
--       in flight at once (a client uploads one batch, at most 10).
--   (c) The bucket's file_size_limit: 25 MiB (26,214,400 bytes), the camera
--       photo limit (MAX_PHOTO_BYTES). Every current upload is smaller: a
--       material is at most 4 MiB (MAX_UPLOAD_BYTES), the sample PDFs 10 to
--       17 KB. The Storage API enforces it for every role, the service role
--       included. allowed_mime_types is NOT set: a material's content type is
--       whatever the student's browser declared for the file (often empty or
--       application/octet-stream for .md and .txt), and refusing on it would
--       refuse real uploads. The routes check the bytes themselves.
--   (d) SELECT ("Users can read own files") is unchanged: /api/page-read
--       lists and downloads the photos with the student's session, and the
--       cap in (b) counts through it.
--
-- RE-RUNNABLE: drop policy if exists before create; the update sets a value.
-- The proof, against Supabase's postgres image and the real Storage API:
-- scripts/verify-storage-lockdown.mjs (a student upload outside page-photos
-- refused, inside allowed, the 101st refused, 25 MiB + 1 refused, the service
-- role unaffected). The verify query and its expected rows are at the end.

begin;

update storage.buckets
set file_size_limit = 26214400
where id = 'documents';

drop policy if exists "Users can upload to their own folder" on storage.objects;
drop policy if exists "Students upload camera photos only" on storage.objects;

create policy "Students upload camera photos only"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/page-photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9_-]{0,63}([.][A-Za-z0-9]{1,8})?$'
  and split_part(name, '/', 1) = (select auth.uid()::text)
  and (
    select count(*)
    from storage.objects o
    where o.bucket_id = 'documents'
      and starts_with(o.name, (select auth.uid()::text) || '/page-photos/')
  ) < 100
);

commit;

-- VERIFY (read-only). Expected, exactly these three rows:
--   bucket | documents | public=false | limit=26214400 | mime=null
--   policy | Students upload camera photos only | INSERT | {authenticated}
--   policy | Users can read own files | SELECT | {public}
-- Any other row (another INSERT policy on storage.objects, a hand-made
-- duplicate) means a student can still insert outside page-photos: stop.
--
-- select 'bucket' as k, id || ' | public=' || public || ' | limit=' || coalesce(file_size_limit::text, 'null')
--        || ' | mime=' || coalesce(array_to_string(allowed_mime_types, ','), 'null') as v
-- from storage.buckets where id = 'documents'
-- union all
-- select 'policy', policyname || ' | ' || cmd || ' | ' || roles::text
-- from pg_policies where schemaname = 'storage' and tablename = 'objects'
-- order by 1, 2;
