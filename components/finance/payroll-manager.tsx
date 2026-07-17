"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Plus, Printer, X, XCircle } from "lucide-react";
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
  ["salario_fixo", "Salário fixo"],
  ["comissao_manual", "Comissão manual"],
  ["vale_transporte", "Vale transporte"],
  ["vale_alimentacao", "Vale alimentacao"],
  ["ajuda_custo", "Ajuda de custo"],
  ["bonus", "Bônus"],
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

const natureOptions: Array<[PayrollNature, string]> = [["credito", "Crédito"], ["debito", "Débito"]];

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


function getPayrollDescription(item: PayrollWithKind) {
  if (item.source === "commission") {
    return item.description ?? "Comissão automática gerada pela Agenda";
  }

  return item.notes ?? entryTypeLabel(item.entry_type);
}

function payrollSectionTitle(item: PayrollWithKind) {
  if (item.source === "commission") return "Comissão automática";
  if (isCharge(item.entry_type, item.nature)) return getPayrollDescription(item);
  return entryTypeLabel(item.entry_type);
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

function defaultNatureForEntryType(type: string): PayrollNature {
  if (["desconto", "adiantamento", "inss", "fgts", "irrf", "vale_transporte", "vale_alimentacao"].includes(type)) {
    return "debito";
  }

  return "credito";
}

function isCredit(type: string, nature: string) {
  if (["desconto", "adiantamento", "inss", "fgts", "irrf", "vale_transporte", "vale_alimentacao"].includes(type)) return false;
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([]);
  const [moreOptionsOpen, setMoreOptionsOpen] = React.useState(false);
  const [periodMode, setPeriodMode] = React.useState<"current" | "previous" | "custom">("current");
  const [customStart, setCustomStart] = React.useState(`${currentYear()}-${currentMonth()}-01`);
  const [customEnd, setCustomEnd] = React.useState(today());
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
  const creditRows = filteredRows.filter((item) => isCredit(item.entry_type, item.nature));
  const debitRows = filteredRows.filter((item) => isCharge(item.entry_type, item.nature));
  const totals = {
    salaries: payrollOnlyRows.filter((item) => item.entry_type === "salario_fixo" && isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0),
    commissions: filteredRows.filter((item) => item.entry_type === "comissao_manual" && isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0),
    benefits: payrollOnlyRows.filter((item) => ["vale_transporte", "vale_alimentacao", "ajuda_custo", "bonus"].includes(item.entry_type) && isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0),
    discounts: payrollOnlyRows.filter((item) => ["desconto", "adiantamento"].includes(item.entry_type) || isCharge(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0),
    charges: payrollOnlyRows.filter((item) => ["inss", "fgts", "irrf"].includes(item.entry_type)).reduce((total, item) => total + item.amount, 0),
    credits: creditRows.reduce((total, item) => total + item.amount, 0),
    debits: debitRows.reduce((total, item) => total + item.amount, 0),
    paid: filteredRows.reduce((total, item) => total + getPaidAmount(item), 0),
    open: filteredRows.reduce((total, item) => total + getOpenAmount(item), 0)
  };
  const gross = totals.credits;
  const net = gross - totals.debits;
  const payslipRows = payslipEmployeeId ? filteredRows.filter((item) => item.employee_id === payslipEmployeeId) : [];
  const payslipEmployee = employees.find((employee) => employee.id === payslipEmployeeId);
  const selectedClinic = clinics.find((clinic) => clinic.id === clinicFilter);
  const filterEmployees = clinicFilter === "all" ? employees : employees.filter((employee) => employee.clinic_id === clinicFilter);
  const employeeSummaries = filterEmployees.map((employee) => {
    const rows = filteredRows.filter((item) => item.employee_id === employee.id);
    const salaries = rows.filter((item) => item.entry_type === "salario_fixo" && isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0);
    const commissions = rows.filter((item) => item.entry_type === "comissao_manual" && isCredit(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0);
    const discounts = rows.filter((item) => isCharge(item.entry_type, item.nature)).reduce((total, item) => total + item.amount, 0);
    const total = rows.filter((item) => isCredit(item.entry_type, item.nature)).reduce((sum, item) => sum + item.amount, 0) - discounts;
    const paid = rows.reduce((sum, item) => sum + getPaidAmount(item), 0);
    const open = rows.reduce((sum, item) => sum + getOpenAmount(item), 0);
    return { employee, rows, salaries, commissions, discounts, total, paid, open, status: open <= 0 && rows.length > 0 ? "pago" : paid > 0 ? "parcial" : "pendente" };
  }).filter((summary) => summary.rows.length > 0);
  const selectedSummaries = employeeSummaries.filter((summary) => selectedEmployeeIds.includes(summary.employee.id));
  const selectedOpen = selectedSummaries.reduce((total, summary) => total + summary.open, 0);

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]);
  }

  function toggleAllEmployees() {
    setSelectedEmployeeIds((current) => current.length === employeeSummaries.length ? [] : employeeSummaries.map((summary) => summary.employee.id));
  }

  function openSelectedPayments() {
    if (selectedEmployeeIds.length === 0 || selectedOpen <= 0) return;
    if (!window.confirm(`Confirmar pagamento de ${money(selectedOpen)} para ${selectedEmployeeIds.length} funcionário(s)?`)) return;
    const params = new URLSearchParams({ tab: "staff", employees: selectedEmployeeIds.join(","), month: monthFilter, year: yearFilter });
    router.push(`/financeiro/baixas?${params.toString()}`);
  }

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
    const employeeName = payslipEmployee?.name ?? "Funcionário";
    const clinicName = selectedClinic?.name ?? "Clínica";
    document.title = `${clinicName} - Contracheque - ${employeeName} - ${monthFilter}-${yearFilter}`;
    document.body.classList.add("mwf-payslip-printing");

    const restorePrintState = () => {
      document.body.classList.remove("mwf-payslip-printing");
      document.title = previousTitle;
      window.removeEventListener("afterprint", restorePrintState);
    };

    window.addEventListener("afterprint", restorePrintState);
    window.print();
    window.setTimeout(restorePrintState, 500);
  }

  return (
    <div className="grid gap-5">
      {message ? <SystemMessage message={message} onClose={() => setMessage(null)} /> : null}

      <div className="flex flex-wrap gap-2 print:hidden">
        {canCreate ? <Button type="button" onClick={openCreateForm}><Plus className="h-4 w-4" />Novo lançamento da folha</Button> : null}
        <Button type="button" onClick={openSelectedPayments} disabled={selectedEmployeeIds.length === 0 || selectedOpen <= 0}>Pagar selecionados</Button>
        <Button type="button" variant="outline" onClick={() => selectedEmployeeIds.length === 1 && setPayslipEmployeeId(selectedEmployeeIds[0])} disabled={selectedEmployeeIds.length !== 1}>Ver contracheques</Button>
        <div className="relative">
          <Button type="button" variant="outline" onClick={() => setMoreOptionsOpen((open) => !open)}>Mais opções</Button>
          {moreOptionsOpen ? <div className="absolute right-0 z-20 mt-2 grid min-w-52 gap-1 rounded-md border bg-card p-2 shadow-xl"><Button type="button" variant="ghost" onClick={() => router.push("/financeiro/baixas")}>Baixas e Repasses</Button><Button type="button" variant="ghost" onClick={() => router.push("/financeiro")}>Voltar ao Financeiro</Button><Button type="button" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button></div> : null}
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 print:hidden">
        A geração automática mensal ainda não está disponível porque o cadastro atual não possui salário, benefícios, descontos e encargos recorrentes configuráveis por funcionário. Use <strong>Novo lançamento da folha</strong> para registrar cada verba manualmente, sem risco de gerar despesas duplicadas.
      </Card>

      <section className="grid gap-3 md:grid-cols-3 print:hidden">
        <MetricCard label="Total líquido" value={money(net)} icon={FileText} />
        <MetricCard label="Total pago" value={money(totals.paid)} icon={CheckCircle2} />
        <MetricCard label="Pendente de pagamento" value={money(totals.open)} icon={XCircle} />
      </section>

      <Card className="border p-4 shadow-none print:hidden">
        <h2 className="text-sm font-semibold">Composição da folha</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Salários" value={money(totals.salaries)} />
          <Metric label="Comissões" value={money(totals.commissions)} />
          <Metric label="Benefícios" value={money(totals.benefits)} />
          <Metric label="Descontos" value={money(totals.discounts)} />
          <Metric label="Encargos" value={money(totals.charges)} />
        </div>
      </Card>

      <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none print:hidden">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => { setPeriodMode("current"); setMonthFilter(currentMonth()); setYearFilter(currentYear()); }}>Este mês</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setPeriodMode("previous"); const date = new Date(); date.setMonth(date.getMonth() - 1); setMonthFilter(String(date.getMonth() + 1).padStart(2, "0")); setYearFilter(String(date.getFullYear())); }}>Mês anterior</Button>
          <Button type="button" size="sm" variant={periodMode === "custom" ? "default" : "outline"} onClick={() => setPeriodMode("custom")}>Personalizado</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SelectField label="Clínica" value={clinicFilter} onChange={(value) => { setClinicFilter(value); setEmployeeFilter("all"); setSelectedEmployeeIds([]); }} options={[...(isAdmMaster ? [["all", "Todas as clínicas"] as [string, string]] : []), ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])]} disabled={!isAdmMaster} />
          <SelectField label="Mês" value={monthFilter} onChange={(value) => { setMonthFilter(value); setSelectedEmployeeIds([]); }} options={Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, "0"), new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))] as [string, string])} />
          <TextField label="Ano" value={yearFilter} onChange={(value) => { setYearFilter(value); setSelectedEmployeeIds([]); }} />
          <SelectField label="Funcionário" value={employeeFilter} onChange={setEmployeeFilter} options={[["all", "Todos"], ...filterEmployees.map((employee) => [employee.id, employee.name] as [string, string])]} />
          <SelectField label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as PayrollStatus | "all")} options={statusOptions} />
        </div>
        {periodMode === "custom" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><TextField label="Data inicial" type="date" value={customStart} onChange={setCustomStart} /><TextField label="Data final" type="date" value={customEnd} onChange={setCustomEnd} /></div> : null}
      </Card>

      {selectedEmployeeIds.length > 0 ? <Card className="flex flex-wrap items-center justify-between gap-3 border p-4 print:hidden"><div><p className="text-sm font-semibold">{selectedEmployeeIds.length} funcionário(s) selecionado(s)</p><p className="text-sm text-muted-foreground">Pendente de pagamento: {money(selectedOpen)}</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={openSelectedPayments} disabled={selectedOpen <= 0}>Pagar selecionados</Button><Button type="button" variant="outline" onClick={() => selectedEmployeeIds.length === 1 && setPayslipEmployeeId(selectedEmployeeIds[0])} disabled={selectedEmployeeIds.length !== 1}>Gerar contracheques</Button><Button type="button" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button></div></Card> : null}

      <Card className="border-none p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none print:hidden">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Funcionários</h2><p className="text-sm text-muted-foreground">Resumo da folha por funcionário.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={employeeSummaries.length > 0 && selectedEmployeeIds.length === employeeSummaries.length} onChange={toggleAllEmployees} />Selecionar todos</label></div>
        <div className="hidden grid-cols-[auto_minmax(130px,1.4fr)_repeat(6,minmax(100px,1fr))] gap-3 border-b pb-2 text-xs font-semibold text-muted-foreground lg:grid"><span></span><span>Funcionário</span><span>Salário</span><span>Comissões</span><span>Descontos</span><span>Total líquido</span><span>Pago</span><span>Pendente / Status</span></div>
        <div className="grid gap-3">
          {employeeSummaries.map((summary) => <article key={summary.employee.id} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[auto_minmax(130px,1.4fr)_repeat(6,minmax(100px,1fr))] lg:items-center"><input type="checkbox" aria-label={`Selecionar ${summary.employee.name}`} checked={selectedEmployeeIds.includes(summary.employee.id)} onChange={() => toggleEmployee(summary.employee.id)} /><strong className="text-sm">{summary.employee.name}</strong><Metric label="Salário" value={money(summary.salaries)} /><Metric label="Comissões" value={money(summary.commissions)} /><Metric label="Descontos" value={money(summary.discounts)} /><Metric label="Total líquido" value={money(summary.total)} /><Metric label="Pago" value={money(summary.paid)} /><div><Metric label="Pendente" value={money(summary.open)} /><StatusBadge status={summary.status} /></div></article>)}
          {employeeSummaries.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento de folha encontrado.</p> : null}
        </div>
      </Card>
      {formOpen ? (
        <PayrollFormModal form={form} setForm={setForm} formMessage={formMessage} clinics={clinics} employees={formEmployees} isAdmMaster={isAdmMaster} isPending={isPending} onSubmit={submitForm} onClose={closeForm} />
      ) : null}

      {payslipEmployeeId ? (
        <PayslipModal employeeName={payslipEmployee?.name ?? "Funcionário"} clinicName={selectedClinic?.name ?? payslipRows[0]?.clinic_name ?? "Clínica"} period={`${monthFilter}/${yearFilter}`} rows={payslipRows} onPrint={printPayslip} onClose={() => setPayslipEmployeeId(null)} />
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
            <h2 className="text-lg font-semibold tracking-normal">Novo lançamento da folha</h2>
            <p className="text-sm text-muted-foreground">O lançamento será criado também como despesa no Financeiro.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
            <SelectField label="Clínica" value={form.clinic_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, clinic_id: value, employee_id: "" }))} options={clinics.map((clinic) => [clinic.id, clinic.name])} disabled={!isAdmMaster || clinics.length === 1} required />
            <SelectField label="Funcionário/Profissional" value={form.employee_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))} options={employeeOptions} disabled={!form.clinic_id} required />
            <SelectField label="Mês" value={form.competence_month} onChange={(value) => setForm((current) => ({ ...current, competence_month: value }))} options={Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, "0"), String(index + 1).padStart(2, "0")] as [string, string])} required />
            <TextField label="Ano" value={form.competence_year} onChange={(value) => setForm((current) => ({ ...current, competence_year: value }))} required />
            <SelectField label="Tipo" value={form.entry_type} onChange={(value) => setForm((current) => ({ ...current, entry_type: value as PayrollEntryType, nature: defaultNatureForEntryType(value) }))} options={entryTypeOptions} required />
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

