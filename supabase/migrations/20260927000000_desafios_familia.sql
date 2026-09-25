-- Tarefas: desafios da família (objectivo de pontos comum e prémio) — só os pais criam ou alteram.
-- O XP, os níveis e as medalhas ficam no membro ("members"), que as filhas já não podem alterar.
create or replace function private.child_can_write(p_coll text, p_data jsonb, p_insert boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_coll in ('members', 'rewards', 'allowances', 'bills', 'challenges') then false
    when p_coll = 'redemptions' then p_insert and p_data ->> 'status' = 'pending'
    when p_coll = 'money' then p_insert
      and p_data ->> 'memberId' = private.my_member_id()
      and coalesce((p_data ->> 'amount') ~ '^-[0-9]+(\.[0-9]+)?$', false)
    else true
  end
$$;
revoke execute on function private.child_can_write(text, jsonb, boolean) from public, anon;
grant execute on function private.child_can_write(text, jsonb, boolean) to authenticated;
