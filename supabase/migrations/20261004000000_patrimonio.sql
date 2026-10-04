-- Património da família: contas (faccounts), dívidas (debts) e fechos do mês (fsnaps).
-- Só os pais vêem e alteram estes dados (como as contas da casa e os talões).

-- alter policy (em vez de drop + create): não deixa a tabela sem regra de leitura nem por um instante.
set lock_timeout = '20s';
alter policy "ler itens da família" on public.items using (
    family_id = (select private.my_family_id())
    and (
      (select private.i_am_parent())
      or (coll not in ('bills', 'groceries', 'exams', 'classes', 'faccounts', 'debts', 'fsnaps'))
      or (coll in ('exams', 'classes') and data ->> 'memberId' = (select private.my_member_id()))
    )
  );

create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills', 'challenges', 'savings', 'groceries',
                    'faccounts', 'debts', 'fsnaps') then false
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
