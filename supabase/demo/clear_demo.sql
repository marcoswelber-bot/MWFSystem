-- Protected cleanup for MWF_DEMO_V1 only.
-- BACK UP the target database first.
-- Deliberately aborts unless the caller explicitly confirms in the SAME transaction:
--   begin;
--   set local mwf_demo_clear_confirm = 'MWF_DEMO_V1_CLEAR_CONFIRMED';
--   \i supabase/demo/clear_demo.sql
--   commit;
-- Do not run without the owner's explicit authorization.

begin;

select pg_advisory_xact_lock(hashtext('MWF_DEMO_V1'));

-- Preview is emitted before confirmation/deletion.
select 'clinics' as table_name, count(*) as rows_to_delete from public.clinics where name like 'DEMO —%MWF_DEMO_V1%'
union all select 'employees', count(*) from public.employees where name like 'DEMO —%MWF_DEMO_V1%'
union all select 'patients', count(*) from public.patients where notes like '%MWF_DEMO_V1%'
union all select 'services', count(*) from public.services where internal_code like 'MWF_DEMO_V1-%'
union all select 'professional_service_commissions', count(*) from public.professional_service_commissions where notes like '%MWF_DEMO_V1%'
union all select 'patient_packages', count(*) from public.patient_packages where notes like '%MWF_DEMO_V1%'
union all select 'appointments', count(*) from public.appointments where notes like '%MWF_DEMO_V1%'
union all select 'appointment_participant_audits', count(*) from public.appointment_participant_audits where appointment_id in (select id from public.appointments where notes like '%MWF_DEMO_V1%')
union all select 'schedule_blocks', count(*) from public.schedule_blocks where reason like '%MWF_DEMO_V1%'
union all select 'patient_session_history', count(*) from public.patient_session_history where notes like '%MWF_DEMO_V1%'
union all select 'medical_records', count(*) from public.medical_records where notes like '%MWF_DEMO_V1%'
union all select 'financial_transactions', count(*) from public.financial_transactions where notes like '%MWF_DEMO_V1%'
union all select 'payment_settlements', count(*) from public.payment_settlements where notes like '%MWF_DEMO_V1%'
union all select 'payroll_entries', count(*) from public.payroll_entries where notes like '%MWF_DEMO_V1%'
order by table_name;

do $confirmation$
begin
  if current_setting('mwf_demo_clear_confirm', true) is distinct from 'MWF_DEMO_V1_CLEAR_CONFIRMED' then
    raise exception 'LIMPEZA BLOQUEADA: use SET LOCAL mwf_demo_clear_confirm = MWF_DEMO_V1_CLEAR_CONFIRMED apos autorizacao explicita';
  end if;
end
$confirmation$;

-- Children first. Every DELETE has an explicit MWF_DEMO_V1 predicate.
delete from public.appointment_participant_audits
where appointment_id in (select id from public.appointments where notes like '%MWF_DEMO_V1%');

delete from public.appointment_reopen_audits
where appointment_id in (select id from public.appointments where notes like '%MWF_DEMO_V1%');

delete from public.payroll_entries where notes like '%MWF_DEMO_V1%';
delete from public.payment_settlements where notes like '%MWF_DEMO_V1%';
delete from public.financial_transactions where notes like '%MWF_DEMO_V1%';
delete from public.medical_records where notes like '%MWF_DEMO_V1%';
delete from public.patient_session_history where notes like '%MWF_DEMO_V1%';

delete from public.appointment_participants
where appointment_id in (select id from public.appointments where notes like '%MWF_DEMO_V1%');

delete from public.appointments where notes like '%MWF_DEMO_V1%';
delete from public.schedule_blocks where reason like '%MWF_DEMO_V1%';
delete from public.patient_packages where notes like '%MWF_DEMO_V1%';
delete from public.professional_service_commissions where notes like '%MWF_DEMO_V1%';
delete from public.services where internal_code like 'MWF_DEMO_V1-%';
delete from public.patients where notes like '%MWF_DEMO_V1%';
delete from public.employees where name like 'DEMO —%MWF_DEMO_V1%';
delete from public.clinics where name like 'DEMO —%MWF_DEMO_V1%';

-- Any remaining marker means rollback, protecting against an overlooked dependency.
do $postcheck$
begin
  if exists (select 1 from public.clinics where name like 'DEMO —%MWF_DEMO_V1%')
     or exists (select 1 from public.employees where name like 'DEMO —%MWF_DEMO_V1%')
     or exists (select 1 from public.patients where notes like '%MWF_DEMO_V1%')
     or exists (select 1 from public.services where internal_code like 'MWF_DEMO_V1-%')
     or exists (select 1 from public.appointments where notes like '%MWF_DEMO_V1%')
     or exists (select 1 from public.financial_transactions where notes like '%MWF_DEMO_V1%') then
    raise exception 'MWF_DEMO_V1: limpeza incompleta; transação revertida';
  end if;
end
$postcheck$;

select 'MWF_DEMO_V1' as batch_id, 0 as remaining_seed_rows,
       'limpeza concluída dentro da transação atual' as result;

commit;
