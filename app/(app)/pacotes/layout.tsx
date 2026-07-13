import { requireViewPermission } from "@/lib/route-permissions";

export default async function PackagesPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("pacotes");
  return children;
}
