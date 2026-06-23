create table if not exists public.patient_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  service_id uuid not null,
  employee_id uuid null,
  contracted_sessions integer not null default 1,
  completed_sessions integer not null default 0,
  remaining_sessions integer not null default 1,
  total_value numeric not null default 0,
  purchase_date date not null default current_date,
  expiration_date date null,
  payment_method text not null default 'pix',
  status text not null default 'active',
  notes text null,
  agenda_integration_status text not null default 'ready',
  finance_integration_status text not null default 'pending',
  future_revenue_status text not null default 'not_generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_packages
  add column if not exists clinic_id uuid,
  add column if not exists patient_id uuid,
  add column if not exists service_id uuid,
  add column if not exists employee_id uuid null,
  add column if not exists contracted_sessions integer not null default 1,
  add column if not exists completed_sessions integer not null default 0,
  add column if not exists remaining_sessions integer not null default 1,
  add column if not exists total_value numeric not null default 0,
  add column if not exists purchase_date date not null default current_date,
  add column if not exists expiration_date date null,
  add column if not exists payment_method text not null default 'pix',
  add column if not exists status text not null default 'active',
  add column if not exists notes text null,
  add column if not exists agenda_integration_status text not null default 'ready',
  add column if not exists finance_integration_status text not null default 'pending',
  add column if not exists future_revenue_status text not null default 'not_generated',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.patient_packages
  alter column clinic_id set not null,
  alter column patient_id set not null,
  alter column service_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_packages_sessions_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_sessions_check check (
        contracted_sessions >= 0
        and completed_sessions >= 0
        and remaining_sessions >= 0
        and completed_sessions <= contracted_sessions
        and remaining_sessions = contracted_sessions - completed_sessions
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_packages_total_value_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_total_value_check check (total_value >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_packages_payment_method_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_payment_method_check check (
        payment_method in ('pix', 'dinheiro', 'cartao', 'boleto', 'parcelado')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_packages_status_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_status_check check (
        status in ('active', 'finished', 'cancelled', 'expired')
      );
  end if;
end $$;

create index if not exists patient_packages_clinic_idx
  on public.patient_packages(clinic_id);

create index if not exists patient_packages_patient_idx
  on public.patient_packages(patient_id);

create index if not exists patient_packages_service_idx
  on public.patient_packages(service_id);

create index if not exists patient_packages_employee_idx
  on public.patient_packages(employee_id);

create index if not exists patient_packages_status_idx
  on public.patient_packages(status);

create index if not exists patient_packages_expiration_idx
  on public.patient_packages(expiration_date);

drop trigger if exists set_patient_packages_updated_at on public.patient_packages;
create trigger set_patient_packages_updated_at
before update on public.patient_packages
for each row execute function public.set_updated_at();

alter table public.patient_packages enable row level security;

drop policy if exists "Authenticated users can read patient packages"
  on public.patient_packages;
create policy "Authenticated users can read patient packages"
on public.patient_packages for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert patient packages"
  on public.patient_packages;
create policy "Authenticated users can insert patient packages"
on public.patient_packages for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update patient packages"
  on public.patient_packages;
create policy "Authenticated users can update patient packages"
on public.patient_packages for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete patient packages"
  on public.patient_packages;
create policy "Authenticated users can delete patient packages"
on public.patient_packages for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
