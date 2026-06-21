import {
  MedicalRecordsManager,
  type EmployeeOption,
  type PatientOption
} from "@/components/medical-records/medical-records-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { getCurrentClinicScope } from "@/lib/access-control";
import type { Database } from "@/types/database";

type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

type ProntuariosPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function includesSearch(value: string | null | undefined, search: string) {
  return value?.toLowerCase().includes(search.toLowerCase()) ?? false;
}

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

export default async function ProntuariosPage({
  searchParams
}: ProntuariosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  let records: MedicalRecord[] = [];
  let patients: Patient[] = [];
  let employees: Employee[] = [];
  let loadError: string | undefined;
  const clinicScope = await getCurrentClinicScope();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
    const supabase = await createClient();
    let recordsQuery = supabase
      .from("medical_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (clinicScope.clinicId) {
      recordsQuery = recordsQuery.eq("clinic_id", clinicScope.clinicId);
    }

    const recordsResult = await recordsQuery;

    if (recordsResult.error) {
      loadError = appendLoadError(loadError, recordsResult.error);
    } else {
      records = recordsResult.data ?? [];
    }

    let patientsQuery = supabase
      .from("patients")
      .select("*")
      .order("full_name", { ascending: true });

    if (clinicScope.clinicId) {
      patientsQuery = patientsQuery.eq("clinic_id", clinicScope.clinicId);
    }

    const patientsResult = await patientsQuery;

    if (patientsResult.error) {
      loadError = appendLoadError(loadError, patientsResult.error);
    } else {
      patients = patientsResult.data ?? [];
    }

    let employeesQuery = supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });

    if (clinicScope.clinicId) {
      employeesQuery = employeesQuery.eq("clinic_id", clinicScope.clinicId);
    }

    const employeesResult = await employeesQuery;

    if (employeesResult.error) {
      loadError = appendLoadError(loadError, employeesResult.error);
    } else {
      employees = employeesResult.data ?? [];
    }
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const patientsById = new Map(
    patients.map((patient) => [patient.id, patient.full_name])
  );
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );

  const displayRecords = records
    .map((record) => ({
      ...record,
      patient_name: record.patient_id
        ? patientsById.get(record.patient_id) ?? "Paciente nao encontrado"
        : "-",
      employee_name: record.employee_id
        ? employeesById.get(record.employee_id) ?? "Funcionario nao encontrado"
        : "-"
    }))
    .filter((record) => {
      if (!search) {
        return true;
      }

      return (
        includesSearch(record.title, search) ||
        includesSearch(record.patient_name, search) ||
        includesSearch(record.notes, search)
      );
    });

  const patientOptions: PatientOption[] = patients.map((patient) => ({
    id: patient.id,
    full_name: patient.full_name
  }));
  const employeeOptions: EmployeeOption[] = employees.map((employee) => ({
    id: employee.id,
    name: employee.name
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Registros clinicos"
        title="Prontuarios"
        description="Cadastre, edite, busque, ative e inative prontuarios usando dados reais do Supabase."
      />

      <MedicalRecordsManager
        records={displayRecords}
        patients={patientOptions}
        employees={employeeOptions}
        initialSearch={search}
        loadError={loadError}
      />
    </div>
  );
}
