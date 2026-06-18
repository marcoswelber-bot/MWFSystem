create extension if not exists "pgcrypto";

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid null,
  employee_id uuid null,
  title text not null,
  complaint text null,
  history text null,
  conduct text null,
  evolution text null,
  notes text null,
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

drop trigger if exists set_medical_records_updated_at on public.medical_records;
create trigger set_medical_records_updated_at
before update on public.medical_records
for each row
execute function public.set_updated_at();

alter table public.medical_records enable row level security;

drop policy if exists "Authenticated users can read medical records" on public.medical_records;
create policy "Authenticated users can read medical records"
on public.medical_records
for select
to authenticated
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert medical records" on public.medical_records;
create policy "Authenticated users can insert medical records"
on public.medical_records
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update medical records" on public.medical_records;
create policy "Authenticated users can update medical records"
on public.medical_records
for update
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete medical records" on public.medical_records;
create policy "Authenticated users can delete medical records"
on public.medical_records
for delete
to authenticated
using (auth.role() = 'authenticated');
