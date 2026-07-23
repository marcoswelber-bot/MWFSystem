"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { auditFinancialAction } from "@/app/(app)/financeiro/document-actions";

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
  ["cartao", "Cartão"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"],
  ["transferencia", "Transferencia"],
  ["outro", "Outro"]
];
const patientStatusOptions: Array<[string, string]> = [["all", "Todos"], ["pendente", "Em aberto"], ["parcial", "Parcial"], ["vencido", "Vencido"]];
const staffStatusOptions: Array<[string, string]> = [["all", "Todos"], ["pendente", "Em aberto"], ["parcial", "Parcial"], ["pago", "Pago"]];
const staffTypeOptions = ["Todos", "Comissão", "Salário fixo", "Bônus", "Desconto", "Ajuste"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(year: string, month: string) {
  return new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
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
  if (text.includes("comiss")) return "Comissão";
  if (text.includes("salario")) return "Salário fixo";
  if (text.includes("bonus")) return "Bônus";
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
  const [receipt, setReceipt] = React.useState<{ html: string; phone: string; clinicId: string; ids: string[] } | null>(null);
  const [periodMode, setPeriodMode] = React.useState<"current" | "previous" | "custom">("current");
  const [periodMonth, setPeriodMonth] = React.useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [periodYear, setPeriodYear] = React.useState(String(new Date().getFullYear()));
  const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false);
  const [initialSelectionApplied, setInitialSelectionApplied] = React.useState(false);
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
  const parsedSettlementAmount = Number.parseFloat(amount.replace(",", "."));
  const informedAmount = mode === "total" ? selectedOpenAmount : Number.isFinite(parsedSettlementAmount) ? parsedSettlementAmount : 0;
  const remainingAfterSettlement = Math.max(selectedOpenAmount - informedAmount, 0);

  React.useEffect(() => {
    setSelectedIds([]);
    setMessage(null);
  }, [tab]);
  React.useEffect(() => {
    if (initialSelectionApplied) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "staff") { setInitialSelectionApplied(true); return; }
    if (tab !== "staff") { setTab("staff"); return; }
    const employeeIds = (params.get("employees") ?? "").split(",").filter(Boolean);
    if (employeeIds.length > 0) {
      setSelectedIds(staffRows.filter((row) => row.employee_id && employeeIds.includes(row.employee_id)).map((row) => row.id));
    }
    setInitialSelectionApplied(true);
  }, [initialSelectionApplied, staffRows, tab]);

  function applyMonth(year: string, month: string, mode: "current" | "previous" | "custom") {
    setPeriodYear(year);
    setPeriodMonth(month);
    setPeriodMode(mode);
    setFilters((current) => ({ ...current, startDate: `${year}-${month}-01`, endDate: monthEnd(year, month) }));
    setSelectedIds([]);
  }

  function choosePreviousMonth() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    applyMonth(String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), "previous");
  }
  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds([]);
  }

  function toggleSelection(id: string) {
    const target = rows.find((row) => row.id === id);
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (tab === "patients" && current.length > 0) {
        const first = rows.find((row) => row.id === current[0]);
        if (first?.patient_id !== target?.patient_id) {
          setMessage({ type: "error", text: "Selecione somente lancamentos do mesmo paciente." });
          return current;
        }
      }
      return [...current, id];
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (current.length) return [];
      if (tab !== "patients") return rows.map((row) => row.id);
      const patientId = rows[0]?.patient_id;
      return rows.filter((row) => row.patient_id === patientId).map((row) => row.id);
    });
    if (tab === "patients" && new Set(rows.map((row) => row.patient_id)).size > 1) setMessage({ type: "error", text: "Foram selecionados apenas os titulos do primeiro paciente. Nao e permitido misturar pacientes." });
  }

  function selectSingle(id: string) {
    setSelectedIds([id]);
    setMode("total");
    setAmount("");
  }

  function documentHtml(kind: "Cobranca" | "Recibo") {
    const clinic = clinics.find((item) => item.id === selectedRows[0]?.clinic_id);
    const dates = selectedRows.map((row) => row.due_date).join(", ");
    const items = selectedRows.map((row) => `<tr><td>${row.description ?? row.service_name}</td><td>${row.due_date}</td><td>${formatCurrency(getOpenAmount(row))}</td></tr>`).join("");
    return `<!doctype html><html><head><title>${kind}</title><style>body{font-family:Arial;padding:32px;color:#172033}h1{color:#6d28d9}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:20px;font-weight:bold;text-align:right}.box{padding:16px;background:#f5f3ff;border-radius:8px}</style></head><body><h1>${clinic?.name ?? "Clinica"} - ${kind}</h1><p><b>Paciente:</b> ${selectedRows[0]?.patient_name ?? "-"}</p><p><b>Data:</b> ${new Date().toLocaleDateString("pt-BR")} &nbsp; <b>Vencimentos:</b> ${dates}</p><table><thead><tr><th>Descricao</th><th>Data</th><th>Valor</th></tr></thead><tbody>${items}</tbody></table><p class="total">Valor total: ${formatCurrency(selectedOpenAmount)}</p><div class="box"><b>Forma de pagamento:</b> ${paymentMethod}<br><b>PIX:</b> ${clinic?.pix_key ?? "Nao informado"}<br><b>Titular:</b> ${clinic?.pix_holder ?? "-"}<br><b>Banco:</b> ${clinic?.pix_bank ?? "-"}</div></body></html>`;
  }

  async function generateDocument(kind: "Cobranca" | "Recibo") {
    if (!selectedRows.length || tab !== "patients") { setMessage({ type: "error", text: "Selecione titulos de um paciente." }); return; }
    const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) { setMessage({ type: "error", text: "Permita pop-ups para gerar o PDF." }); return; }
    popup.document.write(documentHtml(kind)); popup.document.close(); popup.focus(); popup.print();
    await auditFinancialAction({ action: kind === "Cobranca" ? "pdf_generated" : "pdf_generated", clinic_id: selectedRows[0].clinic_id, transaction_ids: selectedIds });
  }

  async function sendCharge() {
    if (!selectedRows.length || tab !== "patients") { setMessage({ type: "error", text: "Selecione titulos de um paciente." }); return; }
    const patient = patients.find((item) => item.id === selectedRows[0].patient_id); const phone = (patient?.phone ?? "").replace(/\D/g, "");
    if (!phone) { setMessage({ type: "error", text: "Paciente sem WhatsApp cadastrado." }); return; }
    const clinic = clinics.find((item) => item.id === selectedRows[0].clinic_id); const details = selectedRows.map((row) => `${row.description ?? row.service_name} - ${formatCurrency(getOpenAmount(row))} - venc. ${row.due_date}`).join("\n");
    const text = `Ola, ${selectedRows[0].patient_name}. Seguem os titulos pendentes da ${clinic?.name ?? "clinica"}:\n\n${details}\n\nTotal: ${formatCurrency(selectedOpenAmount)}\nPIX: ${clinic?.pix_key ?? "consulte a clinica"}\nTitular: ${clinic?.pix_holder ?? "-"}`;
    if (!window.confirm(`Confirmar abertura da cobranca no WhatsApp para ${selectedRows[0].patient_name}?`)) return;
    await auditFinancialAction({ action: "charge_sent", clinic_id: selectedRows[0].clinic_id, transaction_ids: selectedIds }); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  function submitSettlement() {
    setMessage(null);
    if (selectedIds.length === 0) {
      setMessage({ type: "error", text: "Selecione ao menos um lançamento." });
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

    const actionLabel = tab === "patients" ? "receber" : "pagar";
    const receiptSnapshot = tab === "patients" && selectedRows[0] ? { html: documentHtml("Recibo"), phone: (patients.find((item) => item.id === selectedRows[0].patient_id)?.phone ?? "").replace(/\D/g, ""), clinicId: selectedRows[0].clinic_id, ids: [...selectedIds] } : null;
    if (!window.confirm(`Confirmar ${actionLabel} ${formatCurrency(informedAmount)} para ${selectedIds.length} lançamento(s)?`)) return;
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
        setReceipt(receiptSnapshot);
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


      <Card className="p-2">
        <div className="grid gap-2 md:grid-cols-2">
          <TabButton active={tab === "patients"} onClick={() => setTab("patients")}>Recebimentos de pacientes</TabButton>
          <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>Repasses de funcionários</TabButton>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={periodMode === "current" ? "default" : "outline"} onClick={() => applyMonth(String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, "0"), "current")}>Este mês</Button>
          <Button type="button" size="sm" variant={periodMode === "previous" ? "default" : "outline"} onClick={choosePreviousMonth}>Mês anterior</Button>
          <Button type="button" size="sm" variant={periodMode === "custom" ? "default" : "outline"} onClick={() => setPeriodMode("custom")}>Personalizado</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {isAdmMaster ? <SelectField label="Clínica" value={filters.clinicId} onChange={(value) => updateFilter("clinicId", value)} options={[["all", "Todas"], ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])]} /> : null}
          <SelectField label="Mês" value={periodMonth} onChange={(value) => applyMonth(periodYear, value, "current")} options={Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, "0"), new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))] as [string, string])} />
          <InputField label="Ano" value={periodYear} onChange={(value) => value.length <= 4 && applyMonth(value, periodMonth, "current")} />
          {tab === "patients" ? <SelectField label="Paciente" value={filters.patientId} onChange={(value) => updateFilter("patientId", value)} options={[["all", "Todos"], ...patients.map((patient) => [patient.id, patient.full_name] as [string, string])]} /> : <SelectField label="Funcionário" value={filters.employeeId} onChange={(value) => updateFilter("employeeId", value)} options={[["all", "Todos"], ...employees.map((employee) => [employee.id, employee.name] as [string, string])]} />}
          <SelectField label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)} options={tab === "patients" ? patientStatusOptions : staffStatusOptions} />
          <InputField label="Pesquisar" value={filters.search} onChange={(value) => updateFilter("search", value)} placeholder="Nome ou serviço" />
        </div>
        {periodMode === "custom" ? <div className="grid gap-3 sm:grid-cols-2"><InputField label="Início" type="date" value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} /><InputField label="Fim" type="date" value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} /></div> : null}
        <Button type="button" size="sm" variant="ghost" onClick={() => setMoreFiltersOpen((open) => !open)}>{moreFiltersOpen ? "Ocultar filtros" : "Mais filtros"}</Button>
        {moreFiltersOpen ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="Serviço" value={filters.serviceId} onChange={(value) => updateFilter("serviceId", value)} options={[["all", "Todos"], ...services.map((service) => [service.id, service.name] as [string, string])]} />{tab === "patients" ? <SelectField label="Forma de pagamento" value={filters.paymentMethod} onChange={(value) => updateFilter("paymentMethod", value)} options={[["all", "Todas"], ...paymentMethodOptions]} /> : <SelectField label="Tipo" value={filters.type} onChange={(value) => updateFilter("type", value)} options={staffTypeOptions.map((option) => [option, option])} />}</div> : null}
      </Card>
      <Card className="space-y-4 p-4">
        <div><h2 className="text-sm font-semibold">Resumo da baixa</h2><p className="text-xs text-muted-foreground">Confira os valores antes de confirmar.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Quantidade selecionada" value={String(selectedIds.length)} />
          <Metric label="Pendente de pagamento" value={formatCurrency(selectedOpenAmount)} />
          <Metric label={tab === "patients" ? "Valor a receber" : "Valor a pagar"} value={formatCurrency(informedAmount)} />
          <Metric label="Saldo restante" value={formatCurrency(remainingAfterSettlement)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Forma de pagamento" value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={paymentMethodOptions} />
          <InputField label="Data" type="date" value={paidAt} onChange={setPaidAt} />
          {mode === "partial" ? <InputField label="Valor parcial" value={amount} onChange={setAmount} placeholder="0,00" /> : null}
          {moreFiltersOpen ? <InputField label="Observação" value={notes} onChange={setNotes} placeholder="Opcional" /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={submitSettlement} disabled={isPending || selectedIds.length === 0}>{isPending ? "Processando..." : "Confirmar"}</Button>
          <Button type="button" variant={mode === "partial" ? "default" : "outline"} onClick={() => { setMode("partial"); setAmount(""); }}>Baixa parcial</Button>
          <Button type="button" variant="outline" onClick={() => { setSelectedIds([]); setMode("total"); setAmount(""); }}>Cancelar seleção</Button>
          {tab === "patients" ? <>
            <Button type="button" variant="outline" disabled={!selectedIds.length} onClick={() => { void auditFinancialAction({ action: "charge_generated", clinic_id: selectedRows[0].clinic_id, transaction_ids: selectedIds }); setMessage({ type: "success", text: `Cobranca preparada: ${selectedIds.length} titulo(s), total ${formatCurrency(selectedOpenAmount)}.` }); }}>Gerar Cobranca</Button>
            <Button type="button" variant="outline" disabled={!selectedIds.length} onClick={() => void sendCharge()}>Enviar Cobranca</Button>
            <Button type="button" variant="outline" disabled={!selectedIds.length} onClick={() => void generateDocument("Cobranca")}>Gerar PDF</Button>
          </> : null}
        </div>
        {message ? <Alert type={message.type} text={message.text} /> : null}
        {receipt ? <div className="flex flex-wrap gap-2 rounded-md border p-3"><span className="w-full text-sm font-medium">Baixa confirmada. Escolha como receber o recibo:</span><Button type="button" variant="outline" onClick={() => { const popup = window.open("", "_blank", "noopener,noreferrer"); if (popup) { popup.document.write(receipt.html); popup.document.close(); popup.print(); void auditFinancialAction({ action: "pdf_generated", clinic_id: receipt.clinicId, transaction_ids: receipt.ids }); } }}>Baixar recibo em PDF</Button><Button type="button" variant="outline" disabled={!receipt.phone} onClick={() => { if (!window.confirm("Confirmar envio do recibo pelo WhatsApp?")) return; void auditFinancialAction({ action: "receipt_sent", clinic_id: receipt.clinicId, transaction_ids: receipt.ids }); window.open(`https://wa.me/${receipt.phone}?text=${encodeURIComponent("Ola! Seu pagamento foi confirmado. Segue o recibo emitido pela clinica. Obrigado!")}`, "_blank", "noopener,noreferrer"); }}>Enviar recibo pelo WhatsApp</Button></div> : null}
      </Card>
      <Card className="overflow-hidden">
        <div className="hidden lg:block">
          {tab === "patients" ? <PatientTable rows={rows} selectedIds={selectedIds} onToggle={toggleSelection} onToggleAll={toggleAll} onSingle={selectSingle} /> : <StaffTable rows={rows} selectedIds={selectedIds} onToggle={toggleSelection} onToggleAll={toggleAll} onSingle={selectSingle} />}
        </div>
        <div className="grid gap-3 p-3 lg:hidden">
          {rows.map((row) => tab === "patients" ? (
            <PatientMobileCard key={row.id} row={row} selectedIds={selectedIds} onToggle={toggleSelection} onSingle={selectSingle} />
          ) : (
            <StaffMobileCard key={row.id} row={row} selectedIds={selectedIds} onToggle={toggleSelection} onSingle={selectSingle} />
          ))}
        </div>
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum lançamento em aberto encontrado para os filtros selecionados.</div> : null}
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
        "rounded-md px-3 py-2 text-left text-sm font-semibold transition",
        active ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
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
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-600" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-600">
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function SelectionHeader({ rows, selectedIds, onToggleAll }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggleAll: () => void }) {
  return <input type="checkbox" aria-label="Selecionar todos" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={onToggleAll} className="h-5 w-5 rounded border-slate-300 accent-primary" />;
}

