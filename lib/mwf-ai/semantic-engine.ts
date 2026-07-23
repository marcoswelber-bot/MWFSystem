import { fuzzyScore, normalizeMessage } from "./core/normalize-message.ts";

export type OperationalDomain =
  | "agenda"
  | "pacientes"
  | "financeiro"
  | "pacotes"
  | "prontuarios"
  | "funcionarios"
  | "profissionais"
  | "relatorios"
  | "servicos"
  | "comissoes"
  | "notificacoes"
  | "unknown";

export type OperationalIntent =
  | "list"
  | "search"
  | "summary"
  | "availability"
  | "debtors"
  | "revenue"
  | "expenses"
  | "patient_packages"
  | "patient_history"
  | "prepare_appointment"
  | "prepare_cancellation"
  | "prepare_charge"
  | "confirm"
  | "cancel"
  | "unknown";

export type OperationalInterpretation = {
  intent: OperationalIntent;
  confidence: number;
  module: OperationalDomain;
  entities: {
    patient?: string;
    professional?: string;
    service?: string;
    employee?: string;
  };
  filters: { initial?: string; status?: string; period?: string };
  date: string | null;
  dateEnd: string | null;
  time: string | null;
  status: string | null;
  requestedAction: string | null;
  requiresConfirmation: boolean;
  tool: string;
  normalizedText: string;
};

type SemanticCapability = {
  domain: Exclude<OperationalDomain, "unknown">;
  concepts: string[];
};

export const semanticCatalog: SemanticCapability[] = [
  { domain: "agenda", concepts: ["agenda", "agendamento", "atendimento", "consulta", "horario", "vaga", "sessao", "marcar", "remarcar", "cancelar"] },
  { domain: "pacientes", concepts: ["paciente", "cliente", "aluno", "cadastro"] },
  { domain: "financeiro", concepts: ["financeiro", "debito", "divida", "devedor", "inadimplente", "receita", "despesa", "pagamento", "cobranca", "conta"] },
  { domain: "pacotes", concepts: ["pacote", "plano", "credito", "sessoes restantes", "validade"] },
  { domain: "prontuarios", concepts: ["prontuario", "evolucao", "registro clinico", "historico clinico"] },
  { domain: "funcionarios", concepts: ["funcionario", "colaborador", "equipe"] },
  { domain: "profissionais", concepts: ["profissional", "fisioterapeuta", "terapeuta", "instrutor"] },
  { domain: "relatorios", concepts: ["relatorio", "indicador", "resumo gerencial"] },
  { domain: "servicos", concepts: ["servico", "procedimento", "modalidade"] },
  { domain: "comissoes", concepts: ["comissao", "repasse", "contracheque"] },
  { domain: "notificacoes", concepts: ["notificacao", "aviso", "alerta", "lembrete"] }
];

const synonyms: Record<string, string> = {
  paci: "paciente",
  pacte: "paciente",
  cli: "paciente",
  agend: "agenda",
  ag: "agenda",
  hor: "horario",
  prof: "profissional",
  func: "funcionario",
  fin: "financeiro",
  cobr: "cobranca",
  dev: "devedor",
  pront: "prontuario",
  pct: "pacote",
  notif: "notificacao"
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function localDate(now: Date, days = 0) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return iso(date);
}

function parseDates(text: string, now: Date) {
  if (/\bhoje\b/.test(text)) return { date: localDate(now), dateEnd: null };
  if (/\bamanha\b/.test(text)) return { date: localDate(now, 1), dateEnd: null };
  if (/\bontem\b/.test(text)) return { date: localDate(now, -1), dateEnd: null };
  if (/proxima semana|semana que vem/.test(text)) return { date: localDate(now, 7), dateEnd: localDate(now, 13) };
  if (/\besta semana\b|\bsemana atual\b/.test(text)) return { date: localDate(now), dateEnd: localDate(now, 6) };
  const explicit = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!explicit) return { date: null, dateEnd: null };
  const year = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : now.getFullYear();
  return { date: iso(new Date(year, Number(explicit[2]) - 1, Number(explicit[1]))), dateEnd: null };
}

