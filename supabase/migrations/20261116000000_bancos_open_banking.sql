-- Ligação aos bancos por open banking (PSD2, através do Enable Banking): os movimentos entram sozinhos no 🎯 Orçamento.
-- Só a função "bancos" (service role) lê e escreve esta tabela: a app nunca recebe o id da sessão do banco.
-- accounts: [{ uid, label, ref, account }] — uid = conta no Enable Banking, account = conta do portal (faccounts) ou '' (não importar).
-- A chave privada e o id da aplicação do Enable Banking ficam nos segredos das Edge Functions
-- (ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY), não na base de dados.
create table if not exists public.bank_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  bank text not null,
  country text not null default 'PT',
  state text unique,
  session_id text,
  valid_until timestamptz,
  accounts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'error')),
  last_sync date,
  synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists bank_links_family_idx on public.bank_links (family_id);
alter table public.bank_links enable row level security;
-- (sem políticas: ninguém lê nem escreve directamente, só a função)

-- Pedidos de ligação que nunca chegaram a ser concluídos no banco: apagar ao fim de 1 dia.
select cron.schedule('portal-bancos-limpar', '41 3 * * *', $$
  delete from public.bank_links where status = 'pending' and created_at < now() - interval '1 day';
$$);

-- Todos os dias às 6h40 (UTC), ir buscar os movimentos novos de todas as contas ligadas.
select cron.schedule('portal-bancos', '40 6 * * *', $$
  select net.http_post(
    url := 'https://gymxmrgptzqygfupadvw.supabase.co/functions/v1/bancos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'portal_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
