"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type PatientInsert = Database["public"]["Tables"]["patients"]["Insert"];
type PatientUpdate = Database["public"]["Tables"]["patients"]["Update"];

export type PatientFormInput = {
  full_name: string;
  cpf?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status?: string;
};

export type PatientActionResult = {
  ok: boolean;
  message: string;
};

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function getPatientPayload(input: PatientFormInput): PatientInsert {
  const fullName = input.full_name.trim();

  if (!fullName) {
    throw new Error("Nome do paciente e obrigatorio.");
  }

  return {
    full_name: fullName,
    cpf: cleanOptionalValue(input.cpf),
    birth_date: cleanOptionalValue(input.birth_date),
    phone: cleanOptionalValue(input.phone),
    email: cleanOptionalValue(input.email),
    address: cleanOptionalValue(input.address),
    notes: cleanOptionalValue(input.notes),
    status: input.status ?? "active"
  };
}

export async function createPatient(
  input: PatientFormInput
): Promise<PatientActionResult> {
  try {
    const supabase = await createClient();
    const payload = getPatientPayload(input);
    const { error } = await supabase.from("patients").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacientes");
    return { ok: true, message: "Paciente cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updatePatient(
  id: string,
  input: PatientFormInput
): Promise<PatientActionResult> {
  try {
    const supabase = await createClient();
    const payload = getPatientPayload(input) satisfies PatientUpdate;
    const { error } = await supabase
      .from("patients")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacientes");
    return { ok: true, message: "Paciente atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deactivatePatient(id: string): Promise<PatientActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("patients")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacientes");
    return { ok: true, message: "Paciente excluido com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
