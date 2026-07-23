import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");
const operational = readFileSync(new URL("../lib/mwf-ai/operational-assistant.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/ai/mwf-assistant.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../app/(app)/mwf-ia/page.tsx", import.meta.url), "utf8");

test("server action autentica, seleciona clínica e delega somente à camada operacional", () => {
  assert.match(action, /getCurrentClinicScope/);
  assert.match(action, /getCurrentPermissionMap/);
  assert.match(action, /supabase\.auth\.getUser/);
  assert.match(action, /handleOperationalAssistant/);
  assert.doesNotMatch(action, /interpretAssistantQuery|handleCentralIntent|classifyMessage/);
});

test("consultas e mutações validam permissões e clínica antes do Supabase", () => {
  assert.match(operational, /permissionKey/);
  assert.match(operational, /permissions\.financeiro\.view/);
  assert.match(operational, /permissions\.agenda\.view/);
  assert.match(operational, /permissions\.agenda\.create/);
  assert.match(operational, /permissions\.agenda\.edit/);
  assert.match(operational, /\.eq\("clinic_id", clinicId\)/);
  assert.match(operational, /if \(parsed\.intent === "confirm"\)/);
});

test("MWF IA mantém interface flutuante, acessível, responsiva e contexto por conversa", () => {
  assert.match(component, /Abrir MWF IA/);
  assert.match(component, /Assistente Inteligente/);
  assert.match(component, /safe-area-inset-bottom/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /aria-controls="mwf-ai-panel"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /conversationId/);
  assert.match(component, /h-\[90dvh\]/);
  assert.match(component, /lg:w-\[410px\]/);
});

test("botões correspondem a rotas ou prompts operacionais reais", () => {
  for (const route of ["/agenda", "/financeiro", "/pacientes", "/pacotes", "/prontuarios", "/funcionarios", "/servicos"]) {
    assert.match(operational, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(component, /item\.externalHref/);
  assert.match(component, /item\.href/);
  assert.match(component, /ask\(item\.prompt\)/);
});

test("menu grande continua removido e rota antiga preserva compatibilidade", () => {
  assert.doesNotMatch(navigation, /MWF IA|\/mwf-ia/);
  assert.match(legacyPage, /redirect\("\/dashboard"\)/);
});
