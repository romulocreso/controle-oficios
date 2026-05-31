create extension if not exists pgcrypto;

create table if not exists public.oficios (
  id uuid primary key default gen_random_uuid(),
  numero_oficio text not null,
  recebido text,
  data_recebimento date,
  prazo_resposta_dias integer,
  data_limite_resposta date,
  respondido text,
  data_resposta date,
  link_oficio text,
  observacoes text,
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
on public.oficios for select to authenticated using (true);

create policy "authenticated can insert oficios"
on public.oficios for insert to authenticated with check (true);

create policy "authenticated can update oficios"
on public.oficios for update to authenticated using (true) with check (true);

create policy "authenticated can delete oficios"
on public.oficios for delete to authenticated using (true);

-- ============================================================
-- Tabela: oficios_expedidos
-- ============================================================

create table if not exists public.oficios_expedidos (
  id uuid primary key default gen_random_uuid(),
  numero_oficio text not null,
  destinatario text,
  data_expedicao date,
  prazo_resposta_dias integer,
  data_limite_resposta date,
  resposta_recebida text,
  data_resposta date,
  link_oficio text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_oficios_expedidos_updated_at
before update on public.oficios_expedidos
for each row
execute function public.set_updated_at();

alter table public.oficios_expedidos enable row level security;

create policy "authenticated can read oficios_expedidos"
on public.oficios_expedidos for select to authenticated using (true);

create policy "authenticated can insert oficios_expedidos"
on public.oficios_expedidos for insert to authenticated with check (true);

create policy "authenticated can update oficios_expedidos"
on public.oficios_expedidos for update to authenticated using (true) with check (true);

create policy "authenticated can delete oficios_expedidos"
on public.oficios_expedidos for delete to authenticated using (true);
