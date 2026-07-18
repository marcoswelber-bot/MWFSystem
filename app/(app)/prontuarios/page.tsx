import {
  MedicalRecordsManager,
  type EmployeeOption,
  type PatientOption
} from "@/components/medical-records/medical-records-manager";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import type { Database } from "@/types/database";

type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

type ProntuariosPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

export default async function ProntuariosPage({
  searchParams
}: ProntuariosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 50;
  let records: MedicalRecord[] = [];
  let patients: Patient[] = [];
  let employees: Employee[] = [];
  let clinics: Clinic[] = [];
  let loadError: string | undefined;
  let recordCount = 0;
  const clinicScope = await getCurrentClinicScope();
  const permissions = await getCurrentPermissionMap();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
    const supabase = await createClient();
    let clinicsQuery = supabase.from("clinics").select("*").order("name");
    if (clinicScope.clinicId) clinicsQuery = clinicsQuery.eq("id",clinicScope.clinicId);
    let recordsQuery = supabase
      .from("medical_records")
      .select("id,clinic_id,appointment_id,appointment_participant_id,patient_id,employee_id,title,status,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (clinicScope.clinicId) {
      recordsQuery = recordsQuery.eq("clinic_id", clinicScope.clinicId);
    }
    if (search) {
      const term = search.replaceAll("%", "\\%").replaceAll(",", " ");
      recordsQuery = recordsQuery.or(`title.ilike.%${term}%,notes.ilike.%${term}%`);
    }
    if (!search) recordsQuery = recordsQuery.range((page - 1) * pageSize, page * pageSize - 1);
    let countQuery = supabase.from("medical_records").select("id", { count: "exact", head: true });
    if (clinicScope.clinicId) countQuery = countQuery.eq("clinic_id", clinicScope.clinicId);
    let patientsQuery = supabase
      .from("patients")
      .select("*")
      .order("full_name", { ascending: true });

    if (clinicScope.clinicId) {
      patientsQuery = patientsQuery.eq("clinic_id", clinicScope.clinicId);
    }

    let employeesQuery = supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true });

    if (clinicScope.clinicId) {
      employeesQuery = employeesQuery.eq("clinic_id", clinicScope.clinicId);
    }

    const [recordsResult, clinicsResult, patientsResult, employeesResult, countResult] =
      await Promise.all([recordsQuery, clinicsQuery, patientsQuery, employeesQuery, countQuery]);
    clinics=clinicsResult.data ?? [];
    records=(recordsResult.data ?? []).map((record) => ({
      ...record,
      complaint: null,
      history: null,
      conduct: null,
      evolution: null,
      notes: null
    }));
    patients=patientsResult.data ?? [];
    employees=employeesResult.data ?? [];
    recordCount=countResult.count ?? records.length;

    [recordsResult.error, clinicsResult.error, patientsResult.error, employeesResult.error, countResult.error]
      .forEach((error) => { if (error) loadError = appendLoadError(loadError, error); });
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
  const clinicsById = new Map(clinics.map((clinic)=>[clinic.id,clinic.name]));

  const displayRecords = records
    .map((record) => ({
      ...record,
      patient_name: record.patient_id
        ? patientsById.get(record.patient_id) ?? "Paciente nao encontrado"
        : "-",
      employee_name: record.employee_id
        ? employeesById.get(record.employee_id) ?? "Funcionario nao encontrado"
        : "-",
      clinic_name: record.clinic_id ? clinicsById.get(record.clinic_id) ?? "Clínica não encontrada" : "-"
    }));

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
        totalRecords={recordCount}
        currentPage={page}
        pageSize={pageSize}
        loadError={loadError}
        permissions={permissions.prontuarios}
      />
    </div>
  );
}
