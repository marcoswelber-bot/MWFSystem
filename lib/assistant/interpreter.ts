export type AssistantIntent = "check_availability" | "schedule_patient" | "check_patient_financial_status" | "check_debtors" | "check_last_payment" | "check_session_payment" | "check_alerts" | "patient_summary" | "search" | "unknown";

export type AssistantContext = {
  pendingIntent?: AssistantIntent | null;
  patientName?: string | null;
  professionalName?: string | null;
  serviceName?: string | null;
  date?: string | null;
  dateRangeEnd?: string | null;
  period?: "morning" | "afternoon" | "evening" | null;
  time?: string | null;
  updatedAt?: number;
};

export type AssistantInterpretation = AssistantContext & { intent: AssistantIntent; normalizedText: string };

const availabilityWords = ["horario", "vaga", "livre", "disponivel", "disponibilidade", "encaixe", "agenda", "aberto", "espaco", "desocupado", "sobrou", "sobrando"];
const schedulingWords = ["agendar", "marcar", "encaixar", "reservar", "colocar", "retorno", "retornar", "voltar", "remarcar", "consulta", "sessao", "atendimento"];
const financialWords = ["devendo", "deve", "divida", "debito", "pendencia", "pendente", "aberto", "atrasado", "pagamento", "pagou", "quitado", "quitou", "saldo", "cobranca", "parcela", "financeiro", "em dia"];
const debtListWords = ["debitos", "debito", "devedor", "devedores", "devendo", "dividas", "divida", "pendencias", "pendencia", "atrasados", "inadimplentes", "inadimplencia", "devdor", "debto", "decedo", "decendo", "pendecia", "atrazados", "divda"];

export function normalizeAssistantText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9:\s]/g, " ").replace(/\s+/g, " ").trim();
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

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.split(" ").some((token) => token === word || similarity(token, word) >= 0.78));
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }

function extractDate(text: string, now: Date) {
  if (/\bhoje\b/.test(text)) return { date: isoDate(now), dateRangeEnd: null };
  if (/\bamanha\b/.test(text)) return { date: isoDate(addDays(now, 1)), dateRangeEnd: null };
  if (/\besta semana\b|\bna semana\b/.test(text)) return { date: isoDate(now), dateRangeEnd: isoDate(addDays(now, 6)) };
  const explicit = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (explicit) {
    const yearText = explicit[3];
    const year = yearText ? Number(yearText.length === 2 ? "20" + yearText : yearText) : now.getFullYear();
    return { date: isoDate(new Date(year, Number(explicit[2]) - 1, Number(explicit[1]))), dateRangeEnd: null };
  }
  const weekdays: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  for (const [name, weekday] of Object.entries(weekdays)) {
    if (text.includes(name)) {
      let distance = (weekday - now.getDay() + 7) % 7;
      if (distance === 0 && !text.includes("hoje")) distance = 7;
      return { date: isoDate(addDays(now, distance)), dateRangeEnd: null };
    }
  }
  return { date: null, dateRangeEnd: null };
}

function extractLikelyName(text: string) {
  const ignored = new Set([...availabilityWords, ...schedulingWords, ...financialWords, "paciente", "fisioterapia", "hoje", "amanha", "me", "mostra", "mostrar", "quais", "qual", "quando", "tem", "onde", "ultimo", "ultima", "foi", "ele", "ela", "dele", "dela", "tudo", "pode", "abrir", "o", "a"]);
  const patterns = [
    /\b(?:paciente|para|do|da|de|o|a)\s+([a-z][a-z\s]{1,45}?)(?=\s+(?:esta|tem|precisa|com|para|hoje|amanha|terca|quarta|quinta|sexta|sabado|domingo|no|na|as|deve|pagou|quitou|financeiro|costuma|normalmente)|$)/,
    /^(?:buscar|abrir|agendar|marcar|remarcar)?\s*([a-z][a-z\s]{1,45})$/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const candidate = match[1].split(" ").filter((word) => !ignored.has(word)).join(" ").trim().replace(/^(o|a)\s+/, "");
    if (candidate.length >= 3) return candidate;
  }
  return null;
}

