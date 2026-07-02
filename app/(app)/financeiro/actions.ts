"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { createFinancialMovement } from "@/lib/financial-integration-engine";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type FinancialTransactionRow =
  Database["public"]["Tables"]["financial_transactions"]["Row"];
type FinancialTransactionInsert =
  Database["public"]["Tables"]["financial_transactions"]["Insert"];
type FinancialTransactionUpdate =
  Database["public"]["Tables"]["financial_transactions"]["Update"];
type PaymentSettlementInsert =
  Database["public"]["Tables"]["payment_settlements"]["Insert"];

export type FinancialTransactionType = "receita" | "despesa";
export type FinancialOrigin = "avulso" | "pacote" | "manual";
export type FinancialStatus = "pendente" | "pago" | "vencido" | "parcial" | "cancelado";
export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "boleto" | "parcelado" | "transferencia" | "outro";
export type SettlementType = "patient_payment" | "staff_payout";
export type SettlementMode = "total" | "partial";

export type FinancialTransactionFormInput = {
  clinic_id?: string;
  transaction_type: FinancialTransactionType;
  patient_id?: string;
  employee_id?: string;
  service_id?: string;
  origin?: FinancialOrigin;
  category?: string;
  description?: string;
  amount: string;
  payment_method?: PaymentMethod;
  due_date: string;
  payment_date?: string;
  appointment_date?: string;
  base_amount?: string;
  commission_type?: string;
  commission_rule_id?: string;
  status?: FinancialStatus;
  notes?: string;
};

export type SettlementInput = {
  ids: string[];
  settlement_type: SettlementType;
  mode: SettlementMode;
  amount?: string;
  payment_method?: PaymentMethod;
  paid_at: string;
  notes?: string;
};

export type FinancialActionResult = {
  ok: boolean;
  message: string;
};

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function assertRequired(value: string | undefined, message: string) {
  if (!value?.trim()) {
    throw new Error(message);
  }
}

function cleanMoney(value?: string) {
  const cleanValue = value?.replace(",", ".").trim();
  if (!cleanValue) return 0;
  const parsedValue = Number.parseFloat(cleanValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getAutomaticStatus({
  amount,
  paidAmount,
  dueDate,
  currentStatus
}: {
  amount: number;
  paidAmount: number;
  dueDate: string;
  currentStatus?: FinancialStatus | null;
}): FinancialStatus {
  if (currentStatus === "cancelado") return "cancelado";
  if (paidAmount >= amount) return "pago";
  if (paidAmount > 0 && paidAmount < amount) return "parcial";
  if (dueDate < today()) return "vencido";
  return "pendente";
}

async function resolveClinicId(inputClinicId?: string): Promise<string> {
  const clinicScope = await getCurrentClinicScope();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    throw new Error("Usuário sem clínica vinculada.");
  }

  if (!clinicScope.isAdmMaster) {
    return clinicScope.clinicId ?? "";
  }

  const clinicId = cleanOptionalValue(inputClinicId) ?? clinicScope.clinicId;

  if (!clinicId) {
    throw new Error("Selecione uma clínica ativa para usar Financeiro.");
  }

  return clinicId;
}

async function assertTransactionsInClinicScope(transactions: FinancialTransactionRow[]) {
  const clinicScope = await getCurrentClinicScope();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    throw new Error("Usuário sem clínica vinculada.");
  }

  if (clinicScope.isAdmMaster || !clinicScope.clinicId) return;

  const hasOutsideClinic = transactions.some(
    (transaction) => transaction.clinic_id !== clinicScope.clinicId
  );

  if (hasOutsideClinic) {
    throw new Error("Você não tem permissão para baixar lançamentos desta clínica.");
  }
}

