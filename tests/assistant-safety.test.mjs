import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/ai/mwf-assistant.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../app/(app)/mwf-ia/page.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");

test("consultas respeitam clínica, permissões e não gravam dados", () => {
  assert.match(action, /getCurrentClinicScope/);
  assert.match(action, /getCurrentPermissionMap/);
  assert.match(action, /permissions\.financeiro\.view/);
  assert.match(action, /permissions\.agenda\.view/);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("MWF IA é flutuante, acessível e encaminha para fluxos existentes", () => {
  assert.match(component, /Abrir MWF IA/);
  assert.match(component, /Assistente Inteligente/);
  assert.match(component, /safe-area-inset-bottom/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /aria-controls="mwf-ai-panel"/);
  assert.match(component, /document\.body\.style\.overflow = "hidden"/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /launcherRef\.current\?\.focus/);
  assert.match(component, /h-\[90dvh\]/);
  assert.match(component, /lg:w-\[410px\]/);
  assert.doesNotMatch(component, /Hoje você possui/);
  assert.doesNotMatch(component, /Posso ajudar com mais alguma coisa/);
});

test("dashboard mantém cards e destinos enquanto a pesquisa global migra para a MWF IA", () => {
  assert.doesNotMatch(dashboard, /Pesquisa global de pacientes/);
  assert.doesNotMatch(dashboard, /<MwfAssistant/);
  assert.match(dashboard, /Ações rápidas/);
  assert.match(dashboard, /Pendências/);
  assert.match(dashboard, /Agenda de hoje/);
  assert.match(dashboard, /Novo paciente/);
  assert.match(dashboard, /Novo agendamento/);
  assert.match(dashboard, /Receber pagamento/);
  assert.match(dashboard, /\/pacientes\?new=1/);
  assert.match(dashboard, /\/agenda\?new=1/);
  assert.match(dashboard, /\/financeiro\/baixas/);
  assert.match(dashboard, /\/prontuarios/);
  assert.match(dashboard, /\/pacotes/);
  assert.match(dashboard, /\/agenda\?appointmentId=/);
  assert.match(appShell, /<MwfAssistant userName=/);
  assert.match(action, /cpf,phone,email/);
  assert.match(action, /full_name\.ilike/);
  assert.match(action, /Você quis dizer\?/);
  assert.match(action, /Qual serviço\?/);
  assert.match(action, /Qual profissional\?/);
});

test("MWF IA usa ícone próprio e continua fora do fluxo do Dashboard", () => {
  const icon = readFileSync(new URL("../components/ai/mwf-ai-icon.tsx", import.meta.url), "utf8");
  assert.match(icon, /linearGradient/);
  assert.match(icon, /feDropShadow/);
  assert.match(icon, /stroke="white"/);
  assert.match(icon, /circle cx="78"/);
  assert.match(component, /fixed right-4/);
  assert.match(component, /lg:bottom-\[100px\]/);
  assert.doesNotMatch(component, /MWF Assistant|Assistente MWF|Chatbot|Copilot/);
});

test("navegação usa rotas e permissões existentes sem realizar mutações", () => {
  for (const route of ["/agenda", "/financeiro", "/pacientes", "/pacotes", "/prontuarios", "/funcionarios", "/servicos", "/relatorios", "/clinicas"]) {
    assert.match(action, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(action, /Você não possui permissão para consultar esta informação/);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("gate impede consultas de paciente para intenções de Agenda e Financeiro coletivo", () => {
  assert.match(action, /getAssistantPatientSearchTerm\(parsed, input\)/);
  assert.match(action, /const shouldLoadPatients = parsed\.patientSearchAllowed/);
  assert.match(action, /parsed\.intent === "list_appointments"/);
  assert.match(action, /getAgendaVisibleRange\(anchor, "week"\)/);
  assert.doesNotMatch(action, /parsed\.intent === "search" \? input\.trim\(\) : null/);
});

test("menu grande foi removido e rota antiga preserva compatibilidade", () => {
  assert.doesNotMatch(navigation, /MWF IA|\/mwf-ia/);
  assert.match(legacyPage, /redirect\("\/dashboard"\)/);
});
