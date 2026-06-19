import { PageHeader } from "@/components/page-header";
import { UserPermissionsManager } from "@/components/settings/user-permissions-manager";
import { loadPermissionsPageData } from "@/app/(app)/configuracoes/permissions-data";

export default async function PermissoesUsuariosPage() {
  const { employees, initialPermissions, isAdmMaster, loadError } =
    await loadPermissionsPageData();

  if (!isAdmMaster) {
    return (
      <div>
        <PageHeader
          eyebrow="Configuracoes"
          title="Permissoes de Usuarios"
          description="Controle quais modulos e acoes cada funcionario pode visualizar e executar."
        />

        <div className="mt-6 rounded-md border border-destructive p-4 text-destructive">
          {loadError ?? "Apenas o ADM Master pode acessar Permissoes de Usuarios."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Configuracoes"
        title="Permissoes de Usuarios"
        description="Controle quais modulos e acoes cada funcionario pode visualizar e executar."
      />

      {loadError ? (
        <div className="mt-6 rounded-md border border-destructive p-4 text-destructive">
          {loadError}
        </div>
      ) : null}

      <UserPermissionsManager
        employees={employees}
        initialPermissions={initialPermissions}
        isAdmMaster={isAdmMaster}
      />
    </div>
  );
}
