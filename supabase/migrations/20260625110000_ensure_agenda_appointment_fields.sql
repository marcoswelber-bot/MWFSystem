alter table public.appointments
  add column if not exists package_session_status text not null default 'not_applied',
  add column if not exists sessions_contracted integer not null default 1,
  add column if not exists sessions_completed integer not null default 0,
  add column if not exists appointment_type text not null default 'avulso',
  add column if not exists appointment_origin text not null default 'avulso',
  add column if not exists original_appointment_id uuid null,
  add column if not exists patient_package_id uuid null,
  add column if not exists is_billable boolean not null default true,
  add column if not exists consumes_package_session boolean not null default false;

alter table public.appointments
  drop constraint if exists appointments_appointment_type_check,
  add constraint appointments_appointment_type_check
    check (
      appointment_type in (
        'avulso',
        'pacote',
        'grupo',
        'avaliacao',
        'retorno',
        'encaixe',
        'cortesia',
        'convenio',
        'particular',
        'reposicao',
        'experimental',
        'reposicao_extra'
      )
    );

alter table public.appointments
  drop constraint if exists appointments_appointment_origin_check,
  add constraint appointments_appointment_origin_check
    check (
      appointment_origin in (
        'pacote',
        'avulso',
        'grupo',
        'convenio',
        'cortesia',
        'reposicao',
        'avaliacao',
        'retorno',
        'encaixe',
        'experimental',
        'reposicao_extra'
      )
    );

alter table public.appointments
  drop constraint if exists appointments_sessions_check,
  add constraint appointments_sessions_check
    check (
      sessions_contracted >= 0
      and sessions_completed >= 0
    );

alter table public.appointments
  drop constraint if exists appointments_original_appointment_id_fkey,
  add constraint appointments_original_appointment_id_fkey
    foreign key (original_appointment_id)
    references public.appointments(id)
    on delete set null;

update public.appointments
set
  is_billable = false,
  consumes_package_session = true
where appointment_type = 'reposicao'
   or appointment_type = 'reposicao_extra'
   or appointment_origin = 'reposicao'
   or appointment_origin = 'reposicao_extra';

update public.appointments
set consumes_package_session = true
where appointment_type = 'pacote'
   or appointment_origin = 'pacote';

create index if not exists appointments_type_idx
  on public.appointments(appointment_type);

create index if not exists appointments_origin_idx
  on public.appointments(appointment_origin);

create index if not exists appointments_original_appointment_idx
  on public.appointments(original_appointment_id);

create index if not exists appointments_patient_package_idx
  on public.appointments(patient_package_id);

notify pgrst, 'reload schema';
