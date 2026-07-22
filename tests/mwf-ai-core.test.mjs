import test from "node:test";
import assert from "node:assert/strict";
import { classifyMessage } from "../lib/mwf-ai/core/intent-classifier.ts";

const now = new Date("2026-07-22T12:00:00-03:00");

test("termos parciais usam capacidades em vez de nome de paciente", () => {
  const paci = classifyMessage("paci", {}, now);
  assert.equal(paci.domain, "pacientes");
  assert.notEqual(paci.intent, "patient_summary");
  const p = classifyMessage("P", {}, now);
  assert.equal(p.requiresClarification, true);
  assert.deepEqual(p.pendingOptions?.map(option => option.domain), ["pacientes", "pacotes", "prontuarios", "profissionais"]);
  const pro = classifyMessage("Pro", {}, now);
  assert.deepEqual(pro.pendingOptions?.map(option => option.domain), ["prontuarios", "profissionais"]);
});

test("classifica relações entre pacientes, financeiro e agenda", () => {
  const debtors = classifyMessage("pacientes que estão devendo", {}, now);
  assert.equal(debtors.domain, "financeiro");
  assert.equal(debtors.intent, "check_debtors");
  assert.equal(debtors.filters?.[0]?.operator, "open");
  const next = classifyMessage("pacientes do próximo agendamento", {}, now);
  assert.equal(next.domain, "agenda");
  assert.equal(next.intent, "list_appointments");
  assert.equal(next.filters?.[0]?.operator, "next");
});

test("extrai inicial de nome no domínio Pacientes", () => {
  const parsed = classifyMessage("paciente começa com M", {}, now);
  assert.equal(parsed.domain, "pacientes");
  assert.deepEqual(parsed.filters?.[0], { field: "full_name", operator: "starts_with", value: "m" });
});

test("número resolve resultado anterior antes da descoberta", () => {
  const context = { recentResults: [{ id: "patient-4", domain: "pacientes", label: "Paciente Demonstração 4", ordinal: 1, numericTokens: ["4"] }] };
  const parsed = classifyMessage("4", context, now);
  assert.equal(parsed.resolution?.kind, "result");
  assert.equal(parsed.resolution?.result?.id, "patient-4");
});

test("confirmação pendente é resolvida antes da classificação", () => {
  const context = { pendingOperation: { kind: "confirmation", actionId: "charge:4", domain: "financeiro", intent: "check_patient_financial_status", label: "Cobrança" } };
  assert.equal(classifyMessage("Sim", context, now).intent, "confirm");
  assert.equal(classifyMessage("Não", context, now).intent, "cancel");
  const loose = classifyMessage("Sim", {}, now);
  assert.equal(loose.intent, "unknown");
  assert.equal(loose.requiresClarification, true);
});
