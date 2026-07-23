import { normalizeAssistantText } from "../assistant/interpreter.ts";

export type CentralIntent = "list_patients" | "search_patient" | "list_employees" | "search_employee" | "appointments" | "financial" | "payroll" | "services" | "professionals" | "packages" | "reports" | "mark_payment" | "mark_attendance" | "mark_commission" | "universal_search" | "ambiguous" | "unknown";
export type ConversationStep = "choose_settlement" | "choose_employee" | "show_results" | "confirm" | null;
export type CentralContext = { currentIntent?: CentralIntent | null; currentStep?: ConversationStep; selectedPatient?: { id: string; name: string } | null; selectedEmployee?: { id: string; name: string } | null; selectedAppointment?: { id: string; label: string } | null; selectedCommission?: { id: string; label: string } | null; selectedClinic?: string | null; pendingAction?: string | null };
export type RoutedIntent = { intent: CentralIntent; filter?: "active" | "inactive" | "debtors" | "without_appointment" | "next"; startsWith?: string; searchTerm?: string; step: ConversationStep };

export function routeAssistantIntent(input: string, context: CentralContext = {}): RoutedIntent {
  const text = normalizeAssistantText(input);
  if (/^(cancelar|cancela|sair|parar)$/.test(text)) return { intent: "unknown", step: null };
  if (context.currentStep === "choose_settlement") {
    if (/^(atendimento|consulta|sessao)$/.test(text)) return { intent: "mark_attendance", step: "show_results" };
    if (/^(pagamento|pagamento do paciente|paciente)$/.test(text)) return { intent: "mark_payment", step: "show_results" };
    if (/^(comissao|comissao do funcionario)$/.test(text)) return { intent: "mark_commission", step: "choose_employee" };
    if (/^(financeiro|conta|conta financeira)$/.test(text)) return { intent: "financial", step: "show_results" };
    return { intent: "ambiguous", step: "choose_settlement" };
  }
  if (context.currentStep === "choose_employee" && (context.currentIntent === "payroll" || context.currentIntent === "mark_commission" || context.currentIntent === "search_employee")) return { intent: "search_employee", searchTerm: input.trim(), step: "show_results" };
  if (/^(dar baixa|baixar|baixa)$/.test(text)) return { intent: "ambiguous", step: "choose_settlement" };
  if (/^comissoes?$/.test(text)) return { intent: "mark_commission", step: "choose_employee" };
  if (/^buscar funcionario$/.test(text)) return { intent: "search_employee", step: "choose_employee" };
  if (/\bcontracheques?|folha de pagamento\b/.test(text)) return { intent: "payroll", step: "choose_employee" };
  if (/\bproxim[oa] paciente\b/.test(text)) return { intent: "appointments", filter: "next", step: "show_results" };
  if (/\bfuncionarios?\b|\bcolaboradores?\b/.test(text)) return { intent: "list_employees", filter: /inativ/.test(text) ? "inactive" : /ativ/.test(text) ? "active" : undefined, step: "show_results" };
  if (/\bpacientes?\b/.test(text)) {
    const initial = text.match(/(?:comecam?|iniciam?) com (?:a letra )?([a-z])\b/);
    if (initial) return { intent: "search_patient", startsWith: initial[1], step: "show_results" };
    if (/devedor|devendo|debitos?|inadimpl|somente devedores/.test(text)) return { intent: "financial", filter: "debtors", step: "show_results" };
    return { intent: "list_patients", filter: /sem agendamento/.test(text) ? "without_appointment" : /inativ/.test(text) ? "inactive" : /ativ/.test(text) ? "active" : undefined, step: "show_results" };
  }
  if (context.currentIntent === "list_patients" && /^(somente )?(devedores|com debitos|devendo)$/.test(text)) return { intent: "financial", filter: "debtors", step: "show_results" };
  if (/\bservicos?\b/.test(text)) return { intent: "services", step: "show_results" };
  if (/\bprofissionais?\b/.test(text)) return { intent: "professionals", step: "show_results" };
  if (/\bpacotes?\b/.test(text)) return { intent: "packages", step: "show_results" };
  if (/\brelatorios?\b/.test(text)) return { intent: "reports", step: "show_results" };
  if (/\bfinanceiro|contas?|faturamento\b/.test(text)) return { intent: "financial", step: "show_results" };
  if (/\bagenda|agendamentos?|atendimentos?\b/.test(text)) return { intent: "appointments", step: "show_results" };
  return { intent: "universal_search", searchTerm: input.trim(), step: "show_results" };
}
