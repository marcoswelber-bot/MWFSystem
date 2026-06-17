import { BarChart3, Building2, Download } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function RelatoriosPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Inteligência"
          title="Relatórios"
          description="Visões gerenciais por unidade, período, serviço, profissional, receita, agenda e retenção de pacientes."
        />
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Operacional" description="Agenda e produção" icon={BarChart3} value="12" />
        <ModuleCard title="Financeiro" description="Receita e caixa" icon={Download} value="09" />
        <ModuleCard title="Multiclínica" description="Comparativo de unidades" icon={Building2} value="04" />
      </section>
    </div>
  );
}
