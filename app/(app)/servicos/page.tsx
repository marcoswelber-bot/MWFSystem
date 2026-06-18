import { EntityCrudManager, type EntityRecord } from "@/components/entity-crud-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type ServicosPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

function toEntityRecord(service: Service): EntityRecord {
  return {
    id: service.id,
    clinic_id: service.clinic_id,
    name: service.name,
    type: service.type,
    price: service.price,
    duration_minutes: service.duration_minutes,
    allows_package: service.allows_package,
    commission_type: service.commission_type,
    commission_value: service.commission_value,
    status: service.status,
    created_at: service.created_at,
    updated_at: service.updated_at
  };
}

export default async function ServicosPage({ searchParams }: ServicosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  let services: Service[] = [];
  let loadError: string | undefined;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const term = escapeSearchTerm(search);
      query = query.or(`name.ilike.%${term}%,type.ilike.%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      loadError = getErrorMessage(error);
    } else {
      services = data ?? [];
    }
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogo"
        title="Servicos"
        description="Estruture procedimentos, consultas, pacotes, precos e duracao usando dados reais do Supabase."
      />

      <EntityCrudManager
        table="services"
        basePath="/servicos"
        entityLabel="servico"
        entityLabelPlural="Servicos"
        newButtonLabel="Novo servico"
        searchPlaceholder="Buscar por nome ou tipo"
        records={services.map(toEntityRecord)}
        initialSearch={search}
        loadError={loadError}
        fields={[
          { name: "name", label: "Nome", required: true },
          { name: "type", label: "Tipo" },
          { name: "price", label: "Preco", type: "number" },
          { name: "duration_minutes", label: "Duracao em minutos", type: "number" },
          { name: "allows_package", label: "Permite pacote", type: "checkbox" },
          { name: "commission_type", label: "Tipo de comissao" },
          { name: "commission_value", label: "Valor da comissao", type: "number" }
        ]}
        columns={[
          { key: "name", label: "Nome" },
          { key: "type", label: "Tipo" },
          { key: "price", label: "Preco" },
          { key: "duration_minutes", label: "Duracao" },
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
