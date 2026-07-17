begin;

alter table public.appointment_participants
  add column if not exists status text null,
  add column if not exists patient_package_id uuid null,
  add column if not exists package_session_consumed boolean null,
  add column if not exists billing_status text null,
  add column if not exists payment_method text null,
  add column if not exists amount_due numeric(12,2) null,
  add column if not exists amount_paid numeric(12,2) null,
  add column if not exists confirmed_at timestamptz null,
  add column if not exists finalized_at timestamptz null,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists absent_at timestamptz null,
  add column if not exists reopened_at timestamptz null,
  add column if not exists notes text null,
  add column if not exists financial_transaction_id uuid null,
  add column if not exists commission_id uuid null,
  add column if not exists legacy_aggregate boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_transactions
  add column if not exists appointment_participant_id uuid null,
  add column if not exists legacy_group_aggregate boolean not null default false;
alter table public.patient_session_history add column if not exists appointment_participant_id uuid null;
alter table public.medical_records add column if not exists appointment_participant_id uuid null;

create or replace function public.group_v2_can_access_appointment(
  p_appointment_id uuid,p_module text,p_action text
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public set row_security=off as $$
declare allowed boolean;
begin
  if auth.role() not in ('authenticated','service_role') then return false; end if;
  if to_regprocedure('public.can_access_appointment(uuid,text,text)') is not null then
    execute 'select public.can_access_appointment($1,$2,$3)'
      into allowed using p_appointment_id,p_module,p_action;
    return coalesce(allowed,false);
  end if;
  return exists(select 1 from public.appointments where id=p_appointment_id);
end;
$$;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_status_v2_check') then
    alter table public.appointment_participants add constraint appointment_participants_status_v2_check
      check (status is null or status in ('agendado','confirmado','realizado','faltou','cancelado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_billing_v2_check') then
    alter table public.appointment_participants add constraint appointment_participants_billing_v2_check
      check (billing_status is null or billing_status in ('pendente','pago','vencido','parcial','cortesia','pacote','cancelado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_payment_v2_check') then
    alter table public.appointment_participants add constraint appointment_participants_payment_v2_check
      check (payment_method is null or payment_method in ('pix','dinheiro','cartao','boleto','parcelado','transferencia','outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_amounts_v2_check') then
    alter table public.appointment_participants add constraint appointment_participants_amounts_v2_check
      check (coalesce(amount_due,0) >= 0 and coalesce(amount_paid,0) >= 0 and coalesce(amount_paid,0) <= coalesce(amount_due,0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_package_v2_fkey') then
    alter table public.appointment_participants add constraint appointment_participants_package_v2_fkey
      foreign key (patient_package_id) references public.patient_packages(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'financial_transactions_participant_v2_fkey') then
    alter table public.financial_transactions add constraint financial_transactions_participant_v2_fkey
      foreign key (appointment_participant_id) references public.appointment_participants(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_financial_v2_fkey') then
    alter table public.appointment_participants add constraint appointment_participants_financial_v2_fkey
      foreign key (financial_transaction_id) references public.financial_transactions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_participants_commission_v2_fkey') then
    alter table public.appointment_participants add constraint appointment_participants_commission_v2_fkey
      foreign key (commission_id) references public.financial_transactions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patient_session_history_participant_v2_fkey') then
    alter table public.patient_session_history add constraint patient_session_history_participant_v2_fkey
      foreign key (appointment_participant_id) references public.appointment_participants(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'medical_records_participant_v2_fkey') then
    alter table public.medical_records add constraint medical_records_participant_v2_fkey
      foreign key (appointment_participant_id) references public.appointment_participants(id) on delete set null;
  end if;
end
$constraints$;

update public.appointment_participants participant
set status = appointment.status,
    package_session_consumed = false,
    billing_status = case when appointment.appointment_type = 'pacote' or appointment.appointment_origin = 'pacote' then 'pacote' else null end,
    patient_package_id = case when participant.patient_id = appointment.patient_id then appointment.patient_package_id else null end,
    legacy_aggregate = true,
    updated_at = now()
from public.appointments appointment
where appointment.id = participant.appointment_id and participant.status is null;

update public.financial_transactions transaction
set legacy_group_aggregate = true
where transaction.future_agenda_source_id in (
  select id from public.appointments where appointment_type = 'grupo' or appointment_origin = 'grupo'
) and transaction.appointment_participant_id is null;

create unique index if not exists appointment_participants_appointment_patient_v2_uidx
  on public.appointment_participants(appointment_id,patient_id);
create index if not exists appointment_participants_status_v2_idx on public.appointment_participants(appointment_id,status);
create index if not exists appointment_participants_package_v2_idx on public.appointment_participants(patient_package_id);
create unique index if not exists financial_transactions_participant_revenue_v2_uidx
  on public.financial_transactions(appointment_participant_id)
  where appointment_participant_id is not null and transaction_type = 'receita';
create unique index if not exists financial_transactions_participant_commission_v2_uidx
  on public.financial_transactions(appointment_participant_id)
  where appointment_participant_id is not null and transaction_type = 'despesa' and commission_status = 'generated';
create unique index if not exists patient_session_history_participant_v2_uidx
  on public.patient_session_history(appointment_participant_id) where appointment_participant_id is not null;
create unique index if not exists medical_records_participant_v2_uidx
  on public.medical_records(appointment_participant_id) where appointment_participant_id is not null;

drop index if exists public.patient_session_history_appointment_unique_idx;
create unique index patient_session_history_appointment_unique_idx
  on public.patient_session_history(appointment_id)
  where appointment_id is not null and appointment_participant_id is null;

drop index if exists public.financial_transactions_revenue_appointment_unique_idx;
create unique index financial_transactions_revenue_appointment_unique_idx
  on public.financial_transactions(future_agenda_source_id)
  where future_agenda_source_id is not null and appointment_participant_id is null
    and transaction_type = 'receita' and origin = 'avulso';
drop index if exists public.financial_transactions_commission_appointment_unique_idx;
create unique index financial_transactions_commission_appointment_unique_idx
  on public.financial_transactions(future_agenda_source_id)
  where future_agenda_source_id is not null and appointment_participant_id is null
    and transaction_type = 'despesa' and category in ('Comissoes','Comissões') and commission_status = 'generated';

create table if not exists public.appointment_participant_audits (
  id uuid primary key default gen_random_uuid(),
  appointment_participant_id uuid not null references public.appointment_participants(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  clinic_id uuid not null,
  patient_id uuid not null,
  action text not null check (action in ('confirm','absent','restore','cancel','finalize','reopen','configure')),
  previous_status text null,
  new_status text null,
  package_id uuid null,
  financial_transaction_id uuid null,
  commission_id uuid null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_participant_audits_participant_idx
  on public.appointment_participant_audits(appointment_participant_id,created_at desc);
alter table public.appointment_participant_audits enable row level security;
drop policy if exists secure_appointment_participant_audits_select on public.appointment_participant_audits;
create policy secure_appointment_participant_audits_select on public.appointment_participant_audits
for select to authenticated using (
  public.is_adm_master() or public.group_v2_can_access_appointment(appointment_id,'agenda','view')
  or public.group_v2_can_access_appointment(appointment_id,'prontuarios','view')
  or public.group_v2_can_access_appointment(appointment_id,'financeiro','view')
);
drop policy if exists secure_appointment_participant_audits_insert on public.appointment_participant_audits;
create policy secure_appointment_participant_audits_insert on public.appointment_participant_audits
for insert to authenticated with check (
  public.is_adm_master() or public.group_v2_can_access_appointment(appointment_id,'agenda','edit')
);

create or replace function public.derive_group_appointment_status(p_appointment_id uuid)
returns text language sql stable set search_path = public as $$
  select case
    when count(*) = 0 then coalesce((select status from public.appointments where id=p_appointment_id),'agendado')
    when bool_and(status in ('realizado','faltou','cancelado')) then 'realizado'
    when bool_or(status in ('confirmado','realizado')) then 'confirmado'
    else 'agendado'
  end
  from public.appointment_participants where appointment_id=p_appointment_id;
$$;

create or replace function public.set_group_participant_status(
  p_participant_id uuid,p_status text,p_notes text default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public set row_security=off as $$
declare
  participant public.appointment_participants%rowtype;
  appointment public.appointments%rowtype;
  old_status text;
  action_name text;
begin
  if p_status not in ('agendado','confirmado','faltou','cancelado') then
    raise exception 'Status individual invalido.' using errcode='22023';
  end if;
  select * into participant from public.appointment_participants where id=p_participant_id for update;
  if not found then raise exception 'Participante nao encontrado.' using errcode='P0002'; end if;
  select * into appointment from public.appointments where id=participant.appointment_id for update;
  if not public.is_adm_master() and not public.group_v2_can_access_appointment(appointment.id,'agenda','edit') then
    raise exception 'Sem permissao para editar a Agenda.' using errcode='42501';
  end if;
  if participant.status='realizado' then
    raise exception 'Reabra o participante antes de alterar seu status.' using errcode='55000';
  end if;
  old_status:=participant.status;
  action_name:=case p_status when 'confirmado' then 'confirm' when 'faltou' then 'absent'
    when 'cancelado' then 'cancel' else 'restore' end;
  update public.appointment_participants set
    status=p_status,
    confirmed_at=case when p_status='confirmado' then now() else confirmed_at end,
    absent_at=case when p_status='faltou' then now() else null end,
    cancelled_at=case when p_status='cancelado' then now() else null end,
    notes=coalesce(nullif(trim(p_notes),''),notes),updated_at=now()
  where id=participant.id;
  update public.appointments set status=public.derive_group_appointment_status(appointment.id),updated_at=now()
  where id=appointment.id;
  insert into public.appointment_participant_audits(
    appointment_participant_id,appointment_id,clinic_id,patient_id,action,previous_status,new_status,details,performed_by
  ) values (
    participant.id,appointment.id,appointment.clinic_id,participant.patient_id,action_name,old_status,p_status,
    jsonb_build_object('notes',p_notes),auth.uid()
  );
  return jsonb_build_object('participant_id',participant.id,'status',p_status);
end;
$$;

create or replace function public.reopen_group_participant(p_participant_id uuid,p_reason text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public set row_security=off as $$
declare
  participant public.appointment_participants%rowtype;
  appointment public.appointments%rowtype;
  package_row public.patient_packages%rowtype;
  old_revenue_id uuid;
  old_commission_id uuid;
  package_restored boolean:=false;
  remaining_realized integer;
begin
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Informe o motivo da reabertura.' using errcode='22023';
  end if;
  select * into participant from public.appointment_participants where id=p_participant_id for update;
  if not found then raise exception 'Participante nao encontrado.' using errcode='P0002'; end if;
  select * into appointment from public.appointments where id=participant.appointment_id for update;
  if not public.is_adm_master() and not public.group_v2_can_access_appointment(appointment.id,'agenda','edit') then
    raise exception 'Sem permissao para reabrir o participante.' using errcode='42501';
  end if;
  if participant.status<>'realizado' then
    raise exception 'O participante nao esta finalizado.' using errcode='55000';
  end if;
  old_revenue_id:=participant.financial_transaction_id;
  old_commission_id:=participant.commission_id;

  if participant.patient_package_id is not null and coalesce(participant.package_session_consumed,false) then
    select * into package_row from public.patient_packages where id=participant.patient_package_id for update;
    if not found then raise exception 'Pacote do participante nao encontrado.' using errcode='P0002'; end if;
    if package_row.completed_sessions<=0 or package_row.remaining_sessions>=package_row.contracted_sessions then
      raise exception 'O saldo do pacote nao pode ser devolvido com seguranca.' using errcode='23514';
    end if;
    update public.patient_packages set completed_sessions=completed_sessions-1,
      remaining_sessions=remaining_sessions+1,updated_at=now()
    where id=package_row.id and completed_sessions>0 and remaining_sessions<contracted_sessions;
    if not found then raise exception 'Pacote alterado por outra operacao.' using errcode='40001'; end if;
    package_restored:=true;
  end if;

  update public.financial_transactions set status='cancelado',paid_amount=0,payment_date=null,
    commission_status=case when transaction_type='despesa' then 'reverted' else commission_status end,
    notes=concat_ws(' ',notes,'Revertido pela reabertura individual:',p_reason),updated_at=now()
  where appointment_participant_id=participant.id and status<>'cancelado';

  select count(*) into remaining_realized from public.appointment_participants
  where appointment_id=appointment.id and id<>participant.id and status='realizado';
  if remaining_realized=0 then
    update public.financial_transactions set status='cancelado',paid_amount=0,payment_date=null,
      commission_status='reverted',notes=concat_ws(' ',notes,'Turma sem participantes realizados apos reabertura.'),updated_at=now()
    where future_agenda_source_id=appointment.id and appointment_participant_id is null
      and transaction_type='despesa' and commission_status='generated' and not legacy_group_aggregate;
  end if;

  update public.patient_session_history set status='reaberto',finance_integration_status='reverted',
    commission_integration_status='reverted',package_session_status=case when package_restored then 'restored' else package_session_status end,
    notes=concat_ws(' ',notes,'Reaberto:',p_reason)
  where appointment_participant_id=participant.id;
  update public.medical_records set status='reaberto',notes=concat_ws(' ',notes,'Reaberto:',p_reason),updated_at=now()
  where appointment_participant_id=participant.id and status='active';
  update public.appointment_participants set status='confirmado',package_session_consumed=false,
    billing_status=case when patient_package_id is not null then 'pacote' else 'pendente' end,
    financial_transaction_id=null,commission_id=null,finalized_at=null,reopened_at=now(),
    notes=concat_ws(' ',notes,'Reaberto:',p_reason),updated_at=now()
  where id=participant.id;
  update public.appointments set status=public.derive_group_appointment_status(appointment.id),performed_at=null,updated_at=now()
  where id=appointment.id;
  insert into public.appointment_participant_audits(
    appointment_participant_id,appointment_id,clinic_id,patient_id,action,previous_status,new_status,package_id,
    financial_transaction_id,commission_id,details,performed_by
  ) values (participant.id,appointment.id,appointment.clinic_id,participant.patient_id,'reopen','realizado','confirmado',
    participant.patient_package_id,old_revenue_id,old_commission_id,
    jsonb_build_object('reason',p_reason,'package_restored',package_restored),auth.uid());
  return jsonb_build_object('participant_id',participant.id,'status','confirmado','package_restored',package_restored);
end;
$$;

create or replace function public.finalize_group_participant(p_participant_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public set row_security=off as $$
declare
  participant public.appointment_participants%rowtype;
  appointment public.appointments%rowtype;
  package_row public.patient_packages%rowtype;
  service_row public.services%rowtype;
  commission_rule public.professional_service_commissions%rowtype;
  revenue_id uuid;
  commission_transaction_id uuid;
  due_amount numeric(12,2);
  paid_amount numeric(12,2);
  commission_base numeric(12,2);
  commission_amount numeric(12,2);
begin
  select * into participant from public.appointment_participants where id=p_participant_id for update;
  if not found then raise exception 'Participante nao encontrado.' using errcode='P0002'; end if;
  select * into appointment from public.appointments where id=participant.appointment_id for update;
  if not public.is_adm_master() and not public.group_v2_can_access_appointment(appointment.id,'agenda','edit') then
    raise exception 'Sem permissao para finalizar o participante.' using errcode='42501';
  end if;
  if participant.status='realizado' then
    return jsonb_build_object('participant_id',participant.id,'status','realizado','idempotent',true);
  end if;
  if participant.status in ('faltou','cancelado') then
    raise exception 'Restaure o participante antes de finalizar.' using errcode='55000';
  end if;
  select * into service_row from public.services where id=appointment.service_id;
  due_amount:=greatest(coalesce(participant.amount_due,service_row.default_price,service_row.price,0),0);
  paid_amount:=least(greatest(coalesce(participant.amount_paid,0),0),due_amount);

  if participant.patient_package_id is not null then
    select * into package_row from public.patient_packages where id=participant.patient_package_id for update;
    if not found or package_row.clinic_id<>appointment.clinic_id or package_row.patient_id<>participant.patient_id
      or package_row.service_id<>appointment.service_id or package_row.status<>'active'
      or package_row.remaining_sessions<=0
      or (package_row.expiration_date is not null and package_row.expiration_date<appointment.appointment_date) then
      raise exception 'Pacote invalido, vencido, incompativel ou sem saldo.' using errcode='23514';
    end if;
    update public.patient_packages set completed_sessions=completed_sessions+1,
      remaining_sessions=remaining_sessions-1,updated_at=now()
    where id=package_row.id and remaining_sessions>0;
    if not found then raise exception 'Saldo do pacote foi consumido por outra operacao.' using errcode='40001'; end if;
    commission_base:=coalesce(nullif(package_row.unit_session_value,0),due_amount,0);
    due_amount:=0; paid_amount:=0;
  else
    insert into public.financial_transactions(
      clinic_id,transaction_type,patient_id,service_id,employee_id,origin,category,description,
      amount,paid_amount,payment_method,due_date,payment_date,status,notes,future_agenda_source_id,
      appointment_date,appointment_participant_id,legacy_group_aggregate
    ) values (
      appointment.clinic_id,'receita',participant.patient_id,appointment.service_id,appointment.employee_id,
      'avulso','Atendimentos','Atendimento individual em grupo',due_amount,paid_amount,participant.payment_method,
      appointment.appointment_date,case when paid_amount>0 then current_date else null end,
      case when due_amount=0 or paid_amount>=due_amount then 'pago' when paid_amount>0 then 'parcial'
        when appointment.appointment_date<current_date then 'vencido' else 'pendente' end,
      concat_ws(' ',participant.notes,'Agendamento em grupo V2.'),appointment.id,appointment.appointment_date,
      participant.id,false
    ) on conflict (appointment_participant_id) where appointment_participant_id is not null and transaction_type='receita'
      do update set amount=excluded.amount,paid_amount=excluded.paid_amount,payment_method=excluded.payment_method,
        status=excluded.status,payment_date=excluded.payment_date,updated_at=now()
    returning id into revenue_id;
    commission_base:=due_amount;
  end if;

  insert into public.patient_session_history(
    clinic_id,patient_id,employee_id,service_id,appointment_id,appointment_participant_id,session_date,status,notes,
    finance_integration_status,commission_integration_status,package_session_status
  ) values (
    appointment.clinic_id,participant.patient_id,appointment.employee_id,appointment.service_id,appointment.id,
    participant.id,appointment.appointment_date,'realizado','Atendimento em grupo - registro individual.',
    case when revenue_id is null then 'not_applicable' else 'integrated' end,'pending',
    case when participant.patient_package_id is null then 'not_applied' else 'consumed' end
  ) on conflict (appointment_participant_id) where appointment_participant_id is not null do update set
    status='realizado',finance_integration_status=excluded.finance_integration_status,
    commission_integration_status='pending',package_session_status=excluded.package_session_status;

  insert into public.medical_records(
    patient_id,employee_id,appointment_id,appointment_participant_id,title,evolution,notes,status
  ) values (
    participant.patient_id,appointment.employee_id,appointment.id,participant.id,'Atendimento em grupo',
    'Evolucao individual pendente de preenchimento.','Registro individual criado pela finalizacao do participante.','active'
  ) on conflict (appointment_participant_id) where appointment_participant_id is not null do update set status='active',updated_at=now();

  select * into commission_rule from public.professional_service_commissions
  where professional_id=appointment.employee_id and service_id=appointment.service_id and active
  order by updated_at desc limit 1;
  if found then
    commission_amount:=case when commission_rule.commission_type='percentual'
      then round(commission_base*commission_rule.commission_value/100,2) else commission_rule.commission_value end;
    if commission_rule.group_calculation_mode='por_paciente' then
      insert into public.financial_transactions(
        clinic_id,transaction_type,patient_id,service_id,employee_id,origin,category,description,amount,due_date,
        status,notes,future_agenda_source_id,appointment_date,base_amount,commission_type,commission_rule_id,
        commission_status,appointment_participant_id,legacy_group_aggregate
      ) values (
        appointment.clinic_id,'despesa',participant.patient_id,appointment.service_id,appointment.employee_id,'manual',
        'Comissoes','Comissao individual de atendimento em grupo',greatest(commission_amount,0),appointment.appointment_date,
        'pendente','Comissao por participante.',appointment.id,appointment.appointment_date,commission_base,
        commission_rule.commission_type,commission_rule.id,'generated',participant.id,false
      ) on conflict (appointment_participant_id) where appointment_participant_id is not null
        and transaction_type='despesa' and commission_status='generated'
        do update set amount=excluded.amount,base_amount=excluded.base_amount,updated_at=now()
      returning id into commission_transaction_id;
    elsif not exists (
      select 1 from public.financial_transactions where future_agenda_source_id=appointment.id
        and appointment_participant_id is null and transaction_type='despesa' and commission_status='generated'
    ) then
      insert into public.financial_transactions(
        clinic_id,transaction_type,service_id,employee_id,origin,category,description,amount,due_date,status,notes,
        future_agenda_source_id,appointment_date,base_amount,commission_type,commission_rule_id,commission_status,
        legacy_group_aggregate
      ) values (
        appointment.clinic_id,'despesa',appointment.service_id,appointment.employee_id,'manual','Comissoes',
        'Comissao unica por turma',greatest(commission_amount,0),appointment.appointment_date,'pendente',
        'Gerada na primeira finalizacao individual.',appointment.id,appointment.appointment_date,commission_base,
        commission_rule.commission_type,commission_rule.id,'generated',false
      ) returning id into commission_transaction_id;
    end if;
  end if;

  update public.appointment_participants set status='realizado',package_session_consumed=patient_package_id is not null,
    billing_status=case when patient_package_id is not null then 'pacote' when due_amount=0 then 'cortesia'
      when paid_amount>=due_amount then 'pago' when paid_amount>0 then 'parcial'
      when appointment.appointment_date<current_date then 'vencido' else 'pendente' end,
    amount_due=due_amount,amount_paid=paid_amount,financial_transaction_id=revenue_id,
    commission_id=commission_transaction_id,finalized_at=now(),reopened_at=null,legacy_aggregate=false,updated_at=now()
  where id=participant.id;
  update public.appointments set status=public.derive_group_appointment_status(appointment.id),
    performed_at=case when public.derive_group_appointment_status(appointment.id)='realizado' then now() else performed_at end,
    updated_at=now() where id=appointment.id;
  update public.patient_session_history set commission_integration_status=case when commission_transaction_id is null then 'not_applicable' else 'integrated' end
  where appointment_participant_id=participant.id;
  insert into public.appointment_participant_audits(
    appointment_participant_id,appointment_id,clinic_id,patient_id,action,previous_status,new_status,package_id,
    financial_transaction_id,commission_id,performed_by
  ) values (participant.id,appointment.id,appointment.clinic_id,participant.patient_id,'finalize',participant.status,
    'realizado',participant.patient_package_id,revenue_id,commission_transaction_id,auth.uid());
  return jsonb_build_object('participant_id',participant.id,'status','realizado','financial_transaction_id',revenue_id,
    'commission_id',commission_transaction_id,'package_consumed',participant.patient_package_id is not null);
end;
$$;

create or replace function public.configure_group_participant(
  p_participant_id uuid,p_patient_package_id uuid default null,p_billing_status text default null,
  p_payment_method text default null,p_amount_due numeric default null,p_amount_paid numeric default null,
  p_notes text default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public set row_security=off as $$
declare
  participant public.appointment_participants%rowtype;
  appointment public.appointments%rowtype;
  package_row public.patient_packages%rowtype;
begin
  select * into participant from public.appointment_participants where id=p_participant_id for update;
  if not found then raise exception 'Participante nao encontrado.' using errcode='P0002'; end if;
  select * into appointment from public.appointments where id=participant.appointment_id;
  if not public.is_adm_master() and not public.group_v2_can_access_appointment(appointment.id,'agenda','edit') then
    raise exception 'Sem permissao para editar a Agenda.' using errcode='42501';
  end if;
  if participant.status='realizado' then
    raise exception 'Reabra o participante antes de alterar pacote ou cobranca.' using errcode='55000';
  end if;
  if p_patient_package_id is not null then
    select * into package_row from public.patient_packages where id=p_patient_package_id;
    if not found or package_row.clinic_id<>appointment.clinic_id
      or package_row.patient_id<>participant.patient_id or package_row.service_id<>appointment.service_id
      or package_row.status<>'active' or package_row.remaining_sessions<=0
      or (package_row.expiration_date is not null and package_row.expiration_date<appointment.appointment_date) then
      raise exception 'Pacote invalido, vencido, incompativel ou sem saldo.' using errcode='23514';
    end if;
  end if;
  update public.appointment_participants set
    patient_package_id=p_patient_package_id,
    billing_status=case when p_patient_package_id is not null then 'pacote' else coalesce(p_billing_status,'pendente') end,
    payment_method=case when p_patient_package_id is not null then null else p_payment_method end,
    amount_due=case when p_patient_package_id is not null then 0 else greatest(coalesce(p_amount_due,0),0) end,
    amount_paid=case when p_patient_package_id is not null then 0
      else greatest(least(coalesce(p_amount_paid,0),greatest(coalesce(p_amount_due,0),0)),0) end,
    notes=coalesce(nullif(trim(p_notes),''),notes),legacy_aggregate=false,updated_at=now()
  where id=participant.id;
  insert into public.appointment_participant_audits(
    appointment_participant_id,appointment_id,clinic_id,patient_id,action,previous_status,new_status,package_id,details,performed_by
  ) values (
    participant.id,appointment.id,appointment.clinic_id,participant.patient_id,'configure',participant.status,participant.status,
    p_patient_package_id,jsonb_build_object('billing_status',p_billing_status,'amount_due',p_amount_due,'amount_paid',p_amount_paid),auth.uid()
  );
  return jsonb_build_object('participant_id',participant.id,'configured',true);
end;
$$;

revoke all on function public.derive_group_appointment_status(uuid) from public;
revoke all on function public.set_group_participant_status(uuid,text,text) from public;
revoke all on function public.configure_group_participant(uuid,uuid,text,text,numeric,numeric,text) from public;
revoke all on function public.finalize_group_participant(uuid) from public;
revoke all on function public.reopen_group_participant(uuid,text) from public;
grant execute on function public.derive_group_appointment_status(uuid) to authenticated;
grant execute on function public.set_group_participant_status(uuid,text,text) to authenticated;
grant execute on function public.configure_group_participant(uuid,uuid,text,text,numeric,numeric,text) to authenticated;
grant execute on function public.finalize_group_participant(uuid) to authenticated;
grant execute on function public.reopen_group_participant(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
