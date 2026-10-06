-- Assistente (IA): quanto se usou por família e por dia (pedidos, tokens e custo aproximado).
-- Só a função "assistente" escreve (service role); os pais podem ler os da sua família.
create table if not exists public.ai_usage (
  family_id uuid not null references public.families (id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read bigint not null default 0,
  cache_write bigint not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  primary key (family_id, day)
);
alter table public.ai_usage enable row level security;

create policy "pais vêem o uso do assistente" on public.ai_usage
  for select to authenticated
  using (family_id = (select private.my_family_id()) and (select private.i_am_parent()));
