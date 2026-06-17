import { BadgeCheck, Plus, Stethoscope } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function FuncionariosPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Equipe"
          title="Funcionários"
          description="Gerencie profissionais, permissões, vínculos por clínica, especialidades e disponibilidade na agenda."
        />
        <Button>
          <Plus className="h-4 w-4" />
          Novo funcionário
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Profissionais" description="Equipe clínica" icon={Stethoscope} value="42" />
        <ModuleCard title="Ativos" description="Com acesso liberado" icon={BadgeCheck} value="39" />
        <ModuleCard title="Convites" description="Pendentes de aceite" icon={Plus} value="03" />
      </section>
    </div>
  );
}
