-- Fase 4: finanças (mesadas, mealheiros, contas da casa), saúde e documentos,
-- votações e memórias (fotos). Os novos dados continuam na tabela "items";
-- aqui reforçam-se as regras de quem pode escrever o quê.

create or replace function private.my_member_id()
returns text language sql stable security definer set search_path = '' as $$
  select member_id from public.profiles where user_id = auth.uid()
$$;
revoke execute on function private.my_member_id() from public, anon;
grant execute on function private.my_member_id() to authenticated;

-- O que uma filha/filho pode escrever (os pais podem tudo).
--  - membros, recompensas, mesadas e contas da casa: nada
--  - pedidos de recompensa: só criar, e só pendentes
--  - dinheiro: só registar saídas da própria carteira (gastos, pôr no mealheiro)
create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills') then false
    when p_coll = 'redemptions' then p_insert and p_data ->> 'status' = 'pending'
    when p_coll = 'money' then p_insert
      and p_data ->> 'memberId' = private.my_member_id()
      and coalesce((p_data ->> 'amount') ~ '^-[0-9]+(\.[0-9]+)?$', false)
    else true
  end
$$;
revoke execute on function private.child_can_write(text, jsonb, boolean) from public, anon;
grant execute on function private.child_can_write(text, jsonb, boolean) to authenticated;

drop policy "ler itens da família" on public.items;
drop policy "criar itens" on public.items;
drop policy "alterar itens" on public.items;

-- As contas da casa só são visíveis para os pais.
create policy "ler itens da família" on public.items
  for select to authenticated using (
    family_id = (select private.my_family_id())
    and (coll <> 'bills' or (select private.i_am_parent()))
  );

-- Votos: cada pessoa só vota em nome próprio (vale também para os pais).
create policy "criar itens" on public.items
  for insert to authenticated
  with check (
    family_id = (select private.my_family_id())
    and (coll <> 'votes' or data ->> 'memberId' = (select private.my_member_id()))
    and ((select private.i_am_parent()) or private.child_can_write(coll, data, true))
  );

create policy "alterar itens" on public.items
  for update to authenticated
  using (
    family_id = (select private.my_family_id())
    and (coll <> 'votes' or data ->> 'memberId' = (select private.my_member_id()))
    and ((select private.i_am_parent()) or private.child_can_write(coll, data, false))
  )
  with check (
    family_id = (select private.my_family_id())
    and (coll <> 'votes' or data ->> 'memberId' = (select private.my_member_id()))
    and ((select private.i_am_parent()) or private.child_can_write(coll, data, false))
  );

-- Fotos: pasta privada por família (<family_id>/<ficheiro>.jpg).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memorias', 'memorias', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "ver fotos da família" on storage.objects
  for select to authenticated
  using (bucket_id = 'memorias' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "enviar fotos da família" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memorias' and (storage.foldername(name))[1] = (select private.my_family_id())::text);

create policy "apagar fotos (quem enviou ou pais)" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memorias' and (storage.foldername(name))[1] = (select private.my_family_id())::text
    and (owner_id = (select auth.uid())::text or (select private.i_am_parent()))
  );
