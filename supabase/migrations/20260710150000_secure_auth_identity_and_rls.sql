-- Security hardening: canonical Auth identity, credential cleanup and tenant RLS.
-- Apply manually only after reviewing the validation queries in this migration.
-- Optional: replace the empty value below with the Auth UUID of the expected ADM.

begin;
set local mwf.expected_adm_auth_user_id = '';

alter table public.employees add column if not exists auth_user_id uuid null references auth.users(id) on delete set null;
alter table public.patients add column if not exists auth_user_id uuid null references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.employees'::regclass
      and c.contype = 'f'
      and a.attname = 'auth_user_id'
      and c.confrelid = 'auth.users'::regclass
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey_secure
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.patients'::regclass
      and c.contype = 'f'
      and a.attname = 'auth_user_id'
      and c.confrelid = 'auth.users'::regclass
  ) then
    alter table public.patients
      add constraint patients_auth_user_id_fkey_secure
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

do $$
declare
  expected_adm uuid := nullif(current_setting('mwf.expected_adm_auth_user_id', true), '')::uuid;
begin
  if exists (
    select 1
    from public.employees e
    join auth.users login_user
      on lower(trim(login_user.email)) = lower(trim(e.login_email))
    join auth.users contact_user
      on lower(trim(contact_user.email)) = lower(trim(e.email))
    where login_user.id <> contact_user.id
  ) then
    raise exception 'RLS migration aborted: an employee login_email and email match different Auth users.';
  end if;

  if exists (
    select 1
    from public.patients p
    join auth.users login_user
      on lower(trim(login_user.email)) = lower(trim(p.login_email))
    join auth.users contact_user
      on lower(trim(contact_user.email)) = lower(trim(p.email))
    where login_user.id <> contact_user.id
  ) then
    raise exception 'RLS migration aborted: a patient login_email and email match different Auth users.';
  end if;

  if exists (
    select 1
    from public.employees e
    join auth.users u
      on lower(trim(u.email)) = lower(trim(coalesce(nullif(trim(e.login_email), ''), nullif(trim(e.email), ''))))
    group by u.id
    having count(*) > 1
  ) then
    raise exception 'RLS migration aborted: more than one employee matches the same Auth user.';
  end if;

  if exists (
    select 1
    from public.patients p
    join auth.users u
      on lower(trim(u.email)) = lower(trim(coalesce(nullif(trim(p.login_email), ''), nullif(trim(p.email), ''))))
    group by u.id
    having count(*) > 1
  ) then
    raise exception 'RLS migration aborted: more than one patient matches the same Auth user.';
  end if;

  if exists (
    select 1
    from public.employees e
    left join auth.users linked_user on linked_user.id = e.auth_user_id
    left join auth.users email_user
      on lower(trim(email_user.email)) =
         lower(trim(coalesce(nullif(trim(e.login_email), ''), nullif(trim(e.email), ''))))
    where e.auth_user_id is not null
      and (
        linked_user.id is null
        or (email_user.id is not null and email_user.id <> e.auth_user_id)
      )
  ) then
    raise exception 'RLS migration aborted: an existing employee auth_user_id is invalid or conflicts with email.';
  end if;

  if exists (
    select 1
    from public.patients p
    left join auth.users linked_user on linked_user.id = p.auth_user_id
    left join auth.users email_user
      on lower(trim(email_user.email)) =
         lower(trim(coalesce(nullif(trim(p.login_email), ''), nullif(trim(p.email), ''))))
    where p.auth_user_id is not null
      and (
        linked_user.id is null
        or (email_user.id is not null and email_user.id <> p.auth_user_id)
      )
  ) then
    raise exception 'RLS migration aborted: an existing patient auth_user_id is invalid or conflicts with email.';
  end if;

  if expected_adm is not null
     and not exists (select 1 from auth.users where id = expected_adm) then
    raise exception 'RLS migration aborted: expected ADM Auth UUID does not exist.';
  end if;
end $$;

update public.employees e
set auth_user_id = u.id
from auth.users u
where e.auth_user_id is null
  and u.email is not null
  and lower(trim(u.email)) =
      lower(trim(coalesce(nullif(trim(e.login_email), ''), nullif(trim(e.email), ''))));

update public.patients p
set auth_user_id = u.id
from auth.users u
where p.auth_user_id is null
  and u.email is not null
  and lower(trim(u.email)) =
      lower(trim(coalesce(nullif(trim(p.login_email), ''), nullif(trim(p.email), ''))));

