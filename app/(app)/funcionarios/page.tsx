import { EmployeesManager } from "@/components/employees/employees-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

type FuncionariosPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

export default async function FuncionariosPage({
  searchParams
}: FuncionariosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  let employees: Employee[] = [];
  let loadError: string | undefined;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const term = escapeSearchTerm(search);
      query = query.or(
        `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,role.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      loadError = getErrorMessage(error);
    } else {
      employees = data ?? [];
    }
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Equipe"
        title="Funcionarios"
        description="Cadastre, edite, busque, ative e inative funcionarios usando dados reais do Supabase."
      />

      <EmployeesManager
        employees={employees}
        initialSearch={search}
        loadError={loadError}
      />
    </div>
  );
}
