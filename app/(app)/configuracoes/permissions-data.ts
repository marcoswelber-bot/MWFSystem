import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import {
  getEmptyPermissionMap,
  type PermissionMap
} from "@/lib/permission-modules";
import { isCurrentUserAdmMaster } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type UserPermission = Database["public"]["Tables"]["user_permissions"]["Row"];

export function buildPermissionMaps(
  employees: Employee[],
  permissionRows: UserPermission[]
) {
  const maps: Record<string, PermissionMap> = {};

  for (const employee of employees) {
    const employeePermissions = getEmptyPermissionMap();

    for (const row of permissionRows.filter(
      (permission) => permission.employee_id === employee.id
    )) {
      if (row.module_key in employeePermissions) {
        employeePermissions[row.module_key as keyof PermissionMap] = {
          view: row.can_view,
          create: row.can_create,
          edit: row.can_edit,
          delete: row.can_delete,
          toggle: row.can_toggle,
          export: row.can_export,
          import: row.can_import
        };
      }
    }

    maps[employee.id] = employeePermissions;
  }

  return maps;
}

export async function loadPermissionsPageData() {
  let employees: Employee[] = [];
  let permissionRows: UserPermission[] = [];
  let loadError: string | undefined;
  const isAdmMaster = await isCurrentUserAdmMaster();

  if (!isAdmMaster) {
    return {
      employees,
      initialPermissions: {},
      isAdmMaster,
      loadError: "Apenas o ADM Master pode acessar Permissoes de Usuarios."
    };
  }

  try {
    const supabase = await createClient();
    const [employeesResult, permissionsResult] = await Promise.all([
      supabase.from("employees").select("*").order("name", { ascending: true }),
      supabase.from("user_permissions").select("*")
    ]);

    if (employeesResult.error) {
      loadError = getErrorMessage(employeesResult.error);
    } else {
      employees = employeesResult.data ?? [];
    }

    if (permissionsResult.error) {
      loadError = loadError
        ? `${loadError} ${getErrorMessage(permissionsResult.error)}`
        : getErrorMessage(permissionsResult.error);
    } else {
      permissionRows = permissionsResult.data ?? [];
    }
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  return {
    employees,
    initialPermissions: buildPermissionMaps(employees, permissionRows),
    isAdmMaster,
    loadError
  };
}
