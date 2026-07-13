import { requireViewPermission } from "@/lib/route-permissions";

export default async function ClinicsPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("clinicas");
  return children;
}
