import { requireViewPermission } from "@/lib/route-permissions";

export default async function EmployeesPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("funcionarios");
  return children;
}
