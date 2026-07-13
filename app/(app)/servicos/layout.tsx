import { requireViewPermission } from "@/lib/route-permissions";

export default async function ServicesPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("servicos");
  return children;
}
