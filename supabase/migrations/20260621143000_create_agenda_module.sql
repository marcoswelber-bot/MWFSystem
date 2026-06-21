create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  employee_id uuid not null,
  service_id uuid not null,
  appointment_date date not null,
  start_time time not null,
  end_time time null,
  notes text null,
  status text not null default 'agendado',
  medical_record_id uuid null,
  performed_at timestamptz null,
  finance_integration_status text not null default 'pending',
  commission_integration_status text not null default 'pending',
  package_session_status text not null default 'not_applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (
    status in ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou')
  )
);

alter table public.appointments
  add column if not exists clinic_id uuid not null;
alter table public.appointments
  add column if not exists patient_id uuid not null;
alter table public.appointments
  add column if not exists employee_id uuid not null;
alter table public.appointments
  add column if not exists service_id uuid not null;
alter table public.appointments
  add column if not exists appointment_date date not null;
alter table public.appointments
  add column if not exists start_time time not null;
alter table public.appointments
  add column if not exists end_time time null;
alter table public.appointments
  add column if not exists notes text null;
alter table public.appointments
  add column if not exists status text not null default 'agendado';
alter table public.appointments
  add column if not exists medical_record_id uuid null;
alter table public.appointments
  add column if not exists performed_at timestamptz null;
alter table public.appointments
  add column if not exists finance_integration_status text not null default 'pending';
alter table public.appointments
  add column if not exists commission_integration_status text not null default 'pending';
alter table public.appointments
  add column if not exists package_session_status text not null default 'not_applied';
alter table public.appointments
  add column if not exists created_at timestamptz not null default now();
alter table public.appointments
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  employee_id uuid null,
  block_date date not null,
  block_type text not null default 'periodo',
  start_time time null,
  end_time time null,
  reason text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_type_check check (
    block_type in ('dia_inteiro', 'periodo', 'horario')
  )
);

alter table public.schedule_blocks
  add column if not exists clinic_id uuid not null;
alter table public.schedule_blocks
  add column if not exists employee_id uuid null;
alter table public.schedule_blocks
  add column if not exists block_date date not null;
alter table public.schedule_blocks
  add column if not exists block_type text not null default 'periodo';
alter table public.schedule_blocks
  add column if not exists start_time time null;
alter table public.schedule_blocks
  add column if not exists end_time time null;
alter table public.schedule_blocks
  add column if not exists reason text null;
alter table public.schedule_blocks
  add column if not exists status text not null default 'active';
alter table public.schedule_blocks
  add column if not exists created_at timestamptz not null default now();
alter table public.schedule_blocks
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.patient_session_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  employee_id uuid null,
  service_id uuid null,
  appointment_id uuid null,
  session_date date not null,
  status text not null default 'realizado',
  notes text null,
  finance_integration_status text not null default 'pending',
  commission_integration_status text not null default 'pending',
  package_session_status text not null default 'not_applied',
  created_at timestamptz not null default now()
);

alter table public.patient_session_history
  add column if not exists clinic_id uuid not null;
alter table public.patient_session_history
  add column if not exists patient_id uuid not null;
alter table public.patient_session_history
  add column if not exists employee_id uuid null;
alter table public.patient_session_history
  add column if not exists service_id uuid null;
alter table public.patient_session_history
  add column if not exists appointment_id uuid null;
alter table public.patient_session_history
  add column if not exists session_date date not null;
alter table public.patient_session_history
  add column if not exists status text not null default 'realizado';
alter table public.patient_session_history
  add column if not exists notes text null;
alter table public.patient_session_history
  add column if not exists finance_integration_status text not null default 'pending';
alter table public.patient_session_history
  add column if not exists commission_integration_status text not null default 'pending';
alter table public.patient_session_history
  add column if not exists package_session_status text not null default 'not_applied';
alter table public.patient_session_history
  add column if not exists created_at timestamptz not null default now();

alter table public.medical_records
  add column if not exists appointment_id uuid null;

create index if not exists appointments_clinic_date_idx
on public.appointments(clinic_id, appointment_date);

create index if not exists appointments_employee_date_time_idx
on public.appointments(employee_id, appointment_date, start_time);

create index if not exists appointments_patient_idx
on public.appointments(patient_id);

create index if not exists schedule_blocks_clinic_date_idx
on public.schedule_blocks(clinic_id, block_date);

create index if not exists schedule_blocks_employee_date_idx
on public.schedule_blocks(employee_id, block_date);

create index if not exists patient_session_history_patient_idx
on public.patient_session_history(patient_id, session_date);

create index if not exists patient_session_history_appointment_idx
on public.patient_session_history(appointment_id);

create unique index if not exists appointments_professional_time_active_idx
on public.appointments(employee_id, appointment_date, start_time)
where status in ('agendado', 'confirmado', 'realizado');

create unique index if not exists patient_session_history_appointment_unique_idx
on public.patient_session_history(appointment_id)
where appointment_id is not null;

create index if not exists medical_records_appointment_id_idx
on public.medical_records(appointment_id);

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_schedule_blocks_updated_at on public.schedule_blocks;
create trigger set_schedule_blocks_updated_at
before update on public.schedule_blocks
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.patient_session_history enable row level security;

drop policy if exists "Authenticated users can read appointments" on public.appointments;
create policy "Authenticated users can read appointments"
on public.appointments for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert appointments" on public.appointments;
create policy "Authenticated users can insert appointments"
on public.appointments for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update appointments" on public.appointments;
create policy "Authenticated users can update appointments"
on public.appointments for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete appointments" on public.appointments;
create policy "Authenticated users can delete appointments"
on public.appointments for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read schedule blocks" on public.schedule_blocks;
create policy "Authenticated users can read schedule blocks"
on public.schedule_blocks for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert schedule blocks" on public.schedule_blocks;
create policy "Authenticated users can insert schedule blocks"
on public.schedule_blocks for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update schedule blocks" on public.schedule_blocks;
create policy "Authenticated users can update schedule blocks"
on public.schedule_blocks for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete schedule blocks" on public.schedule_blocks;
create policy "Authenticated users can delete schedule blocks"
on public.schedule_blocks for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read patient session history" on public.patient_session_history;
create policy "Authenticated users can read patient session history"
on public.patient_session_history for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert patient session history" on public.patient_session_history;
create policy "Authenticated users can insert patient session history"
on public.patient_session_history for insert
to authenticated
with check (true);
