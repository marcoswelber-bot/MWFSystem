"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClinicScope } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { assertCan, isAdmRole } from "@/lib/permissions";
import type { Database } from "@/types/database";

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];
type ProfessionalCommission =
  Database["public"]["Tables"]["professional_service_commissions"]["Row"];
type ProfessionalCommissionInsert =
  Database["public"]["Tables"]["professional_service_commissions"]["Insert"];

export type EmployeeFormInput = {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  system_access?: boolean;
  login_email?: string;
  temporary_password?: string;
  role?: string;
  commission_type?: string;
  commission_value?: string;
  status?: string;
};

export type EmployeeActionResult = {
  ok: boolean;
  message: string;
};

export type ProfessionalCommissionFormInput = {
  id?: string;
  professional_id: string;
  service_id: string;
  attendance_type: string;
  modality: string;
  group_calculation_mode?: string;
  base_price?: string;
  commission_type: string;
  commission_value: string;
  active?: boolean;
  notes?: string;
  change_reason?: string;
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
    system_access: Boolean(input.system_access),
    login_email: cleanOptionalValue(input.login_email),
    temporary_password: cleanOptionalValue(input.temporary_password),
    role: cleanOptionalValue(input.role),
    commission_type: cleanOptionalValue(input.commission_type),
    commission_value: cleanOptionalNumber(input.commission_value),
    status: input.status ?? "active"
  };
}

function getEstimatedCommission(
  basePrice: number | null,
  commissionType: string,
  commissionValue: number
) {
  if (commissionType === "valor_fixo") {
    return commissionValue;
  }

  return basePrice === null ? 0 : (basePrice * commissionValue) / 100;
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

async function syncEmployeeAuthUser(
  payload: EmployeeInsert | EmployeeUpdate,
  previousLoginEmail?: string | null
) {
  if (!payload.system_access) {
    return;
  }

  const loginEmail = cleanOptionalValue(payload.login_email ?? undefined);

  if (!loginEmail) {
    throw new Error("Informe o email de login para liberar acesso ao sistema.");
  }

  const temporaryPassword = cleanOptionalValue(
    payload.temporary_password ?? undefined
  );
  const supabaseAdmin = createAdminClient();
  const existingUser =
    (await findAuthUserByEmail(loginEmail)) ||
    (previousLoginEmail ? await findAuthUserByEmail(previousLoginEmail) : null);

  const userMetadata = {
    name: payload.name ?? "",
    role: payload.role ?? "Funcionario",
    access_type: "employee"
  };

  if (existingUser) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        email: loginEmail,
        ...(temporaryPassword ? { password: temporaryPassword } : {}),
        email_confirm: true,
        app_metadata: { role: "employee" },
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
    app_metadata: { role: "employee" },
    user_metadata: userMetadata
  });

  if (error) {
    throw error;
  }
}

function getCommissionPayload(
  input: ProfessionalCommissionFormInput
): ProfessionalCommissionInsert {
  if (!input.professional_id) {
    throw new Error("Selecione um profissional.");
  }

  if (!input.service_id) {
    throw new Error("Selecione um servico.");
  }

  const basePrice = cleanOptionalNumber(input.base_price);
  const commissionValue = cleanOptionalNumber(input.commission_value);

  if (commissionValue === null) {
    throw new Error("Informe o valor da comissao.");
  }

  const commissionType = input.commission_type || "percentual";

  return {
    professional_id: input.professional_id,
    service_id: input.service_id,
    attendance_type: input.attendance_type || "presencial",
    modality: input.modality || "individual",
    group_calculation_mode:
      input.modality === "grupo"
        ? input.group_calculation_mode || "por_paciente"
        : "por_paciente",
    base_price: basePrice,
    commission_type: commissionType,
    commission_value: commissionValue,
    estimated_amount: getEstimatedCommission(
      basePrice,
      commissionType,
      commissionValue
    ),
    active: input.active ?? true,
    notes: cleanOptionalValue(input.notes)
  };
}

async function getCurrentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function writeCommissionHistory(
  action: string,
  rule: ProfessionalCommissionInsert & { id?: string },
  previousRule?: ProfessionalCommission | null,
  reason?: string
) {
  const supabase = await createClient();
  const changedBy = await getCurrentUserId();

  await supabase.from("professional_service_commission_history").insert({
    commission_id: rule.id ?? null,
    professional_id: rule.professional_id,
    service_id: rule.service_id,
    old_value: previousRule?.commission_value ?? null,
    new_value: rule.commission_value,
    changed_by: changedBy,
    reason: cleanOptionalValue(reason) ?? action
  });
}

