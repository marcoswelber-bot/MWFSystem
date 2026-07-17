-- MWFSystem demo seed: MWF_DEMO_V1
-- Review and run manually with a privileged database role in a protected environment.
-- This script never creates Supabase Auth users.

begin;

select pg_advisory_xact_lock(hashtext('MWF_DEMO_V1'));

do $preflight$
declare
  required_table text;
begin
  foreach required_table in array array[
    'clinics', 'employees', 'patients', 'services', 'professional_service_commissions',
    'patient_packages', 'appointments', 'appointment_participants', 'schedule_blocks',
    'patient_session_history', 'medical_records', 'financial_transactions',
    'payment_settlements', 'payroll_entries'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'MWF_DEMO_V1: tabela obrigatoria ausente: public.%', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='appointment_participants'
      and column_name='financial_transaction_id'
  ) then
    raise exception 'MWF_DEMO_V1: aplique a migration group_appointments_v2 antes do seed';
  end if;

  if exists (
    select 1 from public.clinics
    where id in (md5('MWF_DEMO_V1:clinic:1')::uuid, md5('MWF_DEMO_V1:clinic:2')::uuid)
      and name not like 'DEMO —%'
  ) then
    raise exception 'MWF_DEMO_V1: colisao de ID com clinica nao-demo; nenhuma alteracao aplicada';
  end if;
end
$preflight$;

insert into public.clinics (id, name, phone, whatsapp, email, cnpj, address, status)
values
  (md5('MWF_DEMO_V1:clinic:1')::uuid, 'DEMO — Clínica Horizonte MWF_DEMO_V1', '(11) 90000-1001', '(11) 90000-1001', 'horizonte.mwf.demo@example.com', null, 'Endereço fictício 100 — DEMO', 'active'),
  (md5('MWF_DEMO_V1:clinic:2')::uuid, 'DEMO — Clínica Integra MWF_DEMO_V1', '(11) 90000-1002', '(11) 90000-1002', 'integra.mwf.demo@example.com', null, 'Endereço fictício 200 — DEMO', 'active')
on conflict (id) do nothing;

-- 8 profissionais, 3 recepcionistas e 2 administradores lógicos; sem vínculo com auth.users.
insert into public.employees (
  id, clinic_id, name, phone, whatsapp, email, role, commission_type,
  commission_value, status, system_access, login_email
)
select
  md5('MWF_DEMO_V1:employee:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:' || case when n <= 7 then 1 else 2 end)::uuid,
  'DEMO — ' || case
    when n <= 8 then 'Profissional ' || lpad(n::text, 2, '0')
    when n <= 11 then 'Recepção ' || lpad((n - 8)::text, 2, '0')
    else 'Administrador ' || lpad((n - 11)::text, 2, '0')
  end || ' MWF_DEMO_V1',
  '(11) 90001-' || lpad(n::text, 4, '0'),
  '(11) 90001-' || lpad(n::text, 4, '0'),
  'colaborador' || n || '.mwf.demo@example.com',
  case when n <= 8 then 'Profissional' when n <= 11 then 'Recepção' else 'Administrador' end,
  case when n <= 8 then 'percentual' else null end,
  case when n <= 8 then 12 + n else null end,
  'active', false, null
from generate_series(1, 13) n
on conflict (id) do nothing;

insert into public.patients (
  id, clinic_id, full_name, cpf, birth_date, phone, email, address, notes, status,
  portal_access, login_email
)
select
  md5('MWF_DEMO_V1:patient:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:' || case when n <= 24 then 1 else 2 end)::uuid,
  'DEMO — Paciente de Homologação ' || lpad(n::text, 2, '0'),
  null,
  date '1960-01-01' + ((n * 317) % 17000),
  case when n % 5 = 0 then null else '(11) 90002-' || lpad(n::text, 4, '0') end,
  case when n % 4 = 0 then null else 'paciente' || n || '.mwf.demo@example.com' end,
  case when n % 3 = 0 then null else 'Endereço fictício ' || n || ' — DEMO' end,
  'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1 | cenário ' || n,
  case when n % 9 = 0 then 'inactive' else 'active' end,
  false, null
from generate_series(1, 40) n
on conflict (id) do nothing;

