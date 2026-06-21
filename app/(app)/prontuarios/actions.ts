"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { assertCan } from "@/lib/permissions";
import type { Database } from "@/types/database";

type MedicalRecordInsert =
  Database["public"]["Tables"]["medical_records"]["Insert"];
type MedicalRecordUpdate =
  Database["public"]["Tables"]["medical_records"]["Update"];

export type MedicalRecordFormInput = {
  patient_id?: string;
  employee_id?: string;
  title: string;
  complaint?: string;
  history?: string;
  conduct?: string;
  evolution?: string;
  notes?: string;
  status?: string;
};

export type MedicalRecordActionResult = {
  ok: boolean;
  message: string;
};

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function getMedicalRecordPayload(
  input: MedicalRecordFormInput
): MedicalRecordInsert {
  const title = input.title.trim();

  if (!title) {
    throw new Error("Titulo do prontuario e obrigatorio.");
  }

  return {
    patient_id: cleanOptionalValue(input.patient_id),
    employee_id: cleanOptionalValue(input.employee_id),
    title,
    complaint: cleanOptionalValue(input.complaint),
    history: cleanOptionalValue(input.history),
    conduct: cleanOptionalValue(input.conduct),
    evolution: cleanOptionalValue(input.evolution),
    notes: cleanOptionalValue(input.notes),
    status: input.status ?? "active"
  };
}

async function resolveClinicIdForMedicalRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: MedicalRecordInsert | MedicalRecordUpdate
) {
  const clinicScope = await getCurrentClinicScope();

  if (clinicScope.clinicId) {
    return clinicScope.clinicId;
  }

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    throw new Error("Usuario sem clinica vinculada.");
  }

  if (!payload.patient_id) {
    return null;
  }

  const { data } = await supabase
    .from("patients")
    .select("clinic_id")
    .eq("id", payload.patient_id)
    .maybeSingle();

  return data?.clinic_id ?? null;
}

export async function createMedicalRecord(
  input: MedicalRecordFormInput
): Promise<MedicalRecordActionResult> {
  try {
    await assertCan("prontuarios", "create");
    const supabase = await createClient();
    const payload = getMedicalRecordPayload(input);
    payload.clinic_id = await resolveClinicIdForMedicalRecord(supabase, payload);
    const { error } = await supabase.from("medical_records").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/prontuarios");
    return { ok: true, message: "Prontuario cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateMedicalRecord(
  id: string,
  input: MedicalRecordFormInput
): Promise<MedicalRecordActionResult> {
  try {
    await assertCan("prontuarios", "edit");
    const supabase = await createClient();
    const payload = getMedicalRecordPayload(input) satisfies MedicalRecordUpdate;
    payload.clinic_id = await resolveClinicIdForMedicalRecord(supabase, payload);
    const { error } = await supabase
      .from("medical_records")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/prontuarios");
    return { ok: true, message: "Prontuario atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deactivateMedicalRecord(
  id: string
): Promise<MedicalRecordActionResult> {
  try {
    await assertCan("prontuarios", "toggle");
    const supabase = await createClient();
    const { error } = await supabase
      .from("medical_records")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/prontuarios");
    return { ok: true, message: "Prontuario inativado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function activateMedicalRecord(
  id: string
): Promise<MedicalRecordActionResult> {
  try {
    await assertCan("prontuarios", "toggle");
    const supabase = await createClient();
    const { error } = await supabase
      .from("medical_records")
      .update({ status: "active" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/prontuarios");
    return { ok: true, message: "Prontuario ativado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteMedicalRecord(
  id: string
): Promise<MedicalRecordActionResult> {
  try {
    await assertCan("prontuarios", "delete");
    const supabase = await createClient();
    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/prontuarios");
    return { ok: true, message: "Prontuario excluido definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
