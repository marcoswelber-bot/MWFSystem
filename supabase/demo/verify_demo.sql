-- Read-only verification for MWF_DEMO_V1.
-- Safe to run before or after seed_demo.sql.

begin transaction read only;

select 'clinics' as table_name, count(*) as demo_rows from public.clinics where name like 'DEMO —%MWF_DEMO_V1%'
union all select 'employees', count(*) from public.employees where name like 'DEMO —%MWF_DEMO_V1%'
union all select 'patients', count(*) from public.patients where notes like '%MWF_DEMO_V1%'
union all select 'services', count(*) from public.services where internal_code like 'MWF_DEMO_V1-%'
union all select 'professional_service_commissions', count(*) from public.professional_service_commissions where notes like '%MWF_DEMO_V1%'
union all select 'patient_packages', count(*) from public.patient_packages where notes like '%MWF_DEMO_V1%'
union all select 'appointments', count(*) from public.appointments where notes like '%MWF_DEMO_V1%'
union all select 'appointment_participant_audits', count(*) from public.appointment_participant_audits where appointment_id in (select id from public.appointments where notes like '%MWF_DEMO_V1%')
union all select 'appointment_participants', count(*) from public.appointment_participants where id in (
  select md5('MWF_DEMO_V1:participant:' || n)::uuid from generate_series(1,150) n
  union all
  select md5('MWF_DEMO_V1:participant:group:' || appointment_number || ':' || patient_number)::uuid
  from (values
    (24, 1), (24, 2),
    (27, 25), (27, 26), (27, 28), (27, 29), (27, 30),
    (64, 1), (64, 2), (64, 3), (64, 4), (64, 10)
  ) as group_member(appointment_number, patient_number)
)
union all select 'schedule_blocks', count(*) from public.schedule_blocks where reason like '%MWF_DEMO_V1%'
union all select 'patient_session_history', count(*) from public.patient_session_history where notes like '%MWF_DEMO_V1%'
union all select 'medical_records', count(*) from public.medical_records where notes like '%MWF_DEMO_V1%'
union all select 'financial_transactions', count(*) from public.financial_transactions where notes like '%MWF_DEMO_V1%'
union all select 'payment_settlements', count(*) from public.payment_settlements where notes like '%MWF_DEMO_V1%'
union all select 'payroll_entries', count(*) from public.payroll_entries where notes like '%MWF_DEMO_V1%'
order by table_name;

select id, name, email, status, created_at
from public.clinics
where name like 'DEMO —%MWF_DEMO_V1%'
order by name;

select min(appointment_date) as period_start,
       max(appointment_date) as period_end,
       count(*) as appointments
from public.appointments
where notes like '%MWF_DEMO_V1%';

-- IDs, datas e status dos dados demo por módulo.
select id, clinic_id, full_name, status from public.patients where notes like '%MWF_DEMO_V1%' order by full_name;
select id, clinic_id, appointment_date, start_time, status, appointment_type from public.appointments where notes like '%MWF_DEMO_V1%' order by appointment_date, start_time;
select id, clinic_id, transaction_type, amount, paid_amount, due_date, status from public.financial_transactions where notes like '%MWF_DEMO_V1%' order by due_date, id;

-- Estado individual dos grupos V2 e vinculos financeiros/pacotes/comissoes.
select a.id as appointment_id,a.appointment_date,a.start_time,ap.id as participant_id,p.full_name,
       ap.status,ap.patient_package_id,ap.package_session_consumed,ap.billing_status,
       ap.amount_due,ap.amount_paid,ap.financial_transaction_id,ap.commission_id,
       ap.reopened_at,ap.legacy_aggregate
from public.appointment_participants ap
join public.appointments a on a.id=ap.appointment_id
join public.patients p on p.id=ap.patient_id
where a.notes like '%MWF_DEMO_V1%' and (a.appointment_type='grupo' or a.appointment_origin='grupo')
order by a.appointment_date,a.start_time,p.full_name;

select a.id as appointment_id,ap.status,count(*) as participants
from public.appointment_participants ap join public.appointments a on a.id=ap.appointment_id
where a.notes like '%MWF_DEMO_V1%' and (a.appointment_type='grupo' or a.appointment_origin='grupo')
group by a.id,ap.status order by a.id,ap.status;

