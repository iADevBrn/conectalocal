-- Bucket público para exibir fotos da loja e do perfil do cliente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-publicas',
  'fotos-publicas',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Usuarios autenticados enviam suas fotos" on storage.objects;
create policy "Usuarios autenticados enviam suas fotos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos-publicas'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
