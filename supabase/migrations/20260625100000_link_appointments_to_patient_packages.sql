alter table public.appointments
  add column if not exists patient_package_id uuid null;

create index if not exists appointments_patient_package_idx
  on public.appointments(patient_package_id);

notify pgrst, 'reload schema';
