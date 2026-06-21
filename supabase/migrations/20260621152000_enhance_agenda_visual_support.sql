alter table if exists public.appointments
  add column if not exists sessions_contracted integer not null default 1,
  add column if not exists sessions_completed integer not null default 0;

create table if not exists public.appointment_participants (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (appointment_id, patient_id)
);

insert into public.appointment_participants (appointment_id, patient_id)
select id, patient_id
from public.appointments
where patient_id is not null
on conflict (appointment_id, patient_id) do nothing;

drop index if exists public.patient_session_history_appointment_unique_idx;

create unique index if not exists patient_session_history_appointment_patient_unique_idx
  on public.patient_session_history(appointment_id, patient_id)
  where appointment_id is not null;

create index if not exists appointment_participants_appointment_idx
  on public.appointment_participants(appointment_id);

create index if not exists appointment_participants_patient_idx
  on public.appointment_participants(patient_id);

alter table public.appointment_participants enable row level security;

drop policy if exists "Authenticated users can select appointment participants"
  on public.appointment_participants;
drop policy if exists "Authenticated users can insert appointment participants"
  on public.appointment_participants;
drop policy if exists "Authenticated users can update appointment participants"
  on public.appointment_participants;
drop policy if exists "Authenticated users can delete appointment participants"
  on public.appointment_participants;

create policy "Authenticated users can select appointment participants"
  on public.appointment_participants
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert appointment participants"
  on public.appointment_participants
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update appointment participants"
  on public.appointment_participants
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete appointment participants"
  on public.appointment_participants
  for delete
  to authenticated
  using (true);

notify pgrst, 'reload schema';
