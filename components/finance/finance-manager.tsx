"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Plus,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PermissionSet } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import {
  cancelFinancialTransaction,
  createFinancialTransaction,
  deleteFinancialTransaction,
  markFinancialTransactionAsPaid,
  updateFinancialTransaction,
  type FinancialActionResult,
  type FinancialOrigin,
  type FinancialStatus,
  type FinancialTransactionFormInput,
  type FinancialTransactionType,
  type PaymentMethod
} from "@/app/(app)/financeiro/actions";

type FinancialTransaction =
  Database["public"]["Tables"]["financial_transactions"]["Row"] & {
    clinic_name: string;
    patient_name: string;
    employee_name: string;
    service_name: string;
    derived_status: FinancialStatus;
  };
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

type FinanceManagerProps = {
  transactions: FinancialTransaction[];
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
};

type FinanceTab =
  | "entradas"
  | "saidas"
  | "pacientes"
  | "funcionarios"
  | "fluxo"
  | "balancete";

const statusOptions: Array<[FinancialStatus, string]> = [
  ["pendente", "Pendente"],
  ["pago", "Pago"],
  ["vencido", "Vencido"],
  ["parcial", "Parcial"],
  ["cancelado", "Cancelado"]
];

const originOptions: Array<[FinancialOrigin, string]> = [
  ["avulso", "Avulso"],
  ["pacote", "Pacote"],
  ["manual", "Manual"]
];

const paymentMethodOptions: Array<[PaymentMethod, string]> = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartao"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"]
];

