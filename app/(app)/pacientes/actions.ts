"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { assertCan } from "@/lib/permissions";
import type { Database } from "@/types/database";

type PatientInsert = Database["public"]["Tables"]["patients"]["Insert"];
type PatientUpdate = Database["public"]["Tables"]["patients"]["Update"];

export type PatientFormInput = {
  full_name: string;
  clinic_id?: string;
  cpf?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  portal_access?: boolean;
  login_email?: string;
  temporary_password?: string;
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
    clinic_id: cleanOptionalValue(input.clinic_id),
    cpf: cleanOptionalValue(input.cpf),
    birth_date: cleanOptionalValue(input.birth_date),
    phone: cleanOptionalValue(input.phone),
    email: cleanOptionalValue(input.email),
    portal_access: Boolean(input.portal_access),
    login_email: cleanOptionalValue(input.login_email),
    temporary_password: cleanOptionalValue(input.temporary_password),
    address: cleanOptionalValue(input.address),
    notes: cleanOptionalValue(input.notes),
    status: input.status ?? "active"
  };
}

async function findAuthUserByEmail(email: string) {
  const supabaseAdmin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (item) => item.email?.trim().toLowerCase() === normalizedEmail
    );

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function syncPatientAuthUser(
  payload: PatientInsert | PatientUpdate,
  previousLoginEmail?: string | null
) {
  if (!payload.portal_access) {
    return;
  }

  const loginEmail = cleanOptionalValue(payload.login_email ?? undefined);

  if (!loginEmail) {
    throw new Error("Informe o email de login para liberar acesso ao portal.");
  }

  const temporaryPassword = cleanOptionalValue(
    payload.temporary_password ?? undefined
  );
  const supabaseAdmin = createAdminClient();
  const existingUser =
    (await findAuthUserByEmail(loginEmail)) ||
    (previousLoginEmail ? await findAuthUserByEmail(previousLoginEmail) : null);

  const userMetadata = {
    name: payload.full_name ?? "",
    access_type: "patient"
  };

  if (existingUser) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        email: loginEmail,
        ...(temporaryPassword ? { password: temporaryPassword } : {}),
        email_confirm: true,
        app_metadata: { role: "patient" },
        user_metadata: userMetadata
      }
    );

    if (error) {
      throw error;
    }

    return;
  }

  if (!temporaryPassword) {
    throw new Error(
      "Informe a senha provisoria para criar o usuario no Supabase Auth."
    );
  }

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: loginEmail,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: "patient" },
    user_metadata: userMetadata
  });

  if (error) {
    throw error;
  }
}

export async function createPatient(
  input: PatientFormInput
): Promise<PatientActionResult> {
  try {
    await assertCan("pacientes", "create");
    const supabase = await createClient();
    const payload = getPatientPayload(input);
    const clinicScope = await getCurrentClinicScope();
    if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
      throw new Error("Usuario sem clinica vinculada.");
    }
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      payload.clinic_id = clinicScope.clinicId;
    }
    await syncPatientAuthUser(payload);
    // Limpa a senha temporária antes de salvar no banco (segurança)
    payload.temporary_password = null;
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
    await assertCan("pacientes", "edit");
    const supabase = await createClient();
    const payload = getPatientPayload(input) satisfies PatientUpdate;
    const clinicScope = await getCurrentClinicScope();
    if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
      throw new Error("Usuario sem clinica vinculada.");
    }
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      payload.clinic_id = clinicScope.clinicId;
    }
    const { data: currentPatient, error: loadError } = await supabase
      .from("patients")
      .select("login_email")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return { ok: false, message: getErrorMessage(loadError) };
    }

    await syncPatientAuthUser(payload, currentPatient?.login_email ?? null);
    // Limpa a senha temporária antes de salvar no banco (segurança)
    payload.temporary_password = null;
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
    await assertCan("pacientes", "toggle");
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

export async function activatePatient(id: string): Promise<PatientActionResult> {
  try {
    await assertCan("pacientes", "toggle");
    const supabase = await createClient();
    const { error } = await supabase
      .from("patients")
      .update({ status: "active" })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacientes");
    return { ok: true, message: "Paciente ativado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deletePatient(id: string): Promise<PatientActionResult> {
  try {
    await assertCan("pacientes", "delete");
    const supabase = await createClient();
    const { error } = await supabase.from("patients").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/pacientes");
    return { ok: true, message: "Paciente excluido definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
