"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, CreditCard, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import {
  settleFinancialTransactions,
  type FinancialStatus,
  type PaymentMethod,
  type SettlementMode
} from "@/app/(app)/financeiro/actions";

type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"] & {
  clinic_name: string;
  patient_name: string;
  employee_name: string;
  service_name: string;
  derived_status: FinancialStatus;
};
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Tab = "patients" | "staff";

type Props = {
  transactions: FinancialTransaction[];
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  employees: Employee[];
  isAdmMaster: boolean;
  loadError?: string;
};

type Filters = {
  clinicId: string;
  startDate: string;
  endDate: string;
  patientId: string;
  employeeId: string;
  serviceId: string;
  status: string;
  paymentMethod: string;
  type: string;
  search: string;
};

const paymentMethodOptions: Array<[PaymentMethod, string]> = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartao"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"],
  ["transferencia", "Transferencia"],
  ["outro", "Outro"]
];
const patientStatusOptions: Array<[string, string]> = [["all", "Todos"], ["pendente", "Em aberto"], ["parcial", "Parcial"], ["vencido", "Vencido"]];
const staffStatusOptions: Array<[string, string]> = [["all", "Todos"], ["pendente", "Em aberto"], ["parcial", "Parcial"], ["pago", "Pago"]];
const staffTypeOptions = ["Todos", "Comissao", "Salario fixo", "Bonus", "Desconto", "Ajuste"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getPaidAmount(transaction: FinancialTransaction) {
  const value = (transaction as FinancialTransaction & { paid_amount?: number | null }).paid_amount;
  if (typeof value === "number") return Math.max(value, 0);
  return transaction.derived_status === "pago" ? transaction.amount : 0;
}

function getOpenAmount(transaction: FinancialTransaction) {
  const value = (transaction as FinancialTransaction & { open_amount?: number | null }).open_amount;
  if (typeof value === "number") return Math.max(value, 0);
  if (transaction.derived_status === "pago" || transaction.derived_status === "cancelado") return 0;
  return Math.max(transaction.amount - getPaidAmount(transaction), 0);
}

function getStatusLabel(status: string) {
  return ({ pendente: "Em aberto", parcial: "Parcial", vencido: "Vencido", pago: "Pago", cancelado: "Cancelado" } as Record<string, string>)[status] ?? status;
}

function getStaffType(transaction: FinancialTransaction) {
  const text = normalizeText(`${transaction.category ?? ""} ${transaction.description ?? ""}`);
  if (text.includes("comiss")) return "Comissao";
  if (text.includes("salario")) return "Salario fixo";
  if (text.includes("bonus")) return "Bonus";
  if (text.includes("desconto")) return "Desconto";
  return "Ajuste";
}

function applyFilters(transaction: FinancialTransaction, filters: Filters, tab: Tab) {
  const referenceDate = transaction.due_date ?? transaction.payment_date ?? transaction.created_at.slice(0, 10);
  const searchable = normalizeText([
    transaction.patient_name,
    transaction.employee_name,
    transaction.clinic_name,
    transaction.service_name,
    transaction.description,
    transaction.origin,
    transaction.category
  ].join(" "));
  const query = normalizeText(filters.search);

  if (filters.clinicId !== "all" && transaction.clinic_id !== filters.clinicId) return false;
  if (filters.startDate && referenceDate < filters.startDate) return false;
  if (filters.endDate && referenceDate > filters.endDate) return false;
  if (filters.serviceId !== "all" && transaction.service_id !== filters.serviceId) return false;
  if (filters.status !== "all" && transaction.derived_status !== filters.status) return false;
  if (filters.paymentMethod !== "all" && transaction.payment_method !== filters.paymentMethod) return false;
  if (query && !searchable.includes(query)) return false;
  if (tab === "patients" && filters.patientId !== "all" && transaction.patient_id !== filters.patientId) return false;
  if (tab === "staff" && filters.employeeId !== "all" && transaction.employee_id !== filters.employeeId) return false;
  if (tab === "staff" && filters.type !== "Todos" && getStaffType(transaction) !== filters.type) return false;
  return true;
}

function isStaffPayout(transaction: FinancialTransaction) {
  const text = normalizeText(`${transaction.category ?? ""} ${transaction.description ?? ""}`);
  return Boolean(transaction.employee_id) || ["comiss", "salario", "bonus", "desconto", "ajuste"].some((key) => text.includes(key));
}

export function SettlementsManager({ transactions, clinics, patients, services, employees, isAdmMaster, loadError }: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("patients");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mode, setMode] = React.useState<SettlementMode>("total");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [paidAt, setPaidAt] = React.useState(today());
  const [notes, setNotes] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>({
    clinicId: "all",
    startDate: monthStart(),
    endDate: today(),
    patientId: "all",
    employeeId: "all",
    serviceId: "all",
    status: "all",
    paymentMethod: "all",
    type: "Todos",
    search: ""
  });

  const patientRows = React.useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_type === "receita" &&
          getOpenAmount(transaction) > 0 &&
          ["pendente", "parcial", "vencido"].includes(transaction.derived_status) &&
          applyFilters(transaction, filters, "patients")
      ),
    [transactions, filters]
  );

  const staffRows = React.useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_type === "despesa" &&
          getOpenAmount(transaction) > 0 &&
          ["pendente", "parcial", "vencido"].includes(transaction.derived_status) &&
          isStaffPayout(transaction) &&
          applyFilters(transaction, filters, "staff")
      ),
    [transactions, filters]
  );

  const rows = tab === "patients" ? patientRows : staffRows;
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const selectedOpenAmount = selectedRows.reduce((total, row) => total + getOpenAmount(row), 0);
  const selectedPaidAmount = selectedRows.reduce((total, row) => total + getPaidAmount(row), 0);
  const parsedSettlementAmount = Number.parseFloat(amount.replace(",", "."));
  const informedAmount = mode === "total" ? selectedOpenAmount : Number.isFinite(parsedSettlementAmount) ? parsedSettlementAmount : 0;
  const remainingAfterSettlement = Math.max(selectedOpenAmount - informedAmount, 0);

  React.useEffect(() => {
    setSelectedIds([]);
    setMessage(null);
  }, [tab]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds([]);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds((current) => (current.length === rows.length ? [] : rows.map((row) => row.id)));
  }

  function selectSingle(id: string) {
    setSelectedIds([id]);
    setMode("total");
    setAmount("");
  }

  function submitSettlement() {
    setMessage(null);
    if (selectedIds.length === 0) {
      setMessage({ type: "error", text: "Selecione ao menos um lancamento." });
      return;
    }

    const parsedAmount = Number.parseFloat(amount.replace(",", "."));
    if (mode === "partial" && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setMessage({ type: "error", text: "Informe um valor parcial maior que zero." });
      return;
    }

    if (mode === "partial" && parsedAmount > selectedOpenAmount) {
      setMessage({ type: "error", text: "O valor pago nao pode ser maior que o valor em aberto." });
      return;
    }

    startTransition(async () => {
      const result = await settleFinancialTransactions({
        ids: selectedIds,
        settlement_type: tab === "patients" ? "patient_payment" : "staff_payout",
        mode,
        amount,
        payment_method: paymentMethod,
        paid_at: paidAt,
        notes
      });

      setMessage({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) {
        setSelectedIds([]);
        setAmount("");
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {loadError ? <Alert type="error" text={loadError} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={CreditCard} label={tab === "patients" ? "Recebimentos em aberto" : "Repasses em aberto"} value={formatCurrency(rows.reduce((total, row) => total + getOpenAmount(row), 0))} />
        <SummaryCard icon={CheckCircle2} label="Ja pago" value={formatCurrency(rows.reduce((total, row) => total + getPaidAmount(row), 0))} />
        <SummaryCard icon={UsersRound} label="Lancamentos" value={String(rows.length)} />
        <SummaryCard icon={Banknote} label="Selecionado" value={formatCurrency(selectedOpenAmount)} />
      </div>

      <Card className="p-2">
        <div className="grid gap-2 md:grid-cols-2">
          <TabButton active={tab === "patients"} onClick={() => setTab("patients")}>Recebimentos de Pacientes</TabButton>
          <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>Repasses de Funcionarios</TabButton>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Search className="h-4 w-4" />Filtros</div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {isAdmMaster ? <SelectField label="Clinica" value={filters.clinicId} onChange={(value) => updateFilter("clinicId", value)} options={[["all", "Todas"], ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])]} /> : null}
          <InputField label="Inicio" type="date" value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} />
          <InputField label="Fim" type="date" value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} />
          {tab === "patients" ? <SelectField label="Paciente" value={filters.patientId} onChange={(value) => updateFilter("patientId", value)} options={[["all", "Todos"], ...patients.map((patient) => [patient.id, patient.full_name] as [string, string])]} /> : <SelectField label="Funcionario" value={filters.employeeId} onChange={(value) => updateFilter("employeeId", value)} options={[["all", "Todos"], ...employees.map((employee) => [employee.id, employee.name] as [string, string])]} />}
          <SelectField label="Servico" value={filters.serviceId} onChange={(value) => updateFilter("serviceId", value)} options={[["all", "Todos"], ...services.map((service) => [service.id, service.name] as [string, string])]} />
          <SelectField label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)} options={tab === "patients" ? patientStatusOptions : staffStatusOptions} />
          {tab === "patients" ? <SelectField label="Forma" value={filters.paymentMethod} onChange={(value) => updateFilter("paymentMethod", value)} options={[["all", "Todas"], ...paymentMethodOptions]} /> : <SelectField label="Tipo" value={filters.type} onChange={(value) => updateFilter("type", value)} options={staffTypeOptions.map((option) => [option, option])} />}
          <InputField label="Pesquisar" value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Nome, servico, origem..." />
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{tab === "patients" ? "Baixa de recebimentos" : "Pagamento de repasses"}</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Escolha baixa total para quitar todo o saldo selecionado ou baixa parcial para informar um valor menor.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <SelectField label="Tipo de baixa" value={mode} onChange={(value) => setMode(value as SettlementMode)} options={[["total", "Baixa total"], ["partial", "Baixa parcial"]]} />
          <InputField label="Valor pago" value={mode === "total" ? formatCurrency(selectedOpenAmount) : amount} onChange={setAmount} disabled={mode === "total"} placeholder="0,00" />
          <SelectField label="Forma de pagamento" value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={paymentMethodOptions} />
          <InputField label="Data do pagamento" type="date" value={paidAt} onChange={setPaidAt} />
          <InputField label="Observacao" value={notes} onChange={setNotes} placeholder="Opcional" />
        </div>
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 md:grid-cols-5">
          <Metric label="Selecionados" value={String(selectedIds.length)} />
          <Metric label="Total em aberto" value={formatCurrency(selectedOpenAmount)} />
          <Metric label="Ja pago" value={formatCurrency(selectedPaidAmount)} />
          <Metric label="Valor informado" value={formatCurrency(informedAmount)} />
          <Metric label="Saldo restante" value={formatCurrency(remainingAfterSettlement)} />
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={submitSettlement} disabled={isPending || selectedIds.length === 0}>{isPending ? "Processando..." : tab === "patients" ? "Baixar recebimentos selecionados" : "Pagar repasses selecionados"}</Button>
        </div>
        {message ? <Alert type={message.type} text={message.text} /> : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "patients" ? <PatientTable rows={rows} selectedIds={selectedIds} onToggle={toggleSelection} onToggleAll={toggleAll} onSingle={selectSingle} /> : <StaffTable rows={rows} selectedIds={selectedIds} onToggle={toggleSelection} onToggleAll={toggleAll} onSingle={selectSingle} />}
        </div>
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum lancamento em aberto encontrado para os filtros selecionados.</div> : null}
      </Card>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-3 text-left text-sm font-semibold transition",
        active ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="rounded-md bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function Alert({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200")}>{text}</div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-600" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-600">
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function SelectionHeader({ rows, selectedIds, onToggleAll }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggleAll: () => void }) {
  return <input type="checkbox" aria-label="Selecionar todos" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={onToggleAll} className="h-4 w-4 rounded border-slate-300" />;
}