function SelectionCell({ id, selectedIds, onToggle }: { id: string; selectedIds: string[]; onToggle: (id: string) => void }) {
  return <input type="checkbox" aria-label="Selecionar lançamento" checked={selectedIds.includes(id)} onChange={() => onToggle(id)} className="h-5 w-5 rounded border-slate-300 accent-primary" />;
}

function MobileValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 rounded-lg bg-muted/40 p-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 break-words text-sm font-medium">{value}</div></div>;
}

function PatientMobileCard({ row, selectedIds, onToggle, onSingle }: { row: FinancialTransaction; selectedIds: string[]; onToggle: (id: string) => void; onSingle: (id: string) => void }) {
  return <article className="grid min-w-0 gap-3 rounded-xl border bg-card p-3 shadow-sm">
    <div className="flex min-w-0 items-start justify-between gap-3"><label className="flex min-w-0 items-center gap-2 text-sm font-semibold"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /><span className="min-w-0 break-words">{row.patient_name}</span></label><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">{getStatusLabel(row.derived_status)}</span></div>
    <div className="grid grid-cols-2 gap-2"><MobileValue label="Clinica" value={row.clinic_name} /><MobileValue label="Servico" value={row.service_name || "-"} /><MobileValue label="Origem" value={row.origin ?? "-"} /><MobileValue label="Vencimento" value={row.due_date} /><MobileValue label="Valor total" value={formatCurrency(row.amount)} /><MobileValue label="Valor pago" value={formatCurrency(getPaidAmount(row))} /><div className="col-span-2"><MobileValue label="Valor em aberto" value={formatCurrency(getOpenAmount(row))} /></div></div>
    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onSingle(row.id)}>Receber</Button>
  </article>;
}

