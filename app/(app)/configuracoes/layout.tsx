import { requireViewPermission } from "@/lib/route-permissions";

export default async function SettingsPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("configuracoes");
  return children;
}
