"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type FinancialTransactionInsert = Database["public"]["Tables"]["financial_transactions"]["Insert"];
type PayrollEntryInsert = Database["public"]["Tables"]["payroll_entries"]["Insert"];

export type PayrollEntryType =
  | "salario_fixo"
  | "comissao_manual"
  | "vale_transporte"
  | "vale_alimentacao"
  | "ajuda_custo"
  | "bonus"
  | "desconto"
  | "adiantamento"
  | "inss"
  | "fgts"
  | "irrf"
  | "outros";
export type PayrollNature = "credito" | "debito";
export type PayrollStatus = "pendente" | "parcial" | "pago" | "cancelado";

export type PayrollEntryFormInput = {
  clinic_id?: string;
  employee_id?: string;
  competence_month: string;
  competence_year: string;
  entry_type: PayrollEntryType;
  nature: PayrollNature;
  amount: string;
  due_date: string;
  status?: PayrollStatus;
  notes?: string;
};

export type PayrollActionResult = {
  ok: boolean;
  message: string;
};

const entryLabels: Record<PayrollEntryType, string> = {
  salario_fixo: "Salário fixo",
  comissao_manual: "Comissão manual",
  vale_transporte: "Vale transporte",
  vale_alimentacao: "Vale alimentacao",
  ajuda_custo: "Ajuda de custo",
  bonus: "Bônus",
  desconto: "Desconto",
  adiantamento: "Adiantamento",
  inss: "INSS",
  fgts: "FGTS",
  irrf: "IRRF",
  outros: "Outros"
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

function cleanInteger(value: string, label: string) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Informe ${label}.`);
  }
  return parsedValue;
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
    throw new Error("Selecione uma clínica ativa para lançar folha.");
  }

  return clinicId;
}

function getFinancialCategory(entryType: PayrollEntryType) {
  if (["salario_fixo"].includes(entryType)) return "Folha - Salarios";
  if (["vale_transporte", "vale_alimentacao", "ajuda_custo", "bonus"].includes(entryType)) return "Folha - Beneficios";
  if (["inss", "fgts", "irrf"].includes(entryType)) return "Folha - Encargos";
  if (["desconto", "adiantamento"].includes(entryType)) return "Folha - Descontos";
  if (entryType === "comissao_manual") return "Folha - Comissão manual";
  return "Folha - Outros";
}

function getPayloads(
  input: PayrollEntryFormInput,
  clinicId: string,
  employeeName: string | null,
  createdBy: string | null
): { financial: FinancialTransactionInsert; payroll: Omit<PayrollEntryInsert, "financial_transaction_id"> } {
  assertRequired(input.employee_id, "Selecione o funcionario/profissional.");
  assertRequired(input.due_date, "Informe o vencimento.");

  const amount = cleanMoney(input.amount);
  if (amount <= 0) {
    throw new Error("O valor deve ser maior que zero.");
  }

  const competenceMonth = cleanInteger(input.competence_month, "o mes de competencia");
  const competenceYear = cleanInteger(input.competence_year, "o ano de competencia");

  if (competenceMonth < 1 || competenceMonth > 12) {
    throw new Error("Mes de competencia invalido.");
  }

  if (competenceYear < 2000) {
    throw new Error("Ano de competencia invalido.");
  }

  const label = entryLabels[input.entry_type] ?? "Folha";
  const competence = `${String(competenceMonth).padStart(2, "0")}/${competenceYear}`;
  const description = `${label} - ${employeeName ?? "Funcionário"} - Competencia ${competence}`;
  const status: PayrollStatus = "pendente";
  const paidAmount = 0;

  return {
    financial: {
      clinic_id: clinicId,
      transaction_type: "despesa",
      patient_id: null,
      employee_id: input.employee_id ?? null,
      service_id: null,
      origin: "folha",
      category: getFinancialCategory(input.entry_type),
      description,
      amount,
      paid_amount: paidAmount,
      payment_method: null,
      due_date: input.due_date,
      payment_date: null,
      appointment_date: null,
      base_amount: amount,
      commission_type: input.entry_type === "comissao_manual" ? "manual" : null,
      commission_rule_id: null,
      status,
      notes: cleanOptionalValue(input.notes),
      future_agenda_source_id: null,
      future_package_source_id: null,
      commission_status: "not_applicable",
      whatsapp_status: "not_applicable",
      report_visibility: "ready"
    },
    payroll: {
      clinic_id: clinicId,
      employee_id: input.employee_id ?? "",
      competence_month: competenceMonth,
      competence_year: competenceYear,
      entry_type: input.entry_type,
      nature: input.nature,
      amount,
      due_date: input.due_date,
      paid_at: null,
      status,
      notes: cleanOptionalValue(input.notes),
      created_by: createdBy
    }
  };
}

export async function createPayrollEntry(input: PayrollEntryFormInput): Promise<PayrollActionResult> {
  let financialTransactionId: string | null = null;

  try {
    await assertCan("financeiro", "create");
    const supabase = await createClient();
    const clinicId = await resolveClinicId(input.clinic_id);
    const createdBy = (await supabase.auth.getUser()).data.user?.id ?? null;

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("name,clinic_id")
      .eq("id", input.employee_id ?? "")
      .maybeSingle();

    if (employeeError) throw employeeError;
    if (!employee) throw new Error("Funcionário/profissional não encontrado.");
    if (!employee.clinic_id || employee.clinic_id !== clinicId) {
      throw new Error("Funcionário/profissional não pertence à clínica selecionada.");
    }

    const payloads = getPayloads(input, clinicId, employee.name, createdBy);
    const { data: financialTransaction, error: financialError } = await supabase
      .from("financial_transactions")
      .insert(payloads.financial)
      .select("id")
      .single();

    if (financialError) throw financialError;
    financialTransactionId = financialTransaction.id;

    const { error: payrollError } = await supabase
      .from("payroll_entries")
      .insert({
        ...payloads.payroll,
        financial_transaction_id: financialTransactionId
      });

    if (payrollError) throw payrollError;

    revalidatePath("/financeiro");
    revalidatePath("/financeiro/folha");
    revalidatePath("/financeiro/baixas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");

    return { ok: true, message: "Lancamento criado com sucesso." };
  } catch (error) {
    if (financialTransactionId) {
      try {
        const supabase = await createClient();
        await supabase.from("financial_transactions").delete().eq("id", financialTransactionId);
      } catch {
        // Best-effort rollback; the original error is more useful to the user.
      }
    }

    return { ok: false, message: getErrorMessage(error) };
  }
}