function getFinancialPayload(
  input: FinancialTransactionFormInput,
  existingTransaction?: FinancialTransactionRow | null
): FinancialTransactionInsert {
  assertRequired(input.amount, "Informe o valor.");

  const transactionType = input.transaction_type;
  const amount = cleanMoney(input.amount);
  const isManualRevenue =
    transactionType === "receita" && input.origin === "manual";

  if (transactionType !== "receita" && transactionType !== "despesa") {
    throw new Error("Tipo financeiro inválido.");
  }

  if (amount <= 0) {
    throw new Error("O valor deve ser maior que zero.");
  }

  if (transactionType === "receita") {
    assertRequired(input.origin, "Selecione a origem da receita.");
  }

  if (isManualRevenue) {
    assertRequired(input.payment_date, "Informe a data de recebimento/pagamento.");
  } else {
    assertRequired(input.due_date, "Informe a data de vencimento.");
  }

  if (transactionType === "despesa") {
    assertRequired(input.category, "Informe a categoria da despesa.");
    assertRequired(input.description, "Informe a descrição da despesa.");
  }

  const dueDate = isManualRevenue
    ? cleanOptionalValue(input.payment_date) ?? today()
    : input.due_date;
  const existingPaidAmount = existingTransaction
    ? getPaidAmount(existingTransaction)
    : 0;
  const paidAmount = isManualRevenue
    ? amount
    : Math.min(existingPaidAmount, amount);
  const paymentDate = isManualRevenue
    ? cleanOptionalValue(input.payment_date) ?? today()
    : existingTransaction?.payment_date ?? null;
  const status = getAutomaticStatus({
    amount,
    paidAmount,
    dueDate,
    currentStatus: existingTransaction?.status as FinancialStatus | null | undefined
  });

  return {
    clinic_id: "",
    transaction_type: transactionType,
    patient_id:
      transactionType === "receita" ? cleanOptionalValue(input.patient_id) : null,
    employee_id: cleanOptionalValue(input.employee_id),
    service_id:
      transactionType === "receita" || input.category === "Comissões"
        ? cleanOptionalValue(input.service_id)
        : null,
    origin: transactionType === "receita" ? input.origin ?? "manual" : null,
    category: transactionType === "despesa" ? cleanOptionalValue(input.category) : null,
    description: cleanOptionalValue(input.description),
    amount,
    paid_amount: paidAmount,
    payment_method:
      transactionType === "receita" ? input.payment_method ?? "pix" : null,
    due_date: dueDate,
    payment_date: paymentDate,
    appointment_date: cleanOptionalValue(input.appointment_date),
    base_amount: input.base_amount ? cleanMoney(input.base_amount) : null,
    commission_type: cleanOptionalValue(input.commission_type),
    commission_rule_id: cleanOptionalValue(input.commission_rule_id),
    status,
    notes: cleanOptionalValue(input.notes),
    future_agenda_source_id: null,
    future_package_source_id: null,
    commission_status: "not_applicable",
    whatsapp_status: "not_applicable",
    report_visibility: "ready"
  };
}

function getOpenAmount(transaction: FinancialTransactionRow) {
  if (transaction.status === "cancelado" || transaction.status === "pago") return 0;
  const row = transaction as FinancialTransactionRow & {
    paid_amount?: number | null;
    open_amount?: number | null;
  };

  if (typeof row.open_amount === "number" && Number.isFinite(row.open_amount)) {
    return Math.max(roundMoney(row.open_amount), 0);
  }

  const paidAmount = typeof row.paid_amount === "number" ? row.paid_amount : 0;
  return Math.max(roundMoney(transaction.amount - paidAmount), 0);
}

function getPaidAmount(transaction: FinancialTransactionRow) {
  const row = transaction as FinancialTransactionRow & { paid_amount?: number | null };
  if (typeof row.paid_amount === "number") return Math.max(roundMoney(row.paid_amount), 0);
  return transaction.status === "pago" ? transaction.amount : 0;
}

function validateSettlementTransaction(
  transaction: FinancialTransactionRow,
  settlementType: SettlementType
) {
  if (settlementType === "patient_payment" && transaction.transaction_type !== "receita") {
    throw new Error("Selecione apenas recebimentos de pacientes para esta baixa.");
  }

  if (settlementType === "staff_payout" && transaction.transaction_type !== "despesa") {
    throw new Error("Selecione apenas repasses de funcionários para este pagamento.");
  }
}

function allocateSettlementAmounts(
  transactions: FinancialTransactionRow[],
  mode: SettlementMode,
  rawAmount?: string
) {
  const openById = new Map(
    transactions.map((transaction) => [transaction.id, getOpenAmount(transaction)])
  );
  const totalOpen = roundMoney(
    Array.from(openById.values()).reduce((total, amount) => total + amount, 0)
  );

  if (totalOpen <= 0) {
    throw new Error("Não há valor em aberto para baixar.");
  }

  if (mode === "total") {
    return transactions.map((transaction) => ({
      transaction,
      amount: openById.get(transaction.id) ?? 0
    }));
  }

  const amount = roundMoney(cleanMoney(rawAmount));

  if (amount <= 0) {
    throw new Error("Informe um valor pago maior que zero.");
  }

  if (amount > totalOpen) {
    throw new Error("O valor pago nao pode ser maior que o valor em aberto.");
  }

  let remaining = amount;
  const allocations: Array<{ transaction: FinancialTransactionRow; amount: number }> = [];

  for (const transaction of transactions) {
    const openAmount = openById.get(transaction.id) ?? 0;
    if (openAmount <= 0 || remaining <= 0) continue;

    const allocatedAmount = roundMoney(Math.min(openAmount, remaining));
    allocations.push({ transaction, amount: allocatedAmount });
    remaining = roundMoney(remaining - allocatedAmount);
  }

  return allocations;
}