function PayslipModal({ employeeName, clinicName, period, rows, onPrint, onClose }: { employeeName: string; clinicName: string; period: string; rows: PayrollWithKind[]; onPrint: () => void; onClose: () => void }) {
  const creditRows = rows.filter((item) => isCredit(item.entry_type, item.nature));
  const debitRows = rows.filter((item) => isCharge(item.entry_type, item.nature));
  const gross = creditRows.reduce((total, item) => total + item.amount, 0);
  const discounts = debitRows.reduce((total, item) => total + item.amount, 0);
  const net = gross - discounts;
  return (
    <div className="payslip-print-root fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
      <Card className="payslip-document w-full max-w-4xl border-none p-5 shadow-2xl print:shadow-none">
        <div className="payslip-screen-actions flex items-start justify-between gap-4 border-b pb-4 print:hidden">
          <div><h2 className="text-lg font-semibold tracking-normal">Contracheque</h2><p className="text-sm text-muted-foreground">{employeeName} - {period}</p></div>
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />Imprimir / PDF</Button><button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button></div>
        </div>
        <div className="payslip-content space-y-4 print:block">
          <div className="hidden print:block print:mb-3 print:border-b print:pb-2"><strong className="print:block print:text-[13px]">MWFSystem</strong><div className="print:text-[18px] print:font-semibold">Contracheque</div></div>
          <div className="payslip-summary grid gap-3 pt-4 md:grid-cols-4 print:grid-cols-4 print:pt-0">
            <Detail label="Clínica" value={clinicName} />
            <Detail label="Funcionário" value={employeeName} />
            <Detail label="Competencia" value={period} />
            <Detail label="Status" value={rows.some((item) => item.financial_status !== "pago") ? "Em aberto" : "Pago"} />
            <Detail label="Total de creditos" value={money(gross)} />
            <Detail label="Total de descontos" value={money(discounts)} />
            <Detail label="Total liquido" value={money(net)} />
            <Detail label="Emissao" value={today()} />
          </div>
          <PayslipSection title="Créditos" rows={creditRows} emptyText="Nenhum crédito no período." />
          <PayslipSection title="Descontos" rows={debitRows} emptyText="Nenhum desconto no periodo." />
          <div className="payslip-total grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-3 print:grid-cols-3">
            <Detail label="Total de creditos" value={money(gross)} />
            <Detail label="Total de descontos" value={money(discounts)} />
            <Detail label="Liquido a receber" value={money(net)} />
          </div>
          <div className="hidden print:grid print:grid-cols-2 print:gap-12 print:pt-10 print:text-center print:text-[11px]">
            <div className="print:border-t print:border-slate-700 print:pt-2">Assinatura do funcionario</div>
            <div className="print:border-t print:border-slate-700 print:pt-2">Assinatura da clínica</div>
          </div>
        </div>
      </Card>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body.mwf-payslip-printing * {
            visibility: hidden !important;
          }

          body.mwf-payslip-printing .payslip-print-root,
          body.mwf-payslip-printing .payslip-print-root * {
            visibility: visible !important;
          }

          body.mwf-payslip-printing {
            background: #ffffff !important;
          }

          body.mwf-payslip-printing .payslip-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            display: block !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
          }

          body.mwf-payslip-printing .payslip-document {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            color: #111827 !important;
            background: #ffffff !important;
          }

          body.mwf-payslip-printing .payslip-content {
            display: block !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }

          body.mwf-payslip-printing .payslip-summary,
          body.mwf-payslip-printing .payslip-total {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            gap: 6px !important;
            margin-bottom: 8px !important;
          }

          body.mwf-payslip-printing .payslip-total {
            padding: 6px !important;
            border: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
          }

          body.mwf-payslip-printing table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 9px !important;
          }

          body.mwf-payslip-printing th,
          body.mwf-payslip-printing td {
            border: 1px solid #d1d5db !important;
            padding: 4px 5px !important;
            vertical-align: top !important;
            color: #111827 !important;
          }

          body.mwf-payslip-printing thead {
            background: #e5e7eb !important;
          }

          body.mwf-payslip-printing tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