function expandTokens(text: string) {
  return text.split(" ").map((token) => synonyms[token] ?? token);
}

function domainScore(text: string, capability: SemanticCapability, currentDomain?: OperationalDomain | null) {
  const tokens = expandTokens(text);
  let best = 0;
  for (const concept of capability.concepts) {
    const normalizedConcept = normalizeMessage(concept).text;
    if (text === normalizedConcept) best = Math.max(best, 1);
    else if (text.startsWith(normalizedConcept) || normalizedConcept.startsWith(text)) best = Math.max(best, 0.94);
    else if (text.includes(normalizedConcept) || normalizedConcept.includes(text)) best = Math.max(best, 0.89);
    for (const token of tokens) {
      if (token === normalizedConcept) best = Math.max(best, 0.98);
      else if (normalizedConcept.startsWith(token) && token.length >= 3) best = Math.max(best, 0.9);
      else best = Math.max(best, fuzzyScore(token, normalizedConcept));
    }
  }
  if (currentDomain === capability.domain) best += 0.07;
  return Math.min(best, 1);
}

function extractNamedEntity(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:${label})\\s+(?:chamad[oa]\\s+|de\\s+|do\\s+|da\\s+)?([a-z][a-z\\s]{1,60}?)(?=\\s+(?:hoje|amanha|dia|as|às|com|no|na|para|por|que|do|da)\\b|$)`));
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function interpretOperationalMessage(
  input: string,
  context: { currentDomain?: OperationalDomain | null; patientName?: string | null; professionalName?: string | null; serviceName?: string | null } = {},
  now = new Date()
): OperationalInterpretation {
  const normalized = normalizeMessage(input);
  const text = normalized.text;
  const dates = parseDates(text, now);
  const timeMatch = text.match(/\b(?:as\s+)?([01]?\d|2[0-3])(?::|h)([0-5]\d)?\b/);
  const ranking = semanticCatalog
    .map((capability) => ({ domain: capability.domain, score: domainScore(text, capability, context.currentDomain) }))
    .sort((left, right) => right.score - left.score);

  let domain: OperationalDomain = ranking[0]?.score >= 0.58 ? ranking[0].domain : context.currentDomain ?? "unknown";
  let confidence = ranking[0]?.score ?? 0;
  let intent: OperationalIntent = domain === "unknown" ? "unknown" : "list";
  let tool = domain === "unknown" ? "clarify" : `list_${domain}`;
  let requestedAction: string | null = null;
  let requiresConfirmation = false;

  if (normalized.isAffirmative) return { intent: "confirm", confidence: 1, module: domain, entities: {}, filters: {}, date: dates.date, dateEnd: dates.dateEnd, time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}` : null, status: null, requestedAction: "confirm", requiresConfirmation: false, tool: "confirm_pending", normalizedText: text };
  if (normalized.isNegative) return { intent: "cancel", confidence: 1, module: domain, entities: {}, filters: {}, date: dates.date, dateEnd: dates.dateEnd, time: null, status: null, requestedAction: "cancel", requiresConfirmation: false, tool: "cancel_pending", normalizedText: text };

  if (/deved|devendo|inadimpl|debito|divida|em aberto|vencid/.test(text)) {
    domain = "financeiro"; intent = "debtors"; tool = "list_debtors"; confidence = 0.98;
  } else if (/\breceitas?\b|faturamento|entradas?/.test(text)) {
    domain = "financeiro"; intent = "revenue"; tool = "financial_summary"; confidence = 0.96;
  } else if (/\bdespesas?\b|gastos?|saidas?/.test(text)) {
    domain = "financeiro"; intent = "expenses"; tool = "financial_summary"; confidence = 0.96;
  } else if (/horarios? (?:livres?|vagos?)|disponibilidade|tem vaga/.test(text)) {
    domain = "agenda"; intent = "availability"; tool = "check_availability"; confidence = 0.97;
  } else if (/\b(?:agendar|marcar|novo agendamento)\b/.test(text)) {
    domain = "agenda"; intent = "prepare_appointment"; tool = "prepare_appointment"; confidence = 0.97; requestedAction = "create"; requiresConfirmation = true;
  } else if (/\b(?:cancelar|desmarcar)\b/.test(text) && /agenda|agendamento|atendimento|consulta/.test(text)) {
    domain = "agenda"; intent = "prepare_cancellation"; tool = "prepare_cancellation"; confidence = 0.98; requestedAction = "cancel"; requiresConfirmation = true;
  } else if (/cobrar|cobranca|mensagem.*pagamento/.test(text)) {
    domain = "financeiro"; intent = "prepare_charge"; tool = "prepare_charge"; confidence = 0.96; requestedAction = "send_charge"; requiresConfirmation = true;
  } else if (/pacote|sessoes? (?:restantes?|contratadas?|realizadas?)|validade/.test(text)) {
    domain = "pacotes"; intent = "patient_packages"; tool = "get_patient_packages"; confidence = 0.96;
  } else if (/historico|ultimo atendimento|proximo agendamento|cadastro/.test(text) && /paciente|cliente|aluno/.test(text)) {
    domain = "pacientes"; intent = "patient_history"; tool = "get_patient_summary"; confidence = 0.93;
  } else if (/buscar|procurar|localizar|quem e|cadastro de/.test(text)) {
    intent = "search"; tool = `search_${domain}`; confidence = Math.max(confidence, 0.82);
  }

  const initial = text.match(/(?:comeca|inicia|letra)\s+(?:com\s+)?([a-z])\b/);
  const status = /\binativ/.test(text) ? "inactive" : /\bativ/.test(text) ? "active" : /\bpendente/.test(text) ? "pending" : null;
  const relatedPatient = ["financeiro", "pacotes", "prontuarios", "agenda", "pacientes"].includes(domain)
    ? text.match(/(?:pacote|debito|divida|cobranca|agenda|agendamento|prontuario|historico|cadastro)\s+(?:do|da|de)\s+([a-z][a-z\s]{1,50}?)(?=\s+(?:hoje|amanha|dia|as|às|com|no|na|para|por)\b|$)/)?.[1]?.trim()
    : undefined;
  const entities = {
    patient: extractNamedEntity(text, ["paciente", "cliente", "aluno"]) ?? relatedPatient ?? context.patientName ?? undefined,
    professional: extractNamedEntity(text, ["profissional", "fisioterapeuta", "instrutor"]) ?? context.professionalName ?? undefined,
    service: extractNamedEntity(text, ["servico", "procedimento"]) ?? context.serviceName ?? undefined,
    employee: extractNamedEntity(text, ["funcionario", "colaborador"])
  };

  return {
    intent,
    confidence,
    module: domain,
    entities,
    filters: { initial: initial?.[1], status: status ?? undefined },
    date: dates.date,
    dateEnd: dates.dateEnd,
    time: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}` : null,
    status,
    requestedAction,
    requiresConfirmation,
    tool,
    normalizedText: text
  };
}

export function validateInterpretation(value: OperationalInterpretation) {
  return Boolean(
    value &&
      typeof value.intent === "string" &&
      typeof value.confidence === "number" &&
      value.confidence >= 0 &&
      value.confidence <= 1 &&
      typeof value.module === "string" &&
      typeof value.tool === "string" &&
      typeof value.normalizedText === "string"
  );
}

export function rankEntityMatches<T extends { id: string; name: string }>(term: string, rows: T[]) {
  const normalizedTerm = normalizeMessage(term).text;
  return rows
    .map((row) => {
      const name = normalizeMessage(row.name).text;
      const tokens = name.split(" ");
      let score = name === normalizedTerm ? 1 : name.startsWith(normalizedTerm) ? 0.96 : name.includes(normalizedTerm) ? 0.9 : 0;
      score = Math.max(score, ...tokens.map((token) => token.startsWith(normalizedTerm) ? 0.93 : fuzzyScore(normalizedTerm, token)));
      return { ...row, score };
    })
    .filter((row) => row.score >= 0.62)
    .sort((left, right) => right.score - left.score);
}