function StaffMobileCard({ row, selectedIds, onToggle, onSingle }: { row: FinancialTransaction; selectedIds: string[]; onToggle: (id: string) => void; onSingle: (id: string) => void }) {
  const type = getStaffType(row);
  const discount = type === "Desconto" ? Math.abs(row.amount) : 0;
  const netAmount = type === "Desconto" ? -Math.abs(row.amount) : row.amount;
  return <article className="grid min-w-0 gap-3 rounded-xl border bg-card p-3 shadow-sm">
    <div className="flex min-w-0 items-start justify-between gap-3"><label className="flex min-w-0 items-center gap-2 text-sm font-semibold"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /><span className="min-w-0 break-words">{row.employee_name}</span></label><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">{getStatusLabel(row.derived_status)}</span></div>
    <div className="grid grid-cols-2 gap-2"><MobileValue label="Clinica" value={row.clinic_name} /><MobileValue label="Tipo" value={type} /><div className="col-span-2"><MobileValue label="Descricao" value={row.description ?? "-"} /></div><MobileValue label="Valor bruto" value={formatCurrency(row.amount)} /><MobileValue label="Descontos" value={formatCurrency(discount)} /><MobileValue label="Valor liquido" value={formatCurrency(netAmount)} /><MobileValue label="Valor pago" value={formatCurrency(getPaidAmount(row))} /><div className="col-span-2"><MobileValue label="Valor em aberto" value={formatCurrency(getOpenAmount(row))} /></div></div>
    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onSingle(row.id)}>Pagar</Button>
  </article>;
}

