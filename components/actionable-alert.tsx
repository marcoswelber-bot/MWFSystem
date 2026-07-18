"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  Check,
  CircleDollarSign,
  Clock,
  PackageCheck,
  RefreshCw,
  X,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AlertAction = {
  label: string;
  action: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
  icon?: React.ReactNode;
};

export type ActionableAlertData = {
  id: string;
  type: "falta" | "sem_baixa" | "vencido" | "pendente" | "pacote_vencendo" | "comissao_pendente";
  title: string;
  description: string;
  date: string;
  referenceId: string;
  module: "agenda" | "financeiro" | "pacotes" | "folha" | "pacientes";
  actions: AlertAction[];
};

type ActionableAlertProps = {
  alert: ActionableAlertData;
  onAction: (alertId: string, action: string, referenceId: string) => Promise<{ ok: boolean; message: string }>;
  onIgnore?: (alertId: string, reason: string) => Promise<void>;
};

function getAlertColor(type: ActionableAlertData["type"]) {
  switch (type) {
    case "falta":
    case "vencido":
      return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50";
    case "sem_baixa":
    case "pendente":
      return "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50";
    case "pacote_vencendo":
      return "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50";
    case "comissao_pendente":
      return "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50";
  }
}

function getAlertTextColor(type: ActionableAlertData["type"]) {
  switch (type) {
    case "falta":
    case "vencido":
      return "text-red-800 dark:text-red-200";
    case "sem_baixa":
    case "pendente":
      return "text-amber-800 dark:text-amber-200";
    case "pacote_vencendo":
      return "text-orange-800 dark:text-orange-200";
    case "comissao_pendente":
      return "text-blue-800 dark:text-blue-200";
  }
}

function getAlertIcon(type: ActionableAlertData["type"]) {
  switch (type) {
    case "falta":
      return <CalendarX className="h-4 w-4" />;
    case "sem_baixa":
      return <Clock className="h-4 w-4" />;
    case "vencido":
      return <CircleDollarSign className="h-4 w-4" />;
    case "pendente":
      return <AlertTriangle className="h-4 w-4" />;
    case "pacote_vencendo":
      return <PackageCheck className="h-4 w-4" />;
    case "comissao_pendente":
      return <CircleDollarSign className="h-4 w-4" />;
  }
}

export function ActionableAlert({ alert, onAction, onIgnore }: ActionableAlertProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [ignoreReason, setIgnoreReason] = React.useState("");
  const [showIgnore, setShowIgnore] = React.useState(false);

  async function handleAction(action: string) {
    setLoading(action);
    setResult(null);
    try {
      const res = await onAction(alert.id, action, alert.referenceId);
      setResult(res);
      if (res.ok) {
        setTimeout(() => {
          setIsOpen(false);
          setResult(null);
          router.refresh();
        }, 1200);
      }
    } catch {
      setResult({ ok: false, message: "Erro inesperado. Tente novamente." });
    } finally {
      setLoading(null);
    }
  }

  async function handleIgnore() {
    if (!ignoreReason.trim()) return;
    setLoading("ignore");
    try {
      await onIgnore?.(alert.id, ignoreReason.trim());
      setIsOpen(false);
      setShowIgnore(false);
      setIgnoreReason("");
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Erro ao ignorar alerta." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex min-w-0 w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-md",
          getAlertColor(alert.type),
          getAlertTextColor(alert.type)
        )}
      >
        <span className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{alert.title}</p>
          <p className="truncate text-xs opacity-80">{alert.description}</p>
        </div>
        <span className="hidden shrink-0 text-xs opacity-60 sm:inline">{alert.date}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setShowIgnore(false); setResult(null); }}
            aria-label="Fechar"
          />
          <Card className="relative z-10 w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className={cn("mt-1 shrink-0", getAlertTextColor(alert.type))}>
                  {getAlertIcon(alert.type)}
                </span>
                <div>
                  <CardTitle className="text-base">{alert.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Data: {alert.date}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => { setIsOpen(false); setShowIgnore(false); setResult(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {result ? (
                <div className={cn(
                  "rounded-lg border p-3 text-sm",
                  result.ok
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                )}>
                  <div className="flex items-center gap-2">
                    {result.ok ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {result.message}
                  </div>
                </div>
              ) : null}

              {!showIgnore ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acoes disponiveis</p>
                  <div className="grid gap-2">
                    {alert.actions.map((act) => (
                      <Button
                        key={act.action}
                        variant={act.variant ?? "default"}
                        className="w-full justify-start gap-2"
                        disabled={loading !== null}
                        onClick={() => handleAction(act.action)}
                      >
                        {loading === act.action ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          act.icon ?? <CalendarCheck className="h-4 w-4" />
                        )}
                        {act.label}
                      </Button>
                    ))}
                  </div>
                  {onIgnore ? (
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowIgnore(true)}
                      disabled={loading !== null}
                    >
                      Ignorar este alerta
                    </Button>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Motivo para ignorar:</p>
                  <input
                    type="text"
                    value={ignoreReason}
                    onChange={(e) => setIgnoreReason(e.target.value)}
                    placeholder="Descreva o motivo..."
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowIgnore(false); setIgnoreReason(""); }}
                      disabled={loading !== null}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={!ignoreReason.trim() || loading !== null}
                      onClick={handleIgnore}
                    >
                      {loading === "ignore" ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
