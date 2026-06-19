import {
  MedicalRecordsManager,
  type EmployeeOption,
  type PatientOption
} from "@/components/medical-records/medical-records-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
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

  try {
    const supabase = await createClient();
    const recordsResult = await supabase
      .from("medical_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (recordsResult.error) {
      loadError = appendLoadError(loadError, recordsResult.error);
    } else {
      records = recordsResult.data ?? [];
    }

    const patientsResult = await supabase
      .from("patients")
      .select("*")
      .order("full_name", { ascending: true });

    if (patientsResult.error) {
      loadError = appendLoadError(loadError, patientsResult.error);
    } else {
      patients = patientsResult.data ?? [];
    }

    const employeesResult = await supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });

    if (employeesResult.error) {
      loadError = appendLoadError(loadError, employeesResult.error);
    } else {
      employees = employeesResult.data ?? [];
    }
  } catch (error) {
    loadError = appendLoadError(loadError, error);
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
