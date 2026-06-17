import { BriefcaseMedical, Plus, Tags } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function ServicosPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Catálogo"
          title="Serviços"
          description="Estruture procedimentos, consultas, pacotes, preços, duração e disponibilidade por clínica."
        />
        <Button>
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Serviços ativos" description="Disponíveis para agenda" icon={BriefcaseMedical} value="58" />
        <ModuleCard title="Categorias" description="Organização comercial" icon={Tags} value="11" />
        <ModuleCard title="Pacotes" description="Planos e combos" icon={Plus} value="08" />
      </section>
    </div>
  );
}
