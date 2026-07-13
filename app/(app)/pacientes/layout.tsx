import { requireViewPermission } from "@/lib/route-permissions";

export default async function PatientsPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("pacientes");
  return children;
}
