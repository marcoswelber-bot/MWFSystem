"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage, isMissingSupabaseTableError } from "@/lib/supabase/env";
import {
  permissionModules,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";
import { assertAdmMaster, getCurrentEmployee, isAdmRole } from "@/lib/permissions";
import { getCurrentClinicScope } from "@/lib/access-control";

export type PermissionActionResult = {
  ok: boolean;
  message: string;
};

function getPermissionTableErrorMessage(error: unknown) {
  if (isMissingSupabaseTableError(error, "user_permissions")) {
    return "A tabela public.user_permissions nao existe no Supabase de producao. Execute a migration SQL para criar a tabela antes de salvar permissoes.";
  }

  return getErrorMessage(error);
}

async function getEmployeeAccess(employeeId: string, clinicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id,email,role,clinic_id")
    .eq("id", employeeId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function assertSelectedClinic(clinicId: string) {
  const scope = await getCurrentClinicScope();
  if (!scope.isAdmMaster || !scope.clinicId || scope.clinicId !== clinicId) {
    throw new Error("A clinica selecionada nao corresponde ao seu escopo atual.");
  }
}

async function assertCanManageEmployeeAccess(employeeId: string, clinicId: string) {
  const { employee: currentEmployee } = await getCurrentEmployee();
  const targetEmployee = await getEmployeeAccess(employeeId, clinicId);

  if (!targetEmployee || targetEmployee.clinic_id !== clinicId) {
    throw new Error("Funcionario nao pertence a clinica selecionada.");
  }

  if (
    targetEmployee &&
    (isAdmRole(targetEmployee.role) ||
      targetEmployee.id === currentEmployee?.id)
  ) {
    throw new Error("Nao e permitido editar ou remover permissoes do proprio ADM Master.");
  }

  return targetEmployee;
}

export async function saveUserPermissions(
  employeeId: string,
  clinicId: string,
  permissions: Partial<Record<PermissionModuleKey, PermissionSet>>
): Promise<PermissionActionResult> {
  try {
    await assertAdmMaster();
    await assertSelectedClinic(clinicId);

    await assertCanManageEmployeeAccess(employeeId, clinicId);

    const supabase = await createClient();
    const rows = permissionModules.map((module) => {
      const permission = permissions[module.key];

      return {
        employee_id: employeeId,
        module_key: module.key,
        can_view: Boolean(permission?.view),
        can_create: Boolean(permission?.create),
        can_edit: Boolean(permission?.edit),
        can_delete: Boolean(permission?.delete),
        can_toggle: Boolean(permission?.toggle),
        can_export: Boolean(permission?.export),
        can_import: Boolean(permission?.import)
      };
    });

    const { error } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "employee_id,module_key" });

    if (error) {
      return { ok: false, message: getPermissionTableErrorMessage(error) };
    }

    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/permissoes");
    return { ok: true, message: "Permissões salvas com sucesso" };
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("[Permissoes] Falha ao salvar", error);
    return { ok: false, message: getErrorMessage(error) };
  }
}