export async function createFinancialTransaction(
  input: FinancialTransactionFormInput
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "create");
    const payload = getFinancialPayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    await createFinancialMovement(payload);

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return {
      ok: true,
      message:
        input.transaction_type === "receita"
          ? "Receita criada com sucesso."
          : "Despesa criada com sucesso."
    };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateFinancialTransaction(
  id: string,
  input: FinancialTransactionFormInput
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "edit");
    const supabase = await createClient();
    const { data: existingTransaction, error: readError } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (readError || !existingTransaction) {
      return { ok: false, message: getErrorMessage(readError) };
    }

    await assertTransactionsInClinicScope([existingTransaction]);

    const payload = getFinancialPayload(input, existingTransaction) satisfies FinancialTransactionUpdate;
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);

    if (error) return { ok: false, message: getErrorMessage(error) };

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return { ok: true, message: "Movimentação atualizada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function markFinancialTransactionAsPaid(
  id: string
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "edit");
    const supabase = await createClient();
    const { data: transaction, error: readError } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (readError || !transaction) {
      return { ok: false, message: getErrorMessage(readError) };
    }

    await assertTransactionsInClinicScope([transaction]);

    const { error } = await supabase
      .from("financial_transactions")
      .update({
        status: "pago",
        paid_amount: transaction.amount,
        payment_date: new Date().toISOString().slice(0, 10)
      })
      .eq("id", id);

    if (error) return { ok: false, message: getErrorMessage(error) };

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return { ok: true, message: "Movimentação marcada como paga." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function settleFinancialTransactions(
  input: SettlementInput
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "edit");

    const ids = Array.from(new Set(input.ids.filter(Boolean)));
    if (ids.length === 0) {
      throw new Error("Selecione ao menos um lançamento para baixar.");
    }

    if (input.mode !== "total" && input.mode !== "partial") {
      throw new Error("Modo de baixa inválido.");
    }

    assertRequired(input.paid_at, "Informe a data do pagamento.");
    assertRequired(input.payment_method, "Informe a forma de pagamento.");

    const supabase = await createClient();
    const { data: transactions, error: readError } = await supabase
      .from("financial_transactions")
      .select("*")
      .in("id", ids)
      .order("due_date", { ascending: true });

    if (readError) throw readError;

    if (!transactions || transactions.length !== ids.length) {
      throw new Error("Um ou mais lançamentos selecionados não foram encontrados.");
    }

    await assertTransactionsInClinicScope(transactions);
    transactions.forEach((transaction) =>
      validateSettlementTransaction(transaction, input.settlement_type)
    );

    const allocations = allocateSettlementAmounts(transactions, input.mode, input.amount).filter(
      (allocation) => allocation.amount > 0
    );

    if (allocations.length === 0) {
      throw new Error("Não há valor em aberto para baixar.");
    }

    const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
    const settlements: PaymentSettlementInsert[] = allocations.map((allocation) => ({
      financial_transaction_id: allocation.transaction.id,
      settlement_type: input.settlement_type,
      amount: allocation.amount,
      payment_method: input.payment_method ?? null,
      paid_at: input.paid_at,
      notes: cleanOptionalValue(input.notes),
      created_by: createdBy
    }));

    const { error: settlementError } = await supabase
      .from("payment_settlements")
      .insert(settlements);

    if (settlementError) throw settlementError;

    for (const allocation of allocations) {
      const previousPaidAmount = getPaidAmount(allocation.transaction);
      const paidAmount = roundMoney(previousPaidAmount + allocation.amount);
      const isPaid = paidAmount >= allocation.transaction.amount;
      const isOverdue = allocation.transaction.due_date < today();
      const updatePayload: FinancialTransactionUpdate = {
        paid_amount: Math.min(paidAmount, allocation.transaction.amount),
        status: isPaid ? "pago" : isOverdue ? "vencido" : "parcial",
        payment_method: input.payment_method ?? allocation.transaction.payment_method,
        payment_date: input.paid_at
      };

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update(updatePayload)
        .eq("id", allocation.transaction.id);

      if (updateError) throw updateError;
    }

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");

    return {
      ok: true,
      message:
        input.settlement_type === "patient_payment"
          ? "Baixa de recebimento registrada com sucesso."
          : "Pagamento de repasse registrado com sucesso."
    };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function cancelFinancialTransaction(
  id: string
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "edit");
    const supabase = await createClient();
    const { error } = await supabase
      .from("financial_transactions")
      .update({ status: "cancelado" })
      .eq("id", id);

    if (error) return { ok: false, message: getErrorMessage(error) };

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return { ok: true, message: "Movimentação cancelada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteFinancialTransaction(
  id: string
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "delete");
    const supabase = await createClient();
    const { error } = await supabase
      .from("financial_transactions")
      .delete()
      .eq("id", id);

    if (error) return { ok: false, message: getErrorMessage(error) };

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return { ok: true, message: "Movimentação excluída com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
