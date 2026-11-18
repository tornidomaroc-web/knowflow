-- STORAGE LOCKDOWN, STAGE 2, FOR THE POLICIES PRODUCTION REALLY HAS
-- (the bucket `documents`). SUPERSEDES 20261118_storage_insert_lockdown.sql,
-- which was never applied and must never be: it dropped one of production's
-- two student INSERT policies and left the other open, and it left a student
-- DELETE policy it did not know about.
--
-- APPLY BY HAND, in the SQL editor, only with the owner's explicit yes. The
-- stage 1 code (#334, 3d8da77: every material file and the sample PDF written
-- by the server with the service role) is live, so nothing the app does still
-- needs a student INSERT outside page-photos.
--
-- PRODUCTION BEFORE THIS MIGRATION (read-only read of pg_policies and
-- storage.buckets by the owner, 2026-11-18). storage.objects has FIVE
-- policies; 1 and 2 come from 002_storage.sql, 3 to 5 were made by hand and
-- were in no migration until this record. Bucket `documents`: public false,
-- file_size_limit null, allowed_mime_types null. The record below is what
-- scripts/verify-storage-lockdown.mjs creates before it applies this file,
-- so the proof starts from production's state. It is a COMMENT on purpose:
-- run after this migration, it would reopen both holes.
--
-- PRODUCTION-BEFORE-BEGIN
-- -- 1 (002_storage.sql)  SELECT {public}
-- create policy "Users can read own files" on storage.objects for select
--   using (bucket_id = 'documents' and auth.uid()::text = (string_to_array(name, '/'))[1]);
-- -- 2 (002_storage.sql)  INSERT {public}
-- create policy "Users can upload to their own folder" on storage.objects for insert
--   with check (bucket_id = 'documents' and auth.uid()::text = (string_to_array(name, '/'))[1]);
-- -- 3 (by hand)  DELETE {authenticated}
-- create policy "Users delete own files" on storage.objects for delete to authenticated
--   using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
-- -- 4 (by hand)  SELECT {authenticated}
-- create policy "Users read own files" on storage.objects for select to authenticated
--   using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
-- -- 5 (by hand)  INSERT {authenticated}
-- create policy "Users upload own files" on storage.objects for insert to authenticated
--   with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
-- PRODUCTION-BEFORE-END
--
-- WHAT IT CHANGES.
--   (a) INSERT. Policies 2 and 5 are BOTH dropped: either alone lets a signed
--       -in student call the Storage API and store any number of objects
--       under their own prefix. In their place one policy: a student may
--       insert ONLY a camera photo, at the key /api/page-read accepts
--       (src/lib/page-reader.ts KEY_RE, checkPhotoKeys):
--         {own uid}/page-photos/{uuid}/{name}
--       name = [A-Za-z0-9][A-Za-z0-9_-]{0,63}, optionally .[A-Za-z0-9]{1,8},
--       and at most 100 page-photos objects per student, counted under the
--       student's own SELECT policy. Uploads in flight together can pass the
--       count together (a client sends one batch, at most 10 photos).
--   (b) DELETE. Policy 3 let a student delete ANY of their objects, a
--       material's stored file included, leaving its `documents` row (and
--       the citation pages that open it) pointing at nothing. It is replaced
--       by a DELETE only under {own uid}/page-photos/. The app itself never
--       deletes with the student's session (page-read and the sweep remove
--       photos with the service role, material deletion too); this policy
--       lets a camera client remove a half-sent batch it abandons, so those
--       photos stop counting against the cap of 100 before the sweep's hour.
--   (c) SELECT. Policy 4 is dropped as a duplicate of 1. For every object,
--       4 true implies 1 true: storage.foldername(name) is
--       string_to_array(name, '/') without its last element, so its first
--       element, when it has one, IS string_to_array's first; 4's roles
--       ({authenticated}) are inside 1's ({public}). The VERIFY query below
--       re-checks that on the database's own storage.foldername. Policy 1
--       stays: /api/page-read lists and downloads the photos with the
--       student's session, and the cap in (a) counts through it.
--   (d) The bucket's file_size_limit: 25 MiB (26,214,400 bytes), the camera
--       photo limit (MAX_PHOTO_BYTES). A material is at most 4 MiB, the
--       sample PDFs 10 to 17 KB. The Storage API enforces it for every role,
--       the service role included. allowed_mime_types stays null: a
--       material's declared type is often empty or application/octet-stream,
--       and the routes check the bytes themselves.
--   No UPDATE policy exists before or after, so a student can neither upsert
--   nor move an object.
--
-- RE-RUNNABLE: drop policy if exists before every create; the update sets a
-- value. Proof (Supabase's postgres image and the real Storage API, starting
-- from the five policies above): scripts/verify-storage-lockdown.mjs.

begin;

update storage.buckets
set file_size_limit = 26214400
where id = 'documents';

-- INSERT: both student policies (2 from 002_storage.sql, 5 by hand) go.
drop policy if exists "Users can upload to their own folder" on storage.objects;
drop policy if exists "Users upload own files" on storage.objects;
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

-- DELETE: any own object (3, by hand) becomes own page-photos only.
drop policy if exists "Users delete own files" on storage.objects;
drop policy if exists "Students delete own camera photos" on storage.objects;

create policy "Students delete own camera photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and starts_with(name, (select auth.uid()::text) || '/page-photos/')
);

-- SELECT: the hand-made duplicate (4) goes; "Users can read own files" (1) stays.
drop policy if exists "Users read own files" on storage.objects;

commit;

-- VERIFY (read-only). Run it before (production today) and after.
-- Expected AFTER, exactly these seven rows:
--   1|bucket|documents public=false limit=26214400 mime=null
--   2|rls|storage.objects enabled=true
--   3|check|foldername first element implies the first segment: true
--   4|policy|objects | Students delete own camera photos | DELETE | {authenticated} | PERMISSIVE
--   5|policy|objects | Students upload camera photos only | INSERT | {authenticated} | PERMISSIVE
--   6|policy|objects | Users can read own files | SELECT | {public} | PERMISSIVE
--   99|count|policies on storage.objects and storage.buckets: 3
-- Any other policy row (another INSERT, DELETE or UPDATE on storage.objects,
-- any policy on storage.buckets) means a student can still write: stop.
--
-- select 1 as n, 'bucket' as k, id || ' public=' || public || ' limit=' || coalesce(file_size_limit::text, 'null')
--        || ' mime=' || coalesce(array_to_string(allowed_mime_types, ','), 'null') as v
-- from storage.buckets where id = 'documents'
-- union all
-- select 2, 'rls', 'storage.objects enabled=' || relrowsecurity
-- from pg_class where oid = 'storage.objects'::regclass
-- union all
-- select 3, 'check', 'foldername first element implies the first segment: '
--        || bool_and((storage.foldername(t.n))[1] is null or (storage.foldername(t.n))[1] = (string_to_array(t.n, '/'))[1])
-- from (values ('u'), ('u/'), ('u/a'), ('u/a/b'), ('u//a'), ('/u/a'), (''), ('u/page-photos/b/1.jpg')) as t(n)
-- union all
-- select 3 + row_number() over (order by tablename, policyname), 'policy',
--        tablename || ' | ' || policyname || ' | ' || cmd || ' | ' || roles::text || ' | ' || permissive
-- from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')
-- union all
-- select 99, 'count', 'policies on storage.objects and storage.buckets: ' || count(*)
-- from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')
-- order by 1;
