"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import {
  permissionModules,
  getEmptyPermissionMap,
  isAdmEmail,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";
import { assertAdmMaster, getCurrentEmployee, isAdmRole } from "@/lib/permissions";
import type { Database } from "@/types/database";

type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

export type PermissionActionResult = {
  ok: boolean;
  message: string;
};

export const userRoles = [
  "ADM MASTER",
  "Administrador",
  "Gerente",
  "Recepcao",
  "Profissional"
] as const;

export type UserRoleName = (typeof userRoles)[number];

function normalizeRole(role?: string | null) {
  return role
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function toStoredRole(role: string) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "adm_master") {
    return "adm_master";
  }

  if (normalizedRole === "admin_master") {
    return "adm_master";
  }

  if (normalizedRole === "administrador") {
    return "Administrador";
  }

  if (normalizedRole === "gerente") {
    return "Gerente";
  }

  if (normalizedRole === "recepcao") {
    return "Recepcao";
  }

  if (normalizedRole === "profissional") {
    return "Profissional";
  }

  throw new Error("Cargo invalido.");
}

async function getEmployeeAccess(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id,email,role")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function assertCanManageEmployeeAccess(employeeId: string) {
  const { user, employee: currentEmployee } = await getCurrentEmployee();
  const targetEmployee = await getEmployeeAccess(employeeId);

  if (
    targetEmployee &&
    (isAdmRole(targetEmployee.role) ||
      isAdmEmail(targetEmployee.email) ||
      targetEmployee.id === currentEmployee?.id ||
      targetEmployee.email?.toLowerCase() === user?.email?.toLowerCase())
  ) {
    throw new Error("Nao e permitido editar ou remover permissoes do proprio ADM Master.");
  }

  return targetEmployee;
}

export async function updateEmployeeRole(
  employeeId: string,
  role: string
): Promise<PermissionActionResult> {
  try {
    await assertAdmMaster();

    const { user, employee: currentEmployee } = await getCurrentEmployee();
    const targetEmployee = await getEmployeeAccess(employeeId);
    const currentRole = targetEmployee?.role ?? null;
    const nextRole = toStoredRole(role);

    if (
      targetEmployee?.id === currentEmployee?.id ||
      targetEmployee?.email?.toLowerCase() === user?.email?.toLowerCase()
    ) {
      throw new Error("Nao e permitido alterar o proprio cargo do ADM Master.");
    }

    if (
      (isAdmRole(currentRole) || isAdmEmail(targetEmployee?.email)) &&
      nextRole !== "adm_master"
    ) {
      throw new Error("O ADM Master nao pode perder o acesso total.");
    }

    if (isAdmEmail(targetEmployee?.email) && nextRole !== "adm_master") {
      throw new Error("O usuario admin@clinica.com deve permanecer ADM Master.");
    }

    const payload: EmployeeUpdate = { role: nextRole };
    const supabase = await createClient();
    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", employeeId);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/configuracoes");
    return { ok: true, message: "Cargo atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function saveUserPermissions(
  employeeId: string,
  permissions: Partial<Record<PermissionModuleKey, PermissionSet>>
): Promise<PermissionActionResult> {
  try {
    await assertAdmMaster();

    await assertCanManageEmployeeAccess(employeeId);

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
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/configuracoes");
    return { ok: true, message: "Permissoes salvas com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function copyUserPermissions(
  sourceEmployeeId: string,
  targetEmployeeId: string
): Promise<PermissionActionResult> {
  try {
    await assertAdmMaster();

    await assertCanManageEmployeeAccess(targetEmployeeId);

    const supabase = await createClient();
    const { data, error: loadError } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("employee_id", sourceEmployeeId);

    if (loadError) {
      return { ok: false, message: getErrorMessage(loadError) };
    }

    const rows = permissionModules.map((module) => {
      const source = data?.find((row) => row.module_key === module.key);

      return {
        employee_id: targetEmployeeId,
        module_key: module.key,
        can_view: Boolean(source?.can_view),
        can_create: Boolean(source?.can_create),
        can_edit: Boolean(source?.can_edit),
        can_delete: Boolean(source?.can_delete),
        can_toggle: Boolean(source?.can_toggle),
        can_export: Boolean(source?.can_export),
        can_import: Boolean(source?.can_import)
      };
    });

    const { error } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "employee_id,module_key" });

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/configuracoes");
    return { ok: true, message: "Permissoes copiadas com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function restoreDefaultUserPermissions(
  employeeId: string
): Promise<PermissionActionResult> {
  return saveUserPermissions(employeeId, getEmptyPermissionMap());
}
