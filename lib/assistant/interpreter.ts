import type { MwfAiContext } from "@/lib/mwf-ai/core/types";

export type AssistantIntent =
  | "list_appointments"
  | "check_availability"
  | "schedule_patient"
  | "check_patient_financial_status"
  | "check_debtors"
  | "check_last_payment"
  | "check_session_payment"
  | "check_alerts"
  | "patient_summary"
  | "discover"
  | "select_domain"
  | "confirm"
  | "cancel"
  | "search"
  | "unknown";

export type AssistantDomain =
  | "agenda"
  | "financeiro"
  | "pacotes"
  | "prontuarios"
  | "relatorios"
  | "servicos"
  | "profissionais"
  | "pacientes"
  | "clinicas"
  | "comissoes"
  | "unknown";

export type AssistantRouteAction =
  | "list"
  | "list_pending"
  | "check_availability"
  | "schedule"
  | "search"
  | "open"
  | "summarize"
  | "prepare_charge"
  | "unknown";

export type AssistantTemporalScope =
  | "today"
  | "tomorrow"
  | "yesterday"
  | "current_week"
  | "next_week"
  | "current_month"
  | "next"
  | "explicit_date"
  | null;

export type AssistantContext = MwfAiContext & {
  patientName?: string | null;
  professionalName?: string | null;
  serviceName?: string | null;
  date?: string | null;
  dateRangeEnd?: string | null;
  period?: "morning" | "afternoon" | "evening" | null;
  time?: string | null;
  updatedAt?: number;
};

export type AssistantInterpretation = AssistantContext & {
  intent: AssistantIntent;
  domain: AssistantDomain;
  action: AssistantRouteAction;
  temporalScope: AssistantTemporalScope;
  patientSearchAllowed: boolean;
  normalizedText: string;
};

export function getAssistantPatientSearchTerm(parsed: AssistantInterpretation, input: string) {
  if (!parsed.patientSearchAllowed) return null;
  return parsed.patientName ?? (parsed.intent === "search" ? input.trim() : null);
}

const agendaDomainWords = [
  "agenda", "agendamento", "agendamentos", "atendimento", "atendimentos", "horario", "horarios",
  "vaga", "vagas", "encaixe", "consulta", "consultas", "sessao", "sessoes", "compromisso", "compromissos"
];
const availabilityWords = ["horario", "horarios", "vaga", "vagas", "livre", "livres", "disponivel", "disponiveis", "disponibilidade", "encaixe", "encaixar", "aberto", "espaco", "desocupado", "sobrou", "sobrando"];
const schedulingWords = ["agendar", "marcar", "encaixar", "reservar", "colocar", "retorno", "retornar", "voltar", "remarcar"];
const financialWords = ["devendo", "deve", "divida", "debito", "pendencia", "pendente", "aberto", "atrasado", "pagamento", "pagou", "quitado", "quitou", "saldo", "cobranca", "parcela", "financeiro", "em dia"];
const debtListWords = ["debitos", "debito", "devedor", "devedores", "devendo", "dividas", "divida", "pendencias", "pendencia", "atrasados", "inadimplentes", "inadimplencia", "debdor", "devdor", "debto", "decedo", "decendo", "pendecia", "atrazados", "divda"];
const temporalWords = ["hoje", "amanha", "ontem", "semana", "semanal", "mes"];

