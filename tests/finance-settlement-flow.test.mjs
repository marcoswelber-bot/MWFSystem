import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateFinanceIndicators } from "../lib/finance-indicators.ts";

const actions = readFileSync(new URL("../app/(app)/financeiro/actions.ts", import.meta.url), "utf8");
const manager = readFileSync(new URL("../components/finance/finance-manager.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const row = {
  id: "demo-revenue",
  transaction_type: "receita",
  amount: 270,
  paid_amount: 0,
  status: "pendente",
  due_date: "2026-07-17",
  payment_date: null
};
const period = ["2026-07-01", "2026-07-31"];

test("baixa total recebe o saldo integral sem alterar faturamento", () => {
  const result = calculateFinanceIndicators([row], [
    { financial_transaction_id: row.id, amount: 270, paid_at: "2026-07-17" }
  ], ...period);
  assert.equal(result.billedRevenue, 270);
  assert.equal(result.receivedRevenue, 270);
  assert.equal(result.openRevenue, 0);
});

test("baixa parcial e segunda baixa somam apenas os valores confirmados", () => {
  const first = [{ financial_transaction_id: row.id, amount: 100, paid_at: "2026-07-17" }];
  const second = [...first, { financial_transaction_id: row.id, amount: 170, paid_at: "2026-07-18" }];
  assert.equal(calculateFinanceIndicators([row], first, ...period).openRevenue, 170);
  assert.equal(calculateFinanceIndicators([row], second, ...period).openRevenue, 0);
  assert.equal(calculateFinanceIndicators([row], second, ...period).receivedRevenue, 270);
});

test("servidor rejeita valor superior ao saldo e interface atualiza sem reload", () => {
  assert.match(actions, /amount > totalOpen/);
  assert.match(actions, /O valor pago não pode ser maior que o valor em aberto/);
  assert.match(manager, /router\.refresh\(\)/);
  assert.doesNotMatch(manager, /location\.reload/);
});

test("desktop mantém tabela e ações fixas; mobile mantém cards", () => {
  assert.match(manager, /md:hidden/);
  assert.match(manager, /hidden max-w-full overflow-x-auto md:block/);
  assert.match(manager, /sticky right-0/);
  assert.match(manager, />Baixa parcial</);
  assert.match(manager, />Abrir ficha</);
});

test("modal de detalhes reutiliza o mesmo fluxo de baixa e mantém módulos sincronizados", () => {
  assert.match(manager, /onPaid=\{\(item\).*markAsPaid\(item\)/);
  assert.match(manager, /onPartial=\{\(item\).*markAsPartiallyPaid\(item\)/);
  assert.match(manager, /settleFinancialTransactions\(/);
  for (const path of ["/financeiro", "/financeiro/baixas", "/dashboard", "/relatorios", "/pacientes", "/portal"]) {
    assert.match(actions, new RegExp(`revalidatePath\\("${path.replaceAll("/", "\\/")}"\\)`));
  }
});

test("modal financeiro expõe ações essenciais e permanece dentro da viewport", () => {
  for (const label of ["Receber pagamento", "Baixa parcial", "Editar lançamento", "Cobrar via WhatsApp", "Gerar recibo", "Histórico financeiro"]) {
    assert.match(manager, new RegExp(label));
  }
  assert.match(manager, /max-h-\[94vh\]/);
  assert.match(manager, /overflow-y-auto/);
});

test("seletor multicliníca mostra nomes completos, pesquisa e usa tela inteira no celular", () => {
  assert.match(shell, /Pesquisar clínica/);
  assert.match(shell, /fixed inset-0 z-\[100\]/);
  assert.match(shell, /break-words/);
  assert.match(shell, /overflow-y-auto/);
  assert.match(shell, /filteredClinics/);
});
