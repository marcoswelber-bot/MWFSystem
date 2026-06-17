import { CalendarDays, Clock, Plus } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function AgendaPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader
          eyebrow="Atendimentos"
          title="Agenda"
          description="Organize consultas, procedimentos, bloqueios de horário, profissionais e unidades em uma agenda multiclínica."
        />
        <Button>
          <Plus className="h-4 w-4" />
          Novo agendamento
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Hoje" description="Eventos confirmados" icon={CalendarDays} value="38" />
        <ModuleCard title="Aguardando" description="Confirmação pendente" icon={Clock} value="09" />
        <ModuleCard title="Disponíveis" description="Horários livres" icon={Plus} value="24" />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Grade do dia</CardTitle>
          <CardDescription>Modelo inicial para trocar por calendário completo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["08:00", "09:30", "11:00", "14:00", "15:30", "17:00"].map((time) => (
            <div key={time} className="rounded-md border p-4">
              <p className="font-semibold">{time}</p>
              <p className="text-sm text-muted-foreground">Consulta disponível</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