export function normalizeAssistantText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9@/:\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function levenshteinDistance(left: string, right: string) {
  const a = normalizeAssistantText(left);
  const b = normalizeAssistantText(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[b.length];
}

export function similarity(left: string, right: string) {
  const a = normalizeAssistantText(left);
  const b = normalizeAssistantText(right);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.25;
  return 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
}

function hasAny(text: string, words: string[], threshold = 0.78) {
  const tokens = text.split(" ");
  return words.some((word) => tokens.some((token) => token === word || similarity(token, word) >= threshold));
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }

function extractDate(text: string, now: Date) {
  if (/\bhoje\b/.test(text)) return { date: isoDate(now), dateRangeEnd: null, temporalScope: "today" as const };
  if (/\bamanha\b/.test(text)) return { date: isoDate(addDays(now, 1)), dateRangeEnd: null, temporalScope: "tomorrow" as const };
  if (/\bontem\b/.test(text)) return { date: isoDate(addDays(now, -1)), dateRangeEnd: null, temporalScope: "yesterday" as const };
  const week = hasAny(text, ["semana", "semanal"]);
  if (week && /\b(proxima|seguinte)\b|semana que vem/.test(text)) return { date: isoDate(addDays(now, 7)), dateRangeEnd: null, temporalScope: "next_week" as const };
  if (week) return { date: isoDate(now), dateRangeEnd: null, temporalScope: "current_week" as const };
  if (hasAny(text, ["mes"]) && !/proxim/.test(text)) return { date: isoDate(now), dateRangeEnd: null, temporalScope: "current_month" as const };
  const explicit = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (explicit) {
    const yearText = explicit[3];
    const year = yearText ? Number(yearText.length === 2 ? "20" + yearText : yearText) : now.getFullYear();
    return { date: isoDate(new Date(year, Number(explicit[2]) - 1, Number(explicit[1]))), dateRangeEnd: null, temporalScope: "explicit_date" as const };
  }
  const weekdays: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  for (const [name, weekday] of Object.entries(weekdays)) {
    if (text.includes(name)) {
      let distance = (weekday - now.getDay() + 7) % 7;
      if (distance === 0 && !text.includes("hoje")) distance = 7;
      return { date: isoDate(addDays(now, distance)), dateRangeEnd: null, temporalScope: "explicit_date" as const };
    }
  }
  return { date: null, dateRangeEnd: null, temporalScope: null };
}

function hasIdentifierEvidence(input: string) {
  const digits = input.replace(/\D/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim()) || digits.length >= 8;
}

function hasExplicitPatientEvidence(text: string) {
  return /\b(?:buscar|procurar|abrir|agendar|marcar|remarcar|colocar)\s+(?:o |a )?(?:paciente\s+)?[a-z]|\b(?:paciente chamado|paciente|cadastro|telefone|cpf|email|e mail)\s+(?:do|da|de)?\s*[a-z]/.test(text);
}

function hasProbableName(input: string, text: string, hasStrongDomain: boolean) {
  if (hasStrongDomain || hasAny(text, temporalWords)) return false;
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length === 1) return /^[a-z][a-z.'-]{2,}$/i.test(tokens[0]);
  if (tokens.length !== 2) return false;
  const originalTokens = input.trim().split(/\s+/);
  const capitalized = originalTokens.every((token) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}.'-]+$/u.test(token));
  const commandWords = new Set(["qualquer", "texto", "abrir", "buscar", "mostrar", "consultar", "quero", "preciso"]);
  return capitalized && !tokens.some((token) => commandWords.has(token));
}

function extractLikelyName(text: string, allowed: boolean) {
  if (!allowed) return null;
  const explicit = text.match(/\b(?:buscar|procurar|abrir|agendar|marcar|remarcar|colocar)\s+(?:o |a )?(?:paciente\s+)?([a-z][a-z.'\-]*(?:\s+[a-z][a-z.'\-]*){0,3})$|\b(?:paciente chamado|paciente|cadastro|telefone|cpf|email|e mail)\s+(?:do|da|de)?\s*([a-z][a-z.'\-]*(?:\s+[a-z][a-z.'\-]*){0,3})$/);
  if (explicit) return (explicit[1] ?? explicit[2]).trim();
  if (/^[a-z][a-z.'\-]*(?:\s+[a-z][a-z.'\-]*)?$/.test(text)) return text;
  const contextual = text.match(/\b(?:do|da|de|o|a|para)\s+([a-z][a-z.'\-]*(?:\s+[a-z][a-z.'\-]*){0,3})(?=\s+(?:esta|tem|precisa|com|hoje|amanha|deve|pagou|quitou|costuma|normalmente)|$)/);
  return contextual?.[1]?.trim() ?? null;
}

function navigationDomain(text: string): AssistantDomain | null {
  if (!/^(?:abrir|abra|ir para|ver|mostrar)\b/.test(text) || text.split(" ").length > 3 || hasAny(text, temporalWords)) return null;
  if (hasAny(text, agendaDomainWords)) return "agenda";
  if (hasAny(text, ["financeiro", "pagamentos"])) return "financeiro";
  if (hasAny(text, ["pacotes"])) return "pacotes";
  if (hasAny(text, ["prontuario", "prontuarios"])) return "prontuarios";
  if (hasAny(text, ["relatorio", "relatorios"])) return "relatorios";
  if (hasAny(text, ["servico", "servicos"])) return "servicos";
  if (hasAny(text, ["profissional", "profissionais", "funcionario", "funcionarios"])) return "profissionais";
  if (hasAny(text, ["paciente", "pacientes"])) return "pacientes";
  return null;
}

