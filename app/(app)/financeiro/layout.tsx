import { requireViewPermission } from "@/lib/route-permissions";

export default async function FinancePermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("financeiro");
  return children;
}
