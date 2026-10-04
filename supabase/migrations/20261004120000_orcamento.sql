-- Orçamento: movimentos (ftx), orçamentos por categoria (fbudgets) e regras de categorias (frules).
-- Só os pais vêem e alteram estes dados.
set lock_timeout = '20s';
alter policy "ler itens da família" on public.items using (
    family_id = (select private.my_family_id())
    and (
      (select private.i_am_parent())
      or (coll not in ('bills', 'groceries', 'exams', 'classes', 'faccounts', 'debts', 'fsnaps', 'ftx', 'fbudgets', 'frules'))
      or (coll in ('exams', 'classes') and data ->> 'memberId' = (select private.my_member_id()))
    )
  );

create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills', 'challenges', 'savings', 'groceries',
                    'faccounts', 'debts', 'fsnaps', 'ftx', 'fbudgets', 'frules') then false
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
