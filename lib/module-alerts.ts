import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import type { ModuleAlert } from "@/components/module-alerts";

export async function getAgendaAlerts(): Promise<ModuleAlert[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const alerts: ModuleAlert[] = [];

  // Agendamentos passados sem baixa
  let pendingQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, patient_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "agendado")
    .order("appointment_date", { ascending: false })
    .limit(15);

  if (clinicScope.clinicId) {
    pendingQuery = pendingQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: pendingRaw } = await pendingQuery;
  const pending = pendingRaw ?? [];

  // Faltas dos ultimos 7 dias
  let absentQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, patient_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "faltou")
    .order("appointment_date", { ascending: false })
    .limit(15);

  if (clinicScope.clinicId) {
    absentQuery = absentQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: absentRaw } = await absentQuery;
  const absent = absentRaw ?? [];

  // Buscar nomes dos pacientes
  const patientIds = Array.from(
    new Set([...pending, ...absent].map((a) => a.patient_id))
  );

  let patientMap = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name")
      .in("id", patientIds);
    patientMap = new Map((data ?? []).map((p) => [p.id, p.full_name]));
  }

  pending.forEach((a) => {
    alerts.push({
      id: `pending-${a.id}`,
      type: "sem_baixa",
      title: "Agendamento sem baixa",
      description: `${patientMap.get(a.patient_id) ?? "Paciente"} - ${a.appointment_date} as ${a.start_time.slice(0, 5)}`,
      date: a.appointment_date
    });
  });

  absent.forEach((a) => {
    alerts.push({
      id: `absent-${a.id}`,
      type: "falta",
      title: "Paciente faltou",
      description: `${patientMap.get(a.patient_id) ?? "Paciente"} - ${a.appointment_date}`,
      date: a.appointment_date
    });
  });

  return alerts;
}

export async function getFinanceiroAlerts(): Promise<ModuleAlert[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const alerts: ModuleAlert[] = [];

  // Contas vencidas
  let overdueQuery = supabase
    .from("financial_transactions")
    .select("id, description, due_date, amount")
    .eq("transaction_type", "receita")
    .eq("status", "pendente")
    .lt("due_date", today)
    .order("due_date", { ascending: false })
    .limit(15);

  if (clinicScope.clinicId) {
    overdueQuery = overdueQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: overdueRaw } = await overdueQuery;
  const overdue = overdueRaw ?? [];

  // Comissoes pendentes
  let commissionQuery = supabase
    .from("financial_transactions")
    .select("id, description, due_date, amount")
    .eq("transaction_type", "despesa")
    .eq("commission_status", "generated")
    .eq("status", "pendente")
    .order("due_date", { ascending: false })
    .limit(10);

  if (clinicScope.clinicId) {
    commissionQuery = commissionQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: commissionRaw } = await commissionQuery;
  const commissions = commissionRaw ?? [];

  overdue.forEach((p) => {
    alerts.push({
      id: `overdue-${p.id}`,
      type: "vencido",
      title: "Pagamento vencido",
      description: `${p.description ?? "Cobranca"} - venceu em ${p.due_date}`,
      date: p.due_date
    });
  });

  commissions.forEach((c) => {
    alerts.push({
      id: `commission-${c.id}`,
      type: "pendente",
      title: "Comissao pendente",
      description: `${c.description ?? "Comissao"} - ${c.due_date}`,
      date: c.due_date
    });
  });

  return alerts;
}
