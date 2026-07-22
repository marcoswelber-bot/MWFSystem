import type { MwfAiDomain, MwfAiIntent } from "./types.ts";

export type Capability = { domain: Exclude<MwfAiDomain, "unknown">; label: string; concepts: string[]; route: string; permission: string; searchable: string[]; intents: MwfAiIntent[]; confirmationActions: string[] };

export const capabilityRegistry: Capability[] = [
  { domain: "pacientes", label: "Pacientes", concepts: ["paciente", "pacientes", "paci", "cadastro"], route: "/pacientes", permission: "pacientes", searchable: ["nome", "cpf", "telefone", "email", "codigo"], intents: ["search", "discover", "patient_summary"], confirmationActions: [] },
  { domain: "pacotes", label: "Pacotes", concepts: ["pacote", "pacotes", "sessoes restantes"], route: "/pacotes", permission: "pacotes", searchable: ["paciente", "status", "validade", "numero"], intents: ["search", "discover", "check_alerts"], confirmationActions: [] },
  { domain: "prontuarios", label: "Prontuários", concepts: ["prontuario", "prontuarios", "evolucao", "registro clinico"], route: "/prontuarios", permission: "prontuarios", searchable: ["paciente", "status"], intents: ["search", "discover", "patient_summary"], confirmationActions: [] },
  { domain: "profissionais", label: "Profissionais", concepts: ["profissional", "profissionais", "funcionario", "funcionarios"], route: "/funcionarios", permission: "funcionarios", searchable: ["nome", "funcao", "email"], intents: ["search", "discover"], confirmationActions: [] },
  { domain: "agenda", label: "Agenda", concepts: ["agenda", "agendamento", "agendamentos", "consulta", "horario", "atendimento", "sessao"], route: "/agenda", permission: "agenda", searchable: ["data", "paciente", "profissional", "servico", "status"], intents: ["list_appointments", "check_availability", "schedule_patient", "discover"], confirmationActions: ["create_appointment"] },
  { domain: "financeiro", label: "Financeiro", concepts: ["financeiro", "debito", "divida", "devendo", "pagamento", "cobranca", "parcela"], route: "/financeiro", permission: "financeiro", searchable: ["paciente", "vencimento", "status", "referencia"], intents: ["check_debtors", "check_patient_financial_status", "discover"], confirmationActions: ["send_charge", "register_payment"] },
  { domain: "servicos", label: "Serviços", concepts: ["servico", "servicos", "procedimento"], route: "/servicos", permission: "servicos", searchable: ["nome", "categoria", "status"], intents: ["search", "discover"], confirmationActions: [] },
  { domain: "relatorios", label: "Relatórios", concepts: ["relatorio", "relatorios", "indicador", "faturamento"], route: "/relatorios", permission: "relatorios", searchable: ["tipo"], intents: ["discover"], confirmationActions: [] },
  { domain: "clinicas", label: "Clínicas", concepts: ["clinica", "clinicas", "unidade", "unidades"], route: "/clinicas", permission: "clinicas", searchable: ["nome", "status"], intents: ["search", "discover"], confirmationActions: [] },
  { domain: "comissoes", label: "Comissões", concepts: ["comissao", "comissoes", "repasse"], route: "/funcionarios", permission: "comissoes", searchable: ["profissional", "periodo", "status"], intents: ["discover"], confirmationActions: [] }
];
