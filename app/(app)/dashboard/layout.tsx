import { requireViewPermission } from "@/lib/route-permissions";

export default async function DashboardPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("dashboard");
  return children;
}
