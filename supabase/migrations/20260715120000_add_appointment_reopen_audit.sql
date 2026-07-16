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

create index if not exists appointment_reopen_audits_appointment_idx on public.appointment_reopen_audits(appointment_id, reopened_at desc);
alter table public.appointment_reopen_audits enable row level security;
drop policy if exists appointment_reopen_audits_select on public.appointment_reopen_audits;
create policy appointment_reopen_audits_select on public.appointment_reopen_audits for select to authenticated using (public.is_adm_master() or public.has_permission('agenda', 'edit'));
drop policy if exists appointment_reopen_audits_insert on public.appointment_reopen_audits;
create policy appointment_reopen_audits_insert on public.appointment_reopen_audits for insert to authenticated with check (public.is_adm_master());

create or replace function public.reopen_appointment(p_appointment_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  a public.appointments%rowtype;
  p public.patient_packages%rowtype;
  e public.employees%rowtype;
  uid uuid := auth.uid(); eid uuid;
  fr boolean := false; cr boolean := false; pr boolean := false; hr boolean := false;
  tc integer := 0; hc integer := 0;
begin
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da reabertura.' using errcode='22023'; end if;
  select emp.* into e from public.employees emp where emp.auth_user_id=uid and emp.status='active' and emp.system_access limit 1;
  eid:=e.id;
  if not public.is_adm_master() and not exists (select 1 from public.employees x join public.user_permissions up on up.employee_id=x.id where x.auth_user_id=uid and x.status='active' and x.system_access and lower(regexp_replace(coalesce(x.role,''),'[^a-zA-Z0-9]+','_','g')) in ('clinic_admin','admin','administrador') and up.module_key='agenda' and up.can_edit) then raise exception 'Apenas administradores autorizados podem reabrir atendimentos.' using errcode='42501'; end if;
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Atendimento nao encontrado.' using errcode='P0002'; end if;
  if a.status<>'realizado' then raise exception 'Este atendimento nao esta finalizado ou ja foi reaberto.' using errcode='55000'; end if;
  update public.financial_transactions set status='cancelado',paid_amount=0,open_amount=amount,payment_date=null,commission_status=case when transaction_type='despesa' then 'reverted' else commission_status end,notes=concat_ws(' ',notes,'Revertido pela reabertura do atendimento',a.id::text,now()::text) where future_agenda_source_id=a.id and status<>'cancelado';
  get diagnostics tc=row_count;
  fr:=exists(select 1 from public.financial_transactions where future_agenda_source_id=a.id and transaction_type='receita');
  cr:=exists(select 1 from public.financial_transactions where future_agenda_source_id=a.id and transaction_type='despesa');
  if a.patient_package_id is not null and a.package_session_status='consumed' then
    select * into p from public.patient_packages where id=a.patient_package_id for update;
    if not found then raise exception 'Pacote do atendimento nao foi encontrado.' using errcode='P0002'; end if;
    update public.patient_packages set completed_sessions=greatest(completed_sessions-1,0),remaining_sessions=remaining_sessions+1,agenda_integration_status='restored',updated_at=now() where id=p.id;
    pr:=true;
  end if;
  update public.patient_session_history set status='reaberto',finance_integration_status='reverted',commission_integration_status='reverted',package_session_status=case when pr then 'restored' else package_session_status end where appointment_id=a.id and status='realizado';
  get diagnostics hc=row_count; hr:=hc>0;
  update public.medical_records set status='reaberto',updated_at=now() where appointment_id=a.id and status='active';
  update public.appointments set status='confirmado',performed_at=null,finance_integration_status=case when fr then 'reverted' else finance_integration_status end,commission_integration_status=case when cr then 'reverted' else commission_integration_status end,package_session_status=case when pr then 'restored' else package_session_status end,sessions_completed=case when pr then greatest(sessions_completed-1,0) else sessions_completed end,updated_at=now() where id=a.id;
  insert into public.appointment_reopen_audits(appointment_id,clinic_id,patient_id,employee_id,reopened_by,reopened_by_user_id,reason,previous_status,new_status,financial_reverted,commissions_reverted,package_restored,session_history_restored,details) values(a.id,a.clinic_id,a.patient_id,a.employee_id,eid,uid,trim(p_reason),a.status,'confirmado',fr,cr,pr,hr,jsonb_build_object('financial_transactions_reverted',tc,'session_history_rows_restored',hc,'patient_package_id',a.patient_package_id,'reopened_at',now()));
  return jsonb_build_object('appointment_id',a.id,'previous_status',a.status,'new_status','confirmado','financial_reverted',fr,'commissions_reverted',cr,'package_restored',pr,'session_history_restored',hr);
end;
$$;

revoke all on function public.reopen_appointment(uuid,text) from public;
grant execute on function public.reopen_appointment(uuid,text) to authenticated;
