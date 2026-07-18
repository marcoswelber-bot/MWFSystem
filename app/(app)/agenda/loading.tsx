import { Card } from "@/components/ui/card";

export default function AgendaLoading() {
  return (
    <div className="grid animate-pulse gap-4" role="status" aria-label="Carregando Agenda">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-2">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="h-4 w-72 max-w-[75vw] rounded bg-muted" />
        </div>
        <div className="h-11 w-44 rounded-xl bg-muted" />
      </div>
      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-11 rounded-lg bg-muted" />
        ))}
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, index) => (
          <Card key={index} className="h-20 bg-muted" />
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="h-20 bg-slate-900/90" />
        <div className="grid min-h-[560px] grid-cols-[64px_repeat(3,minmax(180px,1fr))] gap-px bg-border p-px">
          {Array.from({ length: 16 }, (_, index) => (
            <div key={index} className="bg-background" />
          ))}
        </div>
      </Card>
      <span className="sr-only">Carregando grade e agendamentos.</span>
    </div>
  );
}