export function interpretAssistantQuery(input: string, context: AssistantContext = {}, now = new Date()): AssistantInterpretation {
  const text = normalizeAssistantText(input);
  const dateInfo = extractDate(text, now);
  const navigation = navigationDomain(text);
  const agendaVocabulary = hasAny(text, agendaDomainWords) || /^(?:ver|mostrar)\s+(?:a )?(?:semana|mes)\b/.test(text);
  const financialVocabulary = hasAny(text, financialWords) || hasAny(text, debtListWords) || /\bem dia\b|quem nao pagou|quem (?:esta )?(?:devendo|deve)|valores? em aberto|contas? (?:em aberto|atrasadas?|vencidas?)/.test(text);
  const packageVocabulary = hasAny(text, ["pacote", "pacotes"]) || /sessoes? (?:do|da|de)|sessoes? restantes|quantas sessoes/.test(text);
  const recordsVocabulary = hasAny(text, ["prontuario", "prontuarios", "evolucao", "evolucoes"]);
  const reportsVocabulary = hasAny(text, ["relatorio", "relatorios", "faturamento"]);
  const servicesVocabulary = hasAny(text, ["servico", "servicos", "fisioterapia", "pilates"]);
  const professionalVocabulary = hasAny(text, ["profissional", "profissionais", "funcionario", "funcionarios"]);
  const hasStrongDomain = Boolean(navigation || agendaVocabulary || financialVocabulary || packageVocabulary || recordsVocabulary || reportsVocabulary || servicesVocabulary || professionalVocabulary);
  const targetsModule = /^(?:pode\s+)?(?:abrir|abra|ver|mostrar)\s+(?:o |a )?(?:agenda|financeiro|pacotes?|prontuarios?|relatorios?|servicos?|profissionais?)(?:\s|$)/.test(text);
  const explicitPatient = hasExplicitPatientEvidence(text) && !targetsModule;
  const probableName = hasProbableName(input, text, hasStrongDomain);
  const identifier = hasIdentifierEvidence(input);
  const scheduleEntity = text.match(/\b(?:o|a)\s+([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,}){0,3})(?=\s+(?:esta|tem|precisa|deve|pagou|quitou|costuma|normalmente))|\bpara\s+(?:o |a )?([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,}){0,3})$|\b(?:agendar|marcar|remarcar|colocar)\s+(?:o |a )?([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,}){0,3})/);
  const schedulePatientName = scheduleEntity && !targetsModule
    ? (scheduleEntity[1] ?? scheduleEntity[2] ?? scheduleEntity[3])?.trim().replace(/^(?:o|a)\s+/, "").replace(/\s+(?:esta|tem|precisa|deve)$/, "")
    : null;
  const guidedScheduling = context.pendingIntent === "schedule_patient" && Boolean(context.patientName);
  let patientSearchAllowed = explicitPatient || probableName || identifier || Boolean(schedulePatientName) || guidedScheduling;

  const individualFinancial = financialVocabulary && !/^(?:pacientes?|alguem|quem|tem alguem|nao)\b/.test(text) && /(?:o |a )?[a-z]{3,}.*(?:devendo|deve|pendencia|debito)|(?:financeiro|pendencia|saldo|pagamento) (?:do|da|de) [a-z]{3,}|quanto (?:o|a) [a-z]{3,}.* deve/.test(text);
  if (individualFinancial) patientSearchAllowed = true;
  const debtList = financialVocabulary && !individualFinancial && (hasAny(text, debtListWords) || /quem nao pagou|quem (?:esta )?(?:devendo|deve)|tem alguem devendo|pagamentos? (?:vencidos?|atrasados?|pendentes?)|valores? em aberto|contas? (?:em aberto|atrasadas?|vencidas?)|financeiro pendente|pendencias? financeiras?|nao tem debitos/.test(text));

  const contextualPerson = Boolean(context.patientName && !debtList && (financialVocabulary || agendaVocabulary || packageVocabulary || recordsVocabulary || guidedScheduling));
  if (contextualPerson) patientSearchAllowed = true;
  const extractedName = extractLikelyName(text, patientSearchAllowed);
  let patientName = debtList
    ? null
    : guidedScheduling
      ? context.patientName ?? null
      : schedulePatientName ?? (explicitPatient || probableName || identifier ? extractedName : null) ?? (individualFinancial || contextualPerson ? context.patientName ?? null : null);
  const timeMatch = text.match(/\b([01]?\d|2[0-3])(?::|h)([0-5]\d)?\b/);
  const dayPeriod = /\bmanha\b/.test(text) ? "morning" : /\btarde\b/.test(text) ? "afternoon" : /\bnoite\b/.test(text) ? "evening" : null;
  const asksLastPayment = /ultimo.*(pagamento|pix)|pagou.*ultima|ultima.*(sessao paga|pagamento)/.test(text);
  const asksSessionPayment = /(sessao|atendimento).*(pago|paga|quitad)|ultimo atendimento/.test(text);
  const asksPatientHistory = /(quando|qual).*(ultima|ultimo).*(sessao|consulta|atendimento)|(ultima|ultimo).*(sessao|consulta|atendimento)/.test(text);
  const scheduling = hasAny(text, schedulingWords) || /\bcostuma\b|\bnormalmente\b/.test(text);
  const availability = hasAny(text, availabilityWords);
  const weeklyNoun = /^(?:ver|mostrar)\s+(?:a )?semana\b|\b(?:agenda|agendamentos?|atendimentos?|consultas?|compromissos?)\b/.test(text) || (!/\bagendar\b/.test(text) && hasAny(text, ["agendamento"], 0.82));
  const weeklyListing = ["current_week", "next_week"].includes(dateInfo.temporalScope ?? "") && weeklyNoun;
  const listAgenda = agendaVocabulary && !financialVocabulary && !packageVocabulary && !asksPatientHistory && (weeklyListing || (!availability && !scheduling && Boolean(dateInfo.temporalScope || /agenda|agendamento|atendimento|consulta|compromisso/.test(text))));

  let intent: AssistantIntent = "unknown";
  let domain: AssistantDomain = "unknown";
  let action: AssistantRouteAction = "unknown";

  if (navigation) {
    domain = navigation;
    action = "open";
  } else if (/pacotes?.*venc|sem retorno/.test(text)) {
    intent = "check_alerts";
    domain = packageVocabulary ? "pacotes" : "pacientes";
    action = "list";
  } else if (debtList) {
    intent = "check_debtors";
    domain = "financeiro";
    action = "list_pending";
    patientSearchAllowed = false;
  } else if (asksLastPayment) {
    intent = "check_last_payment";
    domain = "financeiro";
    action = "summarize";
  } else if (asksSessionPayment) {
    intent = "check_session_payment";
    domain = "financeiro";
    action = "summarize";
  } else if (asksPatientHistory) {
    intent = "patient_summary";
    domain = "pacientes";
    action = "summarize";
  } else if (packageVocabulary) {
    intent = "patient_summary";
    domain = "pacotes";
    action = "summarize";
  } else if (recordsVocabulary) {
    intent = patientSearchAllowed ? "patient_summary" : "unknown";
    domain = "prontuarios";
    action = patientSearchAllowed ? "summarize" : "open";
  } else if (reportsVocabulary) {
    domain = "relatorios";
    action = "open";
  } else if (servicesVocabulary && !agendaVocabulary) {
    intent = "search";
    domain = "servicos";
    action = "search";
  } else if (professionalVocabulary && !agendaVocabulary) {
    intent = "search";
    domain = "profissionais";
    action = "search";
  } else if (financialVocabulary) {
    intent = "check_patient_financial_status";
    domain = "financeiro";
    action = "summarize";
  } else if (listAgenda) {
    intent = "list_appointments";
    domain = "agenda";
    action = "list";
    patientSearchAllowed = false;
    patientName = null;
  } else if ((scheduling || (timeMatch && context.date)) && (patientSearchAllowed || context.patientName || /\bpaciente\b/.test(text))) {
    intent = "schedule_patient";
    domain = "agenda";
    action = "schedule";
    patientName = extractedName ?? context.patientName ?? null;
  } else if (agendaVocabulary || availability || scheduling) {
    intent = availability || !patientSearchAllowed ? "check_availability" : "schedule_patient";
    domain = "agenda";
    action = intent === "check_availability" ? "check_availability" : "schedule";
  } else if (patientSearchAllowed) {
    intent = "search";
    domain = "pacientes";
    action = "search";
  }

  if (context.pendingIntent && patientSearchAllowed && patientName) {
    intent = context.pendingIntent;
    if (["check_patient_financial_status", "check_last_payment", "check_session_payment"].includes(intent)) domain = "financeiro";
    if (intent === "schedule_patient") domain = "agenda";
  }
  patientName = patientName?.replace(/^(?:o|a)\s+/, "") ?? null;

  return {
    intent,
    domain,
    action,
    temporalScope: dateInfo.temporalScope,
    patientSearchAllowed,
    normalizedText: text,
    patientName,
    pendingIntent: null,
    professionalName: context.professionalName ?? null,
    serviceName: context.serviceName ?? null,
    date: dateInfo.date ?? context.date ?? null,
    dateRangeEnd: dateInfo.dateRangeEnd ?? (dateInfo.date ? null : context.dateRangeEnd) ?? null,
    period: dayPeriod ?? context.period ?? null,
    time: timeMatch ? timeMatch[1].padStart(2, "0") + ":" + (timeMatch[2] ?? "00") : context.time ?? null,
    updatedAt: Date.now()
  };
}