insert into public.services (
  id, clinic_id, name, type, price, duration_minutes, allows_package,
  commission_type, commission_value, status, internal_code, description,
  default_duration_minutes, default_price, attendance_type, color, is_group,
  participant_limit, requires_medical_record, billing_type, service_mode
)
select
  md5('MWF_DEMO_V1:service:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:' || case when n <= 6 then 1 else 2 end)::uuid,
  'DEMO — Serviço ' || lpad(n::text, 2, '0') || ' MWF_DEMO_V1',
  case when n in (4, 9) then 'coletivo' else 'individual' end,
  (70 + n * 25)::numeric,
  case when n % 3 = 0 then 60 else 45 end,
  true, 'percentual', 15 + (n % 4), 'active',
  'MWF_DEMO_V1-S' || lpad(n::text, 2, '0'),
  'DADO DE HOMOLOGAÇÃO MWFSystem | cenário fictício',
  case when n % 3 = 0 then 60 else 45 end,
  (70 + n * 25)::numeric, 'presencial',
  (array['#2563EB','#16A34A','#9333EA','#EA580C','#0891B2'])[1 + ((n - 1) % 5)],
  n in (4, 9), case when n in (4, 9) then 6 else null end,
  n % 2 = 0, 'particular', case when n in (4, 9) then 'coletivo' else 'individual' end
from generate_series(1, 10) n
on conflict (id) do nothing;

insert into public.professional_service_commissions (
  id, professional_id, service_id, attendance_type, modality, commission_type,
  commission_value, group_calculation_mode, base_price, estimated_amount, active, notes
)
select
  md5('MWF_DEMO_V1:commission_rule:' || n)::uuid,
  md5('MWF_DEMO_V1:employee:' || n)::uuid,
  md5('MWF_DEMO_V1:service:' || case when n <= 7 then 1 + ((n - 1) % 6) else 9 end)::uuid,
  'presencial', case when n = 4 then 'grupo' else 'individual' end,
  'percentual', 15 + (n % 4), case when n = 8 then 'por_turma' else 'por_paciente' end, 70 + (1 + ((n - 1) % 10)) * 25,
  round(((70 + (1 + ((n - 1) % 10)) * 25) * (15 + (n % 4)) / 100.0)::numeric, 2),
  true, 'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1'
from generate_series(1, 8) n
on conflict (id) do nothing;

insert into public.patient_packages (
  id, clinic_id, patient_id, service_id, employee_id, contracted_sessions,
  completed_sessions, remaining_sessions, unit_session_value, discount_percent,
  subtotal_value, discount_value, total_value, purchase_date,
  expiration_date, payment_method, status, notes, agenda_integration_status,
  finance_integration_status, future_revenue_status
)
select
  md5('MWF_DEMO_V1:package:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:1')::uuid,
  md5('MWF_DEMO_V1:patient:' || n)::uuid,
  md5('MWF_DEMO_V1:service:' || (1 + ((n - 1) % 6)))::uuid,
  md5('MWF_DEMO_V1:employee:' || (1 + ((n - 1) % 7)))::uuid,
  case when n % 3 = 0 then 10 else 8 end,
  case when n in (8, 12, 16) then (case when n % 3 = 0 then 10 else 8 end)
       when n in (5, 10, 15, 20) then 0
       when n in (7, 14) then (case when n % 3 = 0 then 9 else 7 end)
       else 3 end,
  (case when n % 3 = 0 then 10 else 8 end) -
    (case when n in (8, 12, 16) then (case when n % 3 = 0 then 10 else 8 end)
          when n in (5, 10, 15, 20) then 0
          when n in (7, 14) then (case when n % 3 = 0 then 9 else 7 end)
          else 3 end),
  (70 + (1 + ((n - 1) % 10)) * 25) * 0.90,
  10,
  (case when n % 3 = 0 then 10 else 8 end) * (70 + (1 + ((n - 1) % 10)) * 25),
  (case when n % 3 = 0 then 10 else 8 end) * (70 + (1 + ((n - 1) % 10)) * 25) * 0.10,
  (case when n % 3 = 0 then 10 else 8 end) * (70 + (1 + ((n - 1) % 10)) * 25) * 0.90,
  current_date - (n * 5),
  case when n in (3, 6) then current_date + 7 when n in (4, 9) then current_date - 10 else current_date + 90 end,
  (array['pix','dinheiro','cartao','boleto','parcelado'])[1 + ((n - 1) % 5)],
  case when n in (4, 9) then 'expired' when n in (8, 12, 16) then 'finished' when n in (14, 20) then 'cancelled' else 'active' end,
  'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1', 'ready',
  case when n % 4 = 0 then 'paid' else 'pending' end, 'not_generated'
from generate_series(1, 20) n
on conflict (id) do nothing;

