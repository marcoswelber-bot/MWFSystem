import { CommissionDetailReport } from "@/components/finance/commission-detail-report";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FinancialStatus } from "@/app/(app)/financeiro/actions";
import type { Database } from "@/types/database";

type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function getDerivedStatus(item: FinancialTransaction): FinancialStatus {
  if (item.status === "pendente" && item.due_date < today()) return "vencido";
  return item.status as FinancialStatus;
}

async function readSupabaseList<T>(label: string, query: PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const { data, error } = await query;
    if (error) return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
    return { data: data ?? [], error: undefined };
  } catch (error) {
    return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
  }
}

export default async function CommissionDetailPage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ inicio?: string; fim?: string; clinica?: string }> }) {
  const { employeeId } = await params;
  const filters = await searchParams;
  const start = filters.inicio || monthStart();
  const end = filters.fim || monthEnd();
  const clinicScope = await getCurrentClinicScope();
  const clinicFilter = clinicScope.clinicId || filters.clinica || null;
  let loadError: string | undefined;
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let employees: Employee[] = [];

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuário sem clínica vinculada.";
  } else {
    const supabase = await createClient();
    const txQuery = clinicFilter
      ? supabase.from("financial_transactions").select("*").eq("clinic_id", clinicFilter)
      : supabase.from("financial_transactions").select("*");
    const clinicsQuery = clinicFilter ? supabase.from("clinics").select("*").eq("id", clinicFilter) : supabase.from("clinics").select("*");
    const patientsQuery = clinicFilter ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter) : supabase.from("patients").select("*");
    const servicesQuery = clinicFilter ? supabase.from("services").select("*").eq("clinic_id", clinicFilter) : supabase.from("services").select("*");
    const employeesQuery = clinicFilter ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter) : supabase.from("employees").select("*");

    const [txResult, clinicsResult, patientsResult, servicesResult, employeesResult] = await Promise.all([
      readSupabaseList<FinancialTransaction>("financial_transactions", txQuery.eq("employee_id", employeeId).eq("transaction_type", "despesa").eq("commission_status", "generated").gte("due_date", start).lte("due_date", end).order("due_date", { ascending: false })),
      readSupabaseList<Clinic>("clinics", clinicsQuery),
      readSupabaseList<Patient>("patients", patientsQuery),
      readSupabaseList<Service>("services", servicesQuery),
      readSupabaseList<Employee>("employees", employeesQuery)
    ]);

    transactions = txResult.data;
    clinics = clinicsResult.data;
    patients = patientsResult.data;
    services = servicesResult.data;
    employees = employeesResult.data;
    loadError = [txResult.error, clinicsResult.error, patientsResult.error, servicesResult.error, employeesResult.error].filter(Boolean).join(" ") || undefined;
  }

  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const patientsById = new Map(patients.map((patient) => [patient.id, patient.full_name]));
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const employee = employees.find((item) => item.id === employeeId);
  const rows = transactions.map((item) => ({
    id: item.id,
    appointmentReference: item.future_agenda_source_id ? item.future_agenda_source_id.slice(0, 8) : item.id.slice(0, 8),
    patientName: item.patient_id ? patientsById.get(item.patient_id) ?? "Paciente não encontrado" : "-",
    serviceName: item.service_id ? servicesById.get(item.service_id) ?? "Serviço não encontrado" : "-",
    clinicName: clinicsById.get(item.clinic_id) ?? "Clínica não encontrada",
    appointmentDate: item.appointment_date ?? item.due_date,
    commissionAmount: Number(item.amount ?? 0),
    status: getDerivedStatus(item)
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Financeiro"
        title="Comissões por atendimento"
        description={loadError ?? "Detalhamento de atendimentos que geraram comissão para o funcionário no período."}
      />
      <CommissionDetailReport
        employeeName={employee?.name ?? "Funcionário não encontrado"}
        employeeRole={employee?.role ?? "Profissional"}
        periodLabel={`${start} até ${end}`}
        rows={rows}
      />
    </div>
  );
}