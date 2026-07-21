import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const action = readFileSync(new URL("../app/(app)/dashboard/assistant-actions.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/ai/mwf-assistant.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../app/(app)/mwf-ia/page.tsx", import.meta.url), "utf8");

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
  assert.match(component, /document\.body\.style\.overflow = "hidden"/);
  assert.match(component, /Ações abrem fluxos existentes para revisão/);
});

test("menu grande foi removido e rota antiga preserva compatibilidade", () => {
  assert.doesNotMatch(navigation, /MWF IA|\/mwf-ia/);
  assert.match(legacyPage, /redirect\("\/dashboard"\)/);
});
