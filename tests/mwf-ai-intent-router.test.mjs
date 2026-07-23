import test from "node:test";
import assert from "node:assert/strict";
import { routeAssistantIntent } from "../lib/mwf-ai/intent-router.ts";

test("roteia as intenções conhecidas antes da busca universal", () => {
  assert.equal(routeAssistantIntent("Funcionários").intent, "list_employees");
  assert.equal(routeAssistantIntent("Pacientes").intent, "list_patients");
  assert.equal(routeAssistantIntent("Dar baixa").intent, "ambiguous");
  assert.equal(routeAssistantIntent("Contracheque").intent, "payroll");
  assert.deepEqual(routeAssistantIntent("Pacientes devedores").filter, "debtors");
  assert.equal(routeAssistantIntent("Pacientes que começam com M").startsWith, "m");
  assert.equal(routeAssistantIntent("Próximo paciente").filter, "next");
  assert.equal(routeAssistantIntent("Funcionários inativos").filter, "inactive");
  assert.equal(routeAssistantIntent("Comissões").intent, "mark_commission");
  for (const phrase of ["Serviços", "Profissionais", "Pacotes", "Relatórios", "Financeiro", "Agenda"]) assert.notEqual(routeAssistantIntent(phrase).intent, "universal_search", phrase);
});

test("mantém o fluxo Dar baixa > Comissão > Maria", () => {
  const first = routeAssistantIntent("Dar baixa");
  const second = routeAssistantIntent("Comissão", { currentIntent: first.intent, currentStep: first.step });
  const third = routeAssistantIntent("Maria", { currentIntent: second.intent, currentStep: second.step });
  assert.equal(second.intent, "mark_commission");
  assert.equal(second.step, "choose_employee");
  assert.equal(third.intent, "search_employee");
  assert.equal(third.searchTerm, "Maria");
});

test("aplica continuação Pacientes > Somente devedores", () => {
  const result = routeAssistantIntent("Somente devedores", { currentIntent: "list_patients", currentStep: "show_results" });
  assert.equal(result.intent, "financial");
  assert.equal(result.filter, "debtors");
});

test("busca universal é somente fallback desconhecido", () => {
  assert.equal(routeAssistantIntent("uma solicitação sem domínio conhecido").intent, "universal_search");
});