const expenseCategoryOptions = [
  "ADM / Funcionarios",
  "ComissÃƒÂµes",
  "Aluguel",
  "Energia",
  "Agua",
  "Internet / Telefone",
  "Sistema / Software",
  "Material de escritorio",
  "Material clinico",
  "Limpeza",
  "Manutencao",
  "Impostos / Taxas",
  "Salarios",
  "Terceirizados",
  "Marketing",
  "Outros"
].map((category) => [category, category] as [string, string]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

const emptyForm: FinancialTransactionFormInput = {
  clinic_id: "",
  transaction_type: "receita",
  patient_id: "",
  employee_id: "",
  service_id: "",
  origin: "manual",
  category: "",
  description: "",
  amount: "0",
  payment_method: "pix",
  due_date: today(),
  payment_date: "",
  appointment_date: "",
  base_amount: "",
  commission_type: "",
  commission_rule_id: "",
  status: "pendente",
  notes: ""
};

function transactionToForm(
  item: FinancialTransaction
): FinancialTransactionFormInput {
  return {
    clinic_id: item.clinic_id,
    transaction_type: item.transaction_type as FinancialTransactionType,
    patient_id: item.patient_id ?? "",
    employee_id: item.employee_id ?? "",
    service_id: item.service_id ?? "",
    origin: (item.origin as FinancialOrigin | null) ?? "manual",
    category: item.category ?? "",
    description: item.description ?? "",
    amount: String(item.amount ?? 0),
    payment_method: (item.payment_method as PaymentMethod | null) ?? "pix",
    due_date: item.due_date,
    payment_date: item.payment_date ?? "",
    appointment_date: item.appointment_date ?? "",
    base_amount: item.base_amount === null ? "" : String(item.base_amount),
    commission_type: item.commission_type ?? "",
    commission_rule_id: item.commission_rule_id ?? "",
    status: item.status as FinancialStatus,
    notes: item.notes ?? ""
  };
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function numberFromForm(value?: string) {
  const parsedValue = Number.parseFloat(value?.replace(",", ".") ?? "0");
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function statusLabel(status: FinancialStatus) {
  return statusOptions.find(([value]) => value === status)?.[1] ?? "Pendente";
}

function statusClass(status: FinancialStatus) {
  const classes: Record<FinancialStatus, string> = {
    pendente:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
    pago: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
    vencido: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100",
    parcial: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-100",
    cancelado: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
  };

  return classes[status];
}




function getPaidAmount(item: FinancialTransaction) {
  const value = (item as FinancialTransaction & { paid_amount?: number | null }).paid_amount;
  if (typeof value === "number") return Math.max(value, 0);
  return item.derived_status === "pago" ? Number(item.amount ?? 0) : 0;
}

function getOpenAmount(item: FinancialTransaction) {
  const value = (item as FinancialTransaction & { open_amount?: number | null }).open_amount;
  if (typeof value === "number") return Math.max(value, 0);
  if (["pago", "cancelado"].includes(item.derived_status)) return 0;
  return Math.max(Number(item.amount ?? 0) - getPaidAmount(item), 0);
}


type BalanceRow = {
  key: string;
  category: string;
  type: "credito" | "debito";
  count: number;
  total: number;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function isCommissionTransaction(item: FinancialTransaction) {
  const category = `${item.category ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    item.transaction_type === "despesa" &&
    (item.commission_status === "generated" || category.includes("comiss"))
  );
}
function isPayrollTransaction(item: FinancialTransaction) {
  const category = normalizeText(item.category);
  const origin = normalizeText(item.origin);
  const description = normalizeText(item.description);

  return (
    item.transaction_type === "despesa" &&
    (origin === "folha" || category.startsWith("folha") || description.includes("competencia"))
  );
}

function getEntryOrigin(item: FinancialTransaction) {
  if (item.origin === "avulso") return "Avulso";
  if (item.origin === "pacote") return "Pacote";
  if (item.origin === "manual") return "Manual";
  if (item.origin === "folha") return "Folha";
  return item.origin ?? "-";
}

function getBalanceCategory(item: FinancialTransaction) {
  if (item.transaction_type === "receita") {
    return item.origin ? `Receita - ${getEntryOrigin(item)}` : "Receitas";
  }

  return item.category ?? (isCommissionTransaction(item) ? "Comissoes" : "Despesas");
}

function buildBalanceRows(rows: FinancialTransaction[]) {
  const grouped = new Map<string, BalanceRow>();

  rows
    .filter((item) => item.derived_status !== "cancelado")
    .forEach((item) => {
      const type = item.transaction_type === "receita" ? "credito" : "debito";
      const category = getBalanceCategory(item);
      const key = `${type}-${category}`;
      const current = grouped.get(key) ?? { key, category, type, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(item.amount ?? 0);
      grouped.set(key, current);
    });

  return Array.from(grouped.values()).sort((a, b) => a.category.localeCompare(b.category));
}

export function FinanceManager({
  transactions,
  clinics,
  patients,
  services,
  currentClinicId,
  isAdmMaster,
  loadError,
  permissions
}: FinanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<FinancialActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] =
    React.useState<FinancialTransaction | null>(null);
  const [detailTransaction, setDetailTransaction] =
    React.useState<FinancialTransaction | null>(null);
  const [form, setForm] = React.useState<FinancialTransactionFormInput>(emptyForm);
  const [clinicFilter, setClinicFilter] = React.useState(currentClinicId ?? "all");
  const [statusFilter, setStatusFilter] = React.useState<FinancialStatus | "all">(
    "all"
  );
  const [periodStart, setPeriodStart] = React.useState(monthStart());
  const [periodEnd, setPeriodEnd] = React.useState(monthEnd());
  const [activeTab, setActiveTab] = React.useState<FinanceTab>("entradas");

  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;

  const filteredTransactions = transactions.filter((item) => {
    if (clinicFilter !== "all" && item.clinic_id !== clinicFilter) return false;
    if (statusFilter !== "all" && item.derived_status !== statusFilter) return false;
    if (periodStart && item.due_date < periodStart) return false;
    if (periodEnd && item.due_date > periodEnd) return false;
    return true;
  });

  const activeTransactions = filteredTransactions.filter(
    (item) => item.derived_status !== "cancelado"
  );
  const incomeRows = filteredTransactions.filter(
    (item) => item.transaction_type === "receita"
  );
  const outflowRows = filteredTransactions.filter(
    (item) => item.transaction_type === "despesa"
  );
  const patientRows = incomeRows;
  const commissionRows = outflowRows.filter(isCommissionTransaction);
  const payrollRows = outflowRows.filter(isPayrollTransaction);
  const staffRows = outflowRows.filter(
    (item) => Boolean(item.employee_id) || isCommissionTransaction(item) || isPayrollTransaction(item)
  );
  const clinicExpenseRows = outflowRows.filter(
    (item) => !isCommissionTransaction(item) && !isPayrollTransaction(item)
  );
  const balanceRows = buildBalanceRows(filteredTransactions);

  const totalEntries = activeTransactions
    .filter((item) => item.transaction_type === "receita")
    .reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const totalOutflows = activeTransactions
    .filter((item) => item.transaction_type === "despesa")
    .reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const totalPatientReceived = incomeRows
    .filter((item) => item.derived_status === "pago")
    .reduce((total, item) => total + getPaidAmount(item), 0);
  const totalPatientOpen = patientRows
    .filter((item) => item.derived_status !== "pago" && item.derived_status !== "cancelado")
    .reduce((total, item) => total + getOpenAmount(item), 0);
  const totalClinicExpenses = clinicExpenseRows
    .filter((item) => item.derived_status !== "cancelado")
    .reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const totalPayroll = payrollRows
    .filter((item) => item.derived_status !== "cancelado")
    .reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const totalCommissions = commissionRows
    .filter((item) => item.derived_status !== "cancelado")
    .reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const periodBalance = totalEntries - totalOutflows;
  const totalPaidOutflows = outflowRows
    .filter((item) => item.derived_status === "pago")
    .reduce((total, item) => total + getPaidAmount(item), 0);
  const realizedBalance = totalPatientReceived - totalPaidOutflows;

  const cashFlowTotals = {
    revenue: totalEntries,
    expense: totalOutflows,
    pendingOutflows: outflowRows
      .filter((item) => item.derived_status !== "pago" && item.derived_status !== "cancelado")
      .reduce((total, item) => total + getOpenAmount(item), 0),
    realized: realizedBalance
  };

  const tabOptions: Array<[FinanceTab, string]> = [
    ["entradas", "Entradas"],
    ["saidas", "Saidas"],
    ["pacientes", "Pacientes"],
    ["funcionarios", "Funcionarios/Folha"],
    ["fluxo", "Fluxo de Caixa"],
    ["balancete", "Balancete"]
  ];

  function refresh() {
    router.refresh();
  }

  function openCreateForm(type: FinancialTransactionType) {
    setEditingTransaction(null);
    setForm({
      ...emptyForm,
      transaction_type: type,
      clinic_id: currentClinicId ?? "",
      origin: type === "receita" ? "manual" : undefined,
      payment_method: type === "receita" ? "pix" : undefined,
      payment_date: type === "receita" ? today() : ""
    });
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(item: FinancialTransaction) {
    setEditingTransaction(item);
    setForm(transactionToForm(item));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingTransaction(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = editingTransaction
        ? await updateFinancialTransaction(editingTransaction.id, form)
        : await createFinancialTransaction(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refresh();
      }
    });
  }

  function markAsPaid(item: FinancialTransaction) {
    startTransition(async () => {
      const result = await markFinancialTransactionAsPaid(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  function cancelTransaction(item: FinancialTransaction) {
    startTransition(async () => {
      const result = await cancelFinancialTransaction(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  function removeTransaction(item: FinancialTransaction) {
    if (!window.confirm("Excluir esta movimentacao?")) return;

    startTransition(async () => {
      const result = await deleteFinancialTransaction(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <SystemMessage message={message} onClose={() => setMessage(null)} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canCreate ? (
          <>
            <Button type="button" onClick={() => openCreateForm("receita")}>
              <Plus className="h-4 w-4" />
              Nova receita
            </Button>
            <Button type="button" variant="outline" onClick={() => openCreateForm("despesa")}>
              <Plus className="h-4 w-4" />
              Nova despesa
            </Button>
          </>
        ) : null}
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro/baixas")}>
          Baixas e Repasses
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro/folha" as Route)}>
          Folha / Contracheque
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total de entradas" value={money(totalEntries)} icon={ArrowUpRight} />
        <MetricCard label="Total de saidas" value={money(totalOutflows)} icon={ArrowDownRight} />
        <MetricCard label="Saldo do periodo" value={money(periodBalance)} icon={CircleDollarSign} />
        <MetricCard label="Recebimentos de pacientes" value={money(totalPatientReceived)} icon={CheckCircle2} />
        <MetricCard label="Pacientes em aberto" value={money(totalPatientOpen)} icon={XCircle} />
        <MetricCard label="Despesas da clinica" value={money(totalClinicExpenses)} icon={ArrowDownRight} />
        <MetricCard label="Folha/funcionarios" value={money(totalPayroll)} icon={ArrowDownRight} />
        <MetricCard label="Comissoes" value={money(totalCommissions)} icon={ArrowDownRight} />
      </section>

      <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Clinica"
            value={clinicFilter}
            onChange={setClinicFilter}
            options={[
              ...(isAdmMaster ? [["all", "Todas as clinicas"] as [string, string]] : []),
              ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])
            ]}
            disabled={!isAdmMaster}
          />
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as FinancialStatus | "all")}
            options={[["all", "Todos"], ...statusOptions]}
          />
          <TextField label="Inicio" type="date" value={periodStart} onChange={setPeriodStart} />
          <TextField label="Fim" type="date" value={periodEnd} onChange={setPeriodEnd} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-md border bg-muted/40 p-1">
        {tabOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={cn(
              "h-10 rounded-md px-3 text-sm font-semibold transition-colors",
              activeTab === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "entradas" ? (
        <FinanceTable title="Entradas" description="Tudo que entra dinheiro: pacientes, avulsos, pacotes pagos e outros creditos.">
          <EntriesTable rows={incomeRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onCancel={cancelTransaction} onDelete={removeTransaction} />
        </FinanceTable>
      ) : null}

      {activeTab === "saidas" ? (
        <FinanceTable title="Saidas" description="Tudo que sai dinheiro: despesas, folha, encargos e comissoes.">
          <OutflowsTable rows={outflowRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onCancel={cancelTransaction} onDelete={removeTransaction} />
        </FinanceTable>
      ) : null}

      {activeTab === "pacientes" ? (
        <FinanceTable title="Pacientes" description="Cobranca e baixa de pacientes. Baixas em lote continuam em Baixas e Repasses.">
          <PatientPaymentsTable rows={patientRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onCancel={cancelTransaction} onDelete={removeTransaction} />
        </FinanceTable>
      ) : null}

      {activeTab === "funcionarios" ? (
        <FinanceTable title="Funcionarios/Folha" description="Lancamentos e contracheque. Pagamentos continuam em Baixas e Repasses.">
          <StaffPayrollTable rows={staffRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onCancel={cancelTransaction} onDelete={removeTransaction} />
        </FinanceTable>
      ) : null}

      {activeTab === "fluxo" ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Entradas previstas" value={money(cashFlowTotals.revenue)} icon={ArrowUpRight} />
          <MetricCard label="Saidas previstas" value={money(cashFlowTotals.expense)} icon={ArrowDownRight} />
          <MetricCard label="Saidas pendentes" value={money(cashFlowTotals.pendingOutflows)} icon={XCircle} />
          <MetricCard label="Saldo realizado" value={money(cashFlowTotals.realized)} icon={CheckCircle2} />
        </section>
      ) : null}

      {activeTab === "balancete" ? (
        <FinanceTable title="Balancete" description="Resumo simples do periodo: credito, debito e saldo.">
          <section className="grid gap-3 p-4 md:grid-cols-3">
            <MetricCard label="Total de receitas" value={money(totalEntries)} icon={ArrowUpRight} />
            <MetricCard label="Total de despesas" value={money(totalOutflows)} icon={ArrowDownRight} />
            <MetricCard label="Resultado" value={money(periodBalance)} icon={CircleDollarSign} />
          </section>
          <BalanceTable rows={balanceRows} />
        </FinanceTable>
      ) : null}
      {detailTransaction ? (
        <TransactionDetailsModal item={detailTransaction} onClose={() => setDetailTransaction(null)} />
      ) : null}

      {formOpen ? (
        <FinanceFormModal
          form={form}
          setForm={setForm}
          editingTransaction={editingTransaction}
          clinics={clinics}
          patients={patients}
          services={services}
          isAdmMaster={isAdmMaster}
          isPending={isPending}
          onSubmit={submitForm}
          onClose={closeForm}
        />
      ) : null}
    </div>
  );
}
function FinanceTable({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

type TableActionProps = {
  rows: FinancialTransaction[];
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  onDetails: (item: FinancialTransaction) => void;
  onEdit: (item: FinancialTransaction) => void;
  onPaid: (item: FinancialTransaction) => void;
  onCancel: (item: FinancialTransaction) => void;
  onDelete: (item: FinancialTransaction) => void;
};

function EntriesTable({
  rows,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onPaid,
  onCancel,
  onDelete
}: TableActionProps) {
  return (
    <table className="w-full min-w-[960px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Data</th>
          <th className="px-3 py-2">Clinica</th>
          <th className="px-3 py-2">Origem</th>
          <th className="px-3 py-2">Paciente</th>
          <th className="px-3 py-2">Servico</th>
          <th className="px-3 py-2 text-right">Valor</th>
          <th className="px-3 py-2">Forma</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Acoes</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.id} className="border-t hover:bg-muted/30">
            <td className="whitespace-nowrap px-3 py-2">{item.payment_date ?? item.due_date}</td>
            <TruncatedCell value={item.clinic_name} />
            <td className="whitespace-nowrap px-3 py-2">{getEntryOrigin(item)}</td>
            <TruncatedCell value={item.patient_name} strong />
            <TruncatedCell value={item.service_name} />
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(Number(item.amount ?? 0))}</td>
            <td className="whitespace-nowrap px-3 py-2">{item.payment_method ?? "-"}</td>
            <StatusCell status={item.derived_status} compact />
            <FinanceActionCell item={item} primaryLabel="Marcar pago" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onCancel={onCancel} onDelete={onDelete} />
          </tr>
        )) : <EmptyRow colSpan={9} />}
      </tbody>
    </table>
  );
}

function OutflowsTable({
  rows,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onPaid,
  onCancel,
  onDelete
}: TableActionProps) {
  return (
    <table className="w-full min-w-[980px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Data</th>
          <th className="px-3 py-2">Clinica</th>
          <th className="px-3 py-2">Categoria</th>
          <th className="px-3 py-2">Funcionario</th>
          <th className="px-3 py-2">Descricao</th>
          <th className="px-3 py-2 text-right">Valor</th>
          <th className="px-3 py-2">Vencimento</th>
          <th className="px-3 py-2">Pagamento</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Acoes</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.id} className="border-t hover:bg-muted/30">
            <td className="whitespace-nowrap px-3 py-2">{item.due_date}</td>
            <TruncatedCell value={item.clinic_name} />
            <TruncatedCell value={item.category ?? getBalanceCategory(item)} />
            <TruncatedCell value={item.employee_name} />
            <td className="max-w-64 px-3 py-2"><span className="line-clamp-2" title={item.description ?? "-"}>{item.description ?? "-"}</span></td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(Number(item.amount ?? 0))}</td>
            <td className="whitespace-nowrap px-3 py-2">{item.due_date}</td>
            <td className="whitespace-nowrap px-3 py-2">{item.payment_date ?? "-"}</td>
            <StatusCell status={item.derived_status} compact />
            <FinanceActionCell item={item} primaryLabel="Marcar pago" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onCancel={onCancel} onDelete={onDelete} />
          </tr>
        )) : <EmptyRow colSpan={10} />}
      </tbody>
    </table>
  );
}

function StaffPayrollTable({
  rows,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onCancel,
  onDelete
}: Omit<TableActionProps, "onPaid">) {
  return (
    <table className="w-full min-w-[860px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Funcionario</th>
          <th className="px-3 py-2">Clinica</th>
          <th className="px-3 py-2">Competencia</th>
          <th className="px-3 py-2">Tipo</th>
          <th className="px-3 py-2">Natureza</th>
          <th className="px-3 py-2 text-right">Valor</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Acoes</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.id} className="border-t hover:bg-muted/30">
            <TruncatedCell value={item.employee_name} strong />
            <TruncatedCell value={item.clinic_name} />
            <td className="whitespace-nowrap px-3 py-2">{item.due_date.slice(0, 7)}</td>
            <TruncatedCell value={isCommissionTransaction(item) ? "Comissao" : item.category ?? "Folha"} />
            <td className="whitespace-nowrap px-3 py-2">Debito</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(Number(item.amount ?? 0))}</td>
            <StatusCell status={item.derived_status} compact />
            <StaffActionCell item={item} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onCancel={onCancel} onDelete={onDelete} />
          </tr>
        )) : <EmptyRow colSpan={8} />}
      </tbody>
    </table>
  );
}

function BalanceTable({ rows }: { rows: BalanceRow[] }) {
  return (
    <table className="w-full min-w-[680px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Categoria</th>
          <th className="px-3 py-2">Tipo</th>
          <th className="px-3 py-2 text-right">Quantidade</th>
          <th className="px-3 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.key} className="border-t hover:bg-muted/30">
            <TruncatedCell value={item.category} strong />
            <td className="whitespace-nowrap px-3 py-2">{item.type === "credito" ? "Credito" : "Debito"}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right">{item.count}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(item.total)}</td>
          </tr>
        )) : <EmptyRow colSpan={4} />}
      </tbody>
    </table>
  );
}
function PatientPaymentsTable({
  rows,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onPaid,
  onCancel,
  onDelete
}: TableActionProps) {
  return (
    <table className="w-full min-w-[980px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Paciente</th>
          <th className="px-3 py-2">Clinica</th>
          <th className="px-3 py-2">Servico</th>
          <th className="px-3 py-2 text-right">Valor total</th>
          <th className="px-3 py-2 text-right">Valor pago</th>
          <th className="px-3 py-2 text-right">Valor em aberto</th>
          <th className="px-3 py-2">Vencimento</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Acoes</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.id} className="border-t hover:bg-muted/30">
            <TruncatedCell strong value={item.patient_name} />
            <TruncatedCell value={item.clinic_name} />
            <TruncatedCell value={item.service_name} />
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(Number(item.amount ?? 0))}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right">{money(getPaidAmount(item))}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(getOpenAmount(item))}</td>
            <td className="whitespace-nowrap px-3 py-2">{item.due_date}</td>
            <StatusCell status={item.derived_status} compact />
            <FinanceActionCell item={item} primaryLabel="Dar baixa" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onCancel={onCancel} onDelete={onDelete} />
          </tr>
        )) : <EmptyRow colSpan={9} />}
      </tbody>
    </table>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={colSpan}>
        Nenhum registro encontrado.
      </td>
    </tr>
  );
}

function TruncatedCell({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <td className={cn("max-w-44 truncate px-3 py-2", strong && "font-semibold text-foreground")} title={value}>
      {value}
    </td>
  );
}

function FinanceActionCell({
  item,
  primaryLabel,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onPaid,
  onCancel,
  onDelete
}: {
  item: FinancialTransaction;
  primaryLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  onDetails: (item: FinancialTransaction) => void;
  onEdit: (item: FinancialTransaction) => void;
  onPaid: (item: FinancialTransaction) => void;
  onCancel: (item: FinancialTransaction) => void;
  onDelete: (item: FinancialTransaction) => void;
}) {
  return (
    <td className="whitespace-nowrap px-3 py-2">
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => onDetails(item)}>Ver detalhes</Button>
        {canEdit ? (
          <>
            <Button type="button" size="sm" onClick={() => onPaid(item)} disabled={isPending || item.derived_status === "pago"}>{primaryLabel}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onCancel(item)} disabled={isPending || item.derived_status === "cancelado"}>Cancelar</Button>
            <IconButton label="Editar" onClick={() => onEdit(item)} icon={Edit3} />
          </>
        ) : null}
        {canDelete ? <IconButton label="Excluir" onClick={() => onDelete(item)} icon={Trash2} danger /> : null}
      </div>
    </td>
  );
}

function StaffActionCell({
  item,
  canEdit,
  canDelete,
  isPending,
  onDetails,
  onEdit,
  onCancel,
  onDelete
}: {
  item: FinancialTransaction;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  onDetails: (item: FinancialTransaction) => void;
  onEdit: (item: FinancialTransaction) => void;
  onCancel: (item: FinancialTransaction) => void;
  onDelete: (item: FinancialTransaction) => void;
}) {
  return (
    <td className="whitespace-nowrap px-3 py-2">
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => onDetails(item)}>Ver contracheque</Button>
        {canEdit ? (
          <>
            <IconButton label="Editar" onClick={() => onEdit(item)} icon={Edit3} />
            <Button type="button" size="sm" variant="outline" onClick={() => onCancel(item)} disabled={isPending || item.derived_status === "cancelado"}>Cancelar</Button>
          </>
        ) : null}
        {canDelete ? <IconButton label="Excluir" onClick={() => onDelete(item)} icon={Trash2} danger /> : null}
      </div>
    </td>
  );
}
function TransactionDetailsModal({ item, onClose }: { item: FinancialTransaction; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl border-none p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Detalhes financeiros</h2>
            <p className="text-sm text-muted-foreground">{item.description ?? item.service_name ?? item.category ?? "Lancamento financeiro"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <DetailItem label="Clinica" value={item.clinic_name} />
          <DetailItem label="Status" value={statusLabel(item.derived_status)} />
          <DetailItem label="Paciente" value={item.patient_name} />
          <DetailItem label="Profissional" value={item.employee_name} />
          <DetailItem label="Servico" value={item.service_name} />
          <DetailItem label="Categoria" value={item.category ?? "-"} />
          <DetailItem label="Valor total" value={money(Number(item.amount ?? 0))} />
          <DetailItem label="Valor pago" value={money(getPaidAmount(item))} />
          <DetailItem label="Valor em aberto" value={money(getOpenAmount(item))} />
          <DetailItem label="Vencimento" value={item.due_date} />
          <DetailItem label="Pagamento" value={item.payment_date ?? "-"} />
          <DetailItem label="Origem" value={item.origin ?? "-"} />
        </div>
        {item.notes ? <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{item.notes}</div> : null}
      </Card>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium text-foreground">{value}</div>
    </div>
  );
}
function SystemMessage({
  message,
  onClose
}: {
  message: FinancialActionResult;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-sm",
        message.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      )}
    >
      <span>{message.message}</span>
      <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-black/5">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatusCell({ status, compact = false }: { status: FinancialStatus; compact?: boolean }) {
  return (
    <td className={compact ? "whitespace-nowrap px-3 py-2" : "px-4 py-3"}>
      <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", statusClass(status))}>
        {statusLabel(status)}
      </span>
    </td>
  );
}


function MetricCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-xl font-semibold tracking-normal">
            {value}
          </strong>
        </div>
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

function FinanceFormModal({
  form,
  setForm,
  editingTransaction,
  clinics,
  patients,
  services,
  isAdmMaster,
  isPending,
  onSubmit,
  onClose
}: {
  form: FinancialTransactionFormInput;
  setForm: React.Dispatch<React.SetStateAction<FinancialTransactionFormInput>>;
  editingTransaction: FinancialTransaction | null;
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  isAdmMaster: boolean;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const isRevenue = form.transaction_type === "receita";
  const isManualRevenue = isRevenue && form.origin === "manual";
  const amount = numberFromForm(form.amount);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-auto border-none shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">
              {editingTransaction
                ? "Editar movimentaÃƒÂ§ÃƒÂ£o"
                : isRevenue
                  ? "Nova receita"
                  : "Nova despesa"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRevenue ? "LanÃƒÂ§amento manual de entrada." : "LanÃƒÂ§amento manual de saÃƒÂ­da."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Clinica"
              value={form.clinic_id ?? ""}
              onChange={(value) => setForm((current) => ({ ...current, clinic_id: value }))}
              options={clinics.map((clinic) => [clinic.id, clinic.name])}
              disabled={!isAdmMaster}
            />
            <SelectField
              label="Status"
              value={form.status ?? "pendente"}
              onChange={(value) =>
                setForm((current) => ({ ...current, status: value as FinancialStatus }))
              }
              options={statusOptions}
            />
            {isRevenue ? (
              <>
                <SelectField
                  label="Paciente"
                  value={form.patient_id ?? ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, patient_id: value }))
                  }
                  options={patients.map((patient) => [patient.id, patient.full_name])}
                />
                <SelectField
                  label="Origem"
                  value={form.origin ?? "manual"}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      origin: value as FinancialOrigin,
                      due_date: value === "manual" ? "" : current.due_date || today(),
                      payment_date:
                        value === "manual"
                          ? current.payment_date || today()
                          : current.payment_date
                    }))
                  }
                  options={originOptions}
                  required
                />
                <SelectField
                  label="ServiÃƒÂ§o"
                  value={form.service_id ?? ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, service_id: value }))
                  }
                  options={services.map((service) => [service.id, service.name])}
                />
                <SelectField
                  label="Forma de pagamento"
                  value={form.payment_method ?? "pix"}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      payment_method: value as PaymentMethod
                    }))
                  }
                  options={paymentMethodOptions}
                />
              </>
            ) : (
              <>
                <SelectField
                  label="Categoria"
                  value={form.category ?? ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, category: value }))
                  }
                  options={expenseCategoryOptions}
                  required
                />
                <TextField
                  label="DescriÃƒÂ§ÃƒÂ£o"
                  value={form.description ?? ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, description: value }))
                  }
                  required
                />
              </>
            )}
            <TextField
              label="Valor"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
              required
            />
            {!isManualRevenue ? (
              <TextField
                label="Data de vencimento"
                type="date"
                value={form.due_date}
                onChange={(value) =>
                  setForm((current) => ({ ...current, due_date: value }))
                }
                required
              />
            ) : null}
            <TextField
              label="Data de recebimento/pagamento"
              type="date"
              value={form.payment_date ?? ""}
              onChange={(value) =>
                setForm((current) => ({ ...current, payment_date: value }))
              }
              required={isManualRevenue}
            />
          </div>
          <TextAreaField
            label="ObservaÃƒÂ§ÃƒÂµes"
            value={form.notes ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">
              Total: {money(amount)}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function FieldShell({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  step,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label}>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={step}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </FieldShell>
  );
}

function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label}>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="">Selecione</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  danger = false
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs font-semibold shadow-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50",
        danger && "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
