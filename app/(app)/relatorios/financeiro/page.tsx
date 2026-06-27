import { PageHeader } from "@/components/page-header";
import {
  EmployeePayoutReport,
  type PayoutTransaction
} from "@/components/reports/employee-payout-report";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap, isCurrentUserAdmMaster } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type FinancialTransaction =
  Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

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

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isAdministratorRole(role?: string | null) {
  const normalizedRole = normalizeText(role).replace(/[^a-z0-9]+/g, "_");
  return normalizedRole.includes("admin") || normalizedRole.includes("administrador");
}

function isPayoutTransaction(item: FinancialTransaction) {
  const text = normalizeText(`${item.category ?? ""} ${item.description ?? ""}`);

  if (!item.employee_id || item.transaction_type !== "despesa") {
    return false;
  }

  return (
    item.commission_status === "generated" ||
    text.includes("comiss") ||
    text.includes("salario") ||
    text.includes("salary") ||
    text.includes("ajuste") ||
    text.includes("desconto") ||
    text.includes("bonus") ||
    text.includes("bonific")
  );
}

export default async function RelatoriosPage() {
  const permissions = await getCurrentPermissionMap();
  const isAdmMaster = await isCurrentUserAdmMaster();
  const clinicScope = await getCurrentClinicScope();
  const profile = clinicScope.profile;
  const canViewReports = isAdmMaster || permissions.relatorios.view;
  const isAdministrator =
    isAdmMaster ||
    (profile?.kind === "employee" && isAdministratorRole(profile.employee.role));
  const ownEmployeeId =
    profile?.kind === "employee" && !isAdministrator
      ? profile.employee.id
      : null;
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let employees: Employee[] = [];
  let loadError: string | undefined;

  if (!canViewReports) {
    loadError = "Voce nao tem permissao para visualizar relatorios.";
  } else if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;

      const clinicsQuery = clinicFilter
        ? supabase.from("clinics").select("*").eq("id", clinicFilter)
        : supabase.from("clinics").select("*");

      let transactionsQuery = clinicFilter
        ? supabase
            .from("financial_transactions")
            .select("*")
            .eq("clinic_id", clinicFilter)
        : supabase.from("financial_transactions").select("*");

      let employeesQuery = clinicFilter
        ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("employees").select("*");

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      if (ownEmployeeId) {
        transactionsQuery = transactionsQuery.eq("employee_id", ownEmployeeId);
        employeesQuery = employeesQuery.eq("id", ownEmployeeId);
      }

      const [transactionsResult, clinicsResult, patientsResult, servicesResult, employeesResult] =
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
          )
        ]);

      transactions = transactionsResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;
      employees = employeesResult.data;

      [
        transactionsResult.error,
        clinicsResult.error,
        patientsResult.error,
        servicesResult.error,
        employeesResult.error
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
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const payoutTransactions: PayoutTransaction[] = transactions
    .filter(isPayoutTransaction)
    .map((item) => ({
      id: item.id,
      clinic_id: item.clinic_id,
      clinic_name: clinicsById.get(item.clinic_id) ?? "Clinica nao encontrada",
      employee_id: item.employee_id ?? "",
      employee_name: item.employee_id
        ? employeesById.get(item.employee_id) ?? "Funcionario nao encontrado"
        : "Funcionario nao informado",
      patient_name: item.patient_id
        ? patientsById.get(item.patient_id) ?? "Paciente nao encontrado"
        : "-",
      service_name: item.service_id
        ? servicesById.get(item.service_id) ?? "Servico nao encontrado"
        : "-",
      appointment_id: item.future_agenda_source_id,
      appointment_date: item.appointment_date,
      due_date: item.due_date,
      transaction_type: item.transaction_type,
      origin: item.origin,
      category: item.category,
      description: item.description,
      base_amount: item.base_amount,
      commission_type: item.commission_type,
      amount: Number(item.amount ?? 0),
      status: item.status,
      commission_status: item.commission_status
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Relatorios"
        title="Repasse / Contracheque"
        description="Visualize valores a receber por funcionario usando apenas lancamentos ja existentes no Financeiro."
      />

      <EmployeePayoutReport
        transactions={payoutTransactions}
        clinics={clinics}
        employees={employees}
        currentClinicId={clinicScope.clinicId}
        canSelectClinic={isAdmMaster && !clinicScope.clinicId}
        loadError={loadError}
      />
    </div>
  );
}
