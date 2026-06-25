"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PatientPackageInsert =
  Database["public"]["Tables"]["patient_packages"]["Insert"];
type PatientPackageUpdate =
  Database["public"]["Tables"]["patient_packages"]["Update"];

export type PackageStatus = "active" | "finished" | "cancelled" | "expired";

export type PatientPackageFormInput = {
  clinic_id?: string;
  patient_id: string;
  service_id: string;
  employee_id?: string;
  sale_responsible_id?: string;
  contracted_sessions: string;
  completed_sessions: string;
  unit_session_value: string;
  discount_percent: string;
  total_value: string;
  purchase_date: string;
  expiration_date?: string;
  payment_method: string;
  status?: PackageStatus;
  notes?: string;
};

export type PackageActionResult = {
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

function cleanInteger(value?: string) {
  const cleanValue = value?.trim();
  if (!cleanValue) {
    return 0;
  }

  const parsedValue = Number.parseInt(cleanValue, 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function cleanMoney(value?: string) {
  const cleanValue = value?.replace(",", ".").trim();
  if (!cleanValue) {
    return 0;
  }

  const parsedValue = Number.parseFloat(cleanValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function cleanPercent(value?: string) {
  const cleanValue = value?.replace(",", ".").trim();
  if (!cleanValue) {
    return 0;
  }

  const parsedValue = Number.parseFloat(cleanValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
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
    throw new Error("Selecione uma clinica ativa para usar Pacotes.");
  }

  return clinicId;
}

function getPackagePayload(input: PatientPackageFormInput): PatientPackageInsert {
  assertRequired(input.patient_id, "Selecione o paciente.");
  assertRequired(input.service_id, "Selecione o servico.");
  assertRequired(input.contracted_sessions, "Informe a quantidade contratada.");
  assertRequired(input.unit_session_value, "Informe o valor unitario da sessao.");
  assertRequired(input.purchase_date, "Informe a data da compra.");

  const contractedSessions = cleanInteger(input.contracted_sessions);
  const completedSessions = cleanInteger(input.completed_sessions);
  const remainingSessions = contractedSessions - completedSessions;
  const unitSessionValue = cleanMoney(input.unit_session_value);
  const discountPercent = cleanPercent(input.discount_percent);
  const subtotalValue = contractedSessions * unitSessionValue;
  const discountValue = subtotalValue * (discountPercent / 100);
  const totalValue = subtotalValue - discountValue;

  if (contractedSessions <= 0) {
    throw new Error("A quantidade contratada deve ser maior que zero.");
  }

  if (remainingSessions < 0) {
    throw new Error("A quantidade restante nao pode ser negativa.");
  }

  if (unitSessionValue < 0) {
    throw new Error("O valor unitario nao pode ser negativo.");
  }

  if (discountPercent < 0) {
    throw new Error("O desconto nao pode ser negativo.");
  }

  if (discountPercent > 100) {
    throw new Error("O desconto nao pode ser maior que 100%.");
  }

  if (totalValue < 0) {
    throw new Error("O valor total nao pode ser negativo.");
  }

  return {
    clinic_id: "",
    patient_id: input.patient_id,
    service_id: input.service_id,
    employee_id: cleanOptionalValue(input.employee_id),
    sale_responsible_id: cleanOptionalValue(input.sale_responsible_id),
    contracted_sessions: contractedSessions,
    completed_sessions: completedSessions,
    remaining_sessions: remainingSessions,
    unit_session_value: unitSessionValue,
    discount_percent: discountPercent,
    subtotal_value: subtotalValue,
    discount_value: discountValue,
    total_value: totalValue,
    purchase_date: input.purchase_date,
    expiration_date: cleanOptionalValue(input.expiration_date),
    payment_method: input.payment_method || "pix",
    status: input.status ?? "active",
    notes: cleanOptionalValue(input.notes),
    agenda_integration_status: "ready",
    finance_integration_status: "pending",
    future_revenue_status: "not_generated"
  };
}

export async function createPatientPackage(
  input: PatientPackageFormInput
): Promise<PackageActionResult> {
  try {
    await assertCan("pacotes", "create");
    const supabase = await createClient();
    const payload = getPackagePayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase.from("patient_packages").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacotes");
    return { ok: true, message: "Pacote criado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updatePatientPackage(
  id: string,
  input: PatientPackageFormInput
): Promise<PackageActionResult> {
  try {
    await assertCan("pacotes", "edit");
    const supabase = await createClient();
    const payload = getPackagePayload(input) satisfies PatientPackageUpdate;
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase
      .from("patient_packages")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacotes");
    return { ok: true, message: "Pacote atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function finishPatientPackage(id: string): Promise<PackageActionResult> {
  try {
    await assertCan("pacotes", "edit");
    const supabase = await createClient();
    const { error } = await supabase
      .from("patient_packages")
      .update({ status: "finished" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacotes");
    return { ok: true, message: "Pacote finalizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function cancelPatientPackage(id: string): Promise<PackageActionResult> {
  try {
    await assertCan("pacotes", "edit");
    const supabase = await createClient();
    const { error } = await supabase
      .from("patient_packages")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacotes");
    return { ok: true, message: "Pacote cancelado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deletePatientPackage(id: string): Promise<PackageActionResult> {
  try {
    await assertCan("pacotes", "delete");
    const supabase = await createClient();
    const { error } = await supabase.from("patient_packages").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacotes");
    return { ok: true, message: "Pacote excluido com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