function SelectionCell({ id, selectedIds, onToggle }: { id: string; selectedIds: string[]; onToggle: (id: string) => void }) {
  return <input type="checkbox" aria-label="Selecionar lancamento" checked={selectedIds.includes(id)} onChange={() => onToggle(id)} className="h-4 w-4 rounded border-slate-300" />;
}

function PatientTable({ rows, selectedIds, onToggle, onToggleAll, onSingle }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onSingle: (id: string) => void }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-4 py-3 text-left"><SelectionHeader rows={rows} selectedIds={selectedIds} onToggleAll={onToggleAll} /></th>
          <th className="px-4 py-3 text-left">Paciente</th><th className="px-4 py-3 text-left">Clinica</th><th className="px-4 py-3 text-left">Servico</th><th className="px-4 py-3 text-left">Origem</th>
          <th className="px-4 py-3 text-right">Valor total</th><th className="px-4 py-3 text-right">Valor pago</th><th className="px-4 py-3 text-right">Valor em aberto</th>
          <th className="px-4 py-3 text-left">Vencimento</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Acao</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
            <td className="px-4 py-3"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /></td>
            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.patient_name}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.clinic_name}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.service_name}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.origin ?? "-"}</td>
            <td className="px-4 py-3 text-right">{formatCurrency(row.amount)}</td><td className="px-4 py-3 text-right">{formatCurrency(getPaidAmount(row))}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(getOpenAmount(row))}</td>
            <td className="px-4 py-3">{row.due_date}</td><td className="px-4 py-3">{getStatusLabel(row.derived_status)}</td><td className="px-4 py-3 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onSingle(row.id)}>Dar baixa</Button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StaffTable({ rows, selectedIds, onToggle, onToggleAll, onSingle }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onSingle: (id: string) => void }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-4 py-3 text-left"><SelectionHeader rows={rows} selectedIds={selectedIds} onToggleAll={onToggleAll} /></th>
          <th className="px-4 py-3 text-left">Funcionario</th><th className="px-4 py-3 text-left">Clinica</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-left">Descricao</th>
          <th className="px-4 py-3 text-right">Valor bruto</th><th className="px-4 py-3 text-right">Descontos</th><th className="px-4 py-3 text-right">Valor liquido</th><th className="px-4 py-3 text-right">Valor pago</th><th className="px-4 py-3 text-right">Valor em aberto</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Acao</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const type = getStaffType(row);
          const discount = type === "Desconto" ? Math.abs(row.amount) : 0;
          const netAmount = type === "Desconto" ? -Math.abs(row.amount) : row.amount;
          return (
            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
              <td className="px-4 py-3"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /></td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.employee_name}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.clinic_name}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{type}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.description ?? "-"}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.amount)}</td><td className="px-4 py-3 text-right">{formatCurrency(discount)}</td><td className="px-4 py-3 text-right">{formatCurrency(netAmount)}</td><td className="px-4 py-3 text-right">{formatCurrency(getPaidAmount(row))}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(getOpenAmount(row))}</td><td className="px-4 py-3">{getStatusLabel(row.derived_status)}</td><td className="px-4 py-3 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onSingle(row.id)}>Pagar</Button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
