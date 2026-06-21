import { PageHeader } from "@/components/page-header";
import { PatientsManager } from "@/components/patients/patients-manager";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

type PacientesPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

export default async function PacientesPage({
  searchParams
}: PacientesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  let patients: Patient[] = [];
  let clinics: Clinic[] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
    const supabase = await createClient();
    let clinicsQuery = supabase
      .from("clinics")
      .select("*")
      .order("name", { ascending: true });
    if (!clinicScope.isAdmMaster && clinicScope.clinicId) {
      clinicsQuery = clinicsQuery.eq("id", clinicScope.clinicId);
    }
    const clinicsResult = await clinicsQuery;
    if (clinicsResult.error) {
      loadError = getErrorMessage(clinicsResult.error);
    } else {
      clinics = clinicsResult.data ?? [];
    }

    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clinicScope.clinicId) {
      query = query.eq("clinic_id", clinicScope.clinicId);
    }

    if (search) {
      const term = escapeSearchTerm(search);
      query = query.or(
        `full_name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      loadError = getErrorMessage(error);
    } else {
      patients = data ?? [];
    }
    } catch (error) {
      loadError = getErrorMessage(error);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cadastro clinico"
        title="Pacientes"
        description="Cadastre, edite, busque e inative pacientes usando dados reais do Supabase."
      />

      <PatientsManager
        patients={patients}
        clinics={clinics}
        isAdmMaster={clinicScope.isAdmMaster}
        currentClinicId={clinicScope.clinicId}
        initialSearch={search}
        loadError={loadError}
        permissions={permissions.pacientes}
      />
    </div>
  );
}
