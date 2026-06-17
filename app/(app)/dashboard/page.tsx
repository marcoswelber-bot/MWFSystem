import { Building2, CalendarClock, CircleDollarSign, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { dashboardStats } from "@/lib/navigation";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        description="Acompanhe a operação consolidada da rede, com indicadores preparados para filtrar por clínica, período e perfil de acesso."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <ModuleCard
            key={stat.label}
            title={stat.label}
            description={stat.helper}
            icon={stat.icon}
            value={stat.value}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Agenda operacional</CardTitle>
            <CardDescription>
              Próximas rotinas críticas para atendimento e gestão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["08:30", "Consulta de avaliação", "Unidade Centro"],
              ["10:00", "Procedimento estético", "Unidade Norte"],
              ["14:15", "Retorno clínico", "Unidade Sul"]
            ].map(([time, title, clinic]) => (
              <div
                key={`${time}-${title}`}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{clinic}</p>
                </div>
                <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">
                  {time}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ModuleCard
            title="ADM Master"
            description="Perfil preparado para acesso total entre clínicas."
            icon={ShieldCheck}
            value="Global"
          />
          <ModuleCard
            title="Multiclínica"
            description="Estrutura pronta para isolar dados por clínica."
            icon={Building2}
            value="RLS"
          />
          <ModuleCard
            title="Rotinas do dia"
            description="Agenda, caixa e prontuários em acompanhamento."
            icon={CalendarClock}
            value="12"
          />
          <ModuleCard
            title="Financeiro"
            description="Receitas, despesas e repasses centralizados."
            icon={CircleDollarSign}
            value="Ativo"
          />
        </div>
      </section>
    </div>
  );
}
