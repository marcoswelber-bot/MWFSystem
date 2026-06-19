"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import {
  permissionModules,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";
import { assertAdmMaster, isAdmRole } from "@/lib/permissions";
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

async function getEmployeeRole(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("role")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role ?? null;
}

export async function updateEmployeeRole(
  employeeId: string,
  role: string
): Promise<PermissionActionResult> {
  try {
    await assertAdmMaster();

    const currentRole = await getEmployeeRole(employeeId);
    const nextRole = toStoredRole(role);

    if (isAdmRole(currentRole) && nextRole !== "adm_master") {
      throw new Error("O ADM Master nao pode perder o proprio acesso total.");
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

    const currentRole = await getEmployeeRole(employeeId);

    if (isAdmRole(currentRole)) {
      throw new Error("O ADM Master sempre tem acesso total e nao deve ser limitado.");
    }

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
        can_toggle: Boolean(permission?.toggle)
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

    const targetRole = await getEmployeeRole(targetEmployeeId);

    if (isAdmRole(targetRole)) {
      throw new Error("O ADM Master sempre tem acesso total e nao deve ser limitado.");
    }

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
        can_toggle: Boolean(source?.can_toggle)
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
