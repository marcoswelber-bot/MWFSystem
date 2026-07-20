import type { ReactNode } from "react";
import { requireViewPermission } from "@/lib/route-permissions";
export default async function MwfIaLayout({ children }: { children: ReactNode }) { await requireViewPermission("mwf_ia"); return children; }
