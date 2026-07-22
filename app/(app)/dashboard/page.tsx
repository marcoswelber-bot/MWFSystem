import { AlertTriangle, CalendarDays, ClipboardList, CreditCard, PackageCheck, UserPlus, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "./actions";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { MwfAssistant } from "@/components/ai/mwf-assistant";

const route = (value: string) => value as Route;

export default async function DashboardPage() {
  const [data, permissions, scope] = await Promise.all([getDashboardData(), getCurrentPermissionMap(), getCurrentClinicScope()]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  let openQuery = supabase.from("financial_transactions").select("patient_id,due_date").eq("transaction_type", "receita").in("status", ["pendente", "parcial"]);
  let packageQuery = supabase.from("patient_packages").select("id").eq("status", "active").gte("expiration_date", today).lte("expiration_date", limit);
  if (scope.clinicId) { openQuery = openQuery.eq("clinic_id", scope.clinicId); packageQuery = packageQuery.eq("clinic_id", scope.clinicId); }
  const [openResult, packageResult] = await Promise.all([openQuery, packageQuery]);
  const openRows = openResult.data || [];
  const pending = [
    ["Agendamentos sem baixa", data.alerts.filter((alert) => alert.type === "sem_baixa").length, "/agenda", CalendarDays, permissions.agenda.view],
    ["Pacientes em aberto", new Set(openRows.map((row) => row.patient_id).filter(Boolean)).size, "/financeiro/baixas", UsersRound, permissions.financeiro.view],
    ["Pagamentos vencidos", openRows.filter((row) => row.due_date < today).length, "/financeiro/baixas", AlertTriangle, permissions.financeiro.view],
    ["Pacotes próximos do vencimento", (packageResult.data || []).length, "/pacotes", PackageCheck, permissions.pacotes.view]
  ] as const;
  const quick = [
    ["Novo paciente", "/pacientes?new=1", UserPlus, permissions.pacientes.create],
    ["Novo agendamento", "/agenda?new=1", CalendarDays, permissions.agenda.create],
    ["Receber pagamento", "/financeiro/baixas", CreditCard, permissions.financeiro.edit],
    ["Abrir Agenda", "/agenda", CalendarDays, permissions.agenda.view],
    ["Pacientes em aberto", "/financeiro/baixas", UsersRound, permissions.financeiro.view],
    ["Abrir prontuário", "/prontuarios", ClipboardList, permissions.prontuarios.view],
    ["Baixas financeiras", "/financeiro/baixas", WalletCards, permissions.financeiro.view]
  ] as const;
  const userName = scope.profile && "employee" in scope.profile ? scope.profile.employee?.name : undefined;

  return <div className="space-y-6">
    <PageHeader eyebrow="Operação de hoje" title="Dashboard operacional" description="Use o Assistente MWF para buscar informações e iniciar suas tarefas." />
    <MwfAssistant userName={userName} contextKey={scope.clinicId ?? "all-clinics"} alerts={pending.map(([label, value, href, , allowed]) => ({ label, value, href, allowed }))} />
    <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ações rápidas</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{quick.filter((item) => item[3]).map(([label, href, Icon]) => <Button key={label} asChild variant="outline" className="h-20 whitespace-normal"><Link href={route(href)} className="flex-col gap-2 text-center"><Icon className="h-5 w-5 text-primary" />{label}</Link></Button>)}</div></section>
    <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pendências</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{pending.filter((item) => item[4]).map(([label, value, href, Icon]) => <Link key={label} href={route(href)}><Card className="h-full hover:border-primary/40"><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 shrink-0 text-primary" /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card></Link>)}</div></section>
    <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Agenda de hoje</CardTitle><CardDescription>{data.stats.todayTotal} atendimento(s)</CardDescription></div><Button asChild size="sm" variant="outline"><Link href="/agenda">Ver agenda completa</Link></Button></CardHeader><CardContent>
      {data.todayAppointments.length === 0 ? <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Agenda livre hoje.</p> : <div className="grid gap-2">{data.todayAppointments.slice(0, 10).map((item) => <Link key={item.id} href={route("/agenda?appointmentId=" + item.id)} className="grid min-w-0 grid-cols-[48px_1fr_auto] items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"><strong className="text-primary">{item.start_time.slice(0, 5)}</strong><div className="min-w-0"><p className="truncate text-sm font-medium">{item.patient_name}</p><p className="truncate text-xs text-muted-foreground">{item.service_name} · {item.employee_name}</p></div><span className="hidden rounded-full bg-muted px-2 py-1 text-xs sm:inline">{item.status}</span></Link>)}</div>}
    </CardContent></Card>
  </div>;
}
