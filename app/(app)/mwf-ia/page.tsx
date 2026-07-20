import { MwfAiConsole } from "@/components/ai/mwf-ai-console";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export default async function MwfIaPage() {
  const scope = await getCurrentClinicScope(); const supabase = await createClient(); const clinicId = scope.clinicId;
  const today = new Date().toISOString().slice(0, 10); const month = today.slice(0, 7); const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  let appointmentsQuery = supabase.from("appointments").select("id,appointment_date,status,patient_id").gte("appointment_date", today);
  let financesQuery = supabase.from("financial_transactions").select("amount,paid_amount,open_amount,status,due_date,patient_id,description");
  let packagesQuery = supabase.from("patient_packages").select("expiration_date,remaining_sessions,status,patient_id");
  let patientsQuery = supabase.from("patients").select("id,full_name,status");
  let employeesQuery = supabase.from("employees").select("id,name,status");
  if (clinicId) {
    appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicId); financesQuery = financesQuery.eq("clinic_id", clinicId);
    packagesQuery = packagesQuery.eq("clinic_id", clinicId); patientsQuery = patientsQuery.eq("clinic_id", clinicId); employeesQuery = employeesQuery.eq("clinic_id", clinicId);
  }
  const [appointments, finances, packages, patients, employees] = await Promise.all([appointmentsQuery, financesQuery, packagesQuery, patientsQuery, employeesQuery]);
  const financeRows = finances.data ?? []; const patientRows = patients.data ?? []; const names = new Map(patientRows.map((p) => [p.id, p.full_name]));
  const received = financeRows.filter((r) => r.status === "pago" && (r.due_date ?? "").startsWith(month)).reduce((s, r) => s + Number(r.paid_amount ?? r.amount ?? 0), 0);
  const expected = financeRows.filter((r) => (r.due_date ?? "").startsWith(month)).reduce((s, r) => s + Number(r.open_amount ?? 0), 0);
  const overdue = financeRows.filter((r) => r.status !== "pago" && r.due_date < today);
  const expiring = (packages.data ?? []).filter((p) => p.status === "active" && p.expiration_date && p.expiration_date >= today && p.expiration_date <= in30);
  const futurePatientIds = new Set((appointments.data ?? []).map((item) => item.patient_id));
  const noReturn = patientRows.filter((p) => p.status === "active" && !futurePatientIds.has(p.id));
  return <div className="grid gap-6"><PageHeader eyebrow="Inteligencia operacional" title="MWF IA" description="Consultas inteligentes e sugestões seguras, sempre limitadas à clínica e às permissões atuais." /><MwfAiConsole insights={[
    { label: "Agenda", value: String((appointments.data ?? []).length), detail: "Atendimentos futuros" }, { label: "Profissionais", value: String((employees.data ?? []).filter((e) => e.status === "active").length), detail: "Ativos na clínica" },
    { label: "Receita recebida", value: money(received), detail: "Competência atual" }, { label: "Receita prevista", value: money(expected), detail: "Saldo aberto do mês" },
    { label: "Valores vencidos", value: money(overdue.reduce((s, r) => s + Number(r.open_amount ?? 0), 0)), detail: `${overdue.length} título(s)` }, { label: "Pacotes vencendo", value: String(expiring.length), detail: "Próximos 30 dias" },
    { label: "Pacientes sem retorno", value: String(noReturn.length), detail: "Há mais de 60 dias" }, { label: "Pendências", value: String(overdue.length), detail: "Cobranças em atraso" }
  ]} lists={{ pendencias: overdue.slice(0, 10).map((r) => `${names.get(r.patient_id ?? "") ?? "Paciente"}: ${money(Number(r.open_amount ?? 0))} - venc. ${r.due_date}`), vencendo: expiring.slice(0, 10).map((p) => `${names.get(p.patient_id) ?? "Paciente"}: ${p.remaining_sessions} sessão(ões), vence ${p.expiration_date}`), semRetorno: noReturn.slice(0, 10).map((p) => p.full_name), agendaVazia: (appointments.data ?? []).length === 0 ? ["Nenhum atendimento futuro encontrado."] : [] }} /></div>;
}
