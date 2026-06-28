import Link from "next/link";
import type { Route } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ReportsMenu } from "@/components/reports/reports-menu";
import { Button } from "@/components/ui/button";

export default function RelatoriosPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Inteligencia"
          title="Relatorios"
          description="Visoes gerenciais por unidade, periodo, servico, profissional, receita, agenda e retencao de pacientes."
        />
        <Button asChild variant="outline">
          <Link href={"/relatorios/financeiro" as Route}>
            <Download className="h-4 w-4" />
            Exportar
          </Link>
        </Button>
      </div>

      <ReportsMenu />
    </div>
  );
}
