import { Plus, Search, UsersRound } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PacientesPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Cadastro clínico"
          title="Pacientes"
          description="Base inicial para cadastro, busca, histórico, vínculos por clínica e acompanhamento de jornada do paciente."
        />
        <Button>
          <Plus className="h-4 w-4" />
          Novo paciente
        </Button>
      </div>

      <div className="mb-6 flex max-w-xl items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone" />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard
          title="Pacientes ativos"
          description="Cadastro consolidado"
          icon={UsersRound}
          value="1.284"
        />
        <ModuleCard
          title="Novos no mês"
          description="Entradas recentes"
          icon={Plus}
          value="76"
        />
        <ModuleCard
          title="Em acompanhamento"
          description="Planos e retornos"
          icon={Search}
          value="312"
        />
      </section>
    </div>
  );
}
