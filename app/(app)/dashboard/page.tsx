import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  Clock,
  ShieldCheck,
  TrendingUp,
  UserX,
  Users
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getOperationalFinanceSnapshot } from "@/lib/financial-integration-engine";
import { getDashboardData } from "@/app/(app)/dashboard/actions";
import type { DashboardAlert } from "@/app/(app)/dashboard/actions";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function getAlertColor(type: DashboardAlert["type"]) {
  switch (type) {
    case "falta":
      return "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950";
    case "sem_baixa":
      return "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950";
    case "vencido":
      return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950";
    case "pendente":
      return "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950";
    default:
      return "";
  }
}

function getAlertIcon(type: DashboardAlert["type"]) {
  switch (type) {
    case "falta":
      return UserX;
    case "sem_baixa":
      return CalendarX;
    case "vencido":
      return AlertTriangle;
    case "pendente":
      return Clock;
    default:
      return AlertTriangle;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "realizado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "confirmado":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "agendado":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    case "faltou":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

export default async function DashboardPage() {
  const [snapshot, dashboardData] = await Promise.all([
    getOperationalFinanceSnapshot(),
    getDashboardData()
  ]);

  const { alerts, todayAppointments, stats } = dashboardData;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visao geral"
        title="Dashboard"
        description="Acompanhe a operacao em tempo real."
      />

      {alerts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Atencao ({alerts.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.slice(0, 9).map((alert) => {
              const Icon = getAlertIcon(alert.type);
              return (
                <Link key={alert.id} href={alert.link}>
                  <div
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:opacity-80 ${getAlertColor(alert.type)}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/financeiro" className="transition-transform hover:scale-[1.02]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receitas do mes</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{money(snapshot.monthlyRevenue)}</p>
              <p className="text-xs text-muted-foreground">Hoje: {money(snapshot.dailyRevenue)}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/financeiro" className="transition-transform hover:scale-[1.02]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{money(snapshot.expenseTotal)}</p>
              <p className="text-xs text-muted-foreground">Saldo: {money(snapshot.realizedBalance)}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agenda" className="transition-transform hover:scale-[1.02]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Agenda hoje</CardTitle>
              <CalendarCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.todayTotal}</p>
              <p className="text-xs text-muted-foreground">
                {stats.todayRealized} realizados - {stats.todayPending} pendentes
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/financeiro" className="transition-transform hover:scale-[1.02]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos vencidos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.overduePayments}</p>
              <p className="text-xs text-muted-foreground">Contas a receber atrasadas</p>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Agenda de hoje</CardTitle>
              <CardDescription>
                {todayAppointments.length === 0
                  ? "Nenhum agendamento para hoje."
                  : `${todayAppointments.length} atendimento${todayAppointments.length > 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <Link
              href="/agenda"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver completa
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CalendarClock className="mb-2 h-8 w-8" />
                <p className="text-sm">Agenda livre hoje</p>
              </div>
            ) : (
              todayAppointments.slice(0, 8).map((appointment) => (
                <Link
                  key={appointment.id}
                  href="/agenda"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {appointment.patient_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.service_name} - {appointment.employee_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(appointment.status)}`}>
                      {appointment.status}
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
                      {appointment.start_time.slice(0, 5)}
                    </span>
                  </div>
                </Link>
              ))
            )}
            {todayAppointments.length > 8 && (
              <Link
                href="/agenda"
                className="block text-center text-sm font-medium text-primary hover:underline"
              >
                +{todayAppointments.length - 8} mais atendimentos
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Link href="/pacientes" className="transition-transform hover:scale-[1.02]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Pacientes devendo</CardTitle>
                  <CardDescription>Contas a receber pendentes</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{snapshot.receivablesCount}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/agenda" className="transition-transform hover:scale-[1.02]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Faltas recentes</CardTitle>
                  <CardDescription>Ultimos 7 dias</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">
                  <UserX className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{stats.todayAbsent + alerts.filter((a) => a.type === "falta").length}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pacotes" className="transition-transform hover:scale-[1.02]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Sessoes restantes</CardTitle>
                  <CardDescription>Saldo de pacotes ativos</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <Building2 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{snapshot.remainingSessions}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/funcionarios" className="transition-transform hover:scale-[1.02]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Comissoes pendentes</CardTitle>
                  <CardDescription>Lancamentos a pagar</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{snapshot.pendingCommissionsCount}</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
