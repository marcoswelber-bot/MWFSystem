import { EntityCrudManager, type EntityRecord } from "@/components/entity-crud-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

type ClinicasPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

function toEntityRecord(clinic: Clinic): EntityRecord {
  return {
    id: clinic.id,
    name: clinic.name,
    phone: clinic.phone,
    whatsapp: clinic.whatsapp,
    email: clinic.email,
    cnpj: clinic.cnpj,
    address: clinic.address,
    status: clinic.status,
    created_at: clinic.created_at,
    updated_at: clinic.updated_at
  };
}

export default async function ClinicasPage({ searchParams }: ClinicasPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  let clinics: Clinic[] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
    const supabase = await createClient();
    let query = supabase
      .from("clinics")
      .select("*")
      .order("created_at", { ascending: false });

    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      query = query.eq("id", clinicScope.clinicId);
    }

    if (search) {
      const term = escapeSearchTerm(search);
      query = query.or(
        `name.ilike.%${term}%,cnpj.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      loadError = getErrorMessage(error);
    } else {
      clinics = data ?? [];
    }
    } catch (error) {
      loadError = getErrorMessage(error);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Multiclinica"
        title="Clinicas"
        description="Cadastre unidades, contatos e dados operacionais usando registros reais do Supabase."
      />

      <EntityCrudManager
        table="clinics"
        basePath="/clinicas"
        entityLabel="clinica"
        entityLabelPlural="Clinicas"
        newButtonLabel="Nova clinica"
        searchPlaceholder="Buscar por nome, CNPJ, telefone ou email"
        records={clinics.map(toEntityRecord)}
        initialSearch={search}
        loadError={loadError}
        permissions={permissions.clinicas}
        fields={[
          { name: "name", label: "Nome", required: true },
          { name: "cnpj", label: "CNPJ" },
          { name: "phone", label: "Telefone" },
          { name: "whatsapp", label: "WhatsApp" },
          { name: "email", label: "Email", type: "email" },
          { name: "address", label: "Endereco", type: "textarea" }
        ]}
        columns={[
          { key: "name", label: "Nome" },
          { key: "cnpj", label: "CNPJ" },
          { key: "phone", label: "Telefone" },
          { key: "email", label: "Email" },
          {
            key: "status",
            label: "Status",
            render: (record) => (record.status === "active" ? "Ativo" : "Inativo")
          }
        ]}
      />
    </div>
  );
}
