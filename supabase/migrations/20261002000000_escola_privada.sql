-- Notas da escola privadas: cada filha vê e altera só os seus testes, notas e horário; os pais vêem tudo.
-- O link do calendário também: as filhas recebem um link pessoal (só com o que é delas) e deixam de ver o da família.

-- 1) Ler: testes ("exams") e aulas ("classes") de outra pessoa ficam escondidos para quem não é pai/mãe.
drop policy "ler itens da família" on public.items;
create policy "ler itens da família" on public.items
  for select to authenticated using (
    family_id = (select private.my_family_id())
    and (
      (select private.i_am_parent())
      or (coll not in ('bills', 'groceries', 'exams', 'classes'))
      or (coll in ('exams', 'classes') and data ->> 'memberId' = (select private.my_member_id()))
    )
  );

-- 2) Escrever: as filhas só criam/alteram testes e aulas em nome próprio.
create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills', 'challenges', 'savings', 'groceries') then false
    when p_coll = 'redemptions' then p_insert and p_data ->> 'status' = 'pending'
    when p_coll = 'money' then p_insert
      and p_data ->> 'memberId' = private.my_member_id()
      and coalesce((p_data ->> 'amount') ~ '^-[0-9]+(\.[0-9]+)?$', false)
    when p_coll = 'shopreqs' then p_data ->> 'status' = 'pending'
      and p_data ->> 'by' = private.my_member_id()
    when p_coll in ('exams', 'classes') then p_data ->> 'memberId' = private.my_member_id()
    else true
  end
$$;
revoke execute on function private.child_can_write(text, jsonb, boolean) from public, anon;
grant execute on function private.child_can_write(text, jsonb, boolean) to authenticated;

-- 3) Calendário: o link da família deixa de se poder ler directamente (só pela função abaixo).
revoke select on public.families from anon, authenticated;
grant select (id, name, created_by, created_at) on public.families to authenticated;

-- Links pessoais das filhas (um por membro). Fora da API.
create table private.calendar_tokens (
  family_id uuid not null references public.families (id) on delete cascade,
  member_id text not null,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  primary key (family_id, member_id)
);

-- O meu link: pais → o da família; filhas → o pessoal (criado na primeira vez).
create or replace function public.my_calendar_token()
returns text language plpgsql security definer set search_path = '' as $$
declare t text; fam uuid := private.my_family_id(); me text := private.my_member_id();
begin
  if fam is null then return null; end if;
  if private.i_am_parent() then
    select ics_token into t from public.families where id = fam;
    return t;
  end if;
  insert into private.calendar_tokens (family_id, member_id) values (fam, me) on conflict do nothing;
  select token into t from private.calendar_tokens where family_id = fam and member_id = me;
  return t;
end $$;
revoke execute on function public.my_calendar_token() from public, anon;
grant execute on function public.my_calendar_token() to authenticated;

-- Gerar um link novo: os pais mudam o da família (e os das filhas); cada filha pode mudar o seu.
create or replace function public.reset_calendar_token()
returns text language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(18), 'hex'); fam uuid := private.my_family_id();
begin
  if fam is null then raise exception 'Sem família'; end if;
  if private.i_am_parent() then
    update public.families set ics_token = t where id = fam;
    update private.calendar_tokens set token = encode(extensions.gen_random_bytes(18), 'hex') where family_id = fam;
  else
    insert into private.calendar_tokens (family_id, member_id, token) values (fam, private.my_member_id(), t)
      on conflict (family_id, member_id) do update set token = excluded.token;
  end if;
  return t;
end $$;
revoke execute on function public.reset_calendar_token() from public, anon;
grant execute on function public.reset_calendar_token() to authenticated;

-- Para a função "calendar" (só o servidor): de quem é este link?
create or replace function public.calendar_lookup(p_token text)
returns table (family_id uuid, family_name text, member_id text)
language sql stable security definer set search_path = '' as $$
  select f.id, f.name, null::text from public.families f where f.ics_token = p_token
  union all
  select f.id, f.name, c.member_id from private.calendar_tokens c join public.families f on f.id = c.family_id
  where c.token = p_token
  limit 1
$$;
revoke execute on function public.calendar_lookup(text) from public, anon, authenticated;
grant execute on function public.calendar_lookup(text) to service_role;
