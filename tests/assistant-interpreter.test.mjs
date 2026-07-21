import test from "node:test";
import assert from "node:assert/strict";
import { interpretAssistantQuery, normalizeAssistantText, similarity } from "../lib/assistant/interpreter.ts";

const now = new Date("2026-07-21T12:00:00-03:00");
const cases = {
  check_availability: [
    "Quais horários estão livres hoje?", "Tem vaga amanhã?", "Quais os horários disponíveis nesta semana?",
    "Tem algum encaixe para hoje?", "Onde tem horário livre?", "Me mostra a agenda disponível.",
    "Tem horário com a Giovana?", "Quais horários para fisioterapia?"
  ],
  schedule_patient: [
    "Preciso marcar o Marcos.", "Quero agendar um retorno para o Marcos.", "O Marcos precisa voltar.",
    "Qual horário o Marcos costuma vir?", "Tem vaga no horário que o Marcos costuma fazer?",
    "Dá para colocar o Marcos amanhã à tarde?", "Preciso remarcar o Marcos."
  ],
  check_patient_financial_status: [
    "O Marcos está devendo?", "Marcos tem pendência?", "Está tudo em dia para o Marcos?", "Quanto o Marcos deve?",
    "Tem parcela vencida?", "O Marcos já quitou tudo?", "Como está o financeiro do Marcos?", "Qual o saldo em aberto?"
  ],
  check_last_payment: ["Qual foi o último pagamento do Marcos?", "Quando foi o último PIX?"],
  check_session_payment: ["O último atendimento foi pago?", "A sessão de ontem está paga?"]
};

for (const [intent, phrases] of Object.entries(cases)) {
  test(`reconhece variações de ${intent}`, () => {
    for (const phrase of phrases) assert.equal(interpretAssistantQuery(phrase, {}, now).intent, intent, phrase);
  });
}

test("normaliza acentos, caixa e pontuação", () => assert.equal(normalizeAssistantText("  HORÁRIOS, disponíveis?!  "), "horarios disponiveis"));
test("tolera erro pequeno e nomes parciais", () => { assert.ok(similarity("Giovanna", "Giovana") > 0.8); assert.ok(similarity("Marco", "Marcos") > 0.8); });
test("mantém contexto curto entre perguntas", () => {
  const first = interpretAssistantQuery("Quais horários tem amanhã?", {}, now);
  const second = interpretAssistantQuery("E com a Giovana?", { ...first, professionalName: "Giovana" }, now);
  const third = interpretAssistantQuery("Pode ser 15:30 para o Marcos.", second, now);
  assert.equal(second.date, "2026-07-22");
  assert.equal(third.intent, "schedule_patient");
  assert.equal(third.professionalName, "Giovana");
  assert.equal(third.patientName, "marcos");
  assert.equal(third.time, "15:30");
});

test("mantém paciente no contexto financeiro", () => {
  const first = interpretAssistantQuery("O Marcos está devendo?", {}, now);
  const second = interpretAssistantQuery("Qual foi o último pagamento?", first, now);
  const third = interpretAssistantQuery("Pode abrir o financeiro dele?", second, now);
  assert.equal(second.patientName, "marcos");
  assert.equal(second.intent, "check_last_payment");
  assert.equal(third.patientName, "marcos");
  assert.equal(third.intent, "check_patient_financial_status");
});

test("reconhece alertas e pedidos incompletos", () => {
  assert.equal(interpretAssistantQuery("Pacotes vencendo", {}, now).intent, "check_alerts");
  assert.equal(interpretAssistantQuery("Pacientes sem retorno", {}, now).intent, "check_alerts");
  assert.equal(interpretAssistantQuery("Agendar paciente", {}, now).intent, "schedule_patient");
  const continued = interpretAssistantQuery("Marcos", { pendingIntent: "check_patient_financial_status" }, now);
  assert.equal(continued.intent, "check_patient_financial_status");
  assert.equal(continued.patientName, "marcos");
});
