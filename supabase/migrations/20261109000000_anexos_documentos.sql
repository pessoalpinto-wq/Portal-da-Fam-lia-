-- Saúde & Docs: o ficheiro de cada documento (Cartão de Cidadão, apólice, inspecção…), em PDF ou
-- fotografia. Pasta privada por família (<family_id>/<documento>/<ficheiro>).
-- A família vê e envia (tal como vê a lista de documentos); apaga quem enviou ou os pais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
])
on conflict (id) do nothing;

create policy "ver anexos dos documentos" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "enviar anexos dos documentos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "apagar anexos dos documentos (quem enviou ou pais)" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos' and (storage.foldername(name))[1] = (select private.my_family_id())::text
    and (owner_id = (select auth.uid())::text or (select private.i_am_parent()))
  );
