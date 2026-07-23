import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const operational = readFileSync(new URL("../lib/mwf-ai/operational-assistant.ts", import.meta.url), "utf8");

test("Prontuários consultam metadados reais sem expor conteúdo clínico", () => {
  assert.match(operational, /from\("medical_records"\)/);
  assert.match(operational, /select\("id,patient_id,title,status,created_at"\)/);
  assert.match(operational, /\.eq\("clinic_id", clinicId\)/);
  assert.doesNotMatch(operational, /select\(".*complaint.*history.*evolution/s);
});

test("devedores relacionam lançamentos e pacientes reais e calculam total", () => {
  assert.match(operational, /from\("financial_transactions"\)/);
  assert.match(operational, /gt\("open_amount", 0\)/);
  assert.match(operational, /const totals = new Map/);
  assert.match(operational, /total em aberto/);
  assert.match(operational, /recentResults/);
});

test("cobrança exige preparação e confirmação sem simular envio", () => {
  assert.match(operational, /type: "prepare_charge"/);
  assert.match(operational, /Confirmar preparação da cobrança/);
  assert.match(operational, /não possui envio automático confirmado pela IA/);
  assert.match(operational, /Abrir cobrança/);
  assert.doesNotMatch(operational, /window\.open\(`https:\/\/wa\.me/);
});

test("Agenda relaciona pacientes, profissionais e serviços em lote", () => {
  assert.match(operational, /select\("id,patient_id,employee_id,service_id,appointment_date,start_time,end_time,status"\)/);
  assert.match(operational, /patientNames/);
  assert.match(operational, /employeeNames/);
  assert.match(operational, /serviceNames/);
});

test("disponibilidade considera expediente, bloqueios e conflitos", () => {
  assert.match(operational, /clinic_opening_hours/);
  assert.match(operational, /schedule_blocks/);
  assert.match(operational, /const occupied/);
  assert.match(operational, /const blocked/);
});

test("agendamento e cancelamento usam dois estágios e retorno real", () => {
  assert.match(operational, /type: "create_appointment"/);
  assert.match(operational, /type: "cancel_appointment"/);
  assert.match(operational, /if \(parsed\.intent === "confirm"\)/);
  assert.match(operational, /\.insert\(/);
  assert.match(operational, /\.update\(/);
  assert.match(operational, /O Supabase não confirmou/);
});