do $$
declare
  expected_adm uuid := nullif(current_setting('mwf.expected_adm_auth_user_id', true), '')::uuid;
begin
  if exists (
    select 1 from public.employees
    where system_access and status = 'active' and auth_user_id is null
  ) then
    raise exception 'RLS migration aborted: active employees with system access are missing an Auth user link.';
  end if;

  if exists (
    select 1 from public.patients
    where portal_access and status = 'active' and auth_user_id is null
  ) then
    raise exception 'RLS migration aborted: active patients with portal access are missing an Auth user link.';
  end if;

  if exists (
    select 1
    from public.employees e
    join public.patients p on p.auth_user_id = e.auth_user_id
    where e.auth_user_id is not null
  ) then
    raise exception 'RLS migration aborted: one Auth user is linked to both an employee and a patient.';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.auth_user_id is not null
      and e.status = 'active'
      and e.system_access
      and lower(regexp_replace(coalesce(e.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
          in ('adm_master', 'admin_master')
      and (expected_adm is null or e.auth_user_id = expected_adm)
  ) then
    raise exception 'RLS migration aborted: no valid ADM Master remains after Auth backfill.';
  end if;
end $$;

drop index if exists public.employees_auth_user_id_uidx;
drop index if exists public.patients_auth_user_id_uidx;
create unique index employees_auth_user_id_uidx
  on public.employees(auth_user_id) where auth_user_id is not null;
create unique index patients_auth_user_id_uidx
  on public.patients(auth_user_id) where auth_user_id is not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees'
      and column_name = 'temporary_password'
  ) then
    execute 'update public.employees set temporary_password = null where temporary_password is not null';
    execute 'alter table public.employees drop column temporary_password';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients'
      and column_name = 'temporary_password'
  ) then
    execute 'update public.patients set temporary_password = null where temporary_password is not null';
    execute 'alter table public.patients drop column temporary_password';
  end if;
end $$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
    and e.status = 'active'
    and e.system_access
  limit 1
$$;

create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select p.id
  from public.patients p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and p.portal_access
  limit 1
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select coalesce(
    (select e.clinic_id from public.employees e
     where e.auth_user_id = auth.uid() and e.status = 'active' and e.system_access limit 1),
    (select p.clinic_id from public.patients p
     where p.auth_user_id = auth.uid() and p.status = 'active' and p.portal_access limit 1)
  )
$$;

create or replace function public.is_adm_master()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and e.status = 'active'
      and e.system_access
      and lower(regexp_replace(e.role, '[^a-zA-Z0-9]+', '_', 'g'))
          in ('adm_master', 'admin_master')
  )
$$;