export async function createEmployee(
  input: EmployeeFormInput
): Promise<EmployeeActionResult> {
  try {
    await assertCan("funcionarios", "create");
    const supabase = await createClient();
    const payload = getEmployeePayload(input);
    const clinicScope = await getCurrentClinicScope();
    if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
      throw new Error("Usuario sem clinica vinculada.");
    }
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      payload.clinic_id = clinicScope.clinicId;
    }
    if (isAdmRole(payload.role)) {
      throw new Error("Use Permissoes de Usuarios para definir ADM Master.");
    }
    await syncEmployeeAuthUser(payload);
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
    await assertCan("funcionarios", "edit");
    const supabase = await createClient();
    const payload = getEmployeePayload(input) satisfies EmployeeUpdate;
    const clinicScope = await getCurrentClinicScope();
    if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
      throw new Error("Usuario sem clinica vinculada.");
    }
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      payload.clinic_id = clinicScope.clinicId;
    }
    if (isAdmRole(payload.role)) {
      throw new Error("Use Permissoes de Usuarios para definir ADM Master.");
    }
    const { data: currentEmployee, error: loadError } = await supabase
      .from("employees")
      .select("login_email")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return { ok: false, message: getErrorMessage(loadError) };
    }

    await syncEmployeeAuthUser(payload, currentEmployee?.login_email ?? null);
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
    await assertCan("funcionarios", "toggle");
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
    await assertCan("funcionarios", "toggle");
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
    await assertCan("funcionarios", "delete");
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

export async function saveProfessionalCommission(
  input: ProfessionalCommissionFormInput
): Promise<EmployeeActionResult> {
  try {
    await assertCan("comissoes", input.id ? "edit" : "create");
    const supabase = await createClient();
    const payload = getCommissionPayload(input);
    const changedBy = await getCurrentUserId();
    let previousRule: ProfessionalCommission | null = null;

    if (input.id) {
      const { data, error: loadError } = await supabase
        .from("professional_service_commissions")
        .select("*")
        .eq("id", input.id)
        .maybeSingle();

      if (loadError) {
        return { ok: false, message: getErrorMessage(loadError) };
      }

      previousRule = data;

      const { error } = await supabase
        .from("professional_service_commissions")
        .update({ ...payload, updated_by: changedBy })
        .eq("id", input.id);

      if (error) {
        return { ok: false, message: getErrorMessage(error) };
      }

      await writeCommissionHistory(
        "updated",
        { ...payload, id: input.id },
        previousRule,
        input.change_reason
      );
      revalidatePath("/funcionarios");
      return { ok: true, message: "Regra de comissao atualizada com sucesso." };
    }

    const { data, error } = await supabase
      .from("professional_service_commissions")
      .insert({ ...payload, created_by: changedBy, updated_by: changedBy })
      .select("*")
      .single();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeCommissionHistory(
      "created",
      { ...payload, id: data.id },
      null,
      input.change_reason
    );
    revalidatePath("/funcionarios");
    return { ok: true, message: "Regra de comissao criada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function setProfessionalCommissionStatus(
  id: string,
  active: boolean,
  reason?: string
): Promise<EmployeeActionResult> {
  try {
    await assertCan("comissoes", "toggle");
    const supabase = await createClient();
    const changedBy = await getCurrentUserId();
    const { data: previousRule, error: loadError } = await supabase
      .from("professional_service_commissions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      return { ok: false, message: getErrorMessage(loadError) };
    }

    const { error } = await supabase
      .from("professional_service_commissions")
      .update({ active, updated_by: changedBy })
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeCommissionHistory(
      active ? "activated" : "deactivated",
      { ...previousRule, active },
      previousRule,
      reason
    );
    revalidatePath("/funcionarios");
    return { ok: true, message: "Status da comissao atualizado." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteProfessionalCommission(
  id: string,
  reason?: string
): Promise<EmployeeActionResult> {
  try {
    await assertCan("comissoes", "delete");
    const supabase = await createClient();
    const { data: previousRule, error: loadError } = await supabase
      .from("professional_service_commissions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      return { ok: false, message: getErrorMessage(loadError) };
    }

    await writeCommissionHistory("deleted", previousRule, previousRule, reason);

    const { error } = await supabase
      .from("professional_service_commissions")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/funcionarios");
    return { ok: true, message: "Regra de comissao excluida definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
