"use server";

import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";

export type DashboardAlert = {
  id: string;
  type: "falta" | "sem_baixa" | "vencido" | "pendente";
  title: string;
  description: string;
  date: string;
  link: string;
};

export type TodayAppointment = {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  patient_name: string;
  employee_name: string;
  service_name: string;
};

export type DashboardData = {
  alerts: DashboardAlert[];
  todayAppointments: TodayAppointment[];
  stats: {
    todayTotal: number;
    todayRealized: number;
    todayPending: number;
    todayAbsent: number;
    overduePayments: number;
    pendingCommissions: number;
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const alerts: DashboardAlert[] = [];

  // Buscar agendamentos de hoje
  let appointmentsQuery = supabase
    .from("appointments")
    .select("id, start_time, end_time, status, appointment_date, patient_id, employee_id, service_id")
    .eq("appointment_date", today)
    .order("start_time", { ascending: true });

  if (clinicScope.clinicId) {
    appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: todayRaw } = await appointmentsQuery;
  const todayAppointments = todayRaw ?? [];

  // Buscar agendamentos passados sem baixa (ultimos 7 dias)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  let pendingQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, status, patient_id, employee_id, service_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "agendado");

  if (clinicScope.clinicId) {
    pendingQuery = pendingQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: pendingRaw } = await pendingQuery;
  const pendingAppointments = pendingRaw ?? [];

  // Buscar agendamentos com falta (ultimos 7 dias)
  let absentQuery = supabase
    .from("appointments")
    .select("id, start_time, appointment_date, status, patient_id")
    .lt("appointment_date", today)
    .gte("appointment_date", sevenDaysAgo)
    .eq("status", "faltou");

  if (clinicScope.clinicId) {
    absentQuery = absentQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: absentRaw } = await absentQuery;
  const absentAppointments = absentRaw ?? [];

  // Buscar contas vencidas
  let overdueQuery = supabase
    .from("financial_transactions")
    .select("id, description, due_date, amount, patient_id")
    .eq("transaction_type", "receita")
    .eq("status", "pendente")
    .lt("due_date", today);

  if (clinicScope.clinicId) {
    overdueQuery = overdueQuery.eq("clinic_id", clinicScope.clinicId);
  }

  const { data: overdueRaw } = await overdueQuery;
  const overduePayments = overdueRaw ?? [];

  // Buscar nomes
  const patientIds = new Set<string>();
  const employeeIds = new Set<string>();
  const serviceIds = new Set<string>();

  todayAppointments.forEach((a) => {
    patientIds.add(a.patient_id);
    employeeIds.add(a.employee_id);
    serviceIds.add(a.service_id);
  });
  pendingAppointments.forEach((a) => {
    patientIds.add(a.patient_id);
    employeeIds.add(a.employee_id);
    serviceIds.add(a.service_id);
  });
  absentAppointments.forEach((a) => patientIds.add(a.patient_id));
  overduePayments.forEach((p) => { if (p.patient_id) patientIds.add(p.patient_id); });

  const patientIdsArr = Array.from(patientIds);
  const employeeIdsArr = Array.from(employeeIds);
  const serviceIdsArr = Array.from(serviceIds);

  const [patientsRes, employeesRes, servicesRes] = await Promise.all([
    patientIdsArr.length > 0
      ? supabase.from("patients").select("id, full_name").in("id", patientIdsArr)
      : { data: [] },
    employeeIdsArr.length > 0
      ? supabase.from("employees").select("id, name").in("id", employeeIdsArr)
      : { data: [] },
    serviceIdsArr.length > 0
      ? supabase.from("services").select("id, name").in("id", serviceIdsArr)
      : { data: [] }
  ]);

  const patientMap = new Map((patientsRes.data ?? []).map((p) => [p.id, p.full_name]));
  const employeeMap = new Map((employeesRes.data ?? []).map((e) => [e.id, e.name]));
  const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));

  // Gerar alertas de agendamentos sem baixa
  pendingAppointments.slice(0, 10).forEach((a) => {
    alerts.push({
      id: `pending-${a.id}`,
      type: "sem_baixa",
      title: "Agendamento sem baixa",
      description: `${patientMap.get(a.patient_id) ?? "Paciente"} - ${a.appointment_date} as ${a.start_time.slice(0, 5)}`,
      date: a.appointment_date,
      link: "/agenda"
    });
  });

  // Gerar alertas de faltas
  absentAppointments.slice(0, 10).forEach((a) => {
    alerts.push({
      id: `absent-${a.id}`,
      type: "falta",
      title: "Paciente faltou",
      description: `${patientMap.get(a.patient_id) ?? "Paciente"} - ${a.appointment_date}`,
      date: a.appointment_date,
      link: "/agenda"
    });
  });

  // Gerar alertas de contas vencidas
  overduePayments.slice(0, 10).forEach((p) => {
    alerts.push({
      id: `overdue-${p.id}`,
      type: "vencido",
      title: "Pagamento vencido",
      description: `${p.description ?? "Cobranca"} - venceu em ${p.due_date}`,
      date: p.due_date,
      link: "/financeiro"
    });
  });

  // Montar appointments de hoje com nomes
  const todayFormatted: TodayAppointment[] = todayAppointments.map((a) => ({
    id: a.id,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status,
    patient_name: patientMap.get(a.patient_id) ?? "Paciente",
    employee_name: employeeMap.get(a.employee_id) ?? "Profissional",
    service_name: serviceMap.get(a.service_id) ?? "Servico"
  }));

  // Contadores
  const todayTotal = todayAppointments.length;
  const todayRealized = todayAppointments.filter((a) => a.status === "realizado").length;
  const todayPending = todayAppointments.filter((a) => a.status === "agendado" || a.status === "confirmado").length;
  const todayAbsent = todayAppointments.filter((a) => a.status === "faltou").length;

  return {
    alerts,
    todayAppointments: todayFormatted,
    stats: {
      todayTotal,
      todayRealized,
      todayPending,
      todayAbsent,
      overduePayments: overduePayments.length,
      pendingCommissions: 0
    }
  };
}