-- Órfãos lógicos dentro do lote. Resultado esperado: zero em todas as linhas.
select 'appointments.patient' as relation_name, count(*) as orphan_rows
from public.appointments a left join public.patients p on p.id = a.patient_id
where a.notes like '%MWF_DEMO_V1%' and p.id is null
union all
select 'appointments.employee', count(*) from public.appointments a left join public.employees e on e.id = a.employee_id where a.notes like '%MWF_DEMO_V1%' and e.id is null
union all
select 'appointments.service', count(*) from public.appointments a left join public.services s on s.id = a.service_id where a.notes like '%MWF_DEMO_V1%' and s.id is null
union all
select 'patient_packages.patient', count(*) from public.patient_packages pp left join public.patients p on p.id = pp.patient_id where pp.notes like '%MWF_DEMO_V1%' and p.id is null
union all
select 'patient_packages.service', count(*) from public.patient_packages pp left join public.services s on s.id = pp.service_id where pp.notes like '%MWF_DEMO_V1%' and s.id is null
union all
select 'financial.patient', count(*) from public.financial_transactions f left join public.patients p on p.id = f.patient_id where f.notes like '%MWF_DEMO_V1%' and f.patient_id is not null and p.id is null
union all
select 'participant.package', count(*) from public.appointment_participants ap left join public.patient_packages pp on pp.id=ap.patient_package_id join public.appointments a on a.id=ap.appointment_id where a.notes like '%MWF_DEMO_V1%' and ap.patient_package_id is not null and pp.id is null
union all
select 'financial.participant', count(*) from public.financial_transactions f left join public.appointment_participants ap on ap.id=f.appointment_participant_id where f.notes like '%MWF_DEMO_V1%' and f.appointment_participant_id is not null and ap.id is null
union all
select 'settlements.transaction', count(*) from public.payment_settlements ps left join public.financial_transactions f on f.id = ps.financial_transaction_id where ps.notes like '%MWF_DEMO_V1%' and f.id is null;

-- Duplicidades individuais. Resultado esperado: zero.
select 'duplicate participant' as finding,count(*) as rows_found from (
  select appointment_id,patient_id from public.appointment_participants group by appointment_id,patient_id having count(*)>1
) duplicate
union all
select 'duplicate participant revenue',count(*) from (
  select appointment_participant_id from public.financial_transactions where appointment_participant_id is not null and transaction_type='receita' group by appointment_participant_id having count(*)>1
) duplicate
union all
select 'duplicate participant commission',count(*) from (
  select appointment_participant_id from public.financial_transactions where appointment_participant_id is not null and transaction_type='despesa' and commission_status='generated' group by appointment_participant_id having count(*)>1
) duplicate
union all
select 'negative package balance',count(*) from public.patient_packages where remaining_sessions<0;

-- Mistura: registros marcados apontando para uma clínica que não é demo.
-- Resultado esperado: zero.
with demo_clinics as (
  select id from public.clinics where name like 'DEMO —%MWF_DEMO_V1%'
)
select 'patients demo outside demo clinic' as finding, count(*) as rows_found
from public.patients where notes like '%MWF_DEMO_V1%' and clinic_id not in (select id from demo_clinics)
union all
select 'appointments demo outside demo clinic', count(*) from public.appointments where notes like '%MWF_DEMO_V1%' and clinic_id not in (select id from demo_clinics)
union all
select 'financial demo outside demo clinic', count(*) from public.financial_transactions where notes like '%MWF_DEMO_V1%' and clinic_id not in (select id from demo_clinics)
union all
select 'unmarked patients inside demo clinic', count(*) from public.patients where clinic_id in (select id from demo_clinics) and notes not like '%MWF_DEMO_V1%'
union all
select 'unmarked appointments inside demo clinic', count(*) from public.appointments where clinic_id in (select id from demo_clinics) and notes not like '%MWF_DEMO_V1%'
union all
select 'unmarked financial rows inside demo clinic', count(*) from public.financial_transactions where clinic_id in (select id from demo_clinics) and notes not like '%MWF_DEMO_V1%';

-- Consistência matemática dos pacotes. Resultado esperado: zero.
select count(*) as inconsistent_packages
from public.patient_packages
where notes like '%MWF_DEMO_V1%'
  and contracted_sessions <> completed_sessions + remaining_sessions;

-- Isolamento logico entre as duas clinicas. Resultado esperado: zero.
select 'appointment employee outside clinic' as finding, count(*) as rows_found
from public.appointments a
join public.employees e on e.id = a.employee_id
where a.notes like '%MWF_DEMO_V1%' and e.clinic_id is distinct from a.clinic_id
union all
select 'appointment service outside clinic', count(*)
from public.appointments a
join public.services s on s.id = a.service_id
where a.notes like '%MWF_DEMO_V1%' and s.clinic_id is distinct from a.clinic_id
union all
select 'package employee outside clinic', count(*)
from public.patient_packages pp
join public.employees e on e.id = pp.employee_id
where pp.notes like '%MWF_DEMO_V1%' and e.clinic_id is distinct from pp.clinic_id
union all
select 'package service outside clinic', count(*)
from public.patient_packages pp
join public.services s on s.id = pp.service_id
where pp.notes like '%MWF_DEMO_V1%' and s.clinic_id is distinct from pp.clinic_id;

rollback;
