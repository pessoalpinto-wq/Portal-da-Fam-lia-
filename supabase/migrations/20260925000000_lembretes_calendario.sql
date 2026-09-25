-- Fase 3: lembretes por notificação (Web Push) e calendário por subscrição (iCal).

-- Aparelhos que aceitaram receber notificações.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index push_subscriptions_family_idx on public.push_subscriptions (family_id);
alter table public.push_subscriptions enable row level security;

create policy "ver os meus aparelhos" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "registar os meus aparelhos" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "actualizar os meus aparelhos" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and family_id = (select private.my_family_id()));
create policy "remover os meus aparelhos" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Registo do que já foi enviado (evita repetir o mesmo lembrete). Só o servidor usa.
create table public.notification_log (
  key text primary key,
  family_id uuid references public.families (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index notification_log_sent_idx on public.notification_log (sent_at);
alter table public.notification_log enable row level security;

-- Preferências de notificação de cada pessoa ({"tasks": false, ...}).
alter table public.profiles add column notify jsonb not null default '{}'::jsonb;
create policy "alterar as minhas preferências" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (notify) on public.profiles to authenticated;

-- Link secreto do calendário da família.
alter table public.families add column ics_token text not null default encode(extensions.gen_random_bytes(18), 'hex');
create unique index families_ics_token_idx on public.families (ics_token);

create or replace function public.reset_calendar_token()
returns text language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if not private.i_am_parent() then raise exception 'Só os pais podem mudar o link do calendário'; end if;
  t := encode(extensions.gen_random_bytes(18), 'hex');
  update public.families set ics_token = t where id = private.my_family_id();
  return t;
end $$;
revoke execute on function public.reset_calendar_token() from public, anon;
grant execute on function public.reset_calendar_token() to authenticated;

-- Segredos (chaves VAPID e segredo do cron) ficam no Vault; só o servidor lhes acede.
-- (Criados à parte com vault.create_secret: portal_vapid_public, portal_vapid_private, portal_cron_secret.)
create or replace function public.get_push_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret)
  from vault.decrypted_secrets
  where name in ('portal_vapid_public', 'portal_vapid_private', 'portal_cron_secret')
$$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

-- De 10 em 10 minutos, chamar a função que envia os lembretes.
create extension if not exists pg_net schema extensions;
create extension if not exists pg_cron;

select cron.schedule('portal-lembretes', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://gymxmrgptzqygfupadvw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'portal_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);

select cron.schedule('portal-limpar-registo', '17 3 * * *', $$
  delete from public.notification_log where sent_at < now() - interval '60 days';
$$);

-- Só aceitar subscrições dos serviços de push oficiais (Google, Mozilla, Apple, Microsoft).
alter table public.push_subscriptions add constraint push_endpoint_servico_oficial check (
  endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/'
);
