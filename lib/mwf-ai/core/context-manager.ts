import { fuzzyScore, type NormalizedMessage } from "./normalize-message.ts";
import type { MwfAiContext, MwfAiInterpretation, MwfAiOption } from "./types.ts";

export function activeContext(context: MwfAiContext, now = Date.now()) { return context.updatedAt && now - context.updatedAt < 30 * 60_000 ? context : {}; }

function optionMatch(message: NormalizedMessage, options: MwfAiOption[]) {
  const numeric = Number(message.text);
  if (Number.isInteger(numeric) && numeric > 0 && options[numeric - 1]) return { option: options[numeric - 1], score: 1 };
  return options.map(option => ({ option, score: fuzzyScore(message.text, option.label) })).sort((a, b) => b.score - a.score)[0];
}

export function resolvePending(message: NormalizedMessage, context: MwfAiContext): Partial<MwfAiInterpretation> | null {
  if (context.pendingOperation) {
    if (message.isAffirmative) return { intent: "confirm", domain: context.pendingOperation.domain, action: context.pendingOperation.intent === "schedule_patient" ? "schedule" : "open", confidence: 1, requiresClarification: false, resolution: { kind: "confirmed", actionId: context.pendingOperation.actionId } };
    if (message.isNegative) return { intent: "cancel", domain: context.pendingOperation.domain, action: "unknown", confidence: 1, requiresClarification: false, resolution: { kind: "cancelled", actionId: context.pendingOperation.actionId }, pendingOperation: null };
  }
  if (context.pendingOptions?.length) {
    const match = optionMatch(message, context.pendingOptions);
    if (match && (match.score >= .67 || context.pendingOptions.some(option => option === match.option && message.text === option.label.toLowerCase()))) return { intent: match.option.intent, domain: match.option.domain, action: "open", confidence: match.score, requiresClarification: false, resolution: { kind: "selected", actionId: match.option.actionId }, pendingOptions: [] };
  }
  if (/^\d+$/.test(message.text) && context.recentResults?.length) {
    const found = context.recentResults.find(result => result.ordinal === Number(message.text) || result.numericTokens?.includes(message.text));
    if (found) return { intent: "search", domain: found.domain, action: "summarize", confidence: .95, requiresClarification: true, resolution: { kind: "result", result: found }, patientId: found.domain === "pacientes" ? found.id : context.patientId, patientName: found.domain === "pacientes" ? found.label : context.patientName };
  }
  return null;
}
