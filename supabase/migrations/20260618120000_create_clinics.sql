create extension if not exists "pgcrypto";

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text null,
  whatsapp text null,
  email text null,
  cnpj text null,
  address text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinics add column if not exists phone text null;
alter table public.clinics add column if not exists whatsapp text null;
alter table public.clinics add column if not exists email text null;
alter table public.clinics add column if not exists cnpj text null;
alter table public.clinics add column if not exists address text null;
alter table public.clinics add column if not exists status text not null default 'active';
alter table public.clinics add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'slug'
  ) then
    alter table public.clinics alter column slug drop not null;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_clinics_updated_at on public.clinics;
create trigger set_clinics_updated_at
before update on public.clinics
for each row
execute function public.set_updated_at();

alter table public.clinics enable row level security;

drop policy if exists "Authenticated users can read clinics" on public.clinics;
create policy "Authenticated users can read clinics"
on public.clinics
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert clinics" on public.clinics;
create policy "Authenticated users can insert clinics"
on public.clinics
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update clinics" on public.clinics;
create policy "Authenticated users can update clinics"
on public.clinics
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete clinics" on public.clinics;
create policy "Authenticated users can delete clinics"
on public.clinics
for delete
to authenticated
using (auth.role() = 'authenticated');
