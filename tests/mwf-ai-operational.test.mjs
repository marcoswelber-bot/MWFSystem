import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  interpretOperationalMessage,
  rankEntityMatches,
  validateInterpretation
} from "../lib/mwf-ai/semantic-engine.ts";
import {
  clearConversation,
  getConversation,
  saveConversation
} from "../lib/mwf-ai/conversation-store.ts";

const now = new Date("2026-07-23T10:00:00-03:00");

test("normaliza acentos, caixa e espaços e reconhece termos incompletos", () => {
  const parsed = interpretOperationalMessage("  PACIÊNTES   com DÉBITOS  ", {}, now);
  assert.equal(parsed.normalizedText, "pacientes com debitos");
  assert.equal(parsed.module, "financeiro");
  assert.equal(parsed.intent, "debtors");
  assert.equal(parsed.tool, "list_debtors");

  const partial = interpretOperationalMessage("paci", {}, now);
  assert.equal(partial.module, "pacientes");
  assert.ok(partial.confidence >= 0.58);
});

test("catálogo reconhece abreviações, sinônimos e erros simples", () => {
  assert.equal(interpretOperationalMessage("notif", {}, now).module, "notificacoes");
  assert.equal(interpretOperationalMessage("prof", {}, now).module, "profissionais");
  assert.equal(interpretOperationalMessage("prontuaro", {}, now).module, "prontuarios");
  assert.equal(interpretOperationalMessage("quem está inadimplente", {}, now).intent, "debtors");
});

test("extrai datas relativas, explícitas e horários", () => {
  const tomorrow = interpretOperationalMessage("agenda amanhã às 9:30", {}, now);
  assert.equal(tomorrow.date, "2026-07-24");
  assert.equal(tomorrow.time, "09:30");
  const explicit = interpretOperationalMessage("agenda dia 30/07/2026 14h", {}, now);
  assert.equal(explicit.date, "2026-07-30");
  assert.equal(explicit.time, "14:00");
  const week = interpretOperationalMessage("receitas da próxima semana", {}, now);
  assert.equal(week.date, "2026-07-30");
  assert.equal(week.dateEnd, "2026-08-05");
});

test("seleciona ferramentas operacionais e schema validado", () => {
  const cases = [
    ["horários livres amanhã", "check_availability"],
    ["agendar paciente Maria amanhã às 10h", "prepare_appointment"],
    ["cancelar agendamento do paciente Maria amanhã", "prepare_cancellation"],
    ["cobrança do paciente João", "prepare_charge"],
    ["pacote da Maria", "get_patient_packages"],
    ["despesas desta semana", "financial_summary"]
  ];
  for (const [input, tool] of cases) {
    const parsed = interpretOperationalMessage(input, {}, now);
    assert.equal(parsed.tool, tool, input);
    assert.equal(validateInterpretation(parsed), true);
  }
});

test("extrai nomes parciais e preserva contexto curto", () => {
  const packageQuery = interpretOperationalMessage("pacote da Mari", {}, now);
  assert.equal(packageQuery.entities.patient, "mari");
  const followUp = interpretOperationalMessage("e os débitos?", { patientName: "Maria Silva", currentDomain: "pacotes" }, now);
  assert.equal(followUp.entities.patient, "Maria Silva");
  assert.equal(followUp.intent, "debtors");
});

test("ranking usa exato, prefixo, parcial e fuzzy sem escolher empate", () => {
  const rows = [
    { id: "1", name: "Maria Silva" },
    { id: "2", name: "Mariana Souza" },
    { id: "3", name: "João Santos" }
  ];
  assert.equal(rankEntityMatches("Maria Silva", rows)[0].id, "1");
  const partial = rankEntityMatches("Mari", rows);
  assert.deepEqual(partial.map((row) => row.id), ["1", "2"]);
  assert.ok(rankEntityMatches("Jao", rows)[0].score >= 0.62);
});

test("confirmações são interpretadas separadamente de novas ações", () => {
  assert.equal(interpretOperationalMessage("sim", {}, now).tool, "confirm_pending");
  assert.equal(interpretOperationalMessage("não", {}, now).tool, "cancel_pending");
  assert.equal(interpretOperationalMessage("agendar paciente Ana amanhã às 8h", {}, now).requiresConfirmation, true);
});

test("memória temporária isola usuário, clínica e conversa", () => {
  const base = {
    userId: "user-a",
    clinicId: "clinic-a",
    conversationId: "conversation-a",
    currentDomain: "pacientes",
    patientId: "patient-a",
    patientName: "Maria",
    pendingAction: null,
    updatedAt: Date.now()
  };
  saveConversation(base);
  assert.equal(getConversation("user-a", "clinic-a", "conversation-a")?.patientName, "Maria");
  assert.equal(getConversation("user-b", "clinic-a", "conversation-a"), null);
  assert.equal(getConversation("user-a", "clinic-b", "conversation-a"), null);
  assert.equal(getConversation("user-a", "clinic-a", "conversation-b"), null);
  clearConversation("user-a", "clinic-a", "conversation-a");
  assert.equal(getConversation("user-a", "clinic-a", "conversation-a"), null);
});

test("memória expirada não pode confirmar ações antigas", () => {
  saveConversation({
    userId: "user-expired",
    clinicId: "clinic-expired",
    conversationId: "conversation-expired",
    pendingAction: { type: "cancel_appointment", entityId: "appointment-1", payload: {}, summary: "Teste" },
    updatedAt: 1
  });
  assert.equal(getConversation("user-expired", "clinic-expired", "conversation-expired", Date.now() + 31 * 60_000), null);
});

test("camada operacional valida permissão, clínica e confirmação antes de mutações", () => {
  const source = readFileSync(new URL("../lib/mwf-ai/operational-assistant.ts", import.meta.url), "utf8");
  assert.match(source, /permissionKey/);
  assert.match(source, /\.eq\("clinic_id", clinicId\)/);
  assert.match(source, /getConversation\(userId, clinicId, conversationId\)/);
  assert.match(source, /if \(parsed\.intent === "confirm"\)/);
  assert.match(source, /permissions\.agenda\.create/);
  assert.match(source, /permissions\.agenda\.edit/);
  assert.match(source, /pendingAction/);
  assert.match(source, /schedule_blocks/);
  assert.match(source, /clinic_opening_hours/);
  assert.match(source, /financial_transactions/);
  assert.match(source, /patient_packages/);
  assert.match(source, /medical_records/);
  assert.match(source, /internal_notifications/);
  assert.match(source, /professional_service_commissions/);
  assert.match(source, /Resumo operacional/);
  assert.match(source, /Dados reais relacionados conforme suas permissões/);
  assert.doesNotMatch(source, /select\(".*complaint.*history.*evolution/s);
});

test("erros e respostas vazias são tratados sem dados simulados", () => {
  const source = readFileSync(new URL("../lib/mwf-ai/operational-assistant.ts", import.meta.url), "utf8");
  assert.match(source, /result\.error/);
  assert.match(source, /Nenhum paciente encontrado/);
  assert.match(source, /Nenhum débito em aberto encontrado/);
  assert.match(source, /O Supabase não confirmou/);
  assert.doesNotMatch(source, /dados de exemplo|mock|simulad/i);
});

test("interface mantém conversa e ações reais sem alterar o layout aprovado", () => {
  const component = readFileSync(new URL("../components/ai/mwf-assistant.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");
  assert.match(component, /conversationId/);
  assert.match(component, /MWF IA/);
  assert.match(component, /safe-area-inset-bottom/);
  assert.match(action, /handleOperationalAssistant/);
});
