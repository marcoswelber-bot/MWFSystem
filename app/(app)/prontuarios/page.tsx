import { EntityCrudManager, type EntityRecord } from "@/components/entity-crud-manager";
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

function toEntityRecord(
  record: MedicalRecord,
  patientsById: Map<string, string>,
  employeesById: Map<string, string>
): EntityRecord {
  return {
    id: record.id,
    patient_id: record.patient_id,
    employee_id: record.employee_id,
    patient_name: record.patient_id ? patientsById.get(record.patient_id) ?? "-" : "-",
    employee_name: record.employee_id ? employeesById.get(record.employee_id) ?? "-" : "-",
    title: record.title,
    complaint: record.complaint,
    history: record.history,
    conduct: record.conduct,
    evolution: record.evolution,
    notes: record.notes,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
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
    const [recordsResult, patientsResult, employeesResult] = await Promise.all([
      supabase
        .from("medical_records")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("patients").select("*").order("full_name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true })
    ]);

    if (recordsResult.error) {
      loadError = getErrorMessage(recordsResult.error);
    } else {
      records = recordsResult.data ?? [];
    }

    if (patientsResult.error && !loadError) {
      loadError = getErrorMessage(patientsResult.error);
    } else {
      patients = patientsResult.data ?? [];
    }

    if (employeesResult.error && !loadError) {
      loadError = getErrorMessage(employeesResult.error);
    } else {
      employees = employeesResult.data ?? [];
    }
  } catch (error) {
    loadError = getErrorMessage(error);
  }

  const patientsById = new Map(patients.map((patient) => [patient.id, patient.full_name]));
  const employeesById = new Map(employees.map((employee) => [employee.id, employee.name]));
  const entityRecords = records
    .map((record) => toEntityRecord(record, patientsById, employeesById))
    .filter((record) => {
      if (!search) {
        return true;
      }

      return (
        includesSearch(String(record.patient_name ?? ""), search) ||
        includesSearch(String(record.title ?? ""), search) ||
        includesSearch(String(record.notes ?? ""), search)
      );
    });

  return (
    <div>
      <PageHeader
        eyebrow="Registros clinicos"
        title="Prontuarios"
        description="Registre queixas, historico, conduta, evolucao e observacoes usando dados reais do Supabase."
      />

      <EntityCrudManager
        table="medical_records"
        basePath="/prontuarios"
        entityLabel="prontuario"
        entityLabelPlural="Prontuarios"
        newButtonLabel="Novo prontuario"
        searchPlaceholder="Buscar por paciente, titulo ou observacoes"
        records={entityRecords}
        initialSearch={search}
        loadError={loadError}
        fields={[
          {
            name: "patient_id",
            label: "Paciente",
            type: "select",
            options: patients.map((patient) => ({
              label: patient.full_name,
              value: patient.id
            }))
          },
          {
            name: "employee_id",
            label: "Funcionario",
            type: "select",
            options: employees.map((employee) => ({
              label: employee.name,
              value: employee.id
            }))
          },
          { name: "title", label: "Titulo", required: true },
          { name: "complaint", label: "Queixa", type: "textarea" },
          { name: "history", label: "Historico", type: "textarea" },
          { name: "conduct", label: "Conduta", type: "textarea" },
          { name: "evolution", label: "Evolucao", type: "textarea" },
          { name: "notes", label: "Observacoes", type: "textarea" }
        ]}
        columns={[
          { key: "patient_name", label: "Paciente" },
          { key: "employee_name", label: "Funcionario" },
          { key: "title", label: "Titulo" },
          { key: "notes", label: "Observacoes" },
          {
            key: "status",
            label: "Status",
            render: (record) => (record.status === "active" ? "Ativo" : "Inativo")
          }
        ]}
      />
    </div>
  );
}
