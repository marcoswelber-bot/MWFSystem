-- Incremental clinic operations: employee roles, PIX, opening hours and audit.
create table if not exists public.employee_roles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

alter table public.employees add column if not exists role_id uuid null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'employees_role_id_fkey') then
    alter table public.employees add constraint employees_role_id_fkey
      foreign key (role_id) references public.employee_roles(id) on delete restrict;
  end if;
end $$;

alter table public.clinics add column if not exists pix_key_type text null;
alter table public.clinics add column if not exists pix_key text null;
alter table public.clinics add column if not exists pix_holder text null;
alter table public.clinics add column if not exists pix_bank text null;

create table if not exists public.clinic_opening_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_at time null,
  closes_at time null,
  break_starts_at time null,
  break_ends_at time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, weekday),
  check (not is_open or (opens_at is not null and closes_at is not null and opens_at < closes_at)),
  check ((break_starts_at is null and break_ends_at is null) or
         (break_starts_at is not null and break_ends_at is not null and break_starts_at < break_ends_at))
);

create table if not exists public.operational_audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid null,
  action text not null,
  entity_type text null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_roles_clinic_status_idx on public.employee_roles(clinic_id, status);
create index if not exists opening_hours_clinic_idx on public.clinic_opening_hours(clinic_id, weekday);
create index if not exists operational_audit_clinic_created_idx on public.operational_audit_logs(clinic_id, created_at desc);

drop trigger if exists set_employee_roles_updated_at on public.employee_roles;
create trigger set_employee_roles_updated_at before update on public.employee_roles
for each row execute function public.set_updated_at();
drop trigger if exists set_clinic_opening_hours_updated_at on public.clinic_opening_hours;
create trigger set_clinic_opening_hours_updated_at before update on public.clinic_opening_hours
for each row execute function public.set_updated_at();

-- Preserve every existing function value and seed common values per clinic.
insert into public.employee_roles (clinic_id, name)
select distinct e.clinic_id, trim(e.role)
from public.employees e
where e.clinic_id is not null and nullif(trim(e.role), '') is not null
on conflict (clinic_id, name) do nothing;

insert into public.employee_roles (clinic_id, name)
select c.id, role_name from public.clinics c cross join unnest(array[
  'Fisioterapeuta','Recepcionista','Gerente','Coordenador','Auxiliar','Financeiro',
  'Massoterapeuta','Psicólogo','Fonoaudiólogo','Administrador'
]) role_name on conflict (clinic_id, name) do nothing;

update public.employees e set role_id = r.id
from public.employee_roles r
where e.role_id is null and r.clinic_id = e.clinic_id and lower(r.name) = lower(trim(e.role));

insert into public.clinic_opening_hours (clinic_id, weekday, is_open, opens_at, closes_at)
select c.id, d.weekday, d.weekday between 1 and 5,
       case when d.weekday between 1 and 5 then '08:00'::time end,
       case when d.weekday between 1 and 5 then '18:00'::time end
from public.clinics c cross join generate_series(0, 6) d(weekday)
on conflict (clinic_id, weekday) do nothing;

create or replace function public.mwf_can_access_clinic(target_clinic_id uuid, module_name text, action_name text)
returns boolean language sql stable security definer set search_path = pg_catalog, public set row_security = off as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.employees e
    where e.status = 'active' and e.system_access
      and lower(e.login_email) = lower(auth.jwt() ->> 'email')
      and (
        lower(regexp_replace(coalesce(e.role, ''), '[^a-zA-Z0-9]+', '_', 'g')) in ('adm_master', 'admin_master')
        or (e.clinic_id = target_clinic_id and exists (
          select 1 from public.user_permissions p where p.employee_id = e.id and p.module_key = module_name
            and case action_name when 'view' then p.can_view when 'create' then p.can_create when 'edit' then p.can_edit when 'delete' then p.can_delete when 'toggle' then p.can_toggle else false end
        ))
      )
  )
$$;
grant execute on function public.mwf_can_access_clinic(uuid, text, text) to authenticated;
alter table public.employee_roles enable row level security;
alter table public.clinic_opening_hours enable row level security;
alter table public.operational_audit_logs enable row level security;

create policy employee_roles_select on public.employee_roles for select to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'funcoes', 'view'));
create policy employee_roles_insert on public.employee_roles for insert to authenticated
with check (public.mwf_can_access_clinic(clinic_id, 'funcoes', 'create'));
create policy employee_roles_update on public.employee_roles for update to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'funcoes', 'edit') or public.mwf_can_access_clinic(clinic_id, 'funcoes', 'toggle'))
with check (public.mwf_can_access_clinic(clinic_id, 'funcoes', 'edit') or public.mwf_can_access_clinic(clinic_id, 'funcoes', 'toggle'));
create policy employee_roles_delete on public.employee_roles for delete to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'funcoes', 'delete'));

create policy opening_hours_select on public.clinic_opening_hours for select to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'clinicas', 'view'));
create policy opening_hours_insert on public.clinic_opening_hours for insert to authenticated
with check (public.mwf_can_access_clinic(clinic_id, 'clinicas', 'edit'));
create policy opening_hours_update on public.clinic_opening_hours for update to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'clinicas', 'edit')) with check (public.mwf_can_access_clinic(clinic_id, 'clinicas', 'edit'));
create policy audit_select on public.operational_audit_logs for select to authenticated
using (public.mwf_can_access_clinic(clinic_id, 'configuracoes', 'view'));
create policy audit_insert on public.operational_audit_logs for insert to authenticated
with check (public.mwf_can_access_clinic(clinic_id, 'financeiro', 'view') or public.mwf_can_access_clinic(clinic_id, 'mwf_ia', 'view'));

grant select, insert, update, delete on public.employee_roles to authenticated;
grant select, insert, update on public.clinic_opening_hours to authenticated;
grant select, insert on public.operational_audit_logs to authenticated;

create or replace function public.validate_appointment_opening_hours()
returns trigger language plpgsql security definer set search_path = public as $$
declare h public.clinic_opening_hours%rowtype; appointment_end time;
begin
  select * into h from public.clinic_opening_hours
   where clinic_id = new.clinic_id and weekday = extract(dow from new.appointment_date)::smallint;
  -- Compatibility: clinics without configuration keep their previous behavior.
  if not found then return new; end if;
  if not h.is_open then raise exception 'A clínica está fechada neste dia.'; end if;
  appointment_end := coalesce(new.end_time, new.start_time);
  if new.start_time < h.opens_at or appointment_end > h.closes_at then
    raise exception 'O horário está fora do funcionamento da clínica.';
  end if;
  if h.break_starts_at is not null and new.start_time < h.break_ends_at and appointment_end > h.break_starts_at then
    raise exception 'O horário coincide com o intervalo da clínica.';
  end if;
  return new;
end $$;
drop trigger if exists validate_appointment_opening_hours on public.appointments;
create trigger validate_appointment_opening_hours before insert or update of clinic_id, appointment_date, start_time, end_time
on public.appointments for each row execute function public.validate_appointment_opening_hours();