create or replace function public.has_permission(module_name text, action_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select public.is_adm_master() or exists (
    select 1
    from public.employees e
    join public.user_permissions up on up.employee_id = e.id
    where e.auth_user_id = auth.uid()
      and e.status = 'active'
      and e.system_access
      and up.module_key = module_name
      and case action_name
        when 'view' then up.can_view
        when 'create' then up.can_create
        when 'edit' then up.can_edit
        when 'delete' then up.can_delete
        when 'toggle' then up.can_toggle
        when 'export' then up.can_export
        when 'import' then up.can_import
        else false
      end
  )
$$;

create or replace function public.can_access_clinic(target_clinic_id uuid, module_name text, action_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select public.is_adm_master() or exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and e.status = 'active'
      and e.system_access
      and target_clinic_id is not null
      and e.clinic_id = target_clinic_id
      and public.has_permission(module_name, action_name)
  )
$$;

create or replace function public.can_read_clinic(target_clinic_id uuid, module_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select public.can_access_clinic(target_clinic_id, module_name, 'view')
      or public.can_access_clinic(target_clinic_id, 'relatorios', 'view')
$$;

create or replace function public.can_access_service(target_id uuid, module_name text, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.services s
    where s.id = target_id
      and (
        public.can_access_clinic(s.clinic_id, module_name, action_name)
        or (
          s.clinic_id is null
          and action_name = 'view'
          and public.has_permission(module_name, 'view')
        )
      )
  )
$$;

create or replace function public.can_access_service_package(target_id uuid, module_name text, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.service_packages p
    where p.id = target_id
      and (
        public.can_access_clinic(p.clinic_id, module_name, action_name)
        or (
          p.clinic_id is null
          and action_name = 'view'
          and public.has_permission(module_name, 'view')
        )
      )
  )
$$;

create or replace function public.can_access_protocol(target_id uuid, module_name text, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.treatment_protocols p
    where p.id = target_id
      and (
        public.can_access_clinic(p.clinic_id, module_name, action_name)
        or (
          p.clinic_id is null
          and action_name = 'view'
          and public.has_permission(module_name, 'view')
        )
      )
  )
$$;

create or replace function public.can_access_employee(target_id uuid, module_name text, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_id
      and public.can_access_clinic(e.clinic_id, module_name, action_name)
  )
$$;

create or replace function public.can_access_appointment(target_id uuid, module_name text, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.appointments a
    where a.id = target_id
      and public.can_access_clinic(a.clinic_id, module_name, action_name)
  )
$$;

create or replace function public.can_access_financial_transaction(target_id uuid, action_name text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1 from public.financial_transactions f
    where f.id = target_id
      and public.can_access_clinic(f.clinic_id, 'financeiro', action_name)
  )
$$;

revoke all on function public.current_employee_id() from public;
revoke all on function public.current_patient_id() from public;
revoke all on function public.current_clinic_id() from public;
revoke all on function public.is_adm_master() from public;
revoke all on function public.has_permission(text, text) from public;
revoke all on function public.can_access_clinic(uuid, text, text) from public;
revoke all on function public.can_read_clinic(uuid, text) from public;
revoke all on function public.can_access_service(uuid, text, text) from public;
revoke all on function public.can_access_service_package(uuid, text, text) from public;
revoke all on function public.can_access_protocol(uuid, text, text) from public;
revoke all on function public.can_access_employee(uuid, text, text) from public;
revoke all on function public.can_access_appointment(uuid, text, text) from public;
revoke all on function public.can_access_financial_transaction(uuid, text) from public;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_patient_id() to authenticated;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.is_adm_master() to authenticated;
grant execute on function public.has_permission(text, text) to authenticated;
grant execute on function public.can_access_clinic(uuid, text, text) to authenticated;
grant execute on function public.can_read_clinic(uuid, text) to authenticated;
grant execute on function public.can_access_service(uuid, text, text) to authenticated;
grant execute on function public.can_access_service_package(uuid, text, text) to authenticated;
grant execute on function public.can_access_protocol(uuid, text, text) to authenticated;
grant execute on function public.can_access_employee(uuid, text, text) to authenticated;
grant execute on function public.can_access_appointment(uuid, text, text) to authenticated;
grant execute on function public.can_access_financial_transaction(uuid, text) to authenticated;

create or replace function public.protect_adm_employee_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  old_is_adm boolean := false;
  new_is_adm boolean := false;
  privileged boolean := auth.role() = 'service_role' or public.is_adm_master();
begin
  if tg_op = 'UPDATE' then
    old_is_adm := lower(regexp_replace(coalesce(old.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
      in ('adm_master', 'admin_master');
  end if;

  new_is_adm := lower(regexp_replace(coalesce(new.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
    in ('adm_master', 'admin_master');

  if (old_is_adm or new_is_adm) and not privileged then
    raise exception 'Only an ADM Master can create or modify an ADM Master employee.';
  end if;

  if not privileged and (
    new.auth_user_id is distinct from case when tg_op = 'UPDATE' then old.auth_user_id else null end
    or new.system_access is distinct from case when tg_op = 'UPDATE' then old.system_access else false end
    or new.login_email is distinct from case when tg_op = 'UPDATE' then old.login_email else null end
  ) then
    raise exception 'Only a trusted server operation can modify employee authentication fields.';
  end if;

  return new;
end
$$;

revoke all on function public.protect_adm_employee_role() from public;

drop trigger if exists protect_adm_employee_role on public.employees;
create trigger protect_adm_employee_role
before insert or update on public.employees
for each row execute function public.protect_adm_employee_role();

create or replace function public.protect_patient_auth_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  privileged boolean := auth.role() = 'service_role' or public.is_adm_master();
begin
  if not privileged and (
    new.auth_user_id is distinct from case when tg_op = 'UPDATE' then old.auth_user_id else null end
    or new.portal_access is distinct from case when tg_op = 'UPDATE' then old.portal_access else false end
    or new.login_email is distinct from case when tg_op = 'UPDATE' then old.login_email else null end
  ) then
    raise exception 'Only a trusted server operation can modify patient authentication fields.';
  end if;

  return new;
end
$$;

revoke all on function public.protect_patient_auth_fields() from public;

drop trigger if exists protect_patient_auth_fields on public.patients;
create trigger protect_patient_auth_fields
before insert or update on public.patients
for each row execute function public.protect_patient_auth_fields();

create or replace function public.enforce_toggle_only_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  module_name text := tg_argv[0];
  toggle_column text := tg_argv[1];
  old_payload jsonb;
  new_payload jsonb;
begin
  if auth.role() = 'service_role'
     or public.is_adm_master()
     or public.has_permission(module_name, 'edit') then
    return new;
  end if;

  if not public.has_permission(module_name, 'toggle') then
    return new;
  end if;

  old_payload := to_jsonb(old) - toggle_column - 'updated_at' - 'updated_by';
  new_payload := to_jsonb(new) - toggle_column - 'updated_at' - 'updated_by';

  if old_payload is distinct from new_payload then
    raise exception 'Toggle permission can only modify the configured status field.';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_toggle_only_update() from public;

drop trigger if exists enforce_toggle_only_clinics on public.clinics;
create trigger enforce_toggle_only_clinics
before update on public.clinics for each row
execute function public.enforce_toggle_only_update('clinicas', 'status');

drop trigger if exists enforce_toggle_only_employees on public.employees;
create trigger enforce_toggle_only_employees
before update on public.employees for each row
execute function public.enforce_toggle_only_update('funcionarios', 'status');

drop trigger if exists enforce_toggle_only_patients on public.patients;
create trigger enforce_toggle_only_patients
before update on public.patients for each row
execute function public.enforce_toggle_only_update('pacientes', 'status');

drop trigger if exists enforce_toggle_only_services on public.services;
create trigger enforce_toggle_only_services
before update on public.services for each row
execute function public.enforce_toggle_only_update('servicos', 'status');

drop trigger if exists enforce_toggle_only_medical_records on public.medical_records;
create trigger enforce_toggle_only_medical_records
before update on public.medical_records for each row
execute function public.enforce_toggle_only_update('prontuarios', 'status');

drop trigger if exists enforce_toggle_only_commissions on public.professional_service_commissions;
create trigger enforce_toggle_only_commissions
before update on public.professional_service_commissions for each row
execute function public.enforce_toggle_only_update('comissoes', 'active');

create or replace function public.enforce_agenda_package_counter_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  old_payload jsonb;
  new_payload jsonb;
  valid_counter_change boolean;
begin
  if auth.role() = 'service_role'
     or public.is_adm_master()
     or public.has_permission('pacotes', 'edit') then
    return new;
  end if;

  if not public.can_access_clinic(old.clinic_id, 'agenda', 'edit') then
    return new;
  end if;

  old_payload := to_jsonb(old)
    - 'completed_sessions' - 'remaining_sessions' - 'updated_at';
  new_payload := to_jsonb(new)
    - 'completed_sessions' - 'remaining_sessions' - 'updated_at';

  valid_counter_change :=
    (
      new.completed_sessions = old.completed_sessions + 1
      and new.remaining_sessions = old.remaining_sessions - 1
    )
    or (
      new.completed_sessions = old.completed_sessions - 1
      and new.remaining_sessions = old.remaining_sessions + 1
    );

  if old_payload is distinct from new_payload
     or not valid_counter_change
     or new.completed_sessions < 0
     or new.remaining_sessions < 0
     or not exists (
       select 1
       from public.appointments a
       where a.patient_package_id = old.id
         and a.clinic_id = old.clinic_id
         and a.patient_id = old.patient_id
         and a.service_id = old.service_id
     ) then
    raise exception 'Agenda can only consume or roll back one session from a linked package.';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_agenda_package_counter_update() from public;

drop trigger if exists enforce_agenda_package_counter_update on public.patient_packages;
create trigger enforce_agenda_package_counter_update
before update on public.patient_packages for each row
execute function public.enforce_agenda_package_counter_update();

do $$
begin
  if exists (
    select 1 from public.employees
    where status = 'active' and system_access and clinic_id is null
      and lower(regexp_replace(coalesce(role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
          not in ('adm_master', 'admin_master')
  ) then
    raise exception 'RLS migration aborted: an active non-ADM employee has no clinic_id.';
  end if;

  if exists (
    select 1 from public.patients
    where status = 'active' and portal_access and clinic_id is null
  ) then
    raise exception 'RLS migration aborted: an active portal patient has no clinic_id.';
  end if;

  if exists (select 1 from public.medical_records where clinic_id is null) then
    raise exception 'RLS migration aborted: medical_records contains rows without clinic_id.';
  end if;
end $$;

do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'clinics', 'employees', 'patients', 'medical_records', 'services',
    'service_categories', 'service_professionals', 'service_packages',
    'service_package_items', 'service_discounts', 'commercial_rules',
    'treatment_goals', 'treatment_protocols', 'treatment_protocol_steps',
    'service_required_documents', 'service_resources', 'internal_notifications',
    'service_audit_logs', 'professional_service_commissions',
    'professional_service_commission_history', 'user_permissions',
    'appointments', 'schedule_blocks', 'patient_session_history',
    'appointment_participants', 'patient_packages', 'financial_transactions',
    'payment_settlements', 'payroll_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;
  end loop;
end $$;

do $$
declare
  policy_record record;
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
    loop
      execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
    end loop;

    execute 'create policy secure_profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_adm_master())';
    execute 'create policy secure_profiles_insert on public.profiles for insert to authenticated with check (public.is_adm_master())';
    execute 'create policy secure_profiles_update on public.profiles for update to authenticated using (public.is_adm_master()) with check (public.is_adm_master())';
    execute 'create policy secure_profiles_delete on public.profiles for delete to authenticated using (public.is_adm_master())';
  end if;
end $$;

create policy secure_clinics_select on public.clinics for select to authenticated
using (
  public.is_adm_master()
  or id = public.current_clinic_id()
);
create policy secure_clinics_insert on public.clinics for insert to authenticated
with check (public.is_adm_master() or public.has_permission('clinicas', 'create'));
create policy secure_clinics_update on public.clinics for update to authenticated
using (public.can_access_clinic(id, 'clinicas', 'edit'))
with check (public.can_access_clinic(id, 'clinicas', 'edit'));
create policy secure_clinics_delete on public.clinics for delete to authenticated
using (public.can_access_clinic(id, 'clinicas', 'delete'));

create policy secure_employees_select on public.employees for select to authenticated
using (
  auth_user_id = auth.uid()
  or public.can_read_clinic(clinic_id, 'funcionarios')
  or public.can_access_clinic(clinic_id, 'servicos', 'view')
  or public.can_access_clinic(clinic_id, 'comissoes', 'view')
  or public.can_access_clinic(clinic_id, 'agenda', 'view')
  or public.can_access_clinic(clinic_id, 'financeiro', 'view')
  or public.can_access_clinic(clinic_id, 'pacotes', 'view')
  or public.can_access_clinic(clinic_id, 'prontuarios', 'view')
);
create policy secure_employees_insert on public.employees for insert to authenticated
with check (public.can_access_clinic(clinic_id, 'funcionarios', 'create'));
create policy secure_employees_update on public.employees for update to authenticated
using (
  public.can_access_clinic(clinic_id, 'funcionarios', 'edit')
  or public.can_access_clinic(clinic_id, 'funcionarios', 'toggle')
)
with check (
  public.can_access_clinic(clinic_id, 'funcionarios', 'edit')
  or public.can_access_clinic(clinic_id, 'funcionarios', 'toggle')
);
create policy secure_employees_delete on public.employees for delete to authenticated
using (public.can_access_clinic(clinic_id, 'funcionarios', 'delete'));

create policy secure_patients_select on public.patients for select to authenticated
using (
  auth_user_id = auth.uid()
  or public.can_read_clinic(clinic_id, 'pacientes')
  or public.can_access_clinic(clinic_id, 'agenda', 'view')
  or public.can_access_clinic(clinic_id, 'financeiro', 'view')
  or public.can_access_clinic(clinic_id, 'pacotes', 'view')
  or public.can_access_clinic(clinic_id, 'prontuarios', 'view')
);
create policy secure_patients_insert on public.patients for insert to authenticated
with check (public.can_access_clinic(clinic_id, 'pacientes', 'create'));
create policy secure_patients_update on public.patients for update to authenticated
using (
  public.can_access_clinic(clinic_id, 'pacientes', 'edit')
  or public.can_access_clinic(clinic_id, 'pacientes', 'toggle')
)
with check (
  public.can_access_clinic(clinic_id, 'pacientes', 'edit')
  or public.can_access_clinic(clinic_id, 'pacientes', 'toggle')
);
create policy secure_patients_delete on public.patients for delete to authenticated
using (public.can_access_clinic(clinic_id, 'pacientes', 'delete'));

create policy secure_user_permissions_select on public.user_permissions for select to authenticated
using (employee_id = public.current_employee_id() or public.is_adm_master());
create policy secure_user_permissions_insert on public.user_permissions for insert to authenticated
with check (public.is_adm_master());
create policy secure_user_permissions_update on public.user_permissions for update to authenticated
using (public.is_adm_master()) with check (public.is_adm_master());
create policy secure_user_permissions_delete on public.user_permissions for delete to authenticated
using (public.is_adm_master());

create or replace procedure public.install_clinic_policies(
  table_name text,
  module_name text
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  execute format(
    'create policy secure_%1$s_select on public.%1$I for select to authenticated using (public.can_read_clinic(clinic_id, %2$L))',
    table_name, module_name
  );
  execute format(
    'create policy secure_%1$s_insert on public.%1$I for insert to authenticated with check (public.can_access_clinic(clinic_id, %2$L, ''create''))',
    table_name, module_name
  );
  execute format(
    'create policy secure_%1$s_update on public.%1$I for update to authenticated using (public.can_access_clinic(clinic_id, %2$L, ''edit'') or public.can_access_clinic(clinic_id, %2$L, ''toggle'')) with check (public.can_access_clinic(clinic_id, %2$L, ''edit'') or public.can_access_clinic(clinic_id, %2$L, ''toggle''))',
    table_name, module_name
  );
  execute format(
    'create policy secure_%1$s_delete on public.%1$I for delete to authenticated using (public.can_access_clinic(clinic_id, %2$L, ''delete''))',
    table_name, module_name
  );
end
$$;

call public.install_clinic_policies('service_categories', 'tipos_servico');
call public.install_clinic_policies('service_packages', 'pacotes');
call public.install_clinic_policies('service_discounts', 'descontos');
call public.install_clinic_policies('commercial_rules', 'regras');
call public.install_clinic_policies('treatment_protocols', 'protocolos');
call public.install_clinic_policies('internal_notifications', 'notificacoes');
call public.install_clinic_policies('schedule_blocks', 'agenda');
call public.install_clinic_policies('medical_records', 'prontuarios');
call public.install_clinic_policies('financial_transactions', 'financeiro');
call public.install_clinic_policies('payroll_entries', 'financeiro');

drop procedure public.install_clinic_policies(text, text);

drop policy secure_service_categories_select on public.service_categories;
drop policy secure_service_categories_insert on public.service_categories;
drop policy secure_service_categories_update on public.service_categories;
drop policy secure_service_categories_delete on public.service_categories;
create policy secure_service_categories_select on public.service_categories
for select to authenticated
using (
  public.can_read_clinic(clinic_id, 'tipos_servico')
  or public.can_access_clinic(clinic_id, 'servicos', 'view')
  or (
    clinic_id is null
    and (
      public.has_permission('tipos_servico', 'view')
      or public.has_permission('servicos', 'view')
    )
  )
);
create policy secure_service_categories_insert on public.service_categories
for insert to authenticated with check (public.is_adm_master());
create policy secure_service_categories_update on public.service_categories
for update to authenticated
using (public.is_adm_master()) with check (public.is_adm_master());
create policy secure_service_categories_delete on public.service_categories
for delete to authenticated using (public.is_adm_master());

drop policy secure_financial_transactions_select on public.financial_transactions;
create policy secure_financial_transactions_select on public.financial_transactions
for select to authenticated
using (
  public.can_read_clinic(clinic_id, 'financeiro')
  or public.can_access_clinic(clinic_id, 'dashboard', 'view')
);

create policy secure_global_service_packages_select on public.service_packages
for select to authenticated
using (clinic_id is null and public.has_permission('pacotes', 'view'));
create policy secure_global_service_discounts_select on public.service_discounts
for select to authenticated
using (clinic_id is null and public.has_permission('descontos', 'view'));
create policy secure_global_commercial_rules_select on public.commercial_rules
for select to authenticated
using (clinic_id is null and public.has_permission('regras', 'view'));
create policy secure_global_treatment_protocols_select on public.treatment_protocols
for select to authenticated
using (clinic_id is null and public.has_permission('protocolos', 'view'));

-- Services are shared with operational modules for reads, but only the service
-- permission can mutate them.
create policy secure_services_select on public.services for select to authenticated
using (
  public.can_read_clinic(clinic_id, 'servicos')
  or public.can_access_clinic(clinic_id, 'agenda', 'view')
  or public.can_access_clinic(clinic_id, 'financeiro', 'view')
  or public.can_access_clinic(clinic_id, 'pacotes', 'view')
  or public.can_access_clinic(clinic_id, 'prontuarios', 'view')
  or (clinic_id is null and public.has_permission('servicos', 'view'))
);
create policy secure_services_insert on public.services for insert to authenticated
with check (public.can_access_clinic(clinic_id, 'servicos', 'create'));
create policy secure_services_update on public.services for update to authenticated
using (
  public.can_access_clinic(clinic_id, 'servicos', 'edit')
  or public.can_access_clinic(clinic_id, 'servicos', 'toggle')
)
with check (
  public.can_access_clinic(clinic_id, 'servicos', 'edit')
  or public.can_access_clinic(clinic_id, 'servicos', 'toggle')
);
create policy secure_services_delete on public.services for delete to authenticated
using (public.can_access_clinic(clinic_id, 'servicos', 'delete'));

-- Global treatment goals are available only to authorized service users.
create policy secure_treatment_goals_select on public.treatment_goals for select to authenticated
using (public.has_permission('servicos', 'view') or public.has_permission('protocolos', 'view'));
create policy secure_treatment_goals_insert on public.treatment_goals for insert to authenticated
with check (public.is_adm_master());
create policy secure_treatment_goals_update on public.treatment_goals for update to authenticated
using (public.is_adm_master()) with check (public.is_adm_master());
create policy secure_treatment_goals_delete on public.treatment_goals for delete to authenticated
using (public.is_adm_master());

create or replace procedure public.install_service_reference_policies(
  table_name text,
  column_name text,
  helper_name text,
  module_name text
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  execute format(
    'create policy secure_%1$s_select on public.%1$I for select to authenticated using (public.%2$I(%3$I, %4$L, ''view''))',
    table_name, helper_name, column_name, module_name
  );
  execute format(
    'create policy secure_%1$s_insert on public.%1$I for insert to authenticated with check (public.%2$I(%3$I, %4$L, ''create''))',
    table_name, helper_name, column_name, module_name
  );
  execute format(
    'create policy secure_%1$s_update on public.%1$I for update to authenticated using (public.%2$I(%3$I, %4$L, ''edit'') or public.%2$I(%3$I, %4$L, ''toggle'')) with check (public.%2$I(%3$I, %4$L, ''edit'') or public.%2$I(%3$I, %4$L, ''toggle''))',
    table_name, helper_name, column_name, module_name
  );
  execute format(
    'create policy secure_%1$s_delete on public.%1$I for delete to authenticated using (public.%2$I(%3$I, %4$L, ''delete''))',
    table_name, helper_name, column_name, module_name
  );
end
$$;

call public.install_service_reference_policies(
  'service_professionals', 'service_id', 'can_access_service', 'comissoes'
);
call public.install_service_reference_policies(
  'service_package_items', 'package_id', 'can_access_service_package', 'pacotes'
);
call public.install_service_reference_policies(
  'treatment_protocol_steps', 'protocol_id', 'can_access_protocol', 'protocolos'
);
call public.install_service_reference_policies(
  'service_required_documents', 'service_id', 'can_access_service', 'servicos'
);
call public.install_service_reference_policies(
  'service_resources', 'service_id', 'can_access_service', 'recursos'
);
call public.install_service_reference_policies(
  'professional_service_commissions', 'professional_id', 'can_access_employee', 'comissoes'
);

drop procedure public.install_service_reference_policies(text, text, text, text);

create policy secure_service_audit_logs_select on public.service_audit_logs for select to authenticated
using (
  service_id is not null
  and public.can_access_service(service_id, 'servicos', 'view')
);
create policy secure_service_audit_logs_insert on public.service_audit_logs for insert to authenticated
with check (
  service_id is not null
  and (
    public.can_access_service(service_id, 'servicos', 'create')
    or public.can_access_service(service_id, 'servicos', 'edit')
    or public.can_access_service(service_id, 'servicos', 'delete')
  )
);
-- Audit rows are append-only: no update/delete policy is intentionally created.

create policy secure_commission_history_select
on public.professional_service_commission_history for select to authenticated
using (
  professional_id is not null
  and public.can_access_employee(professional_id, 'comissoes', 'view')
);
create policy secure_commission_history_insert
on public.professional_service_commission_history for insert to authenticated
with check (
  professional_id is not null
  and (
    public.can_access_employee(professional_id, 'comissoes', 'create')
    or public.can_access_employee(professional_id, 'comissoes', 'edit')
    or public.can_access_employee(professional_id, 'comissoes', 'delete')
  )
);
-- Commission history is append-only.

create policy secure_appointments_select on public.appointments for select to authenticated
using (
  patient_id = public.current_patient_id()
  or public.can_read_clinic(clinic_id, 'agenda')
  or public.can_access_clinic(clinic_id, 'dashboard', 'view')
);
create policy secure_appointments_insert on public.appointments for insert to authenticated
with check (public.can_access_clinic(clinic_id, 'agenda', 'create'));
create policy secure_appointments_update on public.appointments for update to authenticated
using (public.can_access_clinic(clinic_id, 'agenda', 'edit'))
with check (public.can_access_clinic(clinic_id, 'agenda', 'edit'));
create policy secure_appointments_delete on public.appointments for delete to authenticated
using (public.can_access_clinic(clinic_id, 'agenda', 'delete'));

create policy secure_appointment_participants_select
on public.appointment_participants for select to authenticated
using (
  patient_id = public.current_patient_id()
  or public.can_access_appointment(appointment_id, 'agenda', 'view')
);
create policy secure_appointment_participants_insert
on public.appointment_participants for insert to authenticated
with check (
  public.can_access_appointment(appointment_id, 'agenda', 'create')
  or public.can_access_appointment(appointment_id, 'agenda', 'edit')
);
create policy secure_appointment_participants_update
on public.appointment_participants for update to authenticated
using (public.can_access_appointment(appointment_id, 'agenda', 'edit'))
with check (public.can_access_appointment(appointment_id, 'agenda', 'edit'));
create policy secure_appointment_participants_delete
on public.appointment_participants for delete to authenticated
using (
  public.can_access_appointment(appointment_id, 'agenda', 'delete')
  or public.can_access_appointment(appointment_id, 'agenda', 'edit')
);

create policy secure_patient_session_history_select
on public.patient_session_history for select to authenticated
using (
  patient_id = public.current_patient_id()
  or public.can_read_clinic(clinic_id, 'agenda')
);
-- Session history is append-only.

create policy secure_patient_packages_select on public.patient_packages for select to authenticated
using (
  patient_id = public.current_patient_id()
  or public.can_read_clinic(clinic_id, 'pacotes')
  or public.can_access_clinic(clinic_id, 'agenda', 'view')
  or public.can_access_clinic(clinic_id, 'financeiro', 'view')
  or public.can_access_clinic(clinic_id, 'dashboard', 'view')
);
create policy secure_patient_packages_insert on public.patient_packages for insert to authenticated
with check (public.can_access_clinic(clinic_id, 'pacotes', 'create'));
create policy secure_patient_packages_update on public.patient_packages for update to authenticated
using (public.can_access_clinic(clinic_id, 'pacotes', 'edit'))
with check (public.can_access_clinic(clinic_id, 'pacotes', 'edit'));
create policy secure_patient_packages_delete on public.patient_packages for delete to authenticated
using (public.can_access_clinic(clinic_id, 'pacotes', 'delete'));

create policy secure_payment_settlements_select
on public.payment_settlements for select to authenticated
using (
  public.can_access_financial_transaction(financial_transaction_id, 'view')
  or exists (
    select 1 from public.financial_transactions f
    where f.id = financial_transaction_id
      and public.can_access_clinic(f.clinic_id, 'relatorios', 'view')
  )
);
create policy secure_payment_settlements_insert
on public.payment_settlements for insert to authenticated
with check (public.can_access_financial_transaction(financial_transaction_id, 'edit'));
create policy secure_payment_settlements_update
on public.payment_settlements for update to authenticated
using (public.can_access_financial_transaction(financial_transaction_id, 'edit'))
with check (public.can_access_financial_transaction(financial_transaction_id, 'edit'));
create policy secure_payment_settlements_delete
on public.payment_settlements for delete to authenticated
using (public.can_access_financial_transaction(financial_transaction_id, 'delete'));

notify pgrst, 'reload schema';

commit;