-- 120 agendamentos entre hoje-14 e hoje+15. O índice do sistema impede conflito
-- ativo do mesmo profissional; conflitos são representados por registros cancelados.
insert into public.appointments (
  id, clinic_id, patient_id, employee_id, service_id, appointment_date,
  start_time, end_time, notes, status, performed_at, finance_integration_status,
  commission_integration_status, package_session_status, sessions_contracted,
  sessions_completed, appointment_type, appointment_origin, patient_package_id,
  original_appointment_id, is_billable, consumes_package_session
)
select
  md5('MWF_DEMO_V1:appointment:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:' || case when ((n - 1) % 40) + 1 <= 24 then 1 else 2 end)::uuid,
  md5('MWF_DEMO_V1:patient:' || (((n - 1) % 40) + 1))::uuid,
  md5('MWF_DEMO_V1:employee:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 7) else 8 end)::uuid,
  md5('MWF_DEMO_V1:service:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 6) else 7 + ((n - 1) % 4) end)::uuid,
  current_date - 30 + ((n - 1) % 90),
  (time '08:00' + (((n - 1) % 8) * interval '1 hour'))::time,
  (time '08:45' + (((n - 1) % 8) * interval '1 hour'))::time,
  'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1 | ' ||
    case when n % 17 = 0 then 'conflito simulado/cancelado' when n % 13 = 0 then 'reagendamento simulado' else 'agenda demo' end,
  case
    when n % 11 = 0 then 'cancelado' when n % 9 = 0 then 'faltou'
    when current_date - 30 + ((n - 1) % 90) < current_date then 'realizado'
    when current_date - 30 + ((n - 1) % 90) = current_date and n % 2 = 0 then 'confirmado'
    else 'agendado'
  end,
  case when current_date - 30 + ((n - 1) % 90) < current_date and n % 9 <> 0 and n % 11 <> 0
    then (current_date - 30 + ((n - 1) % 90))::timestamp + time '09:00' else null end,
  case when current_date - 30 + ((n - 1) % 90) < current_date then 'generated' else 'pending' end,
  case when current_date - 30 + ((n - 1) % 90) < current_date then 'generated' else 'pending' end,
  case when n <= 20 and current_date - 30 + ((n - 1) % 90) < current_date then 'consumed' else 'not_applied' end,
  1, case when current_date - 30 + ((n - 1) % 90) < current_date and n % 9 <> 0 and n % 11 <> 0 then 1 else 0 end,
  case when n <= 20 then 'pacote' when n % 10 = 4 then 'grupo' when n % 10 = 5 then 'avaliacao' when n % 10 = 6 then 'retorno' when n % 10 = 7 then 'reposicao' else 'avulso' end,
  case when n <= 20 then 'pacote' when n % 10 = 4 then 'grupo' when n % 10 = 5 then 'avaliacao' when n % 10 = 6 then 'retorno' when n % 10 = 7 then 'reposicao' else 'avulso' end,
  case when n <= 20 then md5('MWF_DEMO_V1:package:' || n)::uuid else null end,
  case when n > 20 and n % 10 = 7 then md5('MWF_DEMO_V1:appointment:' || (n - 10))::uuid else null end,
  n % 19 <> 0 and not (n > 20 and n % 10 = 7),
  n <= 20 or (n > 20 and n % 10 = 7)
from generate_series(1, 150) n
on conflict (id) do nothing;

-- Agenda cheia hoje na clinica 1, com tres profissionais no mesmo horario.
update public.appointments
set appointment_date = current_date,
    start_time = time '10:00',
    end_time = time '10:45',
    status = case
      when id = md5('MWF_DEMO_V1:appointment:121')::uuid then 'confirmado'
      else 'agendado'
    end
where id in (
  md5('MWF_DEMO_V1:appointment:121')::uuid,
  md5('MWF_DEMO_V1:appointment:122')::uuid,
  md5('MWF_DEMO_V1:appointment:123')::uuid
)
  and notes like '%MWF_DEMO_V1%';

-- Conflito proposital armazenado como cancelado para nao violar o indice ativo.
update public.appointments
set clinic_id = md5('MWF_DEMO_V1:clinic:1')::uuid,
    patient_id = md5('MWF_DEMO_V1:patient:4')::uuid,
    employee_id = md5('MWF_DEMO_V1:employee:3')::uuid,
    service_id = md5('MWF_DEMO_V1:service:4')::uuid,
    appointment_date = current_date,
    start_time = time '10:00',
    end_time = time '10:45',
    status = 'cancelado',
    notes = 'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1 | conflito proposital bloqueado'
where id = md5('MWF_DEMO_V1:appointment:124')::uuid
  and notes like '%MWF_DEMO_V1%';

insert into public.appointment_participants (
  id, appointment_id, patient_id, status, package_session_consumed, billing_status,
  amount_due, amount_paid, notes, legacy_aggregate
)
select md5('MWF_DEMO_V1:participant:' || n)::uuid,
       md5('MWF_DEMO_V1:appointment:' || n)::uuid,
       md5('MWF_DEMO_V1:patient:' || (((n - 1) % 40) + 1))::uuid,
       case when n % 11 = 0 then 'cancelado' when n % 9 = 0 then 'faltou'
         when current_date - 30 + ((n - 1) % 90) < current_date then 'realizado'
         when current_date - 30 + ((n - 1) % 90) = current_date and n % 2 = 0 then 'confirmado'
         else 'agendado' end,
       false, case when n <= 20 then 'pacote' else 'pendente' end,
       case when n <= 20 then 0 else (70 + (((n - 1) % 10) + 1) * 25)::numeric end,
       0, 'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1', false
from generate_series(1, 150) n
on conflict do nothing;

-- Participantes adicionais tornam os serviços coletivos visíveis no layout.
update public.appointments
set service_id = md5('MWF_DEMO_V1:service:9')::uuid,
    employee_id = md5('MWF_DEMO_V1:employee:8')::uuid,
    appointment_type = 'grupo',
    appointment_origin = 'grupo',
    notes = notes || ' | grupo clinica 2'
where id in (
  md5('MWF_DEMO_V1:appointment:27')::uuid,
  md5('MWF_DEMO_V1:appointment:67')::uuid
)
  and notes like '%MWF_DEMO_V1%'
  and notes not like '%grupo clinica 2%';

update public.appointments
set employee_id = md5('MWF_DEMO_V1:employee:4')::uuid,
    service_id = md5('MWF_DEMO_V1:service:4')::uuid,
    appointment_type = 'grupo',
    appointment_origin = 'grupo',
    notes = notes || ' | grupo clinica 1'
where id in (
  md5('MWF_DEMO_V1:appointment:24')::uuid,
  md5('MWF_DEMO_V1:appointment:64')::uuid
)
  and notes like '%MWF_DEMO_V1%'
  and notes not like '%grupo clinica 1%';

insert into public.appointment_participants (
  id, appointment_id, patient_id, status, package_session_consumed, billing_status,
  amount_due, amount_paid, notes, legacy_aggregate
)
select md5('MWF_DEMO_V1:participant:group:' || appointment_number || ':' || patient_number)::uuid,
       md5('MWF_DEMO_V1:appointment:' || appointment_number)::uuid,
       md5('MWF_DEMO_V1:patient:' || patient_number)::uuid,
       'agendado', false, 'pendente', 150, 0,
       'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1 | participante grupo V2', false
from (values
  (24, 1), (24, 2),
  (27, 25), (27, 26), (27, 28), (27, 29), (27, 30),
  (64, 1), (64, 2), (64, 3), (64, 4), (64, 10)
) as group_member(appointment_number, patient_number)
on conflict do nothing;

-- Estados individuais visiveis: cada acao afeta somente uma linha participante.
update public.appointment_participants set
  status=case patient_id
    when md5('MWF_DEMO_V1:patient:1')::uuid then 'faltou'
    when md5('MWF_DEMO_V1:patient:2')::uuid then 'cancelado'
    else 'confirmado' end,
  absent_at=case when patient_id=md5('MWF_DEMO_V1:patient:1')::uuid then now() else null end,
  cancelled_at=case when patient_id=md5('MWF_DEMO_V1:patient:2')::uuid then now() else null end,
  confirmed_at=case when patient_id not in (md5('MWF_DEMO_V1:patient:1')::uuid,md5('MWF_DEMO_V1:patient:2')::uuid) then now() else null end
where appointment_id=md5('MWF_DEMO_V1:appointment:24')::uuid and notes like '%MWF_DEMO_V1%';

update public.appointment_participants set
  status=case patient_id
    when md5('MWF_DEMO_V1:patient:25')::uuid then 'realizado'
    when md5('MWF_DEMO_V1:patient:26')::uuid then 'faltou'
    when md5('MWF_DEMO_V1:patient:28')::uuid then 'cancelado'
    when md5('MWF_DEMO_V1:patient:30')::uuid then 'confirmado'
    else 'agendado' end,
  finalized_at=case when patient_id=md5('MWF_DEMO_V1:patient:25')::uuid then now() else null end,
  absent_at=case when patient_id=md5('MWF_DEMO_V1:patient:26')::uuid then now() else null end,
  cancelled_at=case when patient_id=md5('MWF_DEMO_V1:patient:28')::uuid then now() else null end
where appointment_id=md5('MWF_DEMO_V1:appointment:27')::uuid and notes like '%MWF_DEMO_V1%';

update public.appointment_participants set patient_package_id=md5('MWF_DEMO_V1:package:10')::uuid,
  status='realizado',package_session_consumed=true,billing_status='pacote',amount_due=0,amount_paid=0,
  finalized_at=now()
where appointment_id=md5('MWF_DEMO_V1:appointment:64')::uuid
  and patient_id=md5('MWF_DEMO_V1:patient:10')::uuid and notes like '%MWF_DEMO_V1%';
update public.appointment_participants set patient_package_id=md5('MWF_DEMO_V1:package:4')::uuid,
  billing_status='pacote',amount_due=0,amount_paid=0
where appointment_id=md5('MWF_DEMO_V1:appointment:64')::uuid
  and patient_id=md5('MWF_DEMO_V1:patient:4')::uuid and notes like '%MWF_DEMO_V1%';

update public.patient_packages set completed_sessions=1,
  remaining_sessions=contracted_sessions-1,updated_at=now()
where id=md5('MWF_DEMO_V1:package:10')::uuid and notes like '%MWF_DEMO_V1%';

insert into public.patient_session_history(
  id,clinic_id,patient_id,employee_id,service_id,appointment_id,appointment_participant_id,
  session_date,status,notes,finance_integration_status,commission_integration_status,package_session_status
) values
  (md5('MWF_DEMO_V1:session:group:64:10')::uuid,md5('MWF_DEMO_V1:clinic:1')::uuid,
   md5('MWF_DEMO_V1:patient:10')::uuid,md5('MWF_DEMO_V1:employee:4')::uuid,
   md5('MWF_DEMO_V1:service:4')::uuid,md5('MWF_DEMO_V1:appointment:64')::uuid,
   md5('MWF_DEMO_V1:participant:group:64:10')::uuid,current_date+33,'realizado',
   'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1 | sessao individual consumida','not_applicable','generated','consumed'),
  (md5('MWF_DEMO_V1:session:group:64:4')::uuid,md5('MWF_DEMO_V1:clinic:1')::uuid,
   md5('MWF_DEMO_V1:patient:4')::uuid,md5('MWF_DEMO_V1:employee:4')::uuid,
   md5('MWF_DEMO_V1:service:4')::uuid,md5('MWF_DEMO_V1:appointment:64')::uuid,
   md5('MWF_DEMO_V1:participant:group:64:4')::uuid,current_date+33,'reaberto',
   'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1 | sessao individual devolvida','reverted','reverted','restored')
on conflict (id) do update set status=excluded.status,package_session_status=excluded.package_session_status;

insert into public.medical_records(
  id,clinic_id,patient_id,employee_id,appointment_id,appointment_participant_id,title,evolution,notes,status
) values
  (md5('MWF_DEMO_V1:record:group:64:10')::uuid,md5('MWF_DEMO_V1:clinic:1')::uuid,
   md5('MWF_DEMO_V1:patient:10')::uuid,md5('MWF_DEMO_V1:employee:4')::uuid,
   md5('MWF_DEMO_V1:appointment:64')::uuid,md5('MWF_DEMO_V1:participant:group:64:10')::uuid,
   'DEMO â€” Evolucao individual do grupo','Evolucao ficticia de teste.',
   'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1','active'),
  (md5('MWF_DEMO_V1:record:group:64:4')::uuid,md5('MWF_DEMO_V1:clinic:1')::uuid,
   md5('MWF_DEMO_V1:patient:4')::uuid,md5('MWF_DEMO_V1:employee:4')::uuid,
   md5('MWF_DEMO_V1:appointment:64')::uuid,md5('MWF_DEMO_V1:participant:group:64:4')::uuid,
   'DEMO â€” Evolucao reaberta do grupo','Registro ficticio reaberto.',
   'DADO DE HOMOLOGAÃ‡ÃƒO MWFSystem | MWF_DEMO_V1','reaberto')
on conflict (id) do update set status=excluded.status,updated_at=now();

insert into public.schedule_blocks (
  id, clinic_id, employee_id, block_date, block_type, start_time, end_time, reason, status
)
select md5('MWF_DEMO_V1:block:' || n)::uuid,
       md5('MWF_DEMO_V1:clinic:' || case when n <= 7 then 1 else 2 end)::uuid,
       md5('MWF_DEMO_V1:employee:' || n)::uuid,
       current_date + n, 'periodo', time '12:00', time '13:00',
       'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1 | bloqueio', 'active'
from generate_series(1, 8) n
on conflict (id) do nothing;

insert into public.patient_session_history (
  id, clinic_id, patient_id, employee_id, service_id, appointment_id,
  session_date, status, notes, finance_integration_status,
  commission_integration_status, package_session_status
)
select md5('MWF_DEMO_V1:session:' || n)::uuid,
       md5('MWF_DEMO_V1:clinic:' || case when ((n - 1) % 40) + 1 <= 24 then 1 else 2 end)::uuid,
       md5('MWF_DEMO_V1:patient:' || (((n - 1) % 40) + 1))::uuid,
       md5('MWF_DEMO_V1:employee:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 7) else 8 end)::uuid,
       md5('MWF_DEMO_V1:service:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 6) else 7 + ((n - 1) % 4) end)::uuid,
       md5('MWF_DEMO_V1:appointment:' || n)::uuid,
       current_date - 14 + ((n - 1) % 14), 'realizado',
       'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1 | evolução de teste',
       'generated', 'generated', case when n <= 15 then 'consumed' else 'not_applied' end
from generate_series(1, 45) n
where n % 9 <> 0 and n % 11 <> 0
on conflict (id) do nothing;

insert into public.medical_records (
  id, clinic_id, patient_id, employee_id, appointment_id, title, complaint,
  history, conduct, evolution, notes, status
)
select md5('MWF_DEMO_V1:record:' || n)::uuid,
       md5('MWF_DEMO_V1:clinic:1')::uuid,
       md5('MWF_DEMO_V1:patient:' || n)::uuid,
       md5('MWF_DEMO_V1:employee:' || (1 + ((n - 1) % 7)))::uuid,
       md5('MWF_DEMO_V1:appointment:' || n)::uuid,
       'DEMO — Evolução de teste ' || lpad(n::text, 2, '0'),
       'Queixa simulada e genérica para homologação.',
       'Histórico fictício sem dado clínico sensível.',
       'Conduta simulada; registro de retorno.',
       'Observação fictícia de melhora para teste visual.',
       'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1', 'active'
from generate_series(1, 20) n
on conflict (id) do nothing;

-- 80 lançamentos: receitas, despesas, vencidos, pendentes e pagos.
insert into public.financial_transactions (
  id, clinic_id, transaction_type, patient_id, service_id, employee_id, origin,
  category, description, amount, paid_amount, payment_method, due_date,
  payment_date, status, notes, future_agenda_source_id, commission_status,
  whatsapp_status, report_visibility, appointment_date, base_amount, commission_type
)
select
  md5('MWF_DEMO_V1:financial:' || n)::uuid,
  md5('MWF_DEMO_V1:clinic:' || case when ((n - 1) % 40) + 1 <= 24 then 1 else 2 end)::uuid,
  case when n <= 70 then 'receita' else 'despesa' end,
  case when n <= 70 then md5('MWF_DEMO_V1:patient:' || (((n - 1) % 40) + 1))::uuid else null end,
  case when n <= 70 then md5('MWF_DEMO_V1:service:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 6) else 7 + ((n - 1) % 4) end)::uuid else null end,
  md5('MWF_DEMO_V1:employee:' || case when ((n - 1) % 40) + 1 <= 24 then 1 + ((n - 1) % 7) else 8 end)::uuid,
  case when n <= 20 then 'pacote' when n <= 70 then 'avulso' else null end,
  case when n <= 70 then 'Atendimentos' when n % 6 = 0 then 'Comissoes' when n % 6 = 1 then 'Aluguel e despesas mensais' when n % 6 = 2 then 'Repasses' when n % 6 = 3 then 'Beneficios' when n % 6 = 4 then 'Descontos' else 'Encargos' end,
  'DEMO — Lançamento financeiro ' || lpad(n::text, 2, '0'),
  case when n <= 70 then (70 + (((n - 1) % 10) + 1) * 25)::numeric else (120 + n * 7)::numeric end,
  case when n % 4 = 0 then 0
       when n % 5 = 0 then round((case when n <= 70 then 70 + (((n - 1) % 10) + 1) * 25 else 120 + n * 7 end) * 0.4, 2)
       else (case when n <= 70 then 70 + (((n - 1) % 10) + 1) * 25 else 120 + n * 7 end)::numeric end,
  (array['pix','dinheiro','cartao','boleto','parcelado'])[1 + ((n - 1) % 5)],
  current_date - 20 + (n % 40),
  case when n % 4 <> 0 then current_date - 19 + (n % 40) else null end,
  case when n % 4 = 0 and current_date - 20 + (n % 40) < current_date then 'vencido'
       when n % 4 = 0 then 'pendente'
       when n % 5 = 0 then 'parcial'
       else 'pago' end,
  'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1' || case when n % 5 = 0 then ' | pagamento parcial' else '' end,
  case when n between 21 and 70 then md5('MWF_DEMO_V1:appointment:' || n)::uuid else null end,
  case when n > 70 and n % 6 = 0 then 'generated' else 'not_applicable' end,
  'not_applicable', 'ready', current_date - 30 + ((n - 1) % 90),
  case when n > 70 and n % 6 = 0 then 200 + n * 5 else null end,
  case when n > 70 and n % 6 = 0 then 'percentual' else null end
from generate_series(1, 100) n
on conflict (id) do nothing;

-- Reutiliza linhas do lote para demonstrar financeiro/comissao individual sem duplicar o volume.
update public.financial_transactions set future_agenda_source_id=md5('MWF_DEMO_V1:appointment:24')::uuid,
  appointment_participant_id=md5('MWF_DEMO_V1:participant:24')::uuid,legacy_group_aggregate=false
where id=md5('MWF_DEMO_V1:financial:24')::uuid and notes like '%MWF_DEMO_V1%';
update public.financial_transactions set clinic_id=md5('MWF_DEMO_V1:clinic:2')::uuid,
  patient_id=md5('MWF_DEMO_V1:patient:25')::uuid,service_id=md5('MWF_DEMO_V1:service:9')::uuid,
  employee_id=md5('MWF_DEMO_V1:employee:8')::uuid,future_agenda_source_id=md5('MWF_DEMO_V1:appointment:27')::uuid,
  appointment_participant_id=md5('MWF_DEMO_V1:participant:group:27:25')::uuid,legacy_group_aggregate=false
where id=md5('MWF_DEMO_V1:financial:65')::uuid and notes like '%MWF_DEMO_V1%';
update public.financial_transactions set clinic_id=md5('MWF_DEMO_V1:clinic:1')::uuid,
  patient_id=md5('MWF_DEMO_V1:patient:24')::uuid,service_id=md5('MWF_DEMO_V1:service:4')::uuid,
  employee_id=md5('MWF_DEMO_V1:employee:4')::uuid,category='Comissoes',
  future_agenda_source_id=md5('MWF_DEMO_V1:appointment:24')::uuid,
  appointment_participant_id=md5('MWF_DEMO_V1:participant:24')::uuid,legacy_group_aggregate=false
where id=md5('MWF_DEMO_V1:financial:72')::uuid and notes like '%MWF_DEMO_V1%';
update public.financial_transactions set clinic_id=md5('MWF_DEMO_V1:clinic:2')::uuid,
  patient_id=null,service_id=md5('MWF_DEMO_V1:service:9')::uuid,
  employee_id=md5('MWF_DEMO_V1:employee:8')::uuid,category='Comissoes',
  future_agenda_source_id=md5('MWF_DEMO_V1:appointment:27')::uuid,
  appointment_participant_id=null,legacy_group_aggregate=false
where id=md5('MWF_DEMO_V1:financial:84')::uuid and notes like '%MWF_DEMO_V1%';
update public.financial_transactions set clinic_id=md5('MWF_DEMO_V1:clinic:1')::uuid,
  patient_id=md5('MWF_DEMO_V1:patient:10')::uuid,service_id=md5('MWF_DEMO_V1:service:4')::uuid,
  employee_id=md5('MWF_DEMO_V1:employee:4')::uuid,category='Comissoes',
  future_agenda_source_id=md5('MWF_DEMO_V1:appointment:64')::uuid,
  appointment_participant_id=md5('MWF_DEMO_V1:participant:group:64:10')::uuid,
  legacy_group_aggregate=false
where id=md5('MWF_DEMO_V1:financial:78')::uuid and notes like '%MWF_DEMO_V1%';

update public.appointment_participants set status='realizado',finalized_at=now(),
  financial_transaction_id=md5('MWF_DEMO_V1:financial:65')::uuid,
  billing_status='parcial',amount_due=195,amount_paid=78
where id=md5('MWF_DEMO_V1:participant:group:27:25')::uuid and notes like '%MWF_DEMO_V1%';
update public.appointment_participants set financial_transaction_id=md5('MWF_DEMO_V1:financial:24')::uuid,
  commission_id=md5('MWF_DEMO_V1:financial:72')::uuid
where id=md5('MWF_DEMO_V1:participant:24')::uuid and notes like '%MWF_DEMO_V1%';
update public.appointment_participants set status='confirmado',reopened_at=now(),
  package_session_consumed=false,notes=notes || ' | sessao reaberta e devolvida'
where id=md5('MWF_DEMO_V1:participant:group:64:4')::uuid and notes like '%MWF_DEMO_V1%';
update public.appointment_participants set commission_id=md5('MWF_DEMO_V1:financial:78')::uuid
where id=md5('MWF_DEMO_V1:participant:group:64:10')::uuid and notes like '%MWF_DEMO_V1%';

insert into public.payment_settlements (
  id, financial_transaction_id, settlement_type, amount, payment_method, paid_at, notes
)
select md5('MWF_DEMO_V1:settlement:' || n)::uuid,
       md5('MWF_DEMO_V1:financial:' || n)::uuid,
       case when n <= 24 then 'patient_payment' else 'staff_payout' end,
       case
         when n <= 24 and n % 5 = 0 then round((70 + (((n - 1) % 10) + 1) * 25) * 0.4, 2)
         when n <= 24 then (70 + (((n - 1) % 10) + 1) * 25)::numeric
         when n % 5 = 0 then round((120 + n * 7) * 0.4, 2)
         else (120 + n * 7)::numeric
       end,
       (array['pix','dinheiro','cartao','boleto','parcelado'])[1 + ((n - 1) % 5)],
       current_date - (n % 15), 'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1'
from (
  select n from generate_series(1, 24) n where n % 4 <> 0
  union all
  select n from generate_series(71, 80) n where n % 4 <> 0
) paid_demo
on conflict (id) do nothing;

insert into public.payroll_entries (
  id, clinic_id, employee_id, financial_transaction_id, competence_month,
  competence_year, entry_type, nature, amount, due_date, paid_at, status, notes
)
select md5('MWF_DEMO_V1:payroll:' || n)::uuid,
       md5('MWF_DEMO_V1:clinic:' || case when n <= 7 then 1 else 2 end)::uuid,
       md5('MWF_DEMO_V1:employee:' || n)::uuid,
       case when n <= 7 then md5('MWF_DEMO_V1:financial:' || (80 + n))::uuid
            when n = 8 then md5('MWF_DEMO_V1:financial:71')::uuid
            else null end,
       extract(month from current_date)::integer, extract(year from current_date)::integer,
       case when n <= 8 then 'comissao_manual' when n <= 11 then 'salario_fixo' else 'vale_alimentacao' end,
       'credito', case when n <= 8 then 650 + n * 35 else 1800 + n * 50 end,
       date_trunc('month', current_date)::date + 29,
       case when n % 3 = 0 then current_date else null end,
       case when n % 3 = 0 then 'pago' else 'pendente' end,
       'DADO DE HOMOLOGAÇÃO MWFSystem | MWF_DEMO_V1'
from generate_series(1, 13) n
on conflict (id) do nothing;

do $postcheck$
begin
  if (select count(*) from public.clinics where name like 'DEMO —%MWF_DEMO_V1%') <> 2 then
    raise exception 'MWF_DEMO_V1: pós-validação falhou para clínicas';
  end if;
  if (select count(*) from public.patients where notes like '%MWF_DEMO_V1%') <> 40 then
    raise exception 'MWF_DEMO_V1: pós-validação falhou para pacientes';
  end if;
  if (select count(*) from public.patient_packages where notes like '%MWF_DEMO_V1%') <> 20 then
    raise exception 'MWF_DEMO_V1: pós-validação falhou para pacotes';
  end if;
  if (select count(*) from public.appointments where notes like '%MWF_DEMO_V1%') <> 150 then
    raise exception 'MWF_DEMO_V1: pós-validação falhou para agendamentos';
  end if;
  if (select count(*) from public.financial_transactions where notes like '%MWF_DEMO_V1%') <> 100 then
    raise exception 'MWF_DEMO_V1: pós-validação falhou para financeiro';
  end if;
  if exists (
    select 1 from public.patient_packages
    where notes like '%MWF_DEMO_V1%'
      and contracted_sessions <> completed_sessions + remaining_sessions
  ) then
    raise exception 'MWF_DEMO_V1: pós-validação encontrou pacote inconsistente';
  end if;
end
$postcheck$;

commit;
