-- Calendários de fora (ex.: Google Calendar, pelo "endereço secreto no formato iCal") mostrados na Agenda do portal.
-- O link é secreto: só a função "calendario-externo" (service role) lê e escreve esta tabela; a app nunca recebe o link.
-- share: 'me' = só quem juntou · 'parents' = os pais · 'family' = a família toda.
create table if not exists public.ext_calendars (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id text not null,
  name text not null,
  url text not null,
  share text not null default 'parents' check (share in ('me', 'parents', 'family')),
  events jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ext_calendars_family_idx on public.ext_calendars (family_id);
alter table public.ext_calendars enable row level security;
-- (sem políticas: ninguém lê nem escreve directamente, só a função)