function PayslipSection({ title, rows, emptyText }: { title: string; rows: PayrollWithKind[]; emptyText: string }) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold tracking-normal">{title}</h3>
      <table className="w-full min-w-[760px] text-left text-xs print:min-w-0">
        <thead className="bg-muted/60 uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Descrição/Observacao</th>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2 text-right">Valor</th>
            <th className="px-3 py-2 print:hidden">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((item) => (
            <tr key={`${item.source}-${item.id}`} className="border-t">
              <td className="px-3 py-2">{payrollSectionTitle(item)}</td>
              <td className="max-w-72 px-3 py-2"><span className="line-clamp-2" title={getPayrollDescription(item)}>{getPayrollDescription(item)}</span></td>
              <td className="px-3 py-2">{item.source === "commission" ? "Agenda" : "Folha"}</td>
              <td className="px-3 py-2 text-right">{money(item.amount)}</td>
              <td className="px-3 py-2 print:hidden">{statusLabel(item.financial_status)}</td>
            </tr>
          )) : (
            <tr><td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={5}>{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function SystemMessage({ message, onClose }: { message: PayrollActionResult; onClose: () => void }) {
  return <div className={cn("flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-sm", message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100")}><span>{message.message}</span><button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X className="h-4 w-4" /></button></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", statusClass(status))}>{statusLabel(status)}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block truncate font-mono text-sm">{value}</strong></div>;
}
function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><strong className="mt-2 block text-xl font-semibold tracking-normal">{value}</strong></div><span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span></div></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-background p-3 print:p-2"><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 break-words font-medium text-foreground">{value}</div></div>;
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


