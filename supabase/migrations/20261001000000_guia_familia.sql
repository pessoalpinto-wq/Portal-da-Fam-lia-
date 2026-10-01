-- Guia "Pôr a família a funcionar": quantos aparelhos com notificações tem cada pessoa da família.
-- Só devolve o número (nunca os endereços das subscrições) e só da família de quem pergunta.
create or replace function public.family_devices()
returns table (member_id text, devices integer)
language sql stable security definer set search_path = '' as $$
  select p.member_id, count(s.id)::integer
  from public.profiles p
  left join public.push_subscriptions s on s.user_id = p.user_id
  where p.family_id = private.my_family_id()
  group by p.member_id
$$;
revoke execute on function public.family_devices() from public, anon;
grant execute on function public.family_devices() to authenticated;
