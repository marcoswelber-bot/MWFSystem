"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type FinancialTransactionInsert =
  Database["public"]["Tables"]["financial_transactions"]["Insert"];
type FinancialTransactionUpdate =
  Database["public"]["Tables"]["financial_transactions"]["Update"];

export type FinancialTransactionType = "receita" | "despesa";
export type FinancialOrigin = "avulso" | "pacote" | "manual";
export type FinancialStatus = "pendente" | "pago" | "vencido" | "cancelado";
export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "boleto" | "parcelado";

export type FinancialTransactionFormInput = {
  clinic_id?: string;
  transaction_type: FinancialTransactionType;
  patient_id?: string;
  service_id?: string;
  origin?: FinancialOrigin;
  category?: string;
  description?: string;
  amount: string;
  payment_method?: PaymentMethod;
  due_date: string;
  payment_date?: string;
  status?: FinancialStatus;
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
  if (!cleanValue) {
    return 0;
  }

  const parsedValue = Number.parseFloat(cleanValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function resolveClinicId(inputClinicId?: string): Promise<string> {
  const clinicScope = await getCurrentClinicScope();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    throw new Error("Usuario sem clinica vinculada.");
  }

  if (!clinicScope.isAdmMaster) {
    return clinicScope.clinicId ?? "";
  }

  const clinicId = cleanOptionalValue(inputClinicId) ?? clinicScope.clinicId;

  if (!clinicId) {
    throw new Error("Selecione uma clinica ativa para usar Financeiro.");
  }

  return clinicId;
}

function getFinancialPayload(
  input: FinancialTransactionFormInput
): FinancialTransactionInsert {
  assertRequired(input.amount, "Informe o valor.");

  const transactionType = input.transaction_type;
  const amount = cleanMoney(input.amount);
  const isManualRevenue =
    transactionType === "receita" && input.origin === "manual";

  if (transactionType !== "receita" && transactionType !== "despesa") {
    throw new Error("Tipo financeiro invalido.");
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
    assertRequired(input.description, "Informe a descricao da despesa.");
  }

  const dueDate = isManualRevenue
    ? cleanOptionalValue(input.payment_date) ?? today()
    : input.due_date;

  return {
    clinic_id: "",
    transaction_type: transactionType,
    patient_id:
      transactionType === "receita" ? cleanOptionalValue(input.patient_id) : null,
    service_id:
      transactionType === "receita" ? cleanOptionalValue(input.service_id) : null,
    origin: transactionType === "receita" ? input.origin ?? "manual" : null,
    category: transactionType === "despesa" ? cleanOptionalValue(input.category) : null,
    description: cleanOptionalValue(input.description),
    amount,
    payment_method:
      transactionType === "receita" ? input.payment_method ?? "pix" : null,
    due_date: dueDate,
    payment_date: cleanOptionalValue(input.payment_date),
    status: input.status ?? "pendente",
    notes: cleanOptionalValue(input.notes),
    future_agenda_source_id: null,
    future_package_source_id: null,
    commission_status: "not_applicable",
    whatsapp_status: "not_applicable",
    report_visibility: "ready"
  };
}

export async function createFinancialTransaction(
  input: FinancialTransactionFormInput
): Promise<FinancialActionResult> {
  try {
    await assertCan("financeiro", "create");
    const supabase = await createClient();
    const payload = getFinancialPayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase.from("financial_transactions").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/financeiro");
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
    const payload = getFinancialPayload(input) satisfies FinancialTransactionUpdate;
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/financeiro");
    return { ok: true, message: "Movimentacao atualizada com sucesso." };
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
    const { error } = await supabase
      .from("financial_transactions")
      .update({
        status: "pago",
        payment_date: new Date().toISOString().slice(0, 10)
      })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/financeiro");
    return { ok: true, message: "Movimentacao marcada como paga." };
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

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/financeiro");
    return { ok: true, message: "Movimentacao cancelada com sucesso." };
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

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/financeiro");
    return { ok: true, message: "Movimentacao excluida com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
