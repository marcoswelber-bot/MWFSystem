import type { Route } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantContext } from "@/lib/assistant/interpreter";
import { routeAssistantIntent, type CentralContext } from "@/lib/mwf-ai/intent-router";
import type { Database } from "@/types/database";

type PermissionSet = { view: boolean; create?: boolean; edit?: boolean };
type Permissions = Record<string, PermissionSet>;
type Reply = { title: string; message: string; cards: { title: string; lines: string[]; tone?: "default" | "warning" | "success" }[]; actions: { label: string; href?: Route; prompt?: string }[]; context: AssistantContext };

const route = (label: string, href: string) => ({ label, href: href as Route });
const contextFor = (context: AssistantContext, clinicId: string, intent: ReturnType<typeof routeAssistantIntent>) => ({ ...context, currentIntent: intent.intent, currentStep: intent.step, selectedClinic: clinicId, updatedAt: Date.now() } as AssistantContext);
const denied = (context: AssistantContext): Reply => ({ title: "Acesso restrito", message: "Você não possui permissão para consultar esta informação.", cards: [], actions: [], context });

export async function handleCentralIntent(input: string, previous: AssistantContext, permissions: Permissions, clinicId: string | null, supabase: SupabaseClient<Database>): Promise<Reply | null> {
  const routed = routeAssistantIntent(input, previous as CentralContext);
  if (routed.intent === "universal_search") return null;
  if (routed.intent === "unknown") return { title: "Conversa limpa", message: "O que você deseja consultar?", cards: [], actions: [], context: { updatedAt: Date.now() } };
  if (!clinicId) return { title: "Selecione uma clínica", message: "Escolha a clínica atual antes de consultar dados.", cards: [], actions: [], context: previous };
  const context = contextFor(previous, clinicId, routed);

  if (routed.intent === "ambiguous") return {
    title: "Dar baixa", message: "O que você deseja dar baixa?", cards: [],
    actions: ["Atendimento", "Pagamento do paciente", "Comissão do funcionário", "Conta financeira"].map(label => ({ label, prompt: label })), context
  };
  if (routed.intent === "payroll") {
    if (!permissions.comissoes?.view && !permissions.financeiro?.view) return denied(context);
    return { title: "Contracheques", message: "De qual funcionário?", cards: [], actions: [], context };
  }
  if (routed.intent === "mark_commission" && routed.step === "choose_employee") {
    if (!permissions.comissoes?.view) return denied(context);
    return { title: "Comissões", message: "De qual funcionário?", cards: [], actions: [], context };
  }
  if (routed.intent === "search_employee" && !routed.searchTerm) {
    if (!permissions.funcionarios?.view) return denied(context);
    return { title: "Buscar funcionário", message: "Qual é o nome do funcionário?", cards: [], actions: [], context: { ...context, currentStep: "choose_employee" } as AssistantContext };
  }
  if (routed.intent === "list_employees") {
    if (!permissions.funcionarios?.view) return denied(context);
    let query = supabase.from("employees").select("id,name,role,status", { count: "exact" }).eq("clinic_id", clinicId).order("name").range(0, 9);
    if (routed.filter) query = query.eq("status", routed.filter);
    const result = await query;
    if (result.error) return { title: "Erro ao consultar funcionários", message: "Não foi possível consultar os funcionários agora.", cards: [], actions: [], context };
    const rows = result.data ?? [];
    return { title: routed.filter === "inactive" ? "Funcionários inativos" : "Funcionários", message: `Encontrei ${result.count ?? rows.length} funcionário(s) cadastrado(s) nesta clínica.`, cards: rows.length ? [{ title: "EmployeeResults", lines: rows.map(row => `${row.name} • ${row.role ?? "Cargo não informado"} • ${row.status}`) }] : [{ title: "EmptyState", lines: ["Nenhum funcionário encontrado."] }], actions: [{ label: "Ver ativos", prompt: "Funcionários ativos" }, { label: "Ver inativos", prompt: "Funcionários inativos" }, { label: "Buscar funcionário", prompt: "Buscar funcionário" }, { label: "Comissões", prompt: "Comissão" }, { label: "Contracheques", prompt: "Contracheque" }, ...rows.slice(0, 5).map(row => route(`Ver ${row.name}`, `/funcionarios?employeeId=${row.id}`))], context };
  }
  if (routed.intent === "list_patients" || routed.intent === "search_patient") {
    if (!permissions.pacientes?.view) return denied(context);
    let query = supabase.from("patients").select("id,full_name,status", { count: "exact" }).eq("clinic_id", clinicId).order("full_name").range(0, 9);
    if (routed.filter === "active" || routed.filter === "inactive") query = query.eq("status", routed.filter);
    if (routed.startsWith) query = query.ilike("full_name", `${routed.startsWith}%`);
    const result = await query;
    if (result.error) return { title: "Erro ao consultar pacientes", message: "Não foi possível consultar os pacientes agora.", cards: [], actions: [], context };
    const rows = result.data ?? [];
    return { title: "Pacientes", message: routed.startsWith ? `Encontrei ${result.count ?? rows.length} paciente(s) cujo nome começa com ${routed.startsWith.toUpperCase()}.` : `Encontrei ${result.count ?? rows.length} paciente(s) cadastrado(s).`, cards: rows.length ? [{ title: "PatientResults", lines: rows.map(row => `${row.full_name} • ${row.status}`) }] : [{ title: "EmptyState", lines: ["Nenhum paciente encontrado."] }], actions: [{ label: "Pacientes devedores", prompt: "Somente devedores" }, { label: "Próximos agendamentos", prompt: "Pacientes do próximo agendamento" }, { label: "Sem agendamento", prompt: "Pacientes sem agendamento" }, { label: "Ativos", prompt: "Pacientes ativos" }, { label: "Inativos", prompt: "Pacientes inativos" }, { label: "Buscar paciente", prompt: "Buscar paciente" }, ...rows.slice(0, 5).map(row => route(`Ver ${row.full_name}`, `/pacientes?patientId=${row.id}`))], context };
  }
  if (routed.intent === "financial" && routed.filter === "debtors") {
    if (!permissions.financeiro?.view || !permissions.pacientes?.view) return denied(context);
    const debts = await supabase.from("financial_transactions").select("patient_id,open_amount,due_date").eq("clinic_id", clinicId).eq("transaction_type", "receita").in("status", ["pendente", "parcial", "vencido"]).gt("open_amount", 0).order("due_date").limit(200);
    if (debts.error) return { title: "Erro ao consultar financeiro", message: "Não foi possível consultar os débitos agora.", cards: [], actions: [], context };
    const ids = [...new Set((debts.data ?? []).map(row => row.patient_id).filter((id): id is string => Boolean(id)))];
    const patients = ids.length ? await supabase.from("patients").select("id,full_name").eq("clinic_id", clinicId).in("id", ids) : { data: [], error: null };
    if (patients.error) return { title: "Erro ao consultar pacientes", message: "Não foi possível relacionar os débitos.", cards: [], actions: [], context };
    const names = new Map((patients.data ?? []).map(row => [row.id, row.full_name]));
    const totals = new Map<string, number>();
    for (const debt of debts.data ?? []) if (debt.patient_id && names.has(debt.patient_id)) totals.set(debt.patient_id, (totals.get(debt.patient_id) ?? 0) + Number(debt.open_amount ?? 0));
    const lines = [...totals].map(([id, total]) => `${names.get(id)} • ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}`);
    return { title: "Pacientes devedores", message: `Encontrei ${lines.length} paciente(s) com débitos reais nesta clínica.`, cards: lines.length ? [{ title: "FinancialResults", lines, tone: "warning" }] : [{ title: "EmptyState", lines: ["Nenhum débito em aberto encontrado."] }], actions: [route("Abrir baixas", "/financeiro/baixas")], context };
  }
  if (routed.intent === "appointments" && routed.filter === "next") {
    if (!permissions.agenda?.view) return denied(context);
    const today = new Date().toISOString().slice(0, 10);
    const appointments = await supabase.from("appointments").select("id,patient_id,appointment_date,start_time,status").eq("clinic_id", clinicId).gte("appointment_date", today).in("status", ["agendado", "confirmado"]).order("appointment_date").order("start_time").limit(1);
    const appointment = appointments.data?.[0];
    if (appointments.error) return { title: "Erro ao consultar agenda", message: "Não foi possível consultar o próximo atendimento.", cards: [], actions: [], context };
    if (!appointment) return { title: "Próximo paciente", message: "Nenhum próximo atendimento encontrado.", cards: [{ title: "EmptyState", lines: ["A agenda não possui atendimento futuro."] }], actions: [route("Abrir Agenda", "/agenda")], context };
    const patient = await supabase.from("patients").select("full_name").eq("clinic_id", clinicId).eq("id", appointment.patient_id).maybeSingle();
    return { title: "Próximo paciente", message: patient.data?.full_name ?? "Paciente não encontrado", cards: [{ title: "AppointmentResults", lines: [`${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} • ${appointment.status}`] }], actions: [route("Ver atendimento", `/agenda?appointmentId=${appointment.id}`)], context };
  }
  if (routed.intent === "search_employee") {
    if (!permissions.funcionarios?.view) return denied(context);
    const term = (routed.searchTerm ?? "").replaceAll("%", "").trim();
    const result = await supabase.from("employees").select("id,name,role,status").eq("clinic_id", clinicId).ilike("name", `%${term}%`).order("name").limit(10);
    const rows = result.data ?? [];
    if (result.error) return { title: "Erro ao buscar funcionário", message: "Não foi possível pesquisar agora.", cards: [], actions: [], context };
    if (!rows.length) return { title: "Funcionário não encontrado", message: "Nenhum funcionário desta clínica corresponde ao nome informado.", cards: [{ title: "EmptyState", lines: ["Tente informar outro nome."] }], actions: [], context };
    if ((previous as CentralContext).currentIntent === "search_employee") return { title: "Funcionários encontrados", message: `Encontrei ${rows.length} funcionário(s).`, cards: [{ title: "EmployeeResults", lines: rows.map(row => `${row.name} • ${row.role ?? "Cargo não informado"} • ${row.status}`) }], actions: rows.map(row => route(`Ver ${row.name}`, `/funcionarios?employeeId=${row.id}`)), context };
    if ((previous as CentralContext).currentIntent === "payroll") return { title: "Contracheques", message: rows.length > 1 ? "Selecione o funcionário." : `Contracheques de ${rows[0].name}.`, cards: [{ title: "EmployeeResults", lines: rows.map(row => `${row.name} • ${row.role ?? "Cargo não informado"}`) }], actions: rows.map(row => route(`Ver contracheques de ${row.name}`, `/financeiro/contracheques/${row.id}/comissoes`)), context: { ...context, currentIntent: "payroll", selectedEmployee: rows.length === 1 ? { id: rows[0].id, name: rows[0].name } : null } as AssistantContext };
    return { title: "Comissões", message: rows.length > 1 ? "Selecione o funcionário antes de continuar." : `Funcionário selecionado: ${rows[0].name}.`, cards: [{ title: "EmployeeResults", lines: rows.map(row => `${row.name} • ${row.status}`) }], actions: rows.map(row => ({ label: row.name, prompt: row.name })), context: { ...context, currentIntent: "mark_commission", currentStep: "confirm", selectedEmployee: rows.length === 1 ? { id: rows[0].id, name: rows[0].name } : null, pendingAction: "mark_commission" } as AssistantContext };
  }
  if (["mark_attendance", "mark_payment", "mark_commission"].includes(routed.intent)) {
    const target = routed.intent === "mark_attendance" ? "/agenda" : "/financeiro/baixas";
    return { title: "Confirmação necessária", message: "Consulte e selecione um registro real antes de confirmar a baixa. Nenhuma alteração foi salva.", cards: [{ title: "ConfirmationCard", lines: ["A baixa só será concluída no fluxo oficial após sua confirmação."] }], actions: [route("Selecionar registro", target)], context: { ...context, pendingAction: routed.intent, currentStep: "confirm" } as AssistantContext };
  }
  const knownModules = {
    services: { permission: "servicos", title: "Serviços", href: "/servicos" },
    professionals: { permission: "funcionarios", title: "Profissionais", href: "/funcionarios" },
    packages: { permission: "pacotes", title: "Pacotes", href: "/pacotes" },
    reports: { permission: "relatorios", title: "Relatórios", href: "/relatorios" },
    financial: { permission: "financeiro", title: "Financeiro", href: "/financeiro" },
    appointments: { permission: "agenda", title: "Agenda", href: "/agenda" }
  } as const;
  const knownModule = knownModules[routed.intent as keyof typeof knownModules];
  if (knownModule) {
    if (!permissions[knownModule.permission]?.view) return denied(context);
    return { title: knownModule.title, message: `Entendi que você deseja consultar ${knownModule.title}.`, cards: [], actions: [route(`Abrir ${knownModule.title}`, knownModule.href)], context };
  }
  return null;
}
