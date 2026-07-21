import { AlertTriangle, CalendarDays, ClipboardList, CreditCard, MessageCircle, PackageCheck, Search, UserPlus, UsersRound, WalletCards } from "lucide-react";
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

type Props = { searchParams: Promise<{ q?: string }> };
type Patient = { id:string; full_name:string; cpf:string|null; phone:string|null; email:string|null };
const route = (value:string) => value as Route;
const digits = (value:string|null) => (value || "").replace(/D/g, "");

export default async function DashboardPage({ searchParams }: Props) {
  const q = ((await searchParams).q || "").trim();
  const [data, permissions, scope] = await Promise.all([getDashboardData(), getCurrentPermissionMap(), getCurrentClinicScope()]);
  const supabase = await createClient();
  let patients: Patient[] = [];
  if (q.length >= 2) {
    const term = q.replaceAll("%", "\%").replaceAll(",", " ");
    let query = supabase.from("patients").select("id,full_name,cpf,phone,email").or("full_name.ilike.%" + term + "%,cpf.ilike.%" + term + "%,phone.ilike.%" + term + "%,email.ilike.%" + term + "%").order("full_name").limit(12);
    if (scope.clinicId) query = query.eq("clinic_id", scope.clinicId);
    patients = (await query).data || [];
  }
  const today = new Date().toISOString().slice(0,10);
  const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
  let openQuery = supabase.from("financial_transactions").select("patient_id,due_date").eq("transaction_type","receita").in("status",["pendente","parcial"]);
  let packageQuery = supabase.from("patient_packages").select("id").eq("status","active").gte("expiration_date",today).lte("expiration_date",limit);
  if (scope.clinicId) { openQuery = openQuery.eq("clinic_id",scope.clinicId); packageQuery = packageQuery.eq("clinic_id",scope.clinicId); }
  const [openResult, packageResult] = await Promise.all([openQuery,packageQuery]);
  const openRows = openResult.data || [];
  const pending = [
    ["Agendamentos sem baixa", data.alerts.filter(a => a.type === "sem_baixa").length, "/agenda", CalendarDays, permissions.agenda.view],
    ["Pacientes em aberto", new Set(openRows.map(r => r.patient_id).filter(Boolean)).size, "/financeiro/baixas", UsersRound, permissions.financeiro.view],
    ["Pagamentos vencidos", openRows.filter(r => r.due_date < today).length, "/financeiro/baixas", AlertTriangle, permissions.financeiro.view],
    ["Pacotes proximos do vencimento", (packageResult.data || []).length, "/pacotes", PackageCheck, permissions.pacotes.view]
  ] as const;
  const quick = [
    ["Novo paciente","/pacientes?new=1",UserPlus,permissions.pacientes.create],
    ["Novo agendamento","/agenda?new=1",CalendarDays,permissions.agenda.create],
    ["Receber pagamento","/financeiro/baixas",CreditCard,permissions.financeiro.edit],
    ["Abrir Agenda","/agenda",CalendarDays,permissions.agenda.view],
    ["Pacientes em aberto","/financeiro/baixas",UsersRound,permissions.financeiro.view],
    ["Abrir prontuario","/prontuarios",ClipboardList,permissions.prontuarios.view],
    ["Baixas financeiras","/financeiro/baixas",WalletCards,permissions.financeiro.view]
  ] as const;

  return <div className="space-y-6">
    <PageHeader eyebrow="Operacao de hoje" title="Dashboard operacional" description="Encontre pacientes e acesse rapidamente as tarefas mais importantes da clinica." />
    <Card className="border-primary/20"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5 text-primary"/>Pesquisa global de pacientes</CardTitle><CardDescription>Busque por nome, CPF, telefone ou e-mail.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><form action="/dashboard" className="flex flex-col gap-2 sm:flex-row"><input name="q" defaultValue={q} minLength={2} placeholder="Nome, CPF, telefone ou e-mail" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"/><Button type="submit"><Search className="h-4 w-4"/>Pesquisar</Button></form>
      {q.length === 1 && <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>}
      {q.length >= 2 && patients.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>}
      <div className="grid gap-3">{patients.map(patient => {
        const phone = digits(patient.phone); const whatsapp = phone ? "https://wa.me/" + (phone.startsWith("55") ? phone : "55" + phone) : "";
        const actions = [
          ["Abrir ficha","/pacientes?patientId="+patient.id,permissions.pacientes.view],
          ["Agendar","/agenda?patientId="+patient.id+"&new=1",permissions.agenda.create],
          ["Receber","/financeiro/baixas?patientId="+patient.id,permissions.financeiro.edit],
          ["Prontuario","/prontuarios?q="+encodeURIComponent(patient.full_name),permissions.prontuarios.view],
          ["Pacotes","/pacotes?patientId="+patient.id,permissions.pacotes.view]
        ] as const;
        return <div key={patient.id} className="rounded-xl border p-4"><p className="truncate font-semibold">{patient.full_name}</p><p className="mb-3 truncate text-xs text-muted-foreground">{[patient.cpf,patient.phone,patient.email].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
          <div className="flex flex-wrap gap-2">{actions.filter(a => a[2]).map(a => <Button key={a[0]} asChild size="sm" variant="outline"><Link href={route(a[1])}>{a[0]}</Link></Button>)}{whatsapp ? <Button asChild size="sm" variant="outline"><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4"/>WhatsApp</a></Button> : <Button size="sm" variant="outline" disabled>WhatsApp</Button>}</div>
        </div>;
      })}</div></CardContent>
    </Card>
    <MwfAssistant
      contextKey={scope.clinicId ?? "all-clinics"}
      alerts={pending.map(([label, value, href, , allowed]) => ({ label, value, href, allowed }))}
    />
    <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Acoes rapidas</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{quick.filter(a => a[3]).map(([label,href,Icon]) => <Button key={label} asChild variant="outline" className="h-20 whitespace-normal"><Link href={route(href)} className="flex-col gap-2 text-center"><Icon className="h-5 w-5 text-primary"/>{label}</Link></Button>)}</div></section>
    <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pendencias</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{pending.filter(a => a[4]).map(([label,value,href,Icon]) => <Link key={label} href={route(href)}><Card className="h-full hover:border-primary/40"><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 shrink-0 text-primary"/><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card></Link>)}</div></section>
    <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Agenda de hoje</CardTitle><CardDescription>{data.stats.todayTotal} atendimento(s)</CardDescription></div><Button asChild size="sm" variant="outline"><Link href="/agenda">Ver agenda completa</Link></Button></CardHeader><CardContent>
      {data.todayAppointments.length === 0 ? <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Agenda livre hoje.</p> : <div className="grid gap-2">{data.todayAppointments.slice(0,10).map(item => <Link key={item.id} href={route("/agenda?appointmentId="+item.id)} className="grid min-w-0 grid-cols-[48px_1fr_auto] items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"><strong className="text-primary">{item.start_time.slice(0,5)}</strong><div className="min-w-0"><p className="truncate text-sm font-medium">{item.patient_name}</p><p className="truncate text-xs text-muted-foreground">{item.service_name} · {item.employee_name}</p></div><span className="hidden rounded-full bg-muted px-2 py-1 text-xs sm:inline">{item.status}</span></Link>)}</div>}
    </CardContent></Card>
  </div>;
}
