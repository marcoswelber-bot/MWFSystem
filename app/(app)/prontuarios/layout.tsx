import { requireViewPermission } from "@/lib/route-permissions";

export default async function MedicalRecordsPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("prontuarios");
  return children;
}
