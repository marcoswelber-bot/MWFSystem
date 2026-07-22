import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/ai/mwf-assistant.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../app/(app)/mwf-ia/page.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");

test("consultas respeitam clínica, permissões e não gravam dados", () => {
  assert.match(action, /getCurrentClinicScope/);
  assert.match(action, /getCurrentPermissionMap/);
  assert.match(action, /permissions\.financeiro\.view/);
  assert.match(action, /permissions\.agenda\.view/);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("interface é compacta, móvel e encaminha para fluxos existentes", () => {
  assert.match(component, /Abrir Assistente MWF/);
  assert.match(component, /safe-area-inset-bottom/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /createPortal\(mobileAssistant, document\.body\)/);
  assert.match(component, /aria-controls="mwf-mobile-assistant"/);
  assert.match(component, /document\.body\.style\.overflow = "hidden"/);
  assert.match(component, /Ações abrem fluxos existentes para revisão/);
  assert.doesNotMatch(component, /const suggestions/);
  assert.match(component, /Hoje você possui/);
});

test("dashboard usa somente o Assistente como pesquisa", () => {
  assert.doesNotMatch(dashboard, /Pesquisa global de pacientes|name="q"|searchParams/);
  assert.match(dashboard, /<MwfAssistant/);
  assert.match(action, /cpf,phone,email/);
  assert.match(action, /Você quis dizer\?/);
  assert.match(action, /Qual serviço\?/);
  assert.match(action, /Qual profissional\?/);
});

test("menu grande foi removido e rota antiga preserva compatibilidade", () => {
  assert.doesNotMatch(navigation, /MWF IA|\/mwf-ia/);
  assert.match(legacyPage, /redirect\("\/dashboard"\)/);
});
