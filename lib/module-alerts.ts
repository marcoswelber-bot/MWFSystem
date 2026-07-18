import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import type { ModuleAlert } from "@/components/module-alerts";
import type { ActionableAlertData } from "@/components/actionable-alert";

export async function getAgendaAlerts(): Promise<ModuleAlert[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const alerts: ModuleAlert[] = [];

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

export async function getAgendaActionableAlerts(): Promise<ActionableAlertData[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const alerts: ActionableAlertData[] = [];

  let pendingQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, patient_id, service_id, employee_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "agendado")
    .order("appointment_date", { ascending: false })
    .limit(20);

  if (clinicScope.clinicId) {
    pendingQuery = pendingQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: pendingRaw } = await pendingQuery;
  const pending = pendingRaw ?? [];

  let absentQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, patient_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "faltou")
    .order("appointment_date", { ascending: false })
    .limit(10);

  if (clinicScope.clinicId) {
    absentQuery = absentQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: absentRaw } = await absentQuery;
  const absent = absentRaw ?? [];

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
      date: a.appointment_date,
      referenceId: a.id,
      module: "agenda",
      actions: [
        { label: "Marcar realizado", action: "marcar_realizado", variant: "default" },
        { label: "Registrar falta", action: "registrar_falta", variant: "secondary" },
        { label: "Cancelar agendamento", action: "cancelar_agendamento", variant: "destructive" }
      ]
    });
  });

  absent.forEach((a) => {
    alerts.push({
      id: `absent-${a.id}`,
      type: "falta",
      title: "Paciente faltou",
      description: `${patientMap.get(a.patient_id) ?? "Paciente"} - ${a.appointment_date}`,
      date: a.appointment_date,
      referenceId: a.id,
      module: "agenda",
      actions: [
        { label: "Marcar realizado", action: "marcar_realizado", variant: "default" },
        { label: "Cancelar", action: "cancelar_agendamento", variant: "destructive" }
      ]
    });
  });

  return alerts;
}

export async function getFinanceiroAlerts(): Promise<ModuleAlert[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const alerts: ModuleAlert[] = [];

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

  const [{ data: overdueRaw }, { data: commissionRaw }] = await Promise.all([
    overdueQuery,
    commissionQuery
  ]);
  const overdue = overdueRaw ?? [];
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

export async function getFinanceiroActionableAlerts(): Promise<ActionableAlertData[]> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const alerts: ActionableAlertData[] = [];

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

  const [{ data: overdueRaw }, { data: commissionRaw }] = await Promise.all([
    overdueQuery,
    commissionQuery
  ]);
  const overdue = overdueRaw ?? [];
  const commissions = commissionRaw ?? [];

  overdue.forEach((p) => {
    alerts.push({
      id: `overdue-${p.id}`,
      type: "vencido",
      title: "Pagamento vencido",
      description: `${p.description ?? "Cobranca"} - venceu em ${p.due_date}`,
      date: p.due_date,
      referenceId: p.id,
      module: "financeiro",
      actions: [
        { label: "Dar baixa total", action: "dar_baixa", variant: "default" }
      ]
    });
  });

  commissions.forEach((c) => {
    alerts.push({
      id: `commission-${c.id}`,
      type: "comissao_pendente",
      title: "Comissao pendente",
      description: `${c.description ?? "Comissao"} - ${c.due_date}`,
      date: c.due_date,
      referenceId: c.id,
      module: "financeiro",
      actions: [
        { label: "Pagar comissao", action: "dar_baixa", variant: "default" }
      ]
    });
  });

  return alerts;
}
