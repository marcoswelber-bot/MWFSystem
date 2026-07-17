import { FinanceManager } from "@/components/finance/finance-manager";
import { ActionableAlertsWrapper } from "@/components/actionable-alerts-wrapper";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getFinanceiroActionableAlerts } from "@/lib/module-alerts";
import { getCurrentPermissionMap, isCurrentUserAdmMaster } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FinancialStatus } from "@/app/(app)/financeiro/actions";
import type { Database } from "@/types/database";

type FinancialTransaction =
  Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type PaymentSettlement = Database["public"]["Tables"]["payment_settlements"]["Row"];

type HydratedFinancialTransaction = FinancialTransaction & {
  clinic_name: string;
  patient_name: string;
  employee_name: string;
  service_name: string;
  derived_status: FinancialStatus;
};

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

async function readSupabaseList<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
) {
  try {
    const { data, error } = await query;

    if (error) {
      return {
        data: [],
        error: `[${label}] ${getErrorMessage(error)}`
      };
    }

    return {
      data: data ?? [],
      error: undefined
    };
  } catch (error) {
    return {
      data: [],
      error: `[${label}] ${getErrorMessage(error)}`
    };
  }
}

function getDerivedStatus(item: FinancialTransaction): FinancialStatus {
  if (item.commission_status === "generated" && item.status === "pendente") {
    return "pendente";
  }

  if (item.status === "pendente" && item.due_date < new Date().toISOString().slice(0, 10)) {
    return "vencido";
  }

  return item.status as FinancialStatus;
}

export default async function FinanceiroPage() {
  const permissions = await getCurrentPermissionMap();
  const isAdmMaster = await isCurrentUserAdmMaster();
  const clinicScope = await getCurrentClinicScope();
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let employees: Employee[] = [];
  let settlements: PaymentSettlement[] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuário sem clínica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;

      const clinicsQuery = clinicFilter
        ? supabase.from("clinics").select("*").eq("id", clinicFilter)
        : supabase.from("clinics").select("*");

      const transactionsQuery = clinicFilter
        ? supabase
            .from("financial_transactions")
            .select("*")
            .eq("clinic_id", clinicFilter)
        : supabase.from("financial_transactions").select("*");

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      const employeesQuery = clinicFilter
        ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("employees").select("*");

      const settlementsQuery = clinicFilter
        ? supabase
            .from("payment_settlements")
            .select("*,financial_transactions!inner(clinic_id)")
            .eq("financial_transactions.clinic_id", clinicFilter)
        : supabase.from("payment_settlements").select("*");

      const [transactionsResult, clinicsResult, patientsResult, servicesResult, employeesResult, settlementsResult] =
        await Promise.all([
          readSupabaseList<FinancialTransaction>(
            "financial_transactions",
            transactionsQuery.order("due_date", { ascending: false })
          ),
          readSupabaseList<Clinic>(
            "clinics",
            clinicsQuery.order("name", { ascending: true })
          ),
          readSupabaseList<Patient>(
            "patients",
            patientsQuery.order("full_name", { ascending: true })
          ),
          readSupabaseList<Service>(
            "services",
            servicesQuery.order("name", { ascending: true })
          ),
          readSupabaseList<Employee>(
            "employees",
            employeesQuery.order("name", { ascending: true })
          ),
          readSupabaseList<PaymentSettlement>(
            "payment_settlements",
            settlementsQuery.order("paid_at", { ascending: false })
          )
        ]);

      transactions = transactionsResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;
      employees = employeesResult.data;
      settlements = settlementsResult.data;

      [
        transactionsResult.error,
        clinicsResult.error,
        patientsResult.error,
        servicesResult.error,
        employeesResult.error,
        settlementsResult.error
      ].forEach((error) => {
        if (error) {
          loadError = appendLoadError(loadError, error);
        }
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const patientsById = new Map(
    patients.map((patient) => [patient.id, patient.full_name])
  );
  const patientsByDetails = new Map(patients.map((patient) => [patient.id, patient]));
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );

  const hydratedTransactions: HydratedFinancialTransaction[] = transactions.map(
    (item) => ({
      ...item,
      clinic_name: clinicsById.get(item.clinic_id) ?? "Clínica nao encontrada",
      patient_name: item.patient_id
        ? patientsById.get(item.patient_id) ?? "Paciente nao encontrado"
        : "-",
      patient_phone: item.patient_id ? patientsByDetails.get(item.patient_id)?.phone ?? null : null,
      patient_cpf: item.patient_id ? patientsByDetails.get(item.patient_id)?.cpf ?? null : null,
      employee_name: item.employee_id
        ? employeesById.get(item.employee_id) ?? "Funcionário não encontrado"
        : "-",
      service_name: item.service_id
        ? servicesById.get(item.service_id) ?? "Serviço não encontrado"
        : "-",
      derived_status: getDerivedStatus(item)
    })
  );

  const financeAlerts = await getFinanceiroActionableAlerts();

  return (
    <div>
      <PageHeader
        eyebrow="Gestao financeira"
        title="Financeiro"
        description="Controle receitas, despesas e movimentações da clínica com estrutura preparada para Agenda e Pacotes futuros."
      />

      <ActionableAlertsWrapper alerts={financeAlerts} />

      <FinanceManager
        transactions={hydratedTransactions}
        settlements={settlements}
        clinics={clinics}
        patients={patients}
        services={services}
        employees={employees}
        currentClinicId={clinicScope.clinicId}
        isAdmMaster={isAdmMaster}
        loadError={loadError}
        permissions={permissions.financeiro}
      />
    </div>
  );
}
