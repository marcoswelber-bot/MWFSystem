import { createClient } from "@/lib/supabase/server";
import { isAdmEmail, isAdmRole } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import { cookies } from "next/headers";

export const ACTIVE_CLINIC_COOKIE = "mwf_active_clinic_id";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

export type AccessProfile =
  | {
      kind: "adm_master";
      employee: Employee | null;
      patient: null;
      email: string;
    }
  | {
      kind: "employee";
      employee: Employee;
      patient: null;
      email: string;
    }
  | {
      kind: "patient";
      employee: null;
      patient: Patient;
      email: string;
    }
  | {
      kind: "blocked";
      employee: Employee | null;
      patient: Patient | null;
      email: string;
      reason: string;
    }
  | {
      kind: "unknown";
      employee: null;
      patient: null;
      email: string;
      reason: string;
    };

function sameEmail(value: string | null | undefined, email: string) {
  return value?.trim().toLowerCase() === email.trim().toLowerCase();
}

export async function getAccessProfileByEmail(
  email: string
): Promise<AccessProfile> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      kind: "unknown",
      employee: null,
      patient: null,
      email: normalizedEmail,
      reason: "Email de login nao informado."
    };
  }

  const supabase = await createClient();
  const [{ data: employee }, { data: patient }] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .or(`login_email.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
      .maybeSingle(),
    supabase
      .from("patients")
      .select("*")
      .or(`login_email.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
      .maybeSingle()
  ]);

  if (isAdmEmail(normalizedEmail) || isAdmRole(employee?.role)) {
    return {
      kind: "adm_master",
      employee: employee ?? null,
      patient: null,
      email: normalizedEmail
    };
  }

  if (employee && (sameEmail(employee.login_email, normalizedEmail) || sameEmail(employee.email, normalizedEmail))) {
    if (employee.status !== "active") {
      return {
        kind: "blocked",
        employee,
        patient: null,
        email: normalizedEmail,
        reason: "Funcionario inativo."
      };
    }

    if (!employee.system_access) {
      return {
        kind: "blocked",
        employee,
        patient: null,
        email: normalizedEmail,
        reason: "Funcionario sem acesso ao sistema."
      };
    }

    return {
      kind: "employee",
      employee,
      patient: null,
      email: normalizedEmail
    };
  }

  if (patient && (sameEmail(patient.login_email, normalizedEmail) || sameEmail(patient.email, normalizedEmail))) {
    if (patient.status !== "active") {
      return {
        kind: "blocked",
        employee: null,
        patient,
        email: normalizedEmail,
        reason: "Paciente inativo."
      };
    }

    if (!patient.portal_access) {
      return {
        kind: "blocked",
        employee: null,
        patient,
        email: normalizedEmail,
        reason: "Paciente sem acesso ao portal."
      };
    }

    return {
      kind: "patient",
      employee: null,
      patient,
      email: normalizedEmail
    };
  }

  return {
    kind: "unknown",
    employee: null,
    patient: null,
    email: normalizedEmail,
    reason: "Usuario nao encontrado nos cadastros liberados."
  };
}

export async function getCurrentAccessProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  return getAccessProfileByEmail(user.email);
}

export async function getCurrentClinicScope() {
  const profile = await getCurrentAccessProfile();
  const cookieStore = await cookies();
  const activeClinicId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value ?? null;

  if (!profile || profile.kind === "blocked" || profile.kind === "unknown") {
    return {
      isAdmMaster: false,
      clinicId: null,
      profile
    };
  }

  if (profile.kind === "adm_master") {
    return {
      isAdmMaster: true,
      clinicId: activeClinicId,
      profile
    };
  }

  const linkedClinicId = profile.employee?.clinic_id ?? profile.patient?.clinic_id ?? null;

  return {
    isAdmMaster: false,
    clinicId: linkedClinicId,
    profile
  };
}

export async function getAvailableClinicsForProfile(profile: AccessProfile | null) {
  if (!profile || profile.kind === "blocked" || profile.kind === "unknown") {
    return [] as Clinic[];
  }

  const supabase = await createClient();

  if (profile.kind === "adm_master") {
    const { data } = await supabase
      .from("clinics")
      .select("*")
      .order("name", { ascending: true });

    return data ?? [];
  }

  const clinicId = profile.employee?.clinic_id ?? profile.patient?.clinic_id ?? null;

  if (!clinicId) {
    return [] as Clinic[];
  }

  const { data } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .order("name", { ascending: true });

  return data ?? [];
}
