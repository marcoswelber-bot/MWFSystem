import { Building2, KeyRound, Settings, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { UserPermissionsManager } from "@/components/settings/user-permissions-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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

function buildPermissionMaps(
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
          toggle: row.can_toggle
        };
      }
    }

    maps[employee.id] = employeePermissions;
  }

  return maps;
}

export default async function ConfiguracoesPage() {
  let employees: Employee[] = [];
  let permissionRows: UserPermission[] = [];
  let loadError: string | undefined;
  const isAdmMaster = await isCurrentUserAdmMaster();

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

  return (
    <div>
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes"
        description="Defina clinicas, permissoes, cargos, integracoes e regras globais do sistema."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <ModuleCard title="Clinicas" description="Unidades cadastradas" icon={Building2} value="04" />
        <ModuleCard title="Permissoes" description="Acessos por usuario" icon={ShieldCheck} value="ACL" />
        <ModuleCard title="Integracoes" description="Supabase e servicos" icon={Settings} value="01" />
        <ModuleCard title="Seguranca" description="Politicas e RLS" icon={KeyRound} value="RLS" />
      </section>

      {loadError ? (
        <div className="mt-6 rounded-md border border-destructive p-4 text-destructive">
          {loadError}
        </div>
      ) : null}

      <UserPermissionsManager
        employees={employees}
        initialPermissions={buildPermissionMaps(employees, permissionRows)}
        isAdmMaster={isAdmMaster}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Modelo de cargos</CardTitle>
          <CardDescription>
            ADM Master tem acesso total. Os demais cargos dependem das permissoes liberadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {[
            ["ADM MASTER", "Acesso total e permanente ao sistema."],
            ["Administrador", "Acesso conforme modulos liberados pelo ADM Master."],
            ["Gerente", "Acesso conforme rotina gerencial liberada."],
            ["Recepcao", "Acesso operacional liberado pelo ADM Master."],
            ["Profissional", "Acesso clinico/operacional liberado pelo ADM Master."]
          ].map(([role, description]) => (
            <div key={role} className="rounded-md border p-4">
              <p className="font-semibold">{role}</p>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
