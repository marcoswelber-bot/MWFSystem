"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

export type EmployeeFormInput = {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  role?: string;
  commission_type?: string;
  commission_value?: string;
  status?: string;
};

export type EmployeeActionResult = {
  ok: boolean;
  message: string;
};

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function cleanOptionalNumber(value?: string) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return null;
  }

  const numberValue = Number(cleanValue.replace(",", "."));

  if (Number.isNaN(numberValue)) {
    throw new Error("Valor da comissao deve ser numerico.");
  }

  return numberValue;
}

function getEmployeePayload(input: EmployeeFormInput): EmployeeInsert {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Nome do funcionario e obrigatorio.");
  }

  return {
    name,
    phone: cleanOptionalValue(input.phone),
    whatsapp: cleanOptionalValue(input.whatsapp),
    email: cleanOptionalValue(input.email),
    role: cleanOptionalValue(input.role),
    commission_type: cleanOptionalValue(input.commission_type),
    commission_value: cleanOptionalNumber(input.commission_value),
    status: input.status ?? "active"
  };
}

export async function createEmployee(
  input: EmployeeFormInput
): Promise<EmployeeActionResult> {
  try {
    const supabase = await createClient();
    const payload = getEmployeePayload(input);
    const { error } = await supabase.from("employees").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Funcionario cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateEmployee(
  id: string,
  input: EmployeeFormInput
): Promise<EmployeeActionResult> {
  try {
    const supabase = await createClient();
    const payload = getEmployeePayload(input) satisfies EmployeeUpdate;
    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Funcionario atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deactivateEmployee(
  id: string
): Promise<EmployeeActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("employees")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Funcionario inativado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function activateEmployee(
  id: string
): Promise<EmployeeActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("employees")
      .update({ status: "active" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Funcionario ativado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteEmployee(
  id: string
): Promise<EmployeeActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Funcionario excluido definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
