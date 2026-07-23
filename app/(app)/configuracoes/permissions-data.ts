import { createClient } from "@/lib/supabase/server";
import { getErrorMessage, isMissingSupabaseTableError } from "@/lib/supabase/env";
import {
  getEmptyPermissionMap,
  type PermissionMap
} from "@/lib/permission-modules";
import { isCurrentUserAdmMaster } from "@/lib/permissions";
import { getCurrentClinicScope } from "@/lib/access-control";
import type { Database } from "@/types/database";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type UserPermission = Database["public"]["Tables"]["user_permissions"]["Row"];

export function buildPermissionMaps(
  employees: Employee[] = [],
  permissionRows: UserPermission[] = []
) {
  const maps: Record<string, PermissionMap> = {};

  for (const employee of employees.filter((item) => Boolean(item?.id))) {
    const employeePermissions = getEmptyPermissionMap();

    for (const row of permissionRows.filter(
      (permission) => permission?.employee_id === employee.id
    )) {
      if (row.module_key in employeePermissions) {
        employeePermissions[row.module_key as keyof PermissionMap] = {
          view: Boolean(row.can_view),
          create: Boolean(row.can_create),
          edit: Boolean(row.can_edit),
          delete: Boolean(row.can_delete),
          toggle: Boolean(row.can_toggle),
          export: Boolean(row.can_export),
          import: Boolean(row.can_import)
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
  const scope = await getCurrentClinicScope();

  if (!isAdmMaster) {
    return {
      employees,
      initialPermissions: {},
      isAdmMaster,
      activeClinic: null,
      loadError: "Apenas o ADM Master pode acessar Permissoes de Usuarios."
    };
  }

  if (!scope.clinicId) {
    return {
      employees,
      initialPermissions: {},
      isAdmMaster,
      activeClinic: null,
      loadError
    };
  }

  try {
    const supabase = await createClient();
    const [clinicResult, employeesResult] = await Promise.all([
      supabase.from("clinics").select("id,name").eq("id", scope.clinicId).maybeSingle(),
      supabase.from("employees").select("*").eq("clinic_id", scope.clinicId).order("name", { ascending: true })
    ]);

    if (employeesResult.error) {
      loadError = getErrorMessage(employeesResult.error);
    } else {
      employees = Array.isArray(employeesResult.data) ? employeesResult.data : [];
    }

    const employeeIds = employees.map((employee) => employee.id);
    const permissionsResult = employeeIds.length
      ? await supabase.from("user_permissions").select("*").in("employee_id", employeeIds)
      : { data: [], error: null };

    if (permissionsResult.error) {
      const permissionsError = isMissingSupabaseTableError(
        permissionsResult.error,
        "user_permissions"
      )
        ? "A tabela public.user_permissions ainda nao existe no Supabase de producao. A pagina foi carregada com permissoes vazias ate a tabela ser criada."
        : getErrorMessage(permissionsResult.error);

      loadError = loadError ? `${loadError} ${permissionsError}` : permissionsError;
    } else {
      permissionRows = Array.isArray(permissionsResult.data)
        ? permissionsResult.data
        : [];
    }
    const activeClinic = clinicResult.data ?? null;
    if (clinicResult.error || !activeClinic) {
      loadError = loadError ?? "Nao foi possivel validar a clinica selecionada.";
    }
    return {
      employees,
      initialPermissions: buildPermissionMaps(employees, permissionRows),
      isAdmMaster,
      activeClinic,
      loadError
    };
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  return {
    employees,
    initialPermissions: buildPermissionMaps(employees, permissionRows),
    isAdmMaster,
    activeClinic: null,
    loadError
  };
}
