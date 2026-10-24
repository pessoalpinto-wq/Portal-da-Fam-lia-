-- Documentos das viagens (bilhetes de avião, reservas de hotel, seguros…): pasta privada por família
-- (<family_id>/<viagem>/<ficheiro>). A família vê e envia; apaga quem enviou ou os pais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('viagens', 'viagens', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/vnd.apple.pkpass'
])
on conflict (id) do nothing;

create policy "ver documentos das viagens" on storage.objects
  for select to authenticated
  using (bucket_id = 'viagens' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "enviar documentos das viagens" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'viagens' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "apagar documentos das viagens (quem enviou ou pais)" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'viagens' and (storage.foldername(name))[1] = (select private.my_family_id())::text
    and (owner_id = (select auth.uid())::text or (select private.i_am_parent()))
  );
