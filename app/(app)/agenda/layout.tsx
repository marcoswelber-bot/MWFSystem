import { requireViewPermission } from "@/lib/route-permissions";

export default async function AgendaPermissionLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireViewPermission("agenda");
  return children;
}
