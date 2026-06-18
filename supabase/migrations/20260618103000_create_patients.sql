create extension if not exists "pgcrypto";

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null references public.clinics(id) on delete set null,
  full_name text not null,
  cpf text null,
  birth_date date null,
  phone text null,
  email text null,
  address text null,
  notes text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_clinic_id_idx on public.patients(clinic_id);
create index if not exists patients_status_idx on public.patients(status);
create index if not exists patients_full_name_idx on public.patients using gin (to_tsvector('portuguese', full_name));

create or replace function public.current_user_clinic_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select clinic_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

alter table public.patients enable row level security;

drop policy if exists "Authenticated users can read patients in their clinic" on public.patients;
create policy "Authenticated users can read patients in their clinic"
on public.patients
for select
to authenticated
using (
  public.is_adm_master()
  or clinic_id = public.current_user_clinic_id()
);

drop policy if exists "Authenticated users can create patients in their clinic" on public.patients;
create policy "Authenticated users can create patients in their clinic"
on public.patients
for insert
to authenticated
with check (
  public.is_adm_master()
  or clinic_id = public.current_user_clinic_id()
);

drop policy if exists "Authenticated users can update patients in their clinic" on public.patients;
create policy "Authenticated users can update patients in their clinic"
on public.patients
for update
to authenticated
using (
  public.is_adm_master()
  or clinic_id = public.current_user_clinic_id()
)
with check (
  public.is_adm_master()
  or clinic_id = public.current_user_clinic_id()
);

drop policy if exists "Authenticated users can delete patients in their clinic" on public.patients;
create policy "Authenticated users can delete patients in their clinic"
on public.patients
for delete
to authenticated
using (
  public.is_adm_master()
  or clinic_id = public.current_user_clinic_id()
);
