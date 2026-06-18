import { PageHeader } from "@/components/page-header";
import { PatientsManager } from "@/components/patients/patients-manager";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

type PacientesPageProps = {
  searchParams: Promise<{
    new?: string;
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

export default async function PacientesPage({
  searchParams
}: PacientesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  let patients: Patient[] = [];
  let loadError: string | undefined;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const term = escapeSearchTerm(search);
      query = query.or(
        `full_name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      loadError = getErrorMessage(error);
    } else {
      patients = data ?? [];
    }
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cadastro clinico"
        title="Pacientes"
        description="Cadastre, edite, busque e inative pacientes usando dados reais do Supabase."
      />

      <PatientsManager
        patients={patients}
        initialFormOpen={params.new === "1"}
        initialSearch={search}
        loadError={loadError}
      />
    </div>
  );
}
