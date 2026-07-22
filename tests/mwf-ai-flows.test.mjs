import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");

test("desambiguação de Prontuários consulta status reais e respeita clínica", () => {
  assert.match(action, /selected\?\.domain === "prontuarios"/);
  assert.match(action, /from\("medical_records"\)/);
  assert.match(action, /recordsQuery = recordsQuery\.eq\("clinic_id", scope\.clinicId\)/);
  assert.match(action, /Status reais/);
});

test("devedores preservam resultados numerados, valor e vencimento", () => {
  assert.match(action, /firstDueDates/);
  assert.match(action, /currentDomain: "financeiro"/);
  assert.match(action, /recentResults: debtors\.map/);
  assert.match(action, /payload: \{ patientId: item\.id, total:/);
});

test("cobrança exige prévia e duas confirmações antes do fluxo oficial", () => {
  assert.match(action, /prepare_charge:/);
  assert.match(action, /Prévia da cobrança/);
  assert.match(action, /send_charge:/);
  assert.match(action, /Confirmar envio/);
  assert.match(action, /Abrir cobrança no Financeiro/);
  assert.doesNotMatch(action, /window\.open\(`https:\/\/wa\.me/);
});

test("Agenda relaciona pacientes com consulta em lote e resultados contextuais", () => {
  assert.match(action, /select\("id,patient_id,appointment_date,start_time,status"\)/);
  assert.match(action, /appointmentPatientNames/);
  assert.match(action, /recentResults: rows\.slice\(0, 10\)/);
});
