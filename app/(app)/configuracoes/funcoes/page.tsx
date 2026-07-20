import type { Route } from "next";
import { EntityCrudManager, type EntityRecord } from "@/components/entity-crud-manager";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";

type Props = { searchParams: Promise<{ q?: string }> };
type RoleRow = { id: string; clinic_id: string; name: string; description: string | null; status: string; created_at: string; updated_at: string; clinic_name?: string };

export default async function FuncoesPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const scope = await getCurrentClinicScope();
  const permissions = await getCurrentPermissionMap();
  const supabase = await createClient();
  let query = supabase.from("employee_roles").select("*").order("name");
  if (scope.clinicId) query = query.eq("clinic_id", scope.clinicId);
  if (q.trim()) query = query.ilike("name", `%${q.trim().replaceAll("%", "\\%")}%`);
  const [{ data, error }, { data: clinics }] = await Promise.all([
    query,
    scope.isAdmMaster ? supabase.from("clinics").select("id,name").order("name") : Promise.resolve({ data: [] })
  ]);
  const clinicNames = new Map((clinics ?? []).map((item) => [item.id, item.name]));
  const rows = (data ?? []) as RoleRow[];
  const records: EntityRecord[] = rows.map((role) => ({
    ...role,
    clinic_name: clinicNames.get(role.clinic_id) ?? "Clinica atual",
    status_label: role.status === "active" ? "Ativa" : "Inativa"
  }));
  const safePermissions = { ...permissions.funcoes, delete: false };

  return <div>
    <PageHeader eyebrow="Cadastros" title="Funcoes" description="Cadastre cargos por clinica e preserve o historico por inativacao." />
    <EntityCrudManager
      table="employee_roles" basePath={"/configuracoes/funcoes" as Route}
      entityLabel="funcao" entityLabelPlural="Funcoes" newButtonLabel="Nova funcao"
      searchPlaceholder="Buscar por nome" records={records} initialSearch={q}
      loadError={error ? getErrorMessage(error) : undefined} permissions={safePermissions}
      fields={[
        ...(scope.isAdmMaster ? [{ name: "clinic_id", label: "Clinica", type: "select" as const, required: true, options: (clinics ?? []).map((clinic) => ({ label: clinic.name, value: clinic.id })) }] : []),
        { name: "name", label: "Nome da funcao", required: true },
        { name: "description", label: "Descricao", type: "textarea" as const }
      ]}
      columns={[
        ...(scope.isAdmMaster ? [{ key: "clinic_name", label: "Clinica" }] : []),
        { key: "name", label: "Nome" }, { key: "description", label: "Descricao" }, { key: "status_label", label: "Status" }
      ]}
    />
  </div>;
}
