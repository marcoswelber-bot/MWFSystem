import type { ReactNode } from "react";
import { requireViewPermission } from "@/lib/route-permissions";

export default async function FuncoesLayout({ children }: { children: ReactNode }) {
  await requireViewPermission("funcoes");
  return children;
}