function PatientTable({ rows, selectedIds, onToggle, onToggleAll, onSingle }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onSingle: (id: string) => void }) {
  return (
    <table className="min-w-[980px] divide-y divide-slate-200 text-xs dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left"><SelectionHeader rows={rows} selectedIds={selectedIds} onToggleAll={onToggleAll} /></th>
          <th className="px-3 py-2 text-left">Paciente</th><th className="px-3 py-2 text-left">Clínica</th><th className="px-3 py-2 text-left">Serviço</th><th className="px-3 py-2 text-left">Origem</th>
          <th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-right">Valor pago</th><th className="px-3 py-2 text-right">Valor em aberto</th>
          <th className="px-3 py-2 text-left">Vencimento</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Acao</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
            <td className="px-3 py-2"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /></td>
            <td className="max-w-44 truncate px-3 py-2 font-medium text-slate-900 dark:text-white" title={row.patient_name}>{row.patient_name}</td><td className="max-w-36 truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={row.clinic_name}>{row.clinic_name}</td><td className="max-w-40 truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={row.service_name}>{row.service_name}</td><td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{row.origin ?? "-"}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(row.amount)}</td><td className="px-3 py-2 text-right">{formatCurrency(getPaidAmount(row))}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(getOpenAmount(row))}</td>
            <td className="whitespace-nowrap px-3 py-2">{row.due_date}</td><td className="whitespace-nowrap px-3 py-2">{getStatusLabel(row.derived_status)}</td><td className="whitespace-nowrap px-3 py-2 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onSingle(row.id)}>Dar baixa</Button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StaffTable({ rows, selectedIds, onToggle, onToggleAll, onSingle }: { rows: FinancialTransaction[]; selectedIds: string[]; onToggle: (id: string) => void; onToggleAll: () => void; onSingle: (id: string) => void }) {
  return (
    <table className="min-w-[980px] divide-y divide-slate-200 text-xs dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left"><SelectionHeader rows={rows} selectedIds={selectedIds} onToggleAll={onToggleAll} /></th>
          <th className="px-3 py-2 text-left">Funcionário</th><th className="px-3 py-2 text-left">Clínica</th><th className="px-3 py-2 text-left">Tipo</th><th className="w-48 px-3 py-2 text-left">Descrição</th>
          <th className="px-3 py-2 text-right">Valor bruto</th><th className="px-3 py-2 text-right">Descontos</th><th className="px-3 py-2 text-right">Valor liquido</th><th className="px-3 py-2 text-right">Valor pago</th><th className="px-3 py-2 text-right">Valor em aberto</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Acao</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const type = getStaffType(row);
          const discount = type === "Desconto" ? Math.abs(row.amount) : 0;
          const netAmount = type === "Desconto" ? -Math.abs(row.amount) : row.amount;
          return (
            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
              <td className="px-3 py-2"><SelectionCell id={row.id} selectedIds={selectedIds} onToggle={onToggle} /></td>
              <td className="max-w-44 truncate px-3 py-2 font-medium text-slate-900 dark:text-white" title={row.employee_name}>{row.employee_name}</td><td className="max-w-36 truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={row.clinic_name}>{row.clinic_name}</td><td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{type}</td><td className="max-w-48 truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={row.description ?? "-"}>{row.description ?? "-"}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(row.amount)}</td><td className="px-3 py-2 text-right">{formatCurrency(discount)}</td><td className="px-3 py-2 text-right">{formatCurrency(netAmount)}</td><td className="px-3 py-2 text-right">{formatCurrency(getPaidAmount(row))}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(getOpenAmount(row))}</td><td className="whitespace-nowrap px-3 py-2">{getStatusLabel(row.derived_status)}</td><td className="whitespace-nowrap px-3 py-2 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onSingle(row.id)}>Pagar</Button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
