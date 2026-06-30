"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, FileText, Plus, Printer, WalletCards, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PermissionSet } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import {
  createPayrollEntry,
  type PayrollActionResult,
  type PayrollEntryFormInput,
  type PayrollEntryType,
  type PayrollNature,
  type PayrollStatus
} from "@/app/(app)/financeiro/folha/actions";

type PayrollEntry = Database["public"]["Tables"]["payroll_entries"]["Row"] & {
  clinic_name: string;
  employee_name: string;
  financial_status: string;
  financial_paid_amount: number;
  financial_open_amount: number;
};
type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"] & {
  clinic_name: string;
  employee_name: string;
};
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

type PayrollManagerProps = {
  entries: PayrollEntry[];
  commissionTransactions: FinancialTransaction[];
  clinics: Clinic[];
  employees: Employee[];
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
};

type PayrollWithKind =
  | (PayrollEntry & { source: "payroll" })
  | (FinancialTransaction & { source: "commission"; competence_month: number; competence_year: number; entry_type: PayrollEntryType; nature: PayrollNature; financial_status: string; financial_paid_amount: number; financial_open_amount: number });

const entryTypeOptions: Array<[PayrollEntryType, string]> = [
  ["salario_fixo", "Salario fixo"],
  ["comissao_manual", "Comissao manual"],
  ["vale_transporte", "Vale transporte"],
  ["vale_alimentacao", "Vale alimentacao"],
  ["ajuda_custo", "Ajuda de custo"],
  ["bonus", "Bonus"],
  ["desconto", "Desconto"],
  ["adiantamento", "Adiantamento"],
  ["inss", "INSS"],
  ["fgts", "FGTS"],
  ["irrf", "IRRF"],
  ["outros", "Outros"]
];

const statusOptions: Array<[PayrollStatus | "all", string]> = [
  ["all", "Todos"],
  ["pendente", "Aberto"],
  ["parcial", "Parcial"],
  ["pago", "Pago"],
  ["cancelado", "Cancelado"]
];

const natureOptions: Array<[PayrollNature, string]> = [["credito", "Credito"], ["debito", "Debito"]];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return String(new Date().getMonth() + 1).padStart(2, "0");
}

function currentYear() {
  return String(new Date().getFullYear());
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}


function entryTypeLabel(type: string) {
  return entryTypeOptions.find(([value]) => value === type)?.[1] ?? type;
}

function statusLabel(status: string) {
  return ({ pendente: "Aberto", parcial: "Parcial", pago: "Pago", cancelado: "Cancelado", vencido: "Vencido" } as Record<string, string>)[status] ?? status;
}

function statusClass(status: string) {
  if (status === "pago") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  if (status === "parcial") return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-100";
  if (status === "cancelado") return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  if (status === "vencido") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
}

function isCredit(type: string, nature: string) {
  if (["desconto", "adiantamento", "inss", "fgts", "irrf"].includes(type)) return false;
  return nature === "credito";
}

function isCharge(type: string, nature: string) {
  return !isCredit(type, nature);
}

function getOpenAmount(item: PayrollWithKind) {
  return Math.max(Number(item.financial_open_amount ?? 0), 0);
}

function getPaidAmount(item: PayrollWithKind) {
  return Math.max(Number(item.financial_paid_amount ?? 0), 0);
}

function transactionMonth(date: string) {
  const parts = date.slice(0, 10).split("-");
  return Number(parts[1] ?? new Date().getMonth() + 1);
}

function transactionYear(date: string) {
  const parts = date.slice(0, 10).split("-");
  return Number(parts[0] ?? new Date().getFullYear());
}

function emptyForm(currentClinicId: string | null): PayrollEntryFormInput {
  return {
    clinic_id: currentClinicId ?? "",
    employee_id: "",
    competence_month: currentMonth(),
    competence_year: currentYear(),
    entry_type: "salario_fixo",
    nature: "credito",
    amount: "0",
    due_date: today(),
    status: "pendente",
    notes: ""
  };
}

