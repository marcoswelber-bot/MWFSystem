create extension if not exists "pgcrypto";

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null,
  name text not null,
  phone text null,
  whatsapp text null,
  email text null,
  role text null,
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

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

alter table public.employees enable row level security;

drop policy if exists "Authenticated users can read employees" on public.employees;
create policy "Authenticated users can read employees"
on public.employees
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert employees" on public.employees;
create policy "Authenticated users can insert employees"
on public.employees
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update employees" on public.employees;
create policy "Authenticated users can update employees"
on public.employees
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete employees" on public.employees;
create policy "Authenticated users can delete employees"
on public.employees
for delete
to authenticated
using (auth.role() = 'authenticated');
