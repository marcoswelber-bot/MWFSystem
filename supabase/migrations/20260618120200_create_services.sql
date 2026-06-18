create extension if not exists "pgcrypto";

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  type text null,
  price numeric null,
  duration_minutes integer null,
  allows_package boolean not null default true,
  commission_type text null,
  commission_value numeric null,
  status text not null default 'active',
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

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

alter table public.services enable row level security;

drop policy if exists "Authenticated users can read services" on public.services;
create policy "Authenticated users can read services"
on public.services
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert services" on public.services;
create policy "Authenticated users can insert services"
on public.services
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update services" on public.services;
create policy "Authenticated users can update services"
on public.services
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete services" on public.services;
create policy "Authenticated users can delete services"
on public.services
for delete
to authenticated
using (auth.role() = 'authenticated');
