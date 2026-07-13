import { requireViewPermission } from "@/lib/route-permissions";

export default async function ReportsPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("relatorios");
  return children;
}
