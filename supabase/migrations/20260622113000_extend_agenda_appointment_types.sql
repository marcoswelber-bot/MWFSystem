alter table public.appointments
  add column if not exists appointment_type text not null default 'avulso',
  add column if not exists appointment_origin text not null default 'avulso',
  add column if not exists original_appointment_id uuid null,
  add column if not exists is_billable boolean not null default true,
  add column if not exists consumes_package_session boolean not null default true;

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

create index if not exists appointments_type_idx
  on public.appointments(appointment_type);

create index if not exists appointments_origin_idx
  on public.appointments(appointment_origin);

create index if not exists appointments_original_appointment_idx
  on public.appointments(original_appointment_id);

notify pgrst, 'reload schema';
