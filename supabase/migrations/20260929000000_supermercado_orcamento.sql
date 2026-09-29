-- Compras: talões do supermercado e orçamento mensal (colecção "groceries") — só os pais vêem.
-- As filhas registam o talão através de public.add_receipt: fica guardado, mas não o podem ler nem alterar.

create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills', 'challenges', 'savings', 'groceries') then false
    when p_coll = 'redemptions' then p_insert and p_data ->> 'status' = 'pending'
    when p_coll = 'money' then p_insert
      and p_data ->> 'memberId' = private.my_member_id()
      and coalesce((p_data ->> 'amount') ~ '^-[0-9]+(\.[0-9]+)?$', false)
    else true
  end
$$;
revoke execute on function private.child_can_write(text, jsonb, boolean) from public, anon;
grant execute on function private.child_can_write(text, jsonb, boolean) to authenticated;

-- As contas da casa e os gastos do supermercado só são visíveis para os pais.
drop policy "ler itens da família" on public.items;
create policy "ler itens da família" on public.items
  for select to authenticated using (
    family_id = (select private.my_family_id())
    and (coll not in ('bills', 'groceries') or (select private.i_am_parent()))
  );

-- Registar um talão (pais ou filhas). Devolve o id do registo.
create or replace function public.add_receipt(p_amount numeric, p_store text, p_items integer, p_estimate numeric)
returns text language plpgsql security definer set search_path = '' as $$
declare
  fid uuid := private.my_family_id();
  rid text;
begin
  if fid is null then raise exception 'Sem família'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 5000 then raise exception 'Valor inválido'; end if;
  rid := 'rc-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.items (family_id, coll, id, data)
  values (fid, 'groceries', rid, jsonb_build_object(
    'id', rid, 'kind', 'receipt', 'date', (now() at time zone 'Europe/Lisbon')::date::text,
    'amount', round(p_amount, 2), 'store', left(coalesce(p_store, ''), 40),
    'items', greatest(coalesce(p_items, 0), 0), 'estimate', round(coalesce(p_estimate, 0), 2),
    'by', private.my_member_id()));
  return rid;
end
$$;
revoke execute on function public.add_receipt(numeric, text, integer, numeric) from public, anon;
grant execute on function public.add_receipt(numeric, text, integer, numeric) to authenticated;
