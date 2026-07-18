import { PageHeader } from "@/components/page-header";
import { PackagesManager } from "@/components/packages/packages-manager";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap, isCurrentUserAdmMaster } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { PackageStatus } from "@/app/(app)/pacotes/actions";
import type { Database } from "@/types/database";

type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

type HydratedPatientPackage = PatientPackage & {
  clinic_name: string;
  patient_name: string;
  service_name: string;
  employee_name: string;
  derived_status: PackageStatus;
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

function getDerivedStatus(item: PatientPackage): PackageStatus {
  if (item.status === "active" && item.expiration_date) {
    const today = new Date().toISOString().slice(0, 10);
    return item.expiration_date < today ? "expired" : "active";
  }

  return item.status as PackageStatus;
}

export default async function PacotesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 50;
  const permissions = await getCurrentPermissionMap();
  const isAdmMaster = await isCurrentUserAdmMaster();
  const clinicScope = await getCurrentClinicScope();
  let packages: PatientPackage[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let employees: Employee[] = [];
  let loadError: string | undefined;
  let packageCount = 0;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;

      const clinicsQuery = clinicFilter
        ? supabase.from("clinics").select("*").eq("id", clinicFilter)
        : supabase.from("clinics").select("*");

      const packagesQuery = clinicFilter
        ? supabase.from("patient_packages").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patient_packages").select("*");
      const countQuery = clinicFilter
        ? supabase.from("patient_packages").select("id", { count: "exact", head: true }).eq("clinic_id", clinicFilter)
        : supabase.from("patient_packages").select("id", { count: "exact", head: true });

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      const employeesQuery = clinicFilter
        ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("employees").select("*");

      const [
        packagesResult,
        clinicsResult,
        patientsResult,
        servicesResult,
        employeesResult,
        countResult
      ] = await Promise.all([
        readSupabaseList<PatientPackage>(
          "pacotes",
          packagesQuery.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
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
        countQuery
      ]);

      packages = packagesResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;
      employees = employeesResult.data;
      packageCount = countResult.count ?? packages.length;

      [
        packagesResult.error,
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

  const hydratedPackages: HydratedPatientPackage[] = packages.map((item) => ({
    ...item,
    clinic_name: clinicsById.get(item.clinic_id) ?? "Clinica nao encontrada",
    patient_name: patientsById.get(item.patient_id) ?? "Paciente nao encontrado",
    service_name: servicesById.get(item.service_id) ?? "Servico nao encontrado",
    employee_name: item.employee_id
      ? employeesById.get(item.employee_id) ?? "Profissional nao encontrado"
      : "-",
    derived_status: getDerivedStatus(item)
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Operacao clinica"
        title="Pacotes"
        description="Gerencie pacotes contratados com controle de sessoes, validade e status, pronto para integracao futura com Agenda e Financeiro."
      />

      <PackagesManager
        packages={hydratedPackages}
        clinics={clinics}
        patients={patients}
        services={services}
        employees={employees}
        totalPackages={packageCount}
        currentPage={page}
        pageSize={pageSize}
        currentClinicId={clinicScope.clinicId}
        isAdmMaster={isAdmMaster}
        loadError={loadError}
        permissions={permissions.pacotes}
      />
    </div>
  );
}
