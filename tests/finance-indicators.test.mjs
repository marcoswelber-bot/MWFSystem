import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinanceIndicators } from "../lib/finance-indicators.ts";

const month = ["2026-07-01", "2026-07-31"];

function transaction(overrides = {}) {
  return {
    id: "revenue-1",
    transaction_type: "receita",
    amount: 1000,
    paid_amount: 0,
    status: "pendente",
    due_date: "2026-07-10",
    payment_date: null,
    ...overrides
  };
}

test("baixa altera caixa e recebido, mas não altera faturado ou resultado previsto", () => {
  const rows = [
    transaction(),
    transaction({ id: "expense-1", transaction_type: "despesa", amount: 400 })
  ];
  const before = calculateFinanceIndicators(rows, [], ...month);
  const after = calculateFinanceIndicators(rows, [
    { financial_transaction_id: "revenue-1", amount: 270, paid_at: "2026-07-17" }
  ], ...month);

  assert.deepEqual(before, {
    billedRevenue: 1000,
    receivedRevenue: 0,
    openRevenue: 1000,
    expectedExpenses: 400,
    paidExpenses: 0,
    cashBalance: 0,
    expectedResult: 600
  });
  assert.equal(after.billedRevenue, 1000);
  assert.equal(after.receivedRevenue, 270);
  assert.equal(after.openRevenue, 730);
  assert.equal(after.cashBalance, 270);
  assert.equal(after.expectedResult, 600);
});

test("baixas parciais usam somente cada valor efetivamente recebido e sua data", () => {
  const rows = [transaction({ paid_amount: 500, payment_date: "2026-08-02", status: "parcial" })];
  const settlements = [
    { financial_transaction_id: "revenue-1", amount: 270, paid_at: "2026-07-17" },
    { financial_transaction_id: "revenue-1", amount: 230, paid_at: "2026-08-02" }
  ];

  assert.equal(calculateFinanceIndicators(rows, settlements, ...month).receivedRevenue, 270);
  assert.equal(calculateFinanceIndicators(rows, settlements, "2026-08-01", "2026-08-31").receivedRevenue, 230);
});

test("não duplica paid_amount quando existem baixas e ignora lançamento cancelado", () => {
  const rows = [
    transaction({ paid_amount: 270, payment_date: "2026-07-17", status: "parcial" }),
    transaction({ id: "cancelled", amount: 500, paid_amount: 500, payment_date: "2026-07-17", status: "cancelado" })
  ];
  const settlements = [
    { financial_transaction_id: "revenue-1", amount: 270, paid_at: "2026-07-17" },
    { financial_transaction_id: "cancelled", amount: 500, paid_at: "2026-07-17" }
  ];

  const result = calculateFinanceIndicators(rows, settlements, ...month);
  assert.equal(result.billedRevenue, 1000);
  assert.equal(result.receivedRevenue, 270);
});

test("pagamento de despesa reduz o saldo de caixa", () => {
  const rows = [
    transaction({ id: "expense-1", transaction_type: "despesa", amount: 400, paid_amount: 150, status: "parcial" })
  ];
  const settlements = [
    { financial_transaction_id: "expense-1", amount: 150, paid_at: "2026-07-17" }
  ];
  const result = calculateFinanceIndicators(rows, settlements, ...month);
  assert.equal(result.expectedExpenses, 400);
  assert.equal(result.paidExpenses, 150);
  assert.equal(result.cashBalance, -150);
});

test("cancelamento da baixa remove somente o valor estornado dos indicadores", () => {
  const rows = [transaction({ paid_amount: 500, status: "parcial" })];
  const before = [
    { financial_transaction_id: "revenue-1", amount: 270, paid_at: "2026-07-17" },
    { financial_transaction_id: "revenue-1", amount: 230, paid_at: "2026-07-18" }
  ];
  const after = before.slice(1);

  assert.equal(calculateFinanceIndicators(rows, before, ...month).receivedRevenue, 500);
  assert.equal(calculateFinanceIndicators(rows, after, ...month).receivedRevenue, 230);
  assert.equal(calculateFinanceIndicators(rows, after, ...month).openRevenue, 770);
});
