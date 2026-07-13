import { notFound } from "next/navigation";
import { canCurrentUser } from "@/lib/permissions";
import type { PermissionModuleKey } from "@/lib/permission-modules";

export async function requireViewPermission(moduleKey: PermissionModuleKey) {
  if (!(await canCurrentUser(moduleKey, "view"))) {
    notFound();
  }
}
