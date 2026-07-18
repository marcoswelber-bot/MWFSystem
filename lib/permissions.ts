import { createClient } from "@/lib/supabase/server";
import {
  getEmptyPermissionMap,
  getFullPermissionMap,
  isAdmRole,
  type PermissionAction,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";
import { getCurrentAccessProfile } from "@/lib/access-control";
import type { Database } from "@/types/database";
import { cache } from "react";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type UserPermission = Database["public"]["Tables"]["user_permissions"]["Row"];

export { getEmptyPermissionMap, getFullPermissionMap, isAdmRole };
export type { PermissionMap } from "@/lib/permission-modules";

function rowToPermissionSet(row: UserPermission): PermissionSet {
  return {
    view: row.can_view,
    create: row.can_create,
    edit: row.can_edit,
    delete: row.can_delete,
    toggle: row.can_toggle,
    export: row.can_export,
    import: row.can_import
  };
}

export const getCurrentEmployee = cache(async function getCurrentEmployee() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user, employee: null as Employee | null };
  }

  const profile = await getCurrentAccessProfile();
  return { user, employee: profile?.employee ?? null };
});

export const isCurrentUserAdmMaster = cache(async function isCurrentUserAdmMaster() {
  const { employee } = await getCurrentEmployee();
  return Boolean(
    employee?.status === "active" &&
      employee.system_access &&
      isAdmRole(employee.role)
  );
});

export const getCurrentPermissionMap = cache(async function getCurrentPermissionMap() {
  if (await isCurrentUserAdmMaster()) {
    return getFullPermissionMap();
  }

  const { employee } = await getCurrentEmployee();

  if (!employee) {
    return getEmptyPermissionMap();
  }

  return getPermissionMapForEmployee(employee.id);
});

export const getPermissionMapForEmployee = cache(async function getPermissionMapForEmployee(employeeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("employee_id", employeeId);

  const permissions = getEmptyPermissionMap();

  for (const row of data ?? []) {
    if (row.module_key in permissions) {
      permissions[row.module_key as PermissionModuleKey] = rowToPermissionSet(row);
    }
  }

  return permissions;
});

export async function canCurrentUser(
  moduleKey: PermissionModuleKey,
  action: PermissionAction
) {
  if (await isCurrentUserAdmMaster()) {
    return true;
  }

  const permissions = await getCurrentPermissionMap();
  return Boolean(permissions[moduleKey]?.[action]);
}

export async function assertCan(
  moduleKey: PermissionModuleKey,
  action: PermissionAction
) {
  if (!(await canCurrentUser(moduleKey, action))) {
    throw new Error("Voce nao tem permissao para executar esta acao.");
  }
}

export async function assertAdmMaster() {
  if (!(await isCurrentUserAdmMaster())) {
    throw new Error("Apenas o ADM Master pode executar esta acao.");
  }
}
export async function canReopenAppointments() {
  if (await isCurrentUserAdmMaster()) {
    return true;
  }

  const { employee } = await getCurrentEmployee();
  const role = employee?.role
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (!employee || !["clinic_admin", "admin", "administrador"].includes(role ?? "")) {
    return false;
  }

  return (await getPermissionMapForEmployee(employee.id)).agenda.edit;
}