export function PayrollManager({ entries, commissionTransactions, clinics, employees, currentClinicId, isAdmMaster, loadError, permissions }: PayrollManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<PayrollActionResult | null>(loadError ? { ok: false, message: loadError } : null);
  const [formMessage, setFormMessage] = React.useState<PayrollActionResult | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [payslipEmployeeId, setPayslipEmployeeId] = React.useState<string | null>(null);
  const [clinicFilter, setClinicFilter] = React.useState(currentClinicId ?? "all");
  const [monthFilter, setMonthFilter] = React.useState(currentMonth());
  const [yearFilter, setYearFilter] = React.useState(currentYear());
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<PayrollStatus | "all">("all");
  const [form, setForm] = React.useState<PayrollEntryFormInput>(() => emptyForm(currentClinicId));

  const canCreate = permissions?.create ?? true;
  const defaultClinicId = currentClinicId ?? (clinics.length === 1 ? clinics[0]?.id ?? "" : "" );
  const formEmployees = form.clinic_id ? employees.filter((employee) => employee.clinic_id === form.clinic_id) : [];

  const payrollRows: PayrollWithKind[] = entries.map((entry) => ({ ...entry, source: "payroll" }));
  const automaticCommissions: PayrollWithKind[] = commissionTransactions.map((transaction) => ({
    ...transaction,
    source: "commission",
    competence_month: transactionMonth(transaction.due_date),
    competence_year: transactionYear(transaction.due_date),
    entry_type: "comissao_manual",
    nature: "credito",
    financial_status: transaction.status,
    financial_paid_amount: Number(transaction.paid_amount ?? 0),
    financial_open_amount: Number(transaction.open_amount ?? Math.max(transaction.amount - Number(transaction.paid_amount ?? 0), 0))
  }));
  const allRows = [...payrollRows, ...automaticCommissions];

  const filteredRows = allRows.filter((item) => {
    if (clinicFilter !== "all" && item.clinic_id !== clinicFilter) return false;
    if (employeeFilter !== "all" && item.employee_id !== employeeFilter) return false;
    if (monthFilter && item.competence_month !== Number(monthFilter)) return false;
    if (yearFilter && item.competence_year !== Number(yearFilter)) return false;
    if (statusFilter !== "all" && item.financial_status !== statusFilter) return false;
    return true;
  });

  const payrollOnlyRows = filteredRows.filter((item) => item.source === "payroll");
  const totals = {
    salaries: payrollOnlyRows.filter((item) => item.entry_type === "salario_fixo").reduce((total, item) => total + item.amount, 0),
    commissions: filteredRows.filter((item) => item.entry_type === "comissao_manual").reduce((total, item) => total + item.amount, 0),
    benefits: payrollOnlyRows.filter((item) => ["vale_transporte", "vale_alimentacao", "ajuda_custo", "bonus"].includes(item.entry_type)).reduce((total, item) => total + item.amount, 0),
    discounts: payrollOnlyRows.filter((item) => ["desconto", "adiantamento"].includes(item.entry_type)).reduce((total, item) => total + item.amount, 0),
    charges: payrollOnlyRows.filter((item) => ["inss", "fgts", "irrf"].includes(item.entry_type)).reduce((total, item) => total + item.amount, 0),
    paid: filteredRows.reduce((total, item) => total + getPaidAmount(item), 0),
    open: filteredRows.reduce((total, item) => total + getOpenAmount(item), 0)
  };
  const gross = totals.salaries + totals.commissions + totals.benefits;
  const net = gross - totals.discounts - totals.charges;
  const payslipRows = payslipEmployeeId ? filteredRows.filter((item) => item.employee_id === payslipEmployeeId) : [];
  const payslipEmployee = employees.find((employee) => employee.id === payslipEmployeeId);
  const selectedClinic = clinics.find((clinic) => clinic.id === clinicFilter);
  const filterEmployees = clinicFilter === "all" ? employees : employees.filter((employee) => employee.clinic_id === clinicFilter);

  function openCreateForm() {
    setForm({ ...emptyForm(defaultClinicId), clinic_id: defaultClinicId });
    setMessage(null);
    setFormMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setForm({ ...emptyForm(defaultClinicId), clinic_id: defaultClinicId });
    setFormMessage(null);
    setFormOpen(false);
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPayrollEntry({ ...form, status: "pendente" });
      if (result.ok) {
        setMessage(result);
        closeForm();
        router.refresh();
      } else {
        setFormMessage(result);
      }
    });
  }

  function printPayslip() {
    const previousTitle = document.title;
    const employeeName = payslipEmployee?.name ?? "Funcionario";
    const clinicName = selectedClinic?.name ?? "Clinica";
    document.title = `${clinicName} - Contracheque - ${employeeName} - ${monthFilter}-${yearFilter}`;
    window.print();
    document.title = previousTitle;
  }

  return (
    <div className="grid gap-5">
      {message ? <SystemMessage message={message} onClose={() => setMessage(null)} /> : null}

      <div className="flex flex-wrap gap-2 print:hidden">
        {canCreate ? <Button type="button" onClick={openCreateForm}><Plus className="h-4 w-4" />Novo lancamento da folha</Button> : null}
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro/baixas")}>Baixas e Repasses</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro")}>Voltar ao Financeiro</Button>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <MetricCard label="Total salarios" value={money(totals.salaries)} icon={WalletCards} />
        <MetricCard label="Total comissoes" value={money(totals.commissions)} icon={ArrowUpRight} />
        <MetricCard label="Total beneficios" value={money(totals.benefits)} icon={CheckCircle2} />
        <MetricCard label="Total descontos" value={money(totals.discounts)} icon={ArrowDownRight} />
        <MetricCard label="INSS/encargos" value={money(totals.charges)} icon={XCircle} />
        <MetricCard label="Liquido da folha" value={money(net)} icon={FileText} />
        <MetricCard label="Total pago" value={money(totals.paid)} icon={CheckCircle2} />
        <MetricCard label="Total em aberto" value={money(totals.open)} icon={XCircle} />
      </section>

      <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none print:hidden">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SelectField label="Clinica" value={clinicFilter} onChange={(value) => { setClinicFilter(value); setEmployeeFilter("all"); }} options={[...(isAdmMaster ? [["all", "Todas as clinicas"] as [string, string]] : []), ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])]} disabled={!isAdmMaster} />
          <SelectField label="Mes" value={monthFilter} onChange={setMonthFilter} options={Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, "0"), String(index + 1).padStart(2, "0")] as [string, string])} />
          <TextField label="Ano" value={yearFilter} onChange={setYearFilter} />
          <SelectField label="Funcionario" value={employeeFilter} onChange={setEmployeeFilter} options={[["all", "Todos"], ...filterEmployees.map((employee) => [employee.id, employee.name] as [string, string])]} />
          <SelectField label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as PayrollStatus | "all")} options={statusOptions} />
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold tracking-normal">Folha / Contracheque</h2>
          <p className="text-sm text-muted-foreground">Lancamentos de folha e comissoes automaticas ja existentes, sem duplicar valores.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-muted/60 uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Funcionario</th>
                <th className="px-3 py-2">Clinica</th>
                <th className="px-3 py-2">Competencia</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Natureza</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-right">Pago</th>
                <th className="px-3 py-2 text-right">Em aberto</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right print:hidden">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? filteredRows.map((item) => (
                <tr key={`${item.source}-${item.id}`} className="border-t hover:bg-muted/30">
                  <TruncatedCell value={item.employee_name} strong />
                  <TruncatedCell value={item.clinic_name} />
                  <td className="whitespace-nowrap px-3 py-2">{String(item.competence_month).padStart(2, "0")}/{item.competence_year}</td>
                  <td className="whitespace-nowrap px-3 py-2">{item.source === "commission" ? "Comissao automatica" : entryTypeLabel(item.entry_type)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{isCredit(item.entry_type, item.nature) ? "Credito" : "Debito"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(item.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{money(getPaidAmount(item))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(getOpenAmount(item))}</td>
                  <td className="whitespace-nowrap px-3 py-2">{item.due_date}</td>
                  <td className="whitespace-nowrap px-3 py-2"><StatusBadge status={item.financial_status} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right print:hidden"><Button type="button" size="sm" variant="outline" onClick={() => setPayslipEmployeeId(item.employee_id)}>Contracheque</Button></td>
                </tr>
              )) : <tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum lancamento de folha encontrado para os filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen ? (
        <PayrollFormModal form={form} setForm={setForm} formMessage={formMessage} clinics={clinics} employees={formEmployees} isAdmMaster={isAdmMaster} isPending={isPending} onSubmit={submitForm} onClose={closeForm} />
      ) : null}

      {payslipEmployeeId ? (
        <PayslipModal employeeName={payslipEmployee?.name ?? "Funcionario"} clinicName={selectedClinic?.name ?? payslipRows[0]?.clinic_name ?? "Clinica"} period={`${monthFilter}/${yearFilter}`} rows={payslipRows} gross={payslipRows.filter((item) => isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0)} discounts={payslipRows.filter((item) => isCharge(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0)} onPrint={printPayslip} onClose={() => setPayslipEmployeeId(null)} />
      ) : null}
    </div>
  );
}

