alter table public.medical_records
  add column if not exists clinic_id uuid null;

create index if not exists medical_records_clinic_id_idx
on public.medical_records(clinic_id);

notify pgrst, 'reload schema';
