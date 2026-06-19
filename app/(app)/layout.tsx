import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentAccessProfile } from "@/lib/access-control";
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

  return (
    <AppShell userEmail={user.email} visibleModules={visibleModules}>
      {children}
    </AppShell>
  );
}
