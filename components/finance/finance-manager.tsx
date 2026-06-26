"use client";

import * as React from "react";
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

const statusOptions: Array<[FinancialStatus, string]> = [
  ["pendente", "Pendente"],
  ["pago", "Pago"],
  ["vencido", "Vencido"],
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
  "Comissões",
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
  service_id: "",
  origin: "manual",
  category: "",
  description: "",
  amount: "0",
  payment_method: "pix",
  due_date: today(),
  payment_date: "",
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
    service_id: item.service_id ?? "",
    origin: (item.origin as FinancialOrigin | null) ?? "manual",
    category: item.category ?? "",
    description: item.description ?? "",
    amount: String(item.amount ?? 0),
    payment_method: (item.payment_method as PaymentMethod | null) ?? "pix",
    due_date: item.due_date,
    payment_date: item.payment_date ?? "",
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
    cancelado: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
  };

  return classes[status];
}

function typeLabel(type: string) {
  return type === "despesa" ? "Despesa" : "Receita";
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
  const [form, setForm] = React.useState<FinancialTransactionFormInput>(emptyForm);
  const [clinicFilter, setClinicFilter] = React.useState(currentClinicId ?? "all");
  const [statusFilter, setStatusFilter] = React.useState<FinancialStatus | "all">(
    "all"
  );
  const [typeFilter, setTypeFilter] =
    React.useState<FinancialTransactionType | "all">("all");
  const [periodStart, setPeriodStart] = React.useState(monthStart());
  const [periodEnd, setPeriodEnd] = React.useState(monthEnd());

  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;

  const filteredTransactions = transactions.filter((item) => {
    if (clinicFilter !== "all" && item.clinic_id !== clinicFilter) return false;
    if (statusFilter !== "all" && item.derived_status !== statusFilter) return false;
    if (typeFilter !== "all" && item.transaction_type !== typeFilter) return false;
    if (periodStart && item.due_date < periodStart) return false;
    if (periodEnd && item.due_date > periodEnd) return false;
    return true;
  });

  const totals = filteredTransactions.reduce(
    (accumulator, item) => {
      const amount = Number(item.amount ?? 0);

      if (item.transaction_type === "receita") {
        if (item.derived_status !== "cancelado") accumulator.revenue += amount;
        if (item.derived_status === "pendente") accumulator.receivable += amount;
      }

      if (item.transaction_type === "despesa" && item.derived_status !== "cancelado") {
        accumulator.expense += amount;
      }

      if (item.derived_status === "pago") accumulator.paid += amount;
      if (item.derived_status === "vencido") accumulator.overdue += amount;

      return accumulator;
    },
    { revenue: 0, expense: 0, receivable: 0, paid: 0, overdue: 0 }
  );
  const balance = totals.revenue - totals.expense;

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
    if (!window.confirm("Excluir esta movimentacao?")) {
      return;
    }

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
            <Button
              type="button"
              variant="outline"
              onClick={() => openCreateForm("despesa")}
            >
              <Plus className="h-4 w-4" />
              Nova despesa
            </Button>
          </>
        ) : null}
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Receitas do mês" value={money(totals.revenue)} icon={ArrowUpRight} />
        <MetricCard label="Despesas do mês" value={money(totals.expense)} icon={ArrowDownRight} />
        <MetricCard label="Saldo do mês" value={money(balance)} icon={CircleDollarSign} />
        <MetricCard label="Contas a receber" value={money(totals.receivable)} icon={ArrowUpRight} />
        <MetricCard label="Contas pagas" value={money(totals.paid)} icon={CheckCircle2} />
        <MetricCard label="Contas vencidas" value={money(totals.overdue)} icon={XCircle} />
      </section>

      <Card className="border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            options={[
              ["all", "Todos"],
              ...statusOptions
            ]}
          />
          <SelectField
            label="Tipo"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as FinancialTransactionType | "all")}
            options={[
              ["all", "Todos"],
              ["receita", "Receitas"],
              ["despesa", "Despesas"]
            ]}
          />
          <TextField
            label="Inicio"
            type="date"
            value={periodStart}
            onChange={setPeriodStart}
          />
          <TextField
            label="Fim"
            type="date"
            value={periodEnd}
            onChange={setPeriodEnd}
          />
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="border-b p-4">
          <h2 className="text-xl font-semibold tracking-normal">Movimentações</h2>
          <p className="text-sm text-muted-foreground">
            Receitas e despesas lançadas manualmente, prontas para integração futura.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{typeLabel(item.transaction_type)}</td>
                    <td className="px-4 py-3">
                      {item.transaction_type === "receita"
                        ? originOptions.find(([value]) => value === item.origin)?.[1] ?? "Manual"
                        : item.description ?? item.category ?? "-"}
                    </td>
                    <td className="px-4 py-3">{item.patient_name}</td>
                    <td className="px-4 py-3">{item.service_name}</td>
                    <td className="px-4 py-3 font-semibold">{money(Number(item.amount))}</td>
                    <td className="px-4 py-3">{item.due_date}</td>
                    <td className="px-4 py-3">{item.payment_date ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-semibold",
                          statusClass(item.derived_status)
                        )}
                      >
                        {statusLabel(item.derived_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canEdit ? (
                          <>
                            <IconButton
                              label="Editar"
                              onClick={() => openEditForm(item)}
                              icon={Edit3}
                            />
                            <IconButton
                              label="Marcar como pago"
                              onClick={() => markAsPaid(item)}
                              icon={CheckCircle2}
                              disabled={isPending || item.derived_status === "pago"}
                            />
                            <IconButton
                              label="Cancelar"
                              onClick={() => cancelTransaction(item)}
                              icon={XCircle}
                              disabled={isPending || item.derived_status === "cancelado"}
                            />
                          </>
                        ) : null}
                        {canDelete ? (
                          <IconButton
                            label="Excluir"
                            onClick={() => removeTransaction(item)}
                            icon={Trash2}
                            danger
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
                ? "Editar movimentação"
                : isRevenue
                  ? "Nova receita"
                  : "Nova despesa"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRevenue ? "Lançamento manual de entrada." : "Lançamento manual de saída."}
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
                  label="Serviço"
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
                  label="Descrição"
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
            label="Observações"
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
