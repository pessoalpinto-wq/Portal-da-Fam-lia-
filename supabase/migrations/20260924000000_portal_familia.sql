-- Portal da Família — esquema Supabase (já aplicado ao projecto "portal-da-familia").
-- Famílias, convites, perfis (conta → membro da família) e itens partilhados.

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Família',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Códigos de convite ficam numa tabela à parte: só os pais os podem ver.
create table public.family_invites (
  family_id uuid primary key references public.families (id) on delete cascade,
  parent_code text not null unique,
  child_code text not null unique
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  member_id text not null,
  role text not null check (role in ('parent', 'child')),
  created_at timestamptz not null default now(),
  unique (family_id, member_id)
);
create index profiles_family_idx on public.profiles (family_id);

-- Cada tarefa, compromisso, aula, etc. é uma linha (coll = colecção).
-- Não há DELETE: os itens apagados ficam com deleted = true.
create table public.items (
  family_id uuid not null references public.families (id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  client_id text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (family_id, coll, id)
);

create or replace function public.items_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger items_touch before insert or update on public.items
  for each row execute function public.items_touch();

-- Funções auxiliares para as políticas (security definer evita recursão no RLS).
create or replace function private.my_family_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where user_id = auth.uid()
$$;

create or replace function private.i_am_parent()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'parent' from public.profiles where user_id = auth.uid()), false)
$$;

alter table public.families enable row level security;
alter table public.family_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.items enable row level security;

create policy "ver a própria família" on public.families
  for select to authenticated using (id = (select private.my_family_id()));

create policy "pais vêem os convites" on public.family_invites
  for select to authenticated
  using (family_id = (select private.my_family_id()) and (select private.i_am_parent()));

create policy "ver perfis da família" on public.profiles
  for select to authenticated using (family_id = (select private.my_family_id()));

create policy "ler itens da família" on public.items
  for select to authenticated using (family_id = (select private.my_family_id()));

-- Filhas não mexem em membros (pontos) nem em recompensas,
-- e só podem criar pedidos de troca de pontos pendentes.
create policy "criar itens" on public.items
  for insert to authenticated
  with check (
    family_id = (select private.my_family_id())
    and ((select private.i_am_parent())
      or (coll not in ('members', 'rewards')
          and (coll <> 'redemptions' or data ->> 'status' = 'pending')))
  );

create policy "alterar itens" on public.items
  for update to authenticated
  using (
    family_id = (select private.my_family_id())
    and ((select private.i_am_parent()) or coll not in ('members', 'rewards', 'redemptions'))
  )
  with check (
    family_id = (select private.my_family_id())
    and ((select private.i_am_parent()) or coll not in ('members', 'rewards', 'redemptions'))
  );

-- Criar uma família nova (quem cria fica como pai/mãe).
create or replace function public.create_family(p_name text, p_member_id text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
  it jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'Esta conta já pertence a uma família';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_items) x
    where x ->> 'coll' = 'members' and x ->> 'id' = p_member_id
  ) then
    raise exception 'Membro inválido';
  end if;

  insert into public.families (name, created_by) values (coalesce(nullif(p_name, ''), 'Família'), auth.uid())
    returning id into fid;
  insert into public.family_invites (family_id, parent_code, child_code)
    values (fid,
      upper(substr(md5(gen_random_uuid()::text), 1, 8)),
      upper(substr(md5(gen_random_uuid()::text), 1, 8)));
  insert into public.profiles (user_id, family_id, member_id, role) values (auth.uid(), fid, p_member_id, 'parent');

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.items (family_id, coll, id, data)
      values (fid, it ->> 'coll', it ->> 'id', it -> 'data')
      on conflict do nothing;
  end loop;
  return fid;
end $$;

-- Ver os membros de uma família a partir de um código (antes de entrar).
create or replace function public.preview_family(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.family_invites;
  kind text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select * into inv from public.family_invites
    where parent_code = upper(trim(p_code)) or child_code = upper(trim(p_code));
  if not found then return null; end if;
  kind := case when inv.parent_code = upper(trim(p_code)) then 'parent' else 'child' end;
  return jsonb_build_object(
    'family', (select name from public.families where id = inv.family_id),
    'role', kind,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.data ->> 'name', 'emoji', i.data ->> 'emoji', 'role', i.data ->> 'role',
        'taken', exists (select 1 from public.profiles p where p.family_id = i.family_id and p.member_id = i.id)))
      from public.items i
      where i.family_id = inv.family_id and i.coll = 'members' and not i.deleted
        and (kind = 'parent' or coalesce(i.data ->> 'role', '') not in ('pai', 'mae'))
    ), '[]'::jsonb));
end $$;

-- Entrar numa família com um código de convite e escolher quem sou.
create or replace function public.join_family(p_code text, p_member_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.family_invites;
  kind text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'Esta conta já pertence a uma família';
  end if;
  select * into inv from public.family_invites
    where parent_code = upper(trim(p_code)) or child_code = upper(trim(p_code));
  if not found then raise exception 'Código inválido'; end if;
  kind := case when inv.parent_code = upper(trim(p_code)) then 'parent' else 'child' end;
  if not exists (
    select 1 from public.items i
    where i.family_id = inv.family_id and i.coll = 'members' and i.id = p_member_id and not i.deleted
      and (kind = 'parent' or coalesce(i.data ->> 'role', '') not in ('pai', 'mae'))
  ) then
    raise exception 'Membro inválido para este código';
  end if;
  if exists (select 1 from public.profiles where family_id = inv.family_id and member_id = p_member_id) then
    raise exception 'Esta pessoa já tem conta associada';
  end if;
  insert into public.profiles (user_id, family_id, member_id, role) values (auth.uid(), inv.family_id, p_member_id, kind);
  return inv.family_id;
end $$;

revoke execute on function public.create_family(text, text, jsonb) from public, anon;
revoke execute on function public.preview_family(text) from public, anon;
revoke execute on function public.join_family(text, text) from public, anon;
revoke execute on function private.my_family_id() from public, anon;
revoke execute on function private.i_am_parent() from public, anon;
grant execute on function public.create_family(text, text, jsonb) to authenticated;
grant execute on function public.preview_family(text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function private.my_family_id() to authenticated;
grant execute on function private.i_am_parent() to authenticated;

alter publication supabase_realtime add table public.items;
