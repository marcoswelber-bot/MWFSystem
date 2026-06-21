import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  getAvailableClinicsForProfile,
  getCurrentAccessProfile,
  getCurrentClinicScope
} from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPermissionMap } from "@/lib/permissions";
import type { PermissionModuleKey } from "@/lib/permission-modules";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accessProfile = await getCurrentAccessProfile();

  if (accessProfile?.kind === "patient") {
    redirect("/portal");
  }

  if (accessProfile?.kind === "blocked" || accessProfile?.kind === "unknown") {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent(accessProfile.reason)}`);
  }

  const permissions = await getCurrentPermissionMap();
  const visibleModules = Object.entries(permissions)
    .filter(([, permission]) => permission.view)
    .map(([moduleKey]) => moduleKey as PermissionModuleKey);
  const clinicScope = await getCurrentClinicScope();
  const availableClinics = await getAvailableClinicsForProfile(accessProfile);
  const userName = accessProfile?.employee?.name ?? user.email ?? "Usuario";
  const userRole =
    accessProfile?.kind === "adm_master"
      ? "ADM MASTER"
      : accessProfile?.employee?.role ?? "Funcionario";

  return (
    <AppShell
      userEmail={user.email}
      userName={userName}
      userRole={userRole}
      visibleModules={visibleModules}
      clinics={availableClinics.map((clinic) => ({
        id: clinic.id,
        name: clinic.name
      }))}
      activeClinicId={clinicScope.clinicId}
      isAdmMaster={clinicScope.isAdmMaster}
    >
      {children}
    </AppShell>
  );
}
