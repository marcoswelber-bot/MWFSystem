"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { markFinancialTransactionAsPaid, type FinancialActionResult, type FinancialStatus } from "@/app/(app)/financeiro/actions";

type CommissionDetailRow = {
  id: string;
  appointmentReference: string;
  patientName: string;
  serviceName: string;
  clinicName: string;
  appointmentDate: string;
  commissionAmount: number;
  status: FinancialStatus;
};

type CommissionDetailReportProps = {
  employeeName: string;
  employeeRole: string;
  periodLabel: string;
  rows: CommissionDetailRow[];
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function statusLabel(status: FinancialStatus) {
  return ({ pendente: "Pendente", pago: "Pago", vencido: "Vencido", parcial: "Parcial", cancelado: "Cancelado" } as Record<FinancialStatus, string>)[status] ?? status;
}

function statusClass(status: FinancialStatus) {
  if (status === "pago") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  if (status === "vencido") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100";
  if (status === "parcial") return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-100";
  if (status === "cancelado") return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
}

export function CommissionDetailReport({ employeeName, employeeRole, periodLabel, rows }: CommissionDetailReportProps) {
  const router = useRouter();
  const [message, setMessage] = React.useState<FinancialActionResult | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const total = rows.reduce((sum, item) => sum + item.commissionAmount, 0);
  const openTotal = rows.filter((item) => item.status !== "pago" && item.status !== "cancelado").reduce((sum, item) => sum + item.commissionAmount, 0);

  function payCommission(id: string) {
    startTransition(async () => {
      const result = await markFinancialTransactionAsPaid(id);
      setMessage(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <div className={cn("flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm", message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100")}>
          <span>{message.message}</span>
          <button type="button" onClick={() => setMessage(null)} className="rounded-md p-1 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro")}> <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro</Button>
        <div className="text-right text-sm text-muted-foreground">{periodLabel}</div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border p-4 shadow-none"><p className="text-sm text-muted-foreground">Funcionário</p><strong className="mt-1 block text-lg">{employeeName}</strong><span className="text-sm text-muted-foreground">{employeeRole}</span></Card>
        <Card className="border p-4 shadow-none"><p className="text-sm text-muted-foreground">Comissões no período</p><strong className="mt-1 block font-mono text-xl">{money(total)}</strong></Card>
        <Card className="border p-4 shadow-none"><p className="text-sm text-muted-foreground">Em aberto</p><strong className="mt-1 block font-mono text-xl text-amber-700 dark:text-amber-300">{money(openTotal)}</strong></Card>
      </section>

      <Card className="overflow-hidden border shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Relatório detalhado de comissões</h2>
            <p className="text-sm text-muted-foreground">Atendimentos do funcionário no período selecionado.</p>
          </div>
          <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">{rows.length} atendimentos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Número do atendimento</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Valor da comissão</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{item.appointmentReference}</td>
                  <td className="max-w-44 truncate px-3 py-2 font-medium" title={item.patientName}>{item.patientName}</td>
                  <td className="max-w-44 truncate px-3 py-2" title={item.serviceName}>{item.serviceName}</td>
                  <td className="whitespace-nowrap px-3 py-2">{item.appointmentDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">{money(item.commissionAmount)}</td>
                  <td className="whitespace-nowrap px-3 py-2"><span className={cn("rounded-md px-2 py-1 text-xs font-semibold", statusClass(item.status))}>{statusLabel(item.status)}</span></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button type="button" size="sm" onClick={() => payCommission(item.id)} disabled={isPending || item.status === "pago" || item.status === "cancelado"}>
                      <CheckCircle2 className="h-4 w-4" /> Dar baixa
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={7}>Nenhuma comissão encontrada para este funcionário no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}