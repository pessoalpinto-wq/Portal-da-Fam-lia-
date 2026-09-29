-- Pedidos das filhas para as compras (colecção "shopreqs").
-- As filhas criam, editam e cancelam os seus pedidos enquanto estão "pending"; só os pais aprovam ou recusam.

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
    else true
  end
$$;
revoke execute on function private.child_can_write(text, jsonb, boolean) from public, anon;
grant execute on function private.child_can_write(text, jsonb, boolean) to authenticated;