function PayrollFormModal({ form, setForm, formMessage, clinics, employees, isAdmMaster, isPending, onSubmit, onClose }: { form: PayrollEntryFormInput; setForm: React.Dispatch<React.SetStateAction<PayrollEntryFormInput>>; formMessage: PayrollActionResult | null; clinics: Clinic[]; employees: Employee[]; isAdmMaster: boolean; isPending: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const amount = Number.parseFloat(form.amount.replace(",", ".")) || 0;
  const employeeOptions = employees.map((employee) => [employee.id, employee.name] as [string, string]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden">
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-auto border-none shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Novo lancamento da folha</h2>
            <p className="text-sm text-muted-foreground">O lancamento sera criado tambem como despesa no Financeiro.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
            <SelectField label="Clinica" value={form.clinic_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, clinic_id: value, employee_id: "" }))} options={clinics.map((clinic) => [clinic.id, clinic.name])} disabled={!isAdmMaster || clinics.length === 1} required />
            <SelectField label="Funcionario/Profissional" value={form.employee_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))} options={employeeOptions} disabled={!form.clinic_id} required />
            <SelectField label="Mes" value={form.competence_month} onChange={(value) => setForm((current) => ({ ...current, competence_month: value }))} options={Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, "0"), String(index + 1).padStart(2, "0")] as [string, string])} required />
            <TextField label="Ano" value={form.competence_year} onChange={(value) => setForm((current) => ({ ...current, competence_year: value }))} required />
            <SelectField label="Tipo" value={form.entry_type} onChange={(value) => setForm((current) => ({ ...current, entry_type: value as PayrollEntryType }))} options={entryTypeOptions} required />
            <SelectField label="Natureza" value={form.nature} onChange={(value) => setForm((current) => ({ ...current, nature: value as PayrollNature }))} options={natureOptions} required />
            <TextField label="Valor" type="number" step="0.01" value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} required />
            <TextField label="Vencimento" type="date" value={form.due_date} onChange={(value) => setForm((current) => ({ ...current, due_date: value }))} required />
          </div>
          <div className="px-5"><TextAreaField label="Observacao" value={form.notes ?? ""} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} /></div>
          <div className="px-5">{formMessage ? <SystemMessage message={formMessage} onClose={() => undefined} /> : null}</div>
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-card px-5 py-4">
            <span className="text-sm font-semibold text-muted-foreground">Total: {money(amount)}</span>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button></div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PayslipModal({ employeeName, clinicName, period, rows, gross, discounts, onPrint, onClose }: { employeeName: string; clinicName: string; period: string; rows: PayrollWithKind[]; gross: number; discounts: number; onPrint: () => void; onClose: () => void }) {
  const net = gross - discounts;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
      <Card className="w-full max-w-4xl border-none p-5 shadow-2xl print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b pb-4 print:hidden">
          <div><h2 className="text-lg font-semibold tracking-normal">Contracheque</h2><p className="text-sm text-muted-foreground">{employeeName} - {period}</p></div>
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />Imprimir / PDF</Button><button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button></div>
        </div>
        <div className="space-y-4 print:block">
          <div className="hidden print:block print:mb-3"><strong>MWFSystem</strong><div>Contracheque</div></div>
          <div className="grid gap-3 pt-4 md:grid-cols-4 print:grid-cols-4 print:pt-0">
            <Detail label="Clinica" value={clinicName} />
            <Detail label="Funcionario" value={employeeName} />
            <Detail label="Competencia" value={period} />
            <Detail label="Status" value={rows.some((item) => item.financial_status !== "pago") ? "Em aberto" : "Pago"} />
            <Detail label="Total bruto" value={money(gross)} />
            <Detail label="Descontos/encargos" value={money(discounts)} />
            <Detail label="Total liquido" value={money(net)} />
            <Detail label="Emissao" value={today()} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs print:min-w-0">
              <thead className="bg-muted/60 uppercase text-muted-foreground"><tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Natureza</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody>{rows.map((item) => <tr key={`${item.source}-${item.id}`} className="border-t"><td className="px-3 py-2">{item.source === "commission" ? "Comissao automatica" : entryTypeLabel(item.entry_type)}</td><td className="px-3 py-2">{item.source === "commission" ? "Agenda" : "Folha"}</td><td className="px-3 py-2">{isCredit(item.entry_type, item.nature) ? "Credito" : "Debito"}</td><td className="px-3 py-2 text-right">{money(item.amount)}</td><td className="px-3 py-2">{statusLabel(item.financial_status)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SystemMessage({ message, onClose }: { message: PayrollActionResult; onClose: () => void }) {
  return <div className={cn("flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-sm", message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100")}><span>{message.message}</span><button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X className="h-4 w-4" /></button></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", statusClass(status))}>{statusLabel(status)}</span>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><strong className="mt-2 block text-xl font-semibold tracking-normal">{value}</strong></div><span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span></div></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-background p-3 print:p-2"><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 break-words font-medium text-foreground">{value}</div></div>;
}

function TruncatedCell({ value, strong = false }: { value: string; strong?: boolean }) {
  return <td className={cn("max-w-44 truncate px-3 py-2", strong && "font-semibold text-foreground")} title={value}>{value}</td>;
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">{label}{children}</label>;
}

function TextField({ label, value, onChange, type = "text", step, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string; required?: boolean }) {
  return <FieldShell label={label}><input type={type} step={step} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></FieldShell>;
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FieldShell label={label}><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></FieldShell>;
}

function SelectField({ label, value, onChange, options, required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; required?: boolean; disabled?: boolean }) {
  return <FieldShell label={label}><select required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70"><option value="">Selecione</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></FieldShell>;
}