export function interpretAssistantQuery(input: string, context: AssistantContext = {}, now = new Date()): AssistantInterpretation {
  const text = normalizeAssistantText(input);
  const dateInfo = extractDate(text, now);
  const extractedName = extractLikelyName(text);
  const individualFinancial = !/^(?:pacientes?|alguem|quem|tem alguem|nao)\b/.test(text) && /^(?:o |a )?[a-z]{3,}(?: [a-z]{3,}){0,4} (?:esta )?(?:devendo|deve|tem pendencia|tem debito)|(?:financeiro|pendencia|saldo|pagamento) (?:do|da|de) [a-z]{3,}|quanto (?:o|a) [a-z]{3,}(?: [a-z]{3,}){0,4} deve/.test(text);
  const debtList = !individualFinancial && (hasAny(text, debtListWords) || /quem (?:esta )?(?:devendo|deve)|tem alguem devendo|pagamentos? (?:vencidos?|atrasados?|pendentes?)|valores? em aberto|contas? (?:em aberto|atrasadas?|vencidas?)|financeiro pendente|nao tem debitos/.test(text));
  const patientName = debtList ? null : context.pendingIntent === "schedule_patient" && context.patientName ? context.patientName : extractedName ?? context.patientName ?? null;
  const timeMatch = text.match(/\b([01]?\d|2[0-3])(?::|h)([0-5]\d)?\b/);
  const period = /\bmanha\b/.test(text) ? "morning" : /\btarde\b/.test(text) ? "afternoon" : /\bnoite\b/.test(text) ? "evening" : null;
  const asksLastPayment = /ultimo.*(pagamento|pix)|pagou.*ultima|ultima.*(sessao paga|pagamento)/.test(text);
  const asksSessionPayment = /(sessao|atendimento).*(pago|paga|quitad)|ultimo atendimento/.test(text);
  const financial = hasAny(text, financialWords) || /\bem dia\b/.test(text);
  const scheduling = hasAny(text, schedulingWords) || /\bcostuma\b|\bnormalmente\b/.test(text);
  const availability = hasAny(text, availabilityWords);
  let intent: AssistantIntent = "unknown";
  if (/pacotes?.*venc|sem retorno/.test(text)) intent = "check_alerts";
  else if (debtList) intent = "check_debtors";
  else if (asksLastPayment) intent = "check_last_payment";
  else if (asksSessionPayment) intent = "check_session_payment";
  else if (/pacote (?:do|da|de)|sessoes? (?:do|da|de)|quantas sessoes|sessoes restantes/.test(text)) intent = "patient_summary";
  else if (/(quando|qual).*(ultima|ultimo).*(sessao|consulta|atendimento)|(ultima|ultimo).*(sessao|consulta|atendimento)/.test(text)) intent = "patient_summary";
  else if (financial) intent = "check_patient_financial_status";
  else if ((scheduling || (timeMatch && context.date)) && (patientName || /\bpaciente\b/.test(text))) intent = "schedule_patient";
  else if (availability || scheduling) intent = "check_availability";
  else if (/\b(resumo|ver|abrir|buscar|paciente)\b/.test(text) || text.split(" ").length <= 3) intent = "search";

  if (context.pendingIntent && (patientName || intent === "search")) intent = context.pendingIntent;

  return {
    intent, normalizedText: text, patientName, pendingIntent: null,
    professionalName: context.professionalName ?? null,
    serviceName: context.serviceName ?? null,
    date: dateInfo.date ?? context.date ?? null,
    dateRangeEnd: dateInfo.dateRangeEnd ?? (dateInfo.date ? null : context.dateRangeEnd) ?? null,
    period: period ?? context.period ?? null,
    time: timeMatch ? timeMatch[1].padStart(2, "0") + ":" + (timeMatch[2] ?? "00") : context.time ?? null,
    updatedAt: Date.now()
  };
}
