import { capabilityRegistry } from "./capability-registry.ts";
import { resolvePending } from "./context-manager.ts";
import { fuzzyScore, normalizeMessage } from "./normalize-message.ts";
import type { MwfAiContext, MwfAiDomain, MwfAiEntity, MwfAiFilter, MwfAiInterpretation, MwfAiOption, MwfAiTemporalScope } from "./types.ts";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };

function timeInfo(text: string, now: Date): { date: string | null; scope: MwfAiTemporalScope } {
  if (/\bhoje\b/.test(text)) return { date: iso(now), scope: "today" };
  if (/\bamanha\b/.test(text)) return { date: iso(addDays(now, 1)), scope: "tomorrow" };
  if (/\bontem\b/.test(text)) return { date: iso(addDays(now, -1)), scope: "yesterday" };
  if (/proxim[oa].*semana|semana que vem/.test(text)) return { date: iso(addDays(now, 7)), scope: "next_week" };
  if (/\bsemana\b/.test(text)) return { date: iso(now), scope: "current_week" };
  if (/\bproxim[oa]s?\b/.test(text)) return { date: iso(now), scope: "next" };
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (match) { const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : now.getFullYear(); return { date: iso(new Date(year, Number(match[2]) - 1, Number(match[1]))), scope: "explicit_date" }; }
  return { date: null, scope: null };
}

function domainRanking(text: string, current?: MwfAiDomain | null) {
  return capabilityRegistry.map(capability => {
    const scores = capability.concepts.map(concept => fuzzyScore(text, concept));
    const tokenScores = text.split(" ").flatMap(token => capability.concepts.map(concept => fuzzyScore(token, concept)));
    let score = Math.max(...scores, ...tokenScores);
    if (current === capability.domain) score += .08;
    return { capability, score: Math.min(score, 1) };
  }).sort((a, b) => b.score - a.score);
}

function optionsForPrefix(text: string): MwfAiOption[] {
  if (!text || text.length > 4 || text.includes(" ")) return [];
  return capabilityRegistry.filter(capability => normalizeMessage(capability.label).text.startsWith(text)).map(capability => ({ actionId: `domain:${capability.domain}`, domain: capability.domain, intent: "select_domain", label: capability.label }));
}

export function classifyMessage(input: string, context: MwfAiContext = {}, now = new Date()): MwfAiInterpretation {
  const message = normalizeMessage(input);
  const temporal = timeInfo(message.text, now);
  const base = { ...context, normalizedText: message.text, entities: [] as MwfAiEntity[], filters: [] as MwfAiFilter[], temporalScope: temporal.scope, date: temporal.date ?? context.date ?? null, updatedAt: Date.now(), patientSearchAllowed: false };
  const pending = resolvePending(message, context);
  if (pending) return { ...base, intent: "unknown", domain: "unknown", action: "unknown", confidence: 1, requiresClarification: false, ...pending };
  if (message.isAffirmative || message.isNegative) return { ...base, intent: message.isNegative ? "cancel" : "unknown", domain: context.currentDomain ?? "unknown", action: "unknown", confidence: 1, requiresClarification: true };

  const prefixOptions = optionsForPrefix(message.text);
  if (prefixOptions.length > 1) return { ...base, intent: "discover", domain: "unknown", action: "search", confidence: .7, requiresClarification: true, pendingOptions: prefixOptions };
  const ranking = domainRanking(message.text, context.currentDomain);
  let domain: MwfAiDomain = ranking[0]?.score >= .62 ? ranking[0].capability.domain : "unknown";
  let confidence = ranking[0]?.score ?? 0;
  let intent: MwfAiInterpretation["intent"] = domain === "unknown" ? "discover" : "search";
  let action: MwfAiInterpretation["action"] = "search";
  const filters: MwfAiFilter[] = [];
  const entities: MwfAiEntity[] = [];

  if (/\b(devendo|devedor|devedores|debitos?|dividas?|inadimpl|valores? em aberto|pagamentos? (?:pendentes?|vencidos?))\b/.test(message.text)) { domain = "financeiro"; intent = "check_debtors"; action = "list_pending"; confidence = .96; filters.push({ field: "open_amount", operator: "open" }); }
  if (/pacientes?.*(?:proxim[oa].*)?(?:agendamento|atendimento|consulta)|proxim[oa].*(?:agendamento|atendimento).*pacientes?/.test(message.text)) { domain = "agenda"; intent = "list_appointments"; action = "list"; confidence = .95; filters.push({ field: "position", operator: "next" }); }
  const initial = message.text.match(/(?:comeca|inicia|com)\s+(?:a letra\s+)?([a-z])\b$/);
  if (initial && (domain === "pacientes" || context.currentDomain === "pacientes" || /paciente/.test(message.text))) { domain = "pacientes"; intent = "search"; action = "search"; confidence = .94; filters.push({ field: "full_name", operator: "starts_with", value: initial[1] }); }
  if (message.isEmail) entities.push({ type: "email", value: input.trim() });
  else if (message.digits.length === 11) entities.push({ type: "cpf", value: message.digits });
  else if (/^\d+$/.test(message.text)) entities.push({ type: "number", value: message.text });
  const patientSearchAllowed = domain === "pacientes" && (entities.length > 0 || filters.length > 0 || message.text.length > 1);
  const requiresClarification = domain === "unknown" || (confidence < .7 && (ranking[1]?.score ?? 0) > confidence - .08);
  return { ...base, intent, domain, currentDomain: domain === "unknown" ? context.currentDomain : domain, action, entities, filters, confidence, requiresClarification, patientSearchAllowed };
}
