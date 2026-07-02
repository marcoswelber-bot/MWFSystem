"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
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
type PayrollEntryInsert =
  Database["public"]["Tables"]["payroll_entries"]["Insert"];

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

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type PayrollSyncConfig = {
  entryType: PayrollEntryInsert["entry_type"];
  nature: PayrollEntryInsert["nature"];
};

function getPayrollSyncConfig(category?: string | null): PayrollSyncConfig | null {
  const normalizedCategory = normalizeText(category);

  if (!normalizedCategory) return null;
  if (normalizedCategory.includes("salario")) return { entryType: "salario_fixo", nature: "credito" };
  if (normalizedCategory.includes("comissao")) return { entryType: "comissao_manual", nature: "credito" };
  if (normalizedCategory.includes("adiantamento")) return { entryType: "adiantamento", nature: "debito" };
  if (normalizedCategory.includes("vale transporte")) return { entryType: "vale_transporte", nature: "credito" };
  if (normalizedCategory.includes("vale alimentacao")) return { entryType: "vale_alimentacao", nature: "credito" };
  if (normalizedCategory.includes("ajuda de custo")) return { entryType: "ajuda_custo", nature: "credito" };
  if (normalizedCategory.includes("inss")) return { entryType: "inss", nature: "debito" };
  if (normalizedCategory.includes("fgts")) return { entryType: "fgts", nature: "debito" };
  if (normalizedCategory.includes("irrf")) return { entryType: "irrf", nature: "debito" };
  if (normalizedCategory.includes("desconto")) return { entryType: "desconto", nature: "debito" };
  if (normalizedCategory.includes("bonificacao")) return { entryType: "bonus", nature: "credito" };
  if (normalizedCategory.includes("ferias") || normalizedCategory.includes("13o")) return { entryType: "outros", nature: "credito" };
  return null;
}

function isEmployeeExpenseCategory(category?: string | null) {
  const normalizedCategory = normalizeText(category);
  return Boolean(getPayrollSyncConfig(category)) || normalizedCategory.includes("adm / funcionarios");
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

    if (isEmployeeExpenseCategory(input.category)) {
      assertRequired(input.employee_id, "Selecione o funcionário/profissional.");
    }
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
    employee_id:
      transactionType === "despesa"
        ? isEmployeeExpenseCategory(input.category)
          ? cleanOptionalValue(input.employee_id)
          : null
        : cleanOptionalValue(input.employee_id),
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

async function assertEmployeeBelongsToClinic(employeeId: string | null | undefined, clinicId: string) {
  if (!employeeId) return;

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id,clinic_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) throw error;
  if (!employee) throw new Error("Funcionário/profissional não encontrado.");
  if (employee.clinic_id !== clinicId) {
    throw new Error("Funcionário/profissional não pertence à clínica selecionada.");
  }
}

async function insertFinancialTransaction(payload: FinancialTransactionInsert) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

function getPayrollCompetence(dueDate: string) {
  const [year, month] = dueDate.split("-");
  return {
    competenceMonth: Number.parseInt(month, 10),
    competenceYear: Number.parseInt(year, 10)
  };
}

function getPayrollPayload(
  transactionId: string,
  payload: FinancialTransactionInsert,
  createdBy: string | null
): PayrollEntryInsert | null {
  if (payload.transaction_type !== "despesa" || !payload.employee_id) return null;

  const payrollConfig = getPayrollSyncConfig(payload.category);
  if (!payrollConfig || !payload.clinic_id || !payload.due_date) return null;

  const amount = Number(payload.amount ?? 0);
  const status = (payload.status ?? "pendente") as PayrollEntryInsert["status"];
  const { competenceMonth, competenceYear } = getPayrollCompetence(payload.due_date);

  return {
    clinic_id: payload.clinic_id,
    employee_id: payload.employee_id,
    financial_transaction_id: transactionId,
    competence_month: competenceMonth,
    competence_year: competenceYear,
    entry_type: payrollConfig.entryType,
    nature: payrollConfig.nature,
    amount,
    due_date: payload.due_date,
    paid_at: payload.payment_date ?? null,
    status,
    notes: payload.notes ?? payload.description ?? null,
    created_by: createdBy
  };
}

async function syncPayrollEntryForFinancialTransaction(
  transactionId: string,
  payload: FinancialTransactionInsert | FinancialTransactionUpdate,
  createdBy: string | null
) {
  const payrollPayload = getPayrollPayload(
    transactionId,
    payload as FinancialTransactionInsert,
    createdBy
  );
  const supabase = await createClient();
  const { data: existingPayrollEntry, error: readError } = await supabase
    .from("payroll_entries")
    .select("id")
    .eq("financial_transaction_id", transactionId)
    .maybeSingle();

  if (readError) throw readError;

  if (!payrollPayload) {
    if (existingPayrollEntry) {
      const { error } = await supabase
        .from("payroll_entries")
        .delete()
        .eq("id", existingPayrollEntry.id);

      if (error) throw error;
    }

    return;
  }

  if (existingPayrollEntry) {
    const { error } = await supabase
      .from("payroll_entries")
      .update(payrollPayload)
      .eq("id", existingPayrollEntry.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("payroll_entries").insert(payrollPayload);
  if (error) throw error;
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
    throw new Error("O valor pago não pode ser maior que o valor em aberto.");
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
    const supabase = await createClient();
    const payload = getFinancialPayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    await assertEmployeeBelongsToClinic(payload.employee_id, payload.clinic_id);

    const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
    const transactionId = await insertFinancialTransaction(payload);

    try {
      await syncPayrollEntryForFinancialTransaction(transactionId, payload, createdBy);
    } catch (error) {
      await supabase.from("financial_transactions").delete().eq("id", transactionId);
      throw error;
    }

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

    await assertEmployeeBelongsToClinic(payload.employee_id, payload.clinic_id);

    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);

    if (error) return { ok: false, message: getErrorMessage(error) };

    const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;
    await syncPayrollEntryForFinancialTransaction(id, payload, createdBy);

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
