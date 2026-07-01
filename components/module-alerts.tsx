import { AlertTriangle, CalendarX, Clock, CircleDollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModuleAlert = {
  id: string;
  type: "falta" | "sem_baixa" | "vencido" | "pendente";
  title: string;
  description: string;
  date: string;
};

function getAlertIcon(type: ModuleAlert["type"]): LucideIcon {
  switch (type) {
    case "falta":
      return CalendarX;
    case "sem_baixa":
      return Clock;
    case "vencido":
      return CircleDollarSign;
    case "pendente":
      return AlertTriangle;
  }
}

function getAlertStyles(type: ModuleAlert["type"]) {
  switch (type) {
    case "falta":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200";
    case "sem_baixa":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    case "vencido":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200";
    case "pendente":
      return "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-200";
  }
}

type ModuleAlertsProps = {
  alerts: ModuleAlert[];
};

export function ModuleAlerts({ alerts }: ModuleAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Pendencias ({alerts.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${getAlertStyles(alert.type)}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="truncate text-xs opacity-80">{alert.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
