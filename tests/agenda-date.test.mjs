import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/agenda-date.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { getAgendaToday, getAgendaVisibleRange, isAgendaDateKey } = await import(moduleUrl);

test("America/Sao_Paulo nao avanca o dia as 21h locais", () => {
  assert.equal(getAgendaToday(new Date("2026-07-19T00:30:00.000Z")), "2026-07-18");
});

test("intervalo mensal cobre exatamente as seis semanas da grade", () => {
  assert.deepEqual(getAgendaVisibleRange("2026-07-18", "month"), {
    start: "2026-06-28",
    end: "2026-08-08"
  });
});

test("intervalos de dia e semana usam datas civis sem deslocamento UTC", () => {
  assert.deepEqual(getAgendaVisibleRange("2026-07-18", "day"), {
    start: "2026-07-18",
    end: "2026-07-18"
  });
  assert.deepEqual(getAgendaVisibleRange("2026-07-18", "week"), {
    start: "2026-07-12",
    end: "2026-07-18"
  });
});

test("rejeita datas civis inexistentes", () => {
  assert.equal(isAgendaDateKey("2026-02-29"), false);
  assert.equal(isAgendaDateKey("2026-07-18"), true);
});
