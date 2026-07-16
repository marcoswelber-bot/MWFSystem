begin;

create extension if not exists "pgcrypto";

create table if not exists public.appointment_reopen_audits (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  clinic_id uuid not null,
  patient_id uuid not null,
  employee_id uuid not null,
  reopened_by uuid null,
  reopened_by_user_id uuid null,
  reopened_at timestamptz not null default now(),
  reason text not null,
  previous_status text not null,
  new_status text not null,
  financial_reverted boolean not null default false,
  commissions_reverted boolean not null default false,
  package_restored boolean not null default false,
  session_history_restored boolean not null default false,
  details jsonb not null default '{}'::jsonb
);

create index if not exists appointment_reopen_audits_appointment_idx
  on public.appointment_reopen_audits (appointment_id, reopened_at desc);

alter table public.appointment_reopen_audits enable row level security;

drop policy if exists appointment_reopen_audits_select
  on public.appointment_reopen_audits;
create policy appointment_reopen_audits_select
on public.appointment_reopen_audits
for select
to authenticated
using (
  public.is_adm_master()
  or exists (
    select 1
    from public.employees e
    join public.user_permissions up on up.employee_id = e.id
    where (
        lower(trim(coalesce(e.login_email, ''))) = lower(trim(coalesce(auth.email(), '')))
        or lower(trim(coalesce(e.email, ''))) = lower(trim(coalesce(auth.email(), '')))
      )
      and e.status = 'active'
      and e.system_access
      and lower(regexp_replace(coalesce(e.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
          in ('adm_master', 'admin_master', 'clinic_admin', 'admin', 'administrador')
      and up.module_key = 'agenda'
      and up.can_edit
  )
);

drop policy if exists appointment_reopen_audits_insert
  on public.appointment_reopen_audits;
create policy appointment_reopen_audits_insert
on public.appointment_reopen_audits
for insert
to authenticated
with check (public.is_adm_master());

do $drop_incompatible_signatures$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reopen_appointment'
      and p.oid <> coalesce(
        to_regprocedure('public.reopen_appointment(uuid,text)')::oid,
        0::oid
      )
  loop
    execute format(
      'drop function %I.%I(%s)',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
  end loop;
end;
$drop_incompatible_signatures$;

create or replace function public.reopen_appointment(
  p_appointment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
declare
  appointment_record public.appointments%rowtype;
  package_record public.patient_packages%rowtype;
  employee_record public.employees%rowtype;
  authenticated_user_id uuid := auth.uid();
  authenticated_email text := lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email', '')));
  authenticated_employee_id uuid;
  is_master boolean := false;
  is_authorized_administrator boolean := false;
  financial_reverted boolean := false;
  commissions_reverted boolean := false;
  package_restored boolean := false;
  session_history_restored boolean := false;
  financial_rows_reverted integer := 0;
  commission_rows_reverted integer := 0;
  session_history_rows_restored integer := 0;
  medical_record_rows_reopened integer := 0;
begin
  if authenticated_user_id is null or authenticated_email = '' then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo da reabertura.' using errcode = '22023';
  end if;

  select employee.*
  into employee_record
  from public.employees employee
  where (
      lower(trim(coalesce(employee.login_email, ''))) = authenticated_email
      or lower(trim(coalesce(employee.email, ''))) = authenticated_email
    )
    and employee.status = 'active'
    and employee.system_access
  order by
    case
      when lower(trim(coalesce(employee.login_email, ''))) = authenticated_email then 0
      else 1
    end,
    employee.id
  limit 1;

  authenticated_employee_id := employee_record.id;

  is_master := public.is_adm_master()
    or lower(regexp_replace(coalesce(employee_record.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
       in ('adm_master', 'admin_master');

  if employee_record.id is not null then
    is_authorized_administrator :=
      lower(regexp_replace(coalesce(employee_record.role, ''), '[^a-zA-Z0-9]+', '_', 'g'))
        in ('clinic_admin', 'admin', 'administrador')
      and exists (
        select 1
        from public.user_permissions permission
        where permission.employee_id = employee_record.id
          and permission.module_key = 'agenda'
          and permission.can_edit
      );
  end if;

  if not is_master and not is_authorized_administrator then
    raise exception 'Apenas administradores autorizados podem reabrir atendimentos.'
      using errcode = '42501';
  end if;

  select appointment.*
  into appointment_record
  from public.appointments appointment
  where appointment.id = p_appointment_id
  for update;

  if not found then
    raise exception 'Atendimento nao encontrado.' using errcode = 'P0002';
  end if;

  if lower(trim(coalesce(appointment_record.status, ''))) not in ('realizado', 'finalizado') then
    raise exception 'Este atendimento nao esta finalizado ou ja foi reaberto.'
      using errcode = '55000';
  end if;

  select exists (
    select 1
    from public.financial_transactions transaction
    where transaction.future_agenda_source_id = appointment_record.id
      and transaction.transaction_type = 'receita'
      and transaction.status <> 'cancelado'
  ) into financial_reverted;

  select exists (
    select 1
    from public.financial_transactions transaction
    where transaction.future_agenda_source_id = appointment_record.id
      and transaction.transaction_type = 'despesa'
      and transaction.status <> 'cancelado'
  ) into commissions_reverted;

  update public.financial_transactions transaction
  set
    status = 'cancelado',
    paid_amount = 0,
    payment_date = null,
    commission_status = case
      when transaction.transaction_type = 'despesa' then 'reverted'
      else transaction.commission_status
    end,
    notes = concat_ws(
      ' ',
      transaction.notes,
      'Revertido pela reabertura do atendimento',
      appointment_record.id::text,
      now()::text
    ),
    updated_at = now()
  where transaction.future_agenda_source_id = appointment_record.id
    and transaction.status <> 'cancelado';

  get diagnostics financial_rows_reverted = row_count;

  select count(*)::integer
  into commission_rows_reverted
  from public.financial_transactions transaction
  where transaction.future_agenda_source_id = appointment_record.id
    and transaction.transaction_type = 'despesa'
    and transaction.status = 'cancelado'
    and transaction.commission_status = 'reverted';

  if appointment_record.patient_package_id is not null
     and appointment_record.package_session_status = 'consumed' then
    select package.*
    into package_record
    from public.patient_packages package
    where package.id = appointment_record.patient_package_id
    for update;

    if not found then
      raise exception 'Pacote do atendimento nao foi encontrado.' using errcode = 'P0002';
    end if;

    update public.patient_packages package
    set
      completed_sessions = greatest(package.completed_sessions - 1, 0),
      remaining_sessions = package.remaining_sessions + 1,
      agenda_integration_status = 'restored',
      updated_at = now()
    where package.id = package_record.id;

    package_restored := true;
  end if;

  update public.patient_session_history session_history
  set
    status = 'reaberto',
    finance_integration_status = 'reverted',
    commission_integration_status = 'reverted',
    package_session_status = case
      when package_restored then 'restored'
      else session_history.package_session_status
    end
  where session_history.appointment_id = appointment_record.id
    and lower(trim(coalesce(session_history.status, ''))) in ('realizado', 'finalizado');

  get diagnostics session_history_rows_restored = row_count;
  session_history_restored := session_history_rows_restored > 0;

  update public.medical_records medical_record
  set
    status = 'reaberto',
    updated_at = now()
  where (
      medical_record.appointment_id = appointment_record.id
      or medical_record.id = appointment_record.medical_record_id
    )
    and medical_record.status = 'active';

  get diagnostics medical_record_rows_reopened = row_count;

  update public.appointments appointment
  set
    status = 'confirmado',
    performed_at = null,
    finance_integration_status = case
      when financial_reverted then 'reverted'
      else appointment.finance_integration_status
    end,
    commission_integration_status = case
      when commissions_reverted then 'reverted'
      else appointment.commission_integration_status
    end,
    package_session_status = case
      when package_restored then 'restored'
      else appointment.package_session_status
    end,
    sessions_completed = case
      when package_restored then greatest(appointment.sessions_completed - 1, 0)
      else appointment.sessions_completed
    end,
    updated_at = now()
  where appointment.id = appointment_record.id
    and appointment.status = appointment_record.status;

  if not found then
    raise exception 'O atendimento ja foi alterado por outro usuario.' using errcode = '40001';
  end if;

  insert into public.appointment_reopen_audits (
    appointment_id,
    clinic_id,
    patient_id,
    employee_id,
    reopened_by,
    reopened_by_user_id,
    reason,
    previous_status,
    new_status,
    financial_reverted,
    commissions_reverted,
    package_restored,
    session_history_restored,
    details
  ) values (
    appointment_record.id,
    appointment_record.clinic_id,
    appointment_record.patient_id,
    appointment_record.employee_id,
    authenticated_employee_id,
    authenticated_user_id,
    trim(p_reason),
    appointment_record.status,
    'confirmado',
    financial_reverted,
    commissions_reverted,
    package_restored,
    session_history_restored,
    jsonb_build_object(
      'financial_transactions_reverted', financial_rows_reverted,
      'commission_transactions_reverted', commission_rows_reverted,
      'session_history_rows_restored', session_history_rows_restored,
      'medical_record_rows_reopened', medical_record_rows_reopened,
      'patient_package_id', appointment_record.patient_package_id,
      'reopened_at', now()
    )
  );

  return jsonb_build_object(
    'appointment_id', appointment_record.id,
    'previous_status', appointment_record.status,
    'new_status', 'confirmado',
    'financial_reverted', financial_reverted,
    'commissions_reverted', commissions_reverted,
    'package_restored', package_restored,
    'session_history_restored', session_history_restored,
    'medical_record_reopened', medical_record_rows_reopened > 0
  );
end;
$function$;

revoke all
  on function public.reopen_appointment(uuid, text)
  from public;

grant execute
  on function public.reopen_appointment(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'reopen_appointment';