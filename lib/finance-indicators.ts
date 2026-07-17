export type FinanceIndicatorTransaction = {
  id: string;
  transaction_type: string;
  amount: number;
  paid_amount?: number | null;
  open_amount?: number | null;
  status: string;
  due_date: string;
  payment_date?: string | null;
};

export type FinanceIndicatorSettlement = {
  financial_transaction_id: string;
  amount: number;
  paid_at: string;
};

export type FinanceIndicators = {
  billedRevenue: number;
  receivedRevenue: number;
  openRevenue: number;
  expectedExpenses: number;
  paidExpenses: number;
  cashBalance: number;
  expectedResult: number;
};

function inPeriod(value: string | null | undefined, start: string, end: string) {
  return Boolean(value && value >= start && value <= end);
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFinanceIndicators(
  transactions: FinanceIndicatorTransaction[],
  settlements: FinanceIndicatorSettlement[],
  start: string,
  end: string
): FinanceIndicators {
  const active = transactions.filter((transaction) => transaction.status !== "cancelado");
  const activeById = new Map(active.map((transaction) => [transaction.id, transaction]));
  const transactionIdsWithSettlements = new Set(
    settlements.map((settlement) => settlement.financial_transaction_id)
  );
  const competenceRows = active.filter((transaction) =>
    inPeriod(transaction.due_date, start, end)
  );

  const settledInPeriod = settlements.reduce(
    (totals, settlement) => {
      const transaction = activeById.get(settlement.financial_transaction_id);
      if (!transaction || !inPeriod(settlement.paid_at, start, end)) return totals;
      if (transaction.transaction_type === "receita" || transaction.transaction_type === "despesa") {
        totals[transaction.transaction_type] += Number(settlement.amount ?? 0);
      }
      return totals;
    },
    { receita: 0, despesa: 0 }
  );

  // Registros anteriores à adoção de payment_settlements continuam compatíveis.
  const legacyPaidInPeriod = active.reduce(
    (totals, transaction) => {
      if (
        transactionIdsWithSettlements.has(transaction.id) ||
        !inPeriod(transaction.payment_date, start, end)
      ) return totals;
      if (transaction.transaction_type === "receita" || transaction.transaction_type === "despesa") {
        totals[transaction.transaction_type] += Number(transaction.paid_amount ?? 0);
      }
      return totals;
    },
    { receita: 0, despesa: 0 }
  );

  const billedRevenue = competenceRows
    .filter((transaction) => transaction.transaction_type === "receita")
    .reduce((total, transaction) => total + Number(transaction.amount ?? 0), 0);
  const expectedExpenses = competenceRows
    .filter((transaction) => transaction.transaction_type === "despesa")
    .reduce((total, transaction) => total + Number(transaction.amount ?? 0), 0);
  const receivedRevenue = settledInPeriod.receita + legacyPaidInPeriod.receita;
  const paidExpenses = settledInPeriod.despesa + legacyPaidInPeriod.despesa;

  return {
    billedRevenue: money(billedRevenue),
    receivedRevenue: money(receivedRevenue),
    openRevenue: money(billedRevenue - receivedRevenue),
    expectedExpenses: money(expectedExpenses),
    paidExpenses: money(paidExpenses),
    cashBalance: money(receivedRevenue - paidExpenses),
    expectedResult: money(billedRevenue - expectedExpenses)
  };
}
