import { EmployeesManager } from "@/components/employees/employees-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type CommissionRule =
  Database["public"]["Tables"]["professional_service_commissions"]["Row"] & {
    employee_name: string;
    service_name: string;
  };
type CommissionHistory =
  Database["public"]["Tables"]["professional_service_commission_history"]["Row"] & {
    employee_name: string;
    service_name: string;
  };

type FuncionariosPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

async function readSupabaseList<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
) {
  try {
    const { data, error } = await query;

    if (error) {
      return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
    }

    return { data: data ?? [], error: undefined };
  } catch (error) {
    return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
  }
}

function appendLoadError(currentError: string | undefined, nextError?: string) {
  if (!nextError) {
    return currentError;
  }

  return currentError ? `${currentError} ${nextError}` : nextError;
}

export default async function FuncionariosPage({
  searchParams
}: FuncionariosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  let employees: Employee[] = [];
  let clinics: Clinic[] = [];
  let services: Service[] = [];
  let rawCommissionRules: Database["public"]["Tables"]["professional_service_commissions"]["Row"][] = [];
  let rawCommissionHistory: Database["public"]["Tables"]["professional_service_commission_history"]["Row"][] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
    const supabase = await createClient();
    let clinicsQuery = supabase
      .from("clinics")
      .select("*")
      .order("name", { ascending: true });
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      clinicsQuery = clinicsQuery.eq("id", clinicScope.clinicId);
    }
    const clinicsResult = await readSupabaseList<Clinic>("clinics", clinicsQuery);
    clinics = clinicsResult.data;
    loadError = appendLoadError(loadError, clinicsResult.error);

    let query = supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      query = query.eq("clinic_id", clinicScope.clinicId);
    }

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

    const [servicesResult, commissionsResult, historyResult] = await Promise.all([
      readSupabaseList<Service>(
        "services",
        (clinicScope.isAdmMaster || !clinicScope.clinicId
          ? supabase.from("services").select("*")
          : supabase.from("services").select("*").eq("clinic_id", clinicScope.clinicId)
        ).order("name", { ascending: true })
      ),
      readSupabaseList<
        Database["public"]["Tables"]["professional_service_commissions"]["Row"]
      >(
        "professional_service_commissions",
        supabase
          .from("professional_service_commissions")
          .select("*")
          .order("created_at", { ascending: false })
      ),
      readSupabaseList<
        Database["public"]["Tables"]["professional_service_commission_history"]["Row"]
      >(
        "professional_service_commission_history",
        supabase
          .from("professional_service_commission_history")
          .select("*")
          .order("created_at", { ascending: false })
      )
    ]);

    services = servicesResult.data;
    rawCommissionRules = commissionsResult.data;
    rawCommissionHistory = historyResult.data;
    loadError = appendLoadError(loadError, servicesResult.error);
    loadError = appendLoadError(loadError, commissionsResult.error);
    loadError = appendLoadError(loadError, historyResult.error);
    } catch (error) {
      loadError = getErrorMessage(error);
    }
  }

  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const visibleEmployeeIds = new Set(employees.map((employee) => employee.id));
  const visibleServiceIds = new Set(services.map((service) => service.id));
  const commissionRules: CommissionRule[] = rawCommissionRules
    .filter(
      (rule) =>
        visibleEmployeeIds.has(rule.professional_id) &&
        visibleServiceIds.has(rule.service_id)
    )
    .map((rule) => ({
      ...rule,
      employee_name:
        employeesById.get(rule.professional_id) ?? "Profissional nao encontrado",
      service_name: servicesById.get(rule.service_id) ?? "Servico nao encontrado"
    }));
  const commissionHistory: CommissionHistory[] = rawCommissionHistory
    .filter(
      (item) =>
        (!item.professional_id || visibleEmployeeIds.has(item.professional_id)) &&
        (!item.service_id || visibleServiceIds.has(item.service_id))
    )
    .map((item) => ({
      ...item,
      employee_name: item.professional_id
        ? employeesById.get(item.professional_id) ?? "Profissional nao encontrado"
        : "-",
      service_name: item.service_id
        ? servicesById.get(item.service_id) ?? "Servico nao encontrado"
        : "-"
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Equipe"
        title="Funcionarios"
        description="Cadastre, edite, busque, ative e inative funcionarios usando dados reais do Supabase."
      />

      <EmployeesManager
        employees={employees}
        clinics={clinics}
        isAdmMaster={clinicScope.isAdmMaster}
        currentClinicId={clinicScope.clinicId}
        services={services}
        commissionRules={commissionRules}
        commissionHistory={commissionHistory}
        initialSearch={search}
        loadError={loadError}
        permissions={permissions.funcionarios}
        commissionPermissions={permissions.comissoes}
      />
    </div>
  );
}
