import { createClient } from "@/lib/supabase/server";
import { isAdmRole } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import { cookies } from "next/headers";
import { cache } from "react";

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
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || user.email?.trim().toLowerCase() !== normalizedEmail) {
    return {
      kind: "unknown",
      employee: null,
      patient: null,
      email: normalizedEmail,
      reason: "Usuario autenticado nao corresponde ao cadastro solicitado."
    };
  }

  const employeeByAuth = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  let employee = employeeByAuth.data;

  if (!employee && employeeByAuth.error?.code === "42703") {
    const byLoginEmail = await supabase
      .from("employees")
      .select("*")
      .eq("login_email", normalizedEmail)
      .maybeSingle();
    employee = byLoginEmail.data;

    if (!employee) {
      const byEmail = await supabase
        .from("employees")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();
      employee = byEmail.data;
    }
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    employee?.status === "active" &&
    employee.system_access &&
    isAdmRole(employee.role)
  ) {
    return {
      kind: "adm_master",
      employee: employee ?? null,
      patient: null,
      email: normalizedEmail
    };
  }

  if (employee) {
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

  if (patient) {
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

export const getCurrentAccessProfile = cache(async function getCurrentAccessProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  return getAccessProfileByEmail(user.email);
});

export const getCurrentClinicScope = cache(async function getCurrentClinicScope() {
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
});

export const getAvailableClinicsForProfile = cache(async function getAvailableClinicsForProfile(profile: AccessProfile | null) {
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
});

