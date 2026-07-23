import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Pix e Horarios reutilizam o editor existente dentro da edicao da clinica", async () => {
  const [page, entityManager, settingsManager, actions] = await Promise.all([
    read("app/(app)/clinicas/page.tsx"),
    read("components/entity-crud-manager.tsx"),
    read("components/clinics/clinic-settings-manager.tsx"),
    read("app/(app)/clinicas/settings-actions.ts")
  ]);

  assert.match(page, /clinicSettings=\{\{ clinics, openingHours \}\}/);
  assert.doesNotMatch(page, /<ClinicSettingsManager/);
  assert.match(entityManager, /table === "clinics" && editingRecord && clinicSettings/);
  assert.match(entityManager, /initialClinicId=\{editingRecord\.id\}/);
  assert.match(entityManager, /embedded/);
  assert.match(settingsManager, /saveClinicSettings/);
  assert.match(settingsManager, /Pix e Horarios/);
  assert.match(actions, /clinicId !== input\.clinic_id/);
  assert.match(actions, /onConflict: "clinic_id,weekday"/);
});
