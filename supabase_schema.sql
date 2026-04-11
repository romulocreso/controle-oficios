create extension if not exists pgcrypto;

create table if not exists public.oficios (
  id uuid primary key default gen_random_uuid(),
  numero_oficio text not null,
  unidade text,
  classe text,
  recebido text,
  data_recebimento date,
  prazo_resposta_dias integer,
  data_limite_resposta date,
  respondido text,
  data_resposta date,
  observacoes text,
  origem_arquivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_oficios_updated_at
before update on public.oficios
for each row
execute function public.set_updated_at();

alter table public.oficios enable row level security;

create policy "authenticated can read oficios"
on public.oficios
for select
to authenticated
using (true);

create policy "authenticated can insert oficios"
on public.oficios
for insert
to authenticated
with check (true);

create policy "authenticated can update oficios"
on public.oficios
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete oficios"
on public.oficios
for delete
to authenticated
using (true);
