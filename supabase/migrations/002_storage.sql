insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

create policy "Users can upload to their own folder"
on storage.objects for insert
with check (
  bucket_id = 'documents' and
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

create policy "Users can read own files"
on storage.objects for select
using (
  bucket_id = 'documents' and
  auth.uid()::text = (string_to_array(name, '/'))[1]
);
