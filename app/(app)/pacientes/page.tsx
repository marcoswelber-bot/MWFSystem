import { PageHeader } from "@/components/page-header";
import { PatientsManager } from "@/components/patients/patients-manager";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];
type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

type PacientesPageProps = {
  searchParams: Promise<{
    q?: string;
    patientId?: string;
    new?: string;
    page?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

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

export default async function PacientesPage({
  searchParams
}: PacientesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 50;
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  let patients: Patient[] = [];
  let clinics: Clinic[] = [];
  let appointments: Appointment[] = [];
  let transactions: FinancialTransaction[] = [];
  let patientPackages: PatientPackage[] = [];
  let medicalRecords: MedicalRecord[] = [];
  let employees: Employee[] = [];
  let services: Service[] = [];
  let loadError: string | undefined;
  let patientCount = 0;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuário sem clínica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;

      const clinicsQuery = clinicFilter
        ? supabase.from("clinics").select("*").eq("id", clinicFilter)
        : supabase.from("clinics").select("*");

      let patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      if (search) {
        const term = escapeSearchTerm(search);
        patientsQuery = patientsQuery.or(
          `full_name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`
        );
      }
      patientsQuery = patientsQuery.range((page - 1) * pageSize, page * pageSize - 1);

      const appointmentsQuery = clinicFilter
        ? supabase.from("appointments").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("appointments").select("*");

      const transactionsQuery = clinicFilter
        ? supabase.from("financial_transactions").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("financial_transactions").select("*");

      const packagesQuery = clinicFilter
        ? supabase.from("patient_packages").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patient_packages").select("*");

      const recordsQuery = clinicFilter
        ? supabase.from("medical_records").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("medical_records").select("*");

      const employeesQuery = clinicFilter
        ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("employees").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");
      let countQuery = clinicFilter
        ? supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("id", { count: "exact", head: true });
      if (search) {
        const term = escapeSearchTerm(search);
        countQuery = countQuery.or(`full_name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`);
      }
      const selectedPatientId = params.patientId?.trim();
      let selectedPatientQuery = supabase.from("patients").select("*").eq("id", selectedPatientId ?? "");
      if (clinicFilter) selectedPatientQuery = selectedPatientQuery.eq("clinic_id", clinicFilter);

      const [
        clinicsResult,
        patientsResult,
        appointmentsResult,
        transactionsResult,
        packagesResult,
        recordsResult,
        employeesResult,
        servicesResult,
        countResult,
        selectedPatientResult
      ] = await Promise.all([
        readSupabaseList<Clinic>("clinics", clinicsQuery.order("name", { ascending: true })),
        readSupabaseList<Patient>("patients", patientsQuery.order("created_at", { ascending: false })),
        readSupabaseList<Appointment>("appointments", selectedPatientId ? appointmentsQuery.eq("patient_id", selectedPatientId).order("appointment_date", { ascending: false }) : appointmentsQuery.limit(0)),
        readSupabaseList<FinancialTransaction>("financial_transactions", selectedPatientId ? transactionsQuery.eq("patient_id", selectedPatientId).order("due_date", { ascending: false }) : transactionsQuery.limit(0)),
        readSupabaseList<PatientPackage>("patient_packages", selectedPatientId ? packagesQuery.eq("patient_id", selectedPatientId).order("created_at", { ascending: false }) : packagesQuery.limit(0)),
        readSupabaseList<MedicalRecord>("medical_records", selectedPatientId ? recordsQuery.eq("patient_id", selectedPatientId).order("created_at", { ascending: false }) : recordsQuery.limit(0)),
        readSupabaseList<Employee>("employees", employeesQuery.order("name", { ascending: true })),
        readSupabaseList<Service>("services", servicesQuery.order("name", { ascending: true })),
        countQuery,
        selectedPatientId ? selectedPatientQuery.maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);

      clinics = clinicsResult.data;
      patients = patientsResult.data;
      appointments = appointmentsResult.data;
      transactions = transactionsResult.data;
      patientPackages = packagesResult.data;
      medicalRecords = recordsResult.data;
      employees = employeesResult.data;
      services = servicesResult.data;
      patientCount = countResult.count ?? patients.length;
      if (selectedPatientResult.data && !patients.some((patient) => patient.id === selectedPatientResult.data.id)) {
        patients = [selectedPatientResult.data, ...patients];
      }

      [
        clinicsResult.error,
        patientsResult.error,
        appointmentsResult.error,
        transactionsResult.error,
        packagesResult.error,
        recordsResult.error,
        employeesResult.error,
        servicesResult.error
      ].forEach((error) => {
        if (error) {
          loadError = appendLoadError(loadError, error);
        }
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cadastro clínico"
        title="Pacientes"
        description="Centralize cadastro, agenda, financeiro, pacotes, prontuário e comunicação do paciente usando os módulos existentes."
      />

      <PatientsManager
        patients={patients}
        clinics={clinics}
        appointments={appointments}
        transactions={transactions}
        patientPackages={patientPackages}
        medicalRecords={medicalRecords}
        employees={employees}
        services={services}
        totalPatients={patientCount}
        currentPage={page}
        pageSize={pageSize}
        isAdmMaster={clinicScope.isAdmMaster}
        currentClinicId={clinicScope.clinicId}
        initialSearch={search}
        initialPatientId={params.patientId ?? null}
        initialOpenNew={params.new === "1"}
        loadError={loadError}
        permissions={permissions.pacientes}
      />
    </div>
  );
}
