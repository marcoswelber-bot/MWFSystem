import { SettlementsManager } from "@/components/finance/settlements-manager";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { isCurrentUserAdmMaster } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FinancialStatus } from "@/app/(app)/financeiro/actions";
import type { Database } from "@/types/database";

type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

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
    if (error) return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
    return { data: data ?? [], error: undefined };
  } catch (error) {
    return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
  }
}

function getDerivedStatus(item: FinancialTransaction): FinancialStatus {
  const row = item as FinancialTransaction & { paid_amount?: number | null };
  if (item.status === "cancelado") return "cancelado";
  if (item.status === "pago") return "pago";
  if (item.status === "parcial" || (typeof row.paid_amount === "number" && row.paid_amount > 0)) return "parcial";
  if (item.status === "pendente" && item.due_date < new Date().toISOString().slice(0, 10)) return "vencido";
  return item.status as FinancialStatus;
}

export default async function BaixasFinanceiroPage() {
  const isAdmMaster = await isCurrentUserAdmMaster();
  const clinicScope = await getCurrentClinicScope();
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let employees: Employee[] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuário sem clínica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;
      const clinicsQuery = clinicFilter ? supabase.from("clinics").select("*").eq("id", clinicFilter) : supabase.from("clinics").select("*");
      const transactionsQuery = clinicFilter ? supabase.from("financial_transactions").select("*").eq("clinic_id", clinicFilter) : supabase.from("financial_transactions").select("*");
      const patientsQuery = clinicFilter ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter) : supabase.from("patients").select("*");
      const servicesQuery = clinicFilter ? supabase.from("services").select("*").eq("clinic_id", clinicFilter) : supabase.from("services").select("*");
      const employeesQuery = clinicFilter ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter) : supabase.from("employees").select("*");

      const [transactionsResult, clinicsResult, patientsResult, servicesResult, employeesResult] = await Promise.all([
        readSupabaseList<FinancialTransaction>("financial_transactions", transactionsQuery.order("due_date", { ascending: true })),
        readSupabaseList<Clinic>("clinics", clinicsQuery.order("name", { ascending: true })),
        readSupabaseList<Patient>("patients", patientsQuery.order("full_name", { ascending: true })),
        readSupabaseList<Service>("services", servicesQuery.order("name", { ascending: true })),
        readSupabaseList<Employee>("employees", employeesQuery.order("name", { ascending: true }))
      ]);

      transactions = transactionsResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;
      employees = employeesResult.data;
      [transactionsResult.error, clinicsResult.error, patientsResult.error, servicesResult.error, employeesResult.error].forEach((error) => {
        if (error) loadError = appendLoadError(loadError, error);
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const patientsById = new Map(patients.map((patient) => [patient.id, patient.full_name]));
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const employeesById = new Map(employees.map((employee) => [employee.id, employee.name]));

  const hydratedTransactions: HydratedFinancialTransaction[] = transactions.map((item) => ({
    ...item,
    clinic_name: clinicsById.get(item.clinic_id) ?? "Clínica nao encontrada",
    patient_name: item.patient_id ? patientsById.get(item.patient_id) ?? "Paciente nao encontrado" : "-",
    employee_name: item.employee_id ? employeesById.get(item.employee_id) ?? "Funcionário não encontrado" : "-",
    service_name: item.service_id ? servicesById.get(item.service_id) ?? "Serviço não encontrado" : "-",
    derived_status: getDerivedStatus(item)
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Operacao financeira"
        title="Baixas e Repasses"
        description="Controle de recebimentos de pacientes e pagamentos de funcionarios"
      />
      <SettlementsManager
        transactions={hydratedTransactions}
        clinics={clinics}
        patients={patients}
        services={services}
        employees={employees}
        isAdmMaster={isAdmMaster}
        loadError={loadError}
      />
    </div>
  );
}
