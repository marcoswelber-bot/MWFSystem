"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  Edit3,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  ReceiptText,
  Send,
  Share2,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { calculateFinanceIndicators } from "@/lib/finance-indicators";
import type { PermissionSet } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import {
  cancelFinancialSettlement,
  cancelFinancialTransaction,
  createFinancialTransaction,
  deleteFinancialTransaction,
  settleFinancialTransactions,
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
    patient_phone?: string | null;
    patient_cpf?: string | null;
    employee_name: string;
    service_name: string;
    derived_status: FinancialStatus;
  };
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type PaymentSettlement = Database["public"]["Tables"]["payment_settlements"]["Row"];

type FinanceManagerProps = {
  transactions: FinancialTransaction[];
  settlements: PaymentSettlement[];
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  employees: Employee[];
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
};

type FinanceTab = "receitas" | "despesas" | "pacientes" | "contracheques" | "fluxo";
type ChargeTemplate = "friendly" | "overdue" | "reminder" | "confirmation";

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
  ["cartao", "Cartão"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"],
  ["transferencia", "Transferência"],
  ["outro", "Outro"]
];

const settlementPaymentMethodOptions: Array<[PaymentMethod, string]> = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartão"],
  ["transferencia", "Transferência"],
  ["boleto", "Boleto"],
  ["outro", "Outro"]
];

const expenseCategoryOptions = [
  "ADM / Funcionários",
  "Salário",
  "Comissão manual",
  "Adiantamento",
  "Vale transporte",
  "Vale alimentação",
  "Ajuda de custo",
  "INSS",
  "FGTS",
  "IRRF",
  "Férias",
  "13º",
  "Bonificação",
  "Desconto",
  "Aluguel",
  "Energia",
  "Água",
  "Internet / Telefone",
  "Sistema / Software",
  "Material de escritório",
  "Material clínico",
  "Limpeza",
  "Manutenção",
  "Impostos / Taxas",
  "Terceirizados",
  "Marketing",
  "Outros"
].map((category) => [category, category] as [string, string]);

const employeeExpenseCategories = new Set(
  [
    "salario",
    "comissao manual",
    "comissao",
    "adiantamento",
    "vale transporte",
    "vale alimentacao",
    "ajuda de custo",
    "inss",
    "fgts",
    "irrf",
    "ferias",
    "13o",
    "bonificacao",
    "desconto",
    "adm / funcionarios"
  ]
);

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

function isEmployeeExpenseCategory(category?: string | null) {
  return employeeExpenseCategories.has(normalizeText(category));
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
type ClinicWithReceiptData = Clinic & {
  pix_key?: string | null;
  pix?: string | null;
  logo_url?: string | null;
  legal_name?: string | null;
};

type ReceiptSnapshot = {
  transaction: FinancialTransaction;
  clinic: ClinicWithReceiptData | null;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  receiptNumber: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function clinicPixKey(clinic: ClinicWithReceiptData | null) {
  return clinic?.pix_key ?? clinic?.pix ?? "";
}

function clinicLogoUrl(clinic: ClinicWithReceiptData | null) {
  return clinic?.logo_url ?? "";
}

function clinicLegalDetails(clinic: ClinicWithReceiptData | null) {
  if (!clinic) return "-";
  return [clinic.cnpj ? `CNPJ: ${clinic.cnpj}` : null, clinic.address, clinic.phone ? `Telefone: ${clinic.phone}` : null, clinic.email].filter(Boolean).join(" | ") || "-";
}

function normalizePhoneForWhatsApp(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function debitLine(item: FinancialTransaction) {
  const service = item.service_name ?? item.description ?? item.category ?? "Atendimento";
  const appointmentDate = item.appointment_date ?? item.due_date;
  return `- Atendimento em ${formatDate(appointmentDate)}, serviço ${service} | vencimento ${formatDate(item.due_date)} | valor em aberto ${money(getOpenAmount(item))}`;
}

function buildChargeMessage({ patientName, clinicName, debts, pixKey, template = "friendly" }: { patientName: string; clinicName: string; debts: FinancialTransaction[]; pixKey: string; template?: ChargeTemplate }) {
  const total = debts.reduce((sum, item) => sum + getOpenAmount(item), 0);
  const details = debts.map(debitLine).join("\n");
  if (template === "overdue") return `Olá, ${patientName}! Identificamos uma cobrança vencida na ${clinicName}.\n\n${details}\n\nTotal vencido: ${money(total)}\n\nCaso já tenha pago, desconsidere e envie o comprovante. PIX: ${pixKey || "consulte a clínica"}.`;
  if (template === "reminder") return `Olá, ${patientName}! Este é um lembrete de vencimento da ${clinicName}.\n\n${details}\n\nTotal: ${money(total)}\n\nSe precisar de ajuda, fale conosco.`;
  if (template === "confirmation") return `Olá, ${patientName}! A ${clinicName} confirma o recebimento do seu pagamento no valor de ${money(total)}. Obrigado!`;
  return `Olá, ${patientName}!

Consta em nosso sistema valor em aberto referente aos atendimentos abaixo, realizados na ${clinicName}.

Débitos:

${details}

Valor em aberto: ${money(total)}

Caso já tenha realizado o pagamento, por favor envie o comprovante por este WhatsApp para que possamos identificar e dar baixa.

Após a confirmação, enviaremos o recibo.

PIX:
${pixKey || "Chave PIX não cadastrada"}

Atenciosamente,
${clinicName}`;
}

const proofRequestMessage = `Assim que realizar o pagamento, por favor envie o comprovante por este WhatsApp.

Nossa equipe fará a conferência e realizará a baixa em seu cadastro o mais breve possível.`;

function buildReceiptMessage(patientName: string, clinicName: string) {
  return `Olá, ${patientName}!

Recebemos e identificamos o seu pagamento.

Segue em anexo o recibo referente ao pagamento realizado.

Agradecemos pela confiança em nosso trabalho.

Sempre que precisar estaremos à disposição.

Atenciosamente,

${clinicName}`;
}

function buildThanksMessage(clinicName: string) {
  return `Obrigado por manter seus pagamentos em dia.

É uma satisfação cuidar da sua saúde.

Conte sempre conosco.

Equipe
${clinicName}`;
}


type BalanceRow = {
  key: string;
  category: string;
  type: "credito" | "debito";
  count: number;
  total: number;
};

type PaycheckSummary = {
  employee: Employee;
  clinicName: string;
  periodLabel: string;
  baseSalary: number;
  benefits: number;
  manualCommission: number;
  automaticCommission: number;
  appointmentCount: number;
  discounts: number;
  gross: number;
  net: number;
  status: FinancialStatus;
  transactions: FinancialTransaction[];
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function isCommissionTransaction(item: FinancialTransaction) {
  return item.transaction_type === "despesa" && item.commission_status === "generated";
}
function isPayrollTransaction(item: FinancialTransaction) {
  const category = normalizeText(item.category);
  const origin = normalizeText(item.origin);
  const description = normalizeText(item.description);

  return (
    item.transaction_type === "despesa" &&
    (origin === "folha" ||
      category.startsWith("folha") ||
      category.includes("salario") ||
      category.includes("comissao manual") ||
      category.includes("adiantamento") ||
      category.includes("vale transporte") ||
      category.includes("vale alimentacao") ||
      category.includes("ajuda de custo") ||
      category.includes("inss") ||
      category.includes("fgts") ||
      category.includes("irrf") ||
      category.includes("ferias") ||
      category.includes("13o") ||
      category.includes("bonificacao") ||
      category.includes("desconto") ||
      description.includes("competencia"))
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

  return item.category ?? (isCommissionTransaction(item) ? "Comissões" : "Despesas");
}

function isPayrollDiscount(item: FinancialTransaction) {
  const category = normalizeText(item.category);
  return isPayrollTransaction(item) && (category.includes("desconto") || category.includes("encargo"));
}

function isPayrollCredit(item: FinancialTransaction) {
  return isPayrollTransaction(item) && !isPayrollDiscount(item);
}

function getEmployeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "F") + (parts[1]?.[0] ?? "");
}

function getPaycheckStatus(rows: FinancialTransaction[]): FinancialStatus {
  if (rows.length === 0) return "pendente";
  if (rows.every((item) => item.derived_status === "pago")) return "pago";
  if (rows.some((item) => item.derived_status === "vencido")) return "vencido";
  if (rows.some((item) => item.derived_status === "parcial")) return "parcial";
  return "pendente";
}

function buildPaycheckSummaries({
  employees,
  rows,
  clinics,
  clinicFilter,
  periodLabel
}: {
  employees: Employee[];
  rows: FinancialTransaction[];
  clinics: Clinic[];
  clinicFilter: string;
  periodLabel: string;
}) {
  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  return employees
    .filter((employee) => clinicFilter === "all" || employee.clinic_id === clinicFilter)
    .map((employee) => {
      const transactions = rows.filter((item) => item.employee_id === employee.id && (isPayrollTransaction(item) || isCommissionTransaction(item)));
      const payrollCredits = transactions.filter(isPayrollCredit);
      const payrollDiscounts = transactions.filter(isPayrollDiscount);
      const automaticCommissions = transactions.filter(isCommissionTransaction);
      const manualCommissions = payrollCredits.filter((item) => normalizeText(item.category).includes("comissao"));
      const baseSalary = payrollCredits.filter((item) => normalizeText(item.category).includes("salario")).reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const benefits = payrollCredits.filter((item) => {
        const text = normalizeText(`${item.category ?? ""} ${item.description ?? ""}`);
        return ["beneficio", "ajuda de custo", "bonus", "bonificacao", "ferias", "13o"].some((term) => text.includes(term));
      }).reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const manualCommission = manualCommissions.reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const automaticCommission = automaticCommissions.reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const discounts = payrollDiscounts.reduce((total, item) => total + Number(item.amount ?? 0), 0);
      const gross = baseSalary + benefits + manualCommission + automaticCommission;
      return {
        employee,
        clinicName: employee.clinic_id ? clinicsById.get(employee.clinic_id) ?? "Clínica não encontrada" : "Sem clínica",
        periodLabel,
        baseSalary,
        benefits,
        manualCommission,
        automaticCommission,
        appointmentCount: automaticCommissions.length,
        discounts,
        gross,
        net: gross - discounts,
        status: getPaycheckStatus(transactions),
        transactions
      } satisfies PaycheckSummary;
    })
    .filter((summary) => summary.transactions.length > 0)
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
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
  settlements,
  clinics,
  patients,
  services,
  employees,
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
  const [activeTab, setActiveTab] = React.useState<FinanceTab>("receitas");
  const [printPaychecks, setPrintPaychecks] = React.useState<PaycheckSummary[] | null>(null);
  const [settlementTransaction, setSettlementTransaction] =
    React.useState<FinancialTransaction | null>(null);
  const [settlementAmount, setSettlementAmount] = React.useState("");
  const [settlementPaymentMethod, setSettlementPaymentMethod] =
    React.useState<PaymentMethod>("pix");
  const [settlementNotes, setSettlementNotes] = React.useState("");
  const [settlementPaidAt, setSettlementPaidAt] = React.useState(today());
  const [chargeDebts, setChargeDebts] = React.useState<FinancialTransaction[] | null>(null);
  const [receiptSnapshot, setReceiptSnapshot] = React.useState<ReceiptSnapshot | null>(null);

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
  const scopedTransactions = transactions.filter(
    (item) => clinicFilter === "all" || item.clinic_id === clinicFilter
  );
  const periodIndicators = calculateFinanceIndicators(
    scopedTransactions,
    settlements,
    periodStart || "0000-01-01",
    periodEnd || "9999-12-31"
  );

  const incomeRows = filteredTransactions.filter(
    (item) => item.transaction_type === "receita"
  );
  const outflowRows = filteredTransactions.filter(
    (item) => item.transaction_type === "despesa"
  );
  const patientRows = incomeRows.filter((item) => item.derived_status !== "cancelado" && getOpenAmount(item) > 0);
  const balanceRows = buildBalanceRows(filteredTransactions);

  const totalEntries = periodIndicators.billedRevenue;
  const totalOutflows = periodIndicators.expectedExpenses;
  const totalEntriesRealized = periodIndicators.receivedRevenue;
  const totalOutflowsRealized = periodIndicators.paidExpenses;
  const periodBalance = periodIndicators.expectedResult;
  const realizedBalance = periodIndicators.cashBalance;

  const cashFlowTotals = {
    revenueExpected: totalEntries,
    expenseExpected: totalOutflows,
    revenueRealized: totalEntriesRealized,
    expenseRealized: totalOutflowsRealized,
    pendingOutflows: outflowRows
      .filter((item) => item.derived_status !== "pago" && item.derived_status !== "cancelado")
      .reduce((total, item) => total + getOpenAmount(item), 0),
    realized: realizedBalance
  };

  const selectedClinic = clinicFilter === "all" ? null : clinics.find((clinic) => clinic.id === clinicFilter) ?? null;
  const selectedClinicName = selectedClinic?.name ?? (clinicFilter === "all" ? "Todas as clínicas" : "Clínica não encontrada");
  const referenceLabel = `${periodStart} ate ${periodEnd}`;
  const totalOverdueAccounts = filteredTransactions
    .filter((item) => item.derived_status === "vencido")
    .reduce((total, item) => total + getOpenAmount(item), 0);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yearKey = todayKey.slice(0, 4);
  const monthKey = todayKey.slice(0, 7);
  const scopedActive = scopedTransactions.filter((item) => item.derived_status !== "cancelado");
  const indicatorsFor = (prefix: string) => {
    const start = prefix.length === 10 ? prefix : prefix.length === 7 ? `${prefix}-01` : `${prefix}-01-01`;
    const end = prefix.length === 10
      ? prefix
      : prefix.length === 7
        ? new Date(Number(prefix.slice(0, 4)), Number(prefix.slice(5, 7)), 0).toISOString().slice(0, 10)
        : `${prefix}-12-31`;
    return calculateFinanceIndicators(scopedTransactions, settlements, start, end);
  };
  const todayIndicators = indicatorsFor(todayKey);
  const monthIndicators = indicatorsFor(monthKey);
  const yearIndicators = indicatorsFor(yearKey);
  const openRows = scopedActive.filter((item) => item.transaction_type === "receita" && getOpenAmount(item) > 0);
  const dueSoon = openRows.filter((item) => item.due_date >= todayKey).reduce((total, item) => total + getOpenAmount(item), 0);
  const debtorPatients = new Set(openRows.map((item) => item.patient_id).filter(Boolean)).size;
  const currentBalance = calculateFinanceIndicators(scopedTransactions, settlements, "0000-01-01", todayKey).cashBalance;
  const ratioTotal = totalEntries + totalOutflows;
  const revenueRatio = ratioTotal > 0 ? Math.round((totalEntries / ratioTotal) * 100) : 50;
  const expenseRatio = ratioTotal > 0 ? 100 - revenueRatio : 50;
  const balanceBadge = periodBalance >= 0 ? "receitas acima das despesas" : "despesas acima das receitas";
  const paycheckSummaries = buildPaycheckSummaries({ employees, rows: filteredTransactions, clinics, clinicFilter, periodLabel: referenceLabel });

  const tabOptions: Array<[FinanceTab, string]> = [
    ["receitas", "Receitas"],
    ["despesas", "Despesas"],
    ["pacientes", "Pacientes em aberto"],
    ["contracheques", "Contracheques"],
    ["fluxo", "Fluxo de caixa"]
  ];

  React.useEffect(() => {
    if (!printPaychecks) return;

    const previousTitle = document.title;
    const first = printPaychecks[0];
    const fileName = printPaychecks.length === 1
      ? `${first.clinicName} - Contracheque - ${first.employee.name} - ${referenceLabel}`
      : `${selectedClinicName} - Folha de pagamento - ${referenceLabel}`;
    document.title = fileName;
    document.body.classList.add("mwf-finance-paycheck-printing");

    const restore = () => {
      document.body.classList.remove("mwf-finance-paycheck-printing");
      document.title = previousTitle;
      setPrintPaychecks(null);
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.setTimeout(() => window.print(), 100);
    window.setTimeout(restore, 900);
  }, [printPaychecks, referenceLabel, selectedClinicName]);

  function openCommissionReport(summary: PaycheckSummary) {
    const params = new URLSearchParams({ inicio: periodStart, fim: periodEnd });
    if (clinicFilter !== "all") params.set("clinica", clinicFilter);
    router.push(`/financeiro/contracheques/${summary.employee.id}/comissoes?${params.toString()}` as Route);
  }

  function exportAllPaychecks() {
    if (paycheckSummaries.length > 0) setPrintPaychecks(paycheckSummaries);
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ ok: true, message: successMessage });
    } catch {
      setMessage({ ok: false, message: "Não foi possível copiar a mensagem automaticamente." });
    }
  }

  function openWhatsappMessage(phone: string | null | undefined, text: string) {
    const normalizedPhone = normalizePhoneForWhatsApp(phone);
    if (!normalizedPhone) {
      setMessage({ ok: false, message: "Paciente sem telefone cadastrado para WhatsApp." });
      return;
    }

    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function openChargeModal(item: FinancialTransaction) {
    if (!item.patient_id) {
      setMessage({ ok: false, message: "Paciente obrigatório para cobrança via WhatsApp." });
      return;
    }

    const debts = patientRows.filter(
      (row) =>
        row.patient_id === item.patient_id &&
        row.clinic_id === item.clinic_id &&
        row.transaction_type === "receita" &&
        row.derived_status !== "pago" &&
        row.derived_status !== "cancelado" &&
        getOpenAmount(row) > 0
    );

    if (debts.length === 0) {
      setMessage({ ok: false, message: "Paciente sem débitos em aberto para cobrança." });
      return;
    }

    setChargeDebts(debts);
    setMessage(null);
  }

  function clinicForTransaction(item: FinancialTransaction | null | undefined) {
    if (!item) return null;
    return (clinics.find((clinic) => clinic.id === item.clinic_id) ?? null) as ClinicWithReceiptData | null;
  }

  function openReceiptPrint() {
    if (!receiptSnapshot) return;
    const previousTitle = document.title;
    document.title = `${receiptSnapshot.clinic?.name ?? receiptSnapshot.transaction.clinic_name} - Recibo - ${receiptSnapshot.transaction.patient_name} - ${receiptSnapshot.receiptNumber}`;
    document.body.classList.add("mwf-receipt-printing");
    const restore = () => {
      document.body.classList.remove("mwf-receipt-printing");
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.setTimeout(() => window.print(), 100);
    window.setTimeout(restore, 900);
  }

  function shareReceipt() {
    if (!receiptSnapshot) return;
    const text = buildReceiptMessage(receiptSnapshot.transaction.patient_name, receiptSnapshot.clinic?.name ?? receiptSnapshot.transaction.clinic_name);
    if (navigator.share) {
      void navigator.share({ title: "Recibo", text });
      return;
    }
    void copyText(text, "Mensagem do recibo copiada.");
  }
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

  function openSettlement(item: FinancialTransaction, mode: "total" | "partial") {
    setSettlementTransaction(item);
    setSettlementAmount(mode === "total" ? getOpenAmount(item).toFixed(2) : "");
    setSettlementPaymentMethod((item.payment_method as PaymentMethod | null) ?? "pix");
    setSettlementPaidAt(today());
    setSettlementNotes("");
    setMessage(null);
  }
  function openExistingReceipt(item: FinancialTransaction) {
    const paidAmount = getPaidAmount(item);
    if (paidAmount <= 0 || !item.payment_date) {
      setMessage({ ok: false, message: "Este lançamento ainda não possui pagamento para gerar recibo." });
      return;
    }
    setDetailTransaction(null);
    setReceiptSnapshot({
      transaction: item,
      clinic: clinicForTransaction(item),
      paidAmount,
      paymentMethod: (item.payment_method as PaymentMethod | null) ?? "pix",
      paidAt: item.payment_date,
      receiptNumber: `REC-${item.id.slice(0, 8).toUpperCase()}`
    });
  }

  function markAsPaid(item: FinancialTransaction) {
    openSettlement(item, "total");
  }

  function markAsPartiallyPaid(item: FinancialTransaction) {
    openSettlement(item, "partial");
  }

  function closeSettlementModal() {
    setSettlementTransaction(null);
    setSettlementAmount("");
    setSettlementPaymentMethod("pix");
    setSettlementPaidAt(today());
    setSettlementNotes("");
  }

  function submitSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settlementTransaction) return;

    const openAmount = getOpenAmount(settlementTransaction);
    const paidAmount = numberFromForm(settlementAmount);

    if (paidAmount <= 0) {
      setMessage({ ok: false, message: "Informe um valor pago maior que zero." });
      return;
    }

    if (paidAmount > openAmount) {
      setMessage({ ok: false, message: "O valor pago não pode ser maior que o valor em aberto." });
      return;
    }

    startTransition(async () => {
      const result = await settleFinancialTransactions({
        ids: [settlementTransaction.id],
        settlement_type:
          settlementTransaction.transaction_type === "receita"
            ? "patient_payment"
            : "staff_payout",
        mode: paidAmount >= openAmount ? "total" : "partial",
        amount: settlementAmount,
        payment_method: settlementPaymentMethod,
        paid_at: settlementPaidAt,
        notes: settlementNotes
      });

      setMessage(result);

      if (result.ok) {
        if (settlementTransaction.transaction_type === "receita") {
          setReceiptSnapshot({
            transaction: settlementTransaction,
            clinic: clinicForTransaction(settlementTransaction),
            paidAmount,
            paymentMethod: settlementPaymentMethod,
            paidAt: settlementPaidAt,
            receiptNumber: `REC-${settlementTransaction.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`
          });
        }
        closeSettlementModal();
        refresh();
      }
    });
  }

  function cancelTransaction(item: FinancialTransaction) {
    startTransition(async () => {
      const result = await cancelFinancialTransaction(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  function cancelSettlement(settlement: PaymentSettlement) {
    if (!window.confirm(`Cancelar a baixa de ${money(Number(settlement.amount))} registrada em ${formatDate(settlement.paid_at)}?`)) return;
    startTransition(async () => {
      const result = await cancelFinancialSettlement(settlement.id);
      setMessage(result);
      if (result.ok) {
        setDetailTransaction(null);
        refresh();
      }
    });
  }

  function removeTransaction(item: FinancialTransaction) {
    if (!window.confirm("Excluir esta movimentação?")) return;

    startTransition(async () => {
      const result = await deleteFinancialTransaction(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {message ? <SystemMessage message={message} onClose={() => setMessage(null)} /> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm text-muted-foreground">{selectedClinicName}</p>
          <h2 className="text-2xl font-semibold tracking-normal">Referência {referenceLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <>
              <Button type="button" variant="outline" onClick={() => openCreateForm("despesa")}><Plus className="h-4 w-4" />Nova despesa</Button>
              <Button type="button" className="bg-[#1D9E75] text-white hover:bg-[#188765]" onClick={() => openCreateForm("receita")}><Plus className="h-4 w-4" />Nova receita</Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
      <Card className="border p-5 shadow-none">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] lg:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Resultado previsto</p>
            <strong className={cn("mt-2 block font-mono text-4xl tracking-normal", periodBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>{money(periodBalance)}</strong>
            <span className={cn("mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", periodBalance >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100")}>{balanceBadge}</span>
          </div>
          <div className="grid gap-3">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div className="bg-emerald-600" style={{ width: `${revenueRatio}%` }} />
              <div className="bg-orange-500" style={{ width: `${expenseRatio}%` }} />
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded-md border p-3"><span className="text-muted-foreground">Receitas</span><strong className="mt-1 block font-mono text-emerald-700 dark:text-emerald-300">{money(totalEntries)}</strong></div>
              <div className="rounded-md border p-3"><span className="text-muted-foreground">Despesas</span><strong className="mt-1 block font-mono text-orange-700 dark:text-orange-300">{money(totalOutflows)}</strong></div>
            </div>
          </div>
        </div>
      </Card>
      <Card className="border p-5 shadow-none">
        <p className="text-sm text-muted-foreground">Saldo de caixa</p>
        <strong className={cn("mt-2 block whitespace-nowrap font-mono text-4xl tracking-normal", realizedBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>{money(realizedBalance)}</strong>
        <p className="mt-3 text-sm text-muted-foreground">Recebido {money(totalEntriesRealized)} menos despesas pagas {money(totalOutflowsRealized)} no período selecionado.</p>
      </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryCard label="Faturado no mês" value={money(monthIndicators.billedRevenue)} tone="neutral" onClick={() => { setActiveTab("receitas"); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); }} />
        <SummaryCard label="Recebido no mês" value={money(monthIndicators.receivedRevenue)} tone="positive" onClick={() => { setActiveTab("receitas"); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); }} />
        <SummaryCard label="Em aberto" value={money(monthIndicators.openRevenue)} tone="warning" onClick={() => { setActiveTab("pacientes"); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); }} />
        <SummaryCard label="Despesas previstas" value={money(monthIndicators.expectedExpenses)} tone="warning" onClick={() => { setActiveTab("despesas"); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); }} />
        <SummaryCard label="Despesas pagas" value={money(monthIndicators.paidExpenses)} tone="danger" onClick={() => { setActiveTab("despesas"); setPeriodStart(monthStart()); setPeriodEnd(monthEnd()); }} />
        <SummaryCard label="Recebido hoje" value={money(todayIndicators.receivedRevenue)} tone="positive" onClick={() => { setActiveTab("receitas"); setPeriodStart(todayKey); setPeriodEnd(todayKey); }} />
        <SummaryCard label="Recebido no ano" value={money(yearIndicators.receivedRevenue)} tone="positive" onClick={() => { setActiveTab("receitas"); setPeriodStart(`${yearKey}-01-01`); setPeriodEnd(`${yearKey}-12-31`); }} />
        <SummaryCard label="Despesas pagas hoje" value={money(todayIndicators.paidExpenses)} tone="danger" onClick={() => { setActiveTab("despesas"); setPeriodStart(todayKey); setPeriodEnd(todayKey); }} />
        <SummaryCard label="Despesas pagas no ano" value={money(yearIndicators.paidExpenses)} tone="danger" onClick={() => { setActiveTab("despesas"); setPeriodStart(`${yearKey}-01-01`); setPeriodEnd(`${yearKey}-12-31`); }} />
        <SummaryCard label="Saldo atual" value={money(currentBalance)} tone={currentBalance >= 0 ? "positive" : "danger"} onClick={() => setActiveTab("fluxo")} />
        <SummaryCard label="Contas vencidas" value={money(totalOverdueAccounts)} tone="danger" onClick={() => { setActiveTab("pacientes"); setStatusFilter("vencido"); setPeriodStart(""); setPeriodEnd(""); }} />
        <SummaryCard label="Contas a vencer" value={money(dueSoon)} tone="warning" onClick={() => { setActiveTab("pacientes"); setStatusFilter("pendente"); setPeriodStart(todayKey); setPeriodEnd(""); }} />
        <SummaryCard label="Pacientes devedores" value={String(debtorPatients)} tone="neutral" onClick={() => { setActiveTab("pacientes"); setStatusFilter("all"); setPeriodStart(""); setPeriodEnd(""); }} />
      </section>

      <Card className="border p-4 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong className="text-sm">Relatórios financeiros</strong><p className="text-xs text-muted-foreground">Receitas, despesas, fluxo de caixa, inadimplência e análises por clínica, profissional, serviço e forma de pagamento.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => router.push("/relatorios/financeiro" as Route)}><FileText className="h-4 w-4" />Visão financeira</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => router.push("/relatorios/pagamentos" as Route)}><Download className="h-4 w-4" />Pagamentos e exportações</Button>
          </div>
        </div>
      </Card>

      <Card className="border p-4 shadow-none">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 md:col-span-2 xl:col-span-2"><SelectField label="Clínica" value={clinicFilter} onChange={setClinicFilter} options={[...(isAdmMaster ? [["all", "Todas as clínicas"] as [string, string]] : []), ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])]} disabled={!isAdmMaster} /></div>
          <SelectField label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as FinancialStatus | "all")} options={[["all", "Todos"], ...statusOptions]} />
          <TextField label="Data início" type="date" value={periodStart} onChange={setPeriodStart} />
          <TextField label="Data fim" type="date" value={periodEnd} onChange={setPeriodEnd} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
        {tabOptions.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActiveTab(value)} className={cn("h-10 rounded-md px-3 text-sm font-semibold transition-colors", activeTab === value ? "bg-[#1D9E75] text-white" : "text-muted-foreground hover:bg-background hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {activeTab === "receitas" ? <FinanceTable title="Receitas" description="Entradas de pacientes, avulsos, pacotes pagos e outros créditos."><EntriesTable rows={incomeRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onCancel={cancelTransaction} onDelete={removeTransaction} /></FinanceTable> : null}
      {activeTab === "despesas" ? <FinanceTable title="Despesas" description="Saídas da clínica, folha, encargos e comissões."><OutflowsTable rows={outflowRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onCancel={cancelTransaction} onDelete={removeTransaction} /></FinanceTable> : null}
      {activeTab === "pacientes" ? <FinanceTable title="Pacientes em aberto" description="Baixas individuais são feitas aqui. Use Baixas e Repasses somente para lotes e operações administrativas."><PatientPaymentsTable rows={patientRows} canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={setDetailTransaction} onEdit={openEditForm} onPaid={markAsPaid} onPartial={markAsPartiallyPaid} onCancel={cancelTransaction} onDelete={removeTransaction} onCharge={openChargeModal} onOpenPatient={(item) => item.patient_id && router.push(`/pacientes?patientId=${item.patient_id}` as Route)} /></FinanceTable> : null}
      {activeTab === "contracheques" ? <PaychecksPanel summaries={paycheckSummaries} canEdit={canEdit} onExportAll={exportAllPaychecks} onPrintOne={(summary) => setPrintPaychecks([summary])} onDetails={openCommissionReport} /> : null}
      {activeTab === "fluxo" ? (
        <FinanceTable title="Fluxo de caixa" description="Resumo do período com entradas, saídas, saldo e composição do balancete.">
          <section className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
            <SummaryCard label="Receitas realizadas" value={money(cashFlowTotals.revenueRealized)} tone="positive" />
            <SummaryCard label="Despesas realizadas" value={money(cashFlowTotals.expenseRealized)} tone="danger" />
            <SummaryCard label="Pendências" value={money(cashFlowTotals.pendingOutflows)} tone="warning" />
            <SummaryCard label="Saldo realizado" value={money(cashFlowTotals.realized)} tone="neutral" />
            <SummaryCard label="Saldo previsto" value={money(periodBalance)} tone={periodBalance >= 0 ? "positive" : "danger"} />
          </section>
          <BalanceTable rows={balanceRows} />
        </FinanceTable>
      ) : null}

      {detailTransaction ? <TransactionDetailsModal item={detailTransaction} settlements={settlements.filter((settlement) => settlement.financial_transaction_id === detailTransaction.id)} canEdit={canEdit} isPending={isPending} onPaid={(item) => { setDetailTransaction(null); markAsPaid(item); }} onPartial={(item) => { setDetailTransaction(null); markAsPartiallyPaid(item); }} onEdit={(item) => { setDetailTransaction(null); openEditForm(item); }} onCharge={(item) => { setDetailTransaction(null); openChargeModal(item); }} onReceipt={openExistingReceipt} onCancelSettlement={cancelSettlement} onClose={() => setDetailTransaction(null)} /> : null}
      {chargeDebts ? (
        <ChargeWhatsappModal
          debts={chargeDebts}
          clinic={clinicForTransaction(chargeDebts[0])}
          onClose={() => setChargeDebts(null)}
          onCopy={(text) => void copyText(text, "Mensagem de cobrança copiada.")}
          onOpenWhatsapp={openWhatsappMessage}
        />
      ) : null}

      {receiptSnapshot ? (
        <ReceiptModal
          snapshot={receiptSnapshot}
          onClose={() => setReceiptSnapshot(null)}
          onPrint={openReceiptPrint}
          onCopy={(text) => void copyText(text, "Mensagem copiada.")}
          onShare={shareReceipt}
          onOpenWhatsapp={openWhatsappMessage}
        />
      ) : null}
      {settlementTransaction ? (
        <SettlementModal
          item={settlementTransaction}
          amount={settlementAmount}
          paymentMethod={settlementPaymentMethod}
          paidAt={settlementPaidAt}
          notes={settlementNotes}
          isPending={isPending}
          onAmountChange={setSettlementAmount}
          onPaymentMethodChange={setSettlementPaymentMethod}
          onPaidAtChange={setSettlementPaidAt}
          onNotesChange={setSettlementNotes}
          onSubmit={submitSettlement}
          onClose={closeSettlementModal}
        />
      ) : null}
      {formOpen ? <FinanceFormModal form={form} setForm={setForm} editingTransaction={editingTransaction} clinics={clinics} patients={patients} services={services} employees={employees} isAdmMaster={isAdmMaster} isPending={isPending} onSubmit={submitForm} onClose={closeForm} /> : null}
      {printPaychecks ? <PaycheckPrintArea summaries={printPaychecks} /> : null}
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
  onPartial?: (item: FinancialTransaction) => void;
  onCancel: (item: FinancialTransaction) => void;
  onDelete: (item: FinancialTransaction) => void;
  onCharge?: (item: FinancialTransaction) => void;
  onOpenPatient?: (item: FinancialTransaction) => void;
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
          <th className="px-3 py-2">Clínica</th>
          <th className="px-3 py-2">Origem</th>
          <th className="px-3 py-2">Paciente</th>
          <th className="px-3 py-2">Serviço</th>
          <th className="px-3 py-2 text-right">Valor</th>
          <th className="px-3 py-2">Forma</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Ações</th>
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
            <FinanceActionCell item={item} primaryLabel="Dar baixa" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onCancel={onCancel} onDelete={onDelete} />
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
    <table className="w-full min-w-[1080px] text-left text-xs">
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Data</th>
          <th className="px-3 py-2">Clínica</th>
          <th className="px-3 py-2">Categoria</th>
          <th className="px-3 py-2">Funcionário</th>
          <th className="px-3 py-2">Descrição</th>
          <th className="px-3 py-2 text-right">Valor</th>
          <th className="px-3 py-2">Vencimento</th>
          <th className="px-3 py-2">Pagamento</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2 text-right">Ações</th>
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
            <FinanceActionCell item={item} primaryLabel="Dar baixa" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onCancel={onCancel} onDelete={onDelete} />
          </tr>
        )) : <EmptyRow colSpan={10} />}
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
            <td className="whitespace-nowrap px-3 py-2">{item.type === "credito" ? "Crédito" : "Débito"}</td>
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
  onPartial,
  onCancel,
  onDelete,
  onCharge,
  onOpenPatient
}: TableActionProps) {
  return (
    <>
    <div className="grid gap-3 p-3 md:hidden">
      {rows.length > 0 ? rows.map((item) => (
        <article key={item.id} className="grid min-w-0 gap-3 rounded-lg border bg-background p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><strong className="block truncate">{item.patient_name}</strong><p className="truncate text-sm text-muted-foreground">{item.service_name} · {item.employee_name}</p></div>
            <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-semibold", statusClass(item.derived_status))}>{statusLabel(item.derived_status)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <DetailItem label="Valor total" value={money(Number(item.amount ?? 0))} />
            <DetailItem label="Em aberto" value={money(getOpenAmount(item))} />
            <DetailItem label="Valor pago" value={money(getPaidAmount(item))} />
            <DetailItem label="Vencimento" value={formatDate(item.due_date)} />
          </div>
          <div className="grid gap-2">
            {canEdit ? <Button type="button" className="min-h-11" onClick={() => onPaid(item)} disabled={isPending}>Dar baixa</Button> : null}
            {canEdit && onPartial ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onPartial(item)} disabled={isPending}>Baixa parcial</Button> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" className="min-h-11" variant="outline" onClick={() => onDetails(item)}>Ver detalhes</Button>
              {onOpenPatient ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onOpenPatient(item)}>Abrir ficha</Button> : null}
            </div>
            {onCharge ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onCharge(item)}><MessageCircle className="h-4 w-4" />Cobrar via WhatsApp</Button> : null}
          </div>
        </article>
      )) : <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>}
    </div>
    <div className="hidden max-w-full overflow-x-auto md:block">
    <table className="w-full min-w-[1480px] table-fixed text-left text-xs xl:min-w-[1540px]">
      <colgroup>
        <col className="w-[180px]" /><col className="w-[170px]" /><col className="w-[130px]" />
        <col className="w-[170px]" /><col className="w-[160px]" /><col className="w-[110px]" />
        <col className="w-[110px]" /><col className="w-[120px]" /><col className="w-[110px]" />
        <col className="w-[105px]" /><col className="w-[500px]" />
      </colgroup>
      <thead className="bg-muted/60 uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Paciente</th>
          <th className="px-3 py-2">Clínica</th>
          <th className="px-3 py-2">Data do atendimento</th>
          <th className="px-3 py-2">Serviço</th>
          <th className="px-3 py-2">Profissional</th>
          <th className="px-3 py-2 text-right">Valor total</th>
          <th className="px-3 py-2 text-right">Valor pago</th>
          <th className="px-3 py-2 text-right">Valor em aberto</th>
          <th className="px-3 py-2">Vencimento</th>
          <th className="px-3 py-2">Status</th>
          <th className="sticky right-0 z-20 whitespace-nowrap border-l bg-muted px-3 py-2 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.8)]">Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((item) => (
          <tr key={item.id} className="border-t hover:bg-muted/30">
            <td className="truncate px-3 py-2 font-semibold" title={item.patient_name}>{item.patient_name}</td>
            <td className="truncate px-3 py-2" title={item.clinic_name}>{item.clinic_name}</td>
            <td className="whitespace-nowrap px-3 py-2">{formatDate(item.appointment_date ?? item.due_date)}</td>
            <td className="truncate px-3 py-2" title={item.service_name}>{item.service_name}</td>
            <td className="truncate px-3 py-2" title={item.employee_name}>{item.employee_name}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(Number(item.amount ?? 0))}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right">{money(getPaidAmount(item))}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(getOpenAmount(item))}</td>
            <td className="whitespace-nowrap px-3 py-2">{formatDate(item.due_date)}</td>
            <StatusCell status={item.derived_status} compact />
            <FinanceActionCell item={item} primaryLabel="Dar baixa" canEdit={canEdit} canDelete={canDelete} isPending={isPending} onDetails={onDetails} onEdit={onEdit} onPaid={onPaid} onPartial={onPartial} onCancel={onCancel} onDelete={onDelete} onCharge={onCharge} onOpenPatient={onOpenPatient} sticky />
          </tr>
        )) : <EmptyRow colSpan={11} />}
      </tbody>
    </table>
    </div>
    </>
  );
}

function PaychecksPanel({
  summaries,
  canEdit,
  onExportAll,
  onPrintOne,
  onDetails
}: {
  summaries: PaycheckSummary[];
  canEdit: boolean;
  onExportAll: () => void;
  onPrintOne: (summary: PaycheckSummary) => void;
  onDetails: (summary: PaycheckSummary) => void;
}) {
  return (
    <Card className="overflow-hidden border shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Contracheques</h2>
          <p className="text-sm text-muted-foreground">Resumo de folha e comissões por funcionário.</p>
        </div>
        <Button type="button" variant="outline" onClick={onExportAll} disabled={summaries.length === 0}>
          <Download className="h-4 w-4" />
          Exportar tudo
        </Button>
      </div>
      <div className="grid gap-3 p-4">
        {summaries.length > 0 ? summaries.map((summary) => (
          <div key={summary.employee.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1D9E75]/10 text-xs font-semibold text-[#1D9E75]">{getEmployeeInitials(summary.employee.name)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-sm">{summary.employee.name}</strong>
                <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", statusClass(summary.status))}>{statusLabel(summary.status)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{summary.employee.role ?? "Profissional"} · {summary.clinicName}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mr-2 text-right">
                <span className="block text-xs text-muted-foreground">Total líquido</span>
                <strong className="font-mono text-base">{money(summary.net)}</strong>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onDetails(summary)}>Ver detalhado</Button>
              <Button type="button" size="sm" onClick={() => onPrintOne(summary)} disabled={!canEdit}>
                <FileText className="h-4 w-4" />
                Baixar contracheque
              </Button>
            </div>
          </div>
        )) : <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">Nenhum contracheque encontrado para os filtros selecionados.</div>}
      </div>
    </Card>
  );
}

function PaycheckPrintArea({ summaries }: { summaries: PaycheckSummary[] }) {
  const generatedAt = today();
  return (
    <div className="finance-paycheck-print-area hidden">
      {summaries.map((summary) => (
        <article key={summary.employee.id} className="finance-paycheck-document">
          <header className="finance-paycheck-header">
            <div>
              <strong>MWFSystem</strong>
              <h1>Contracheque</h1>
            </div>
            <div>
              <p>{summary.clinicName}</p>
              <p>Período: {summary.periodLabel}</p>
            </div>
          </header>
          <section className="finance-paycheck-grid">
            <DetailItem label="Funcionário" value={summary.employee.name} />
            <DetailItem label="Cargo" value={summary.employee.role ?? "Profissional"} />
            <DetailItem label="Admissão" value={summary.employee.created_at?.slice(0, 10) ?? "-"} />
            <DetailItem label="Status" value={statusLabel(summary.status)} />
          </section>
          <table className="finance-paycheck-table">
            <tbody>
              <tr><td>Salário base</td><td>{money(summary.baseSalary)}</td></tr>
              <tr><td>Comissões sobre atendimentos ({summary.appointmentCount} atendimentos)</td><td>{money(summary.automaticCommission)}</td></tr>
              <tr><td>Comissões manuais e benefícios</td><td>{money(summary.manualCommission + summary.benefits)}</td></tr>
              <tr><td>Descontos</td><td>{money(summary.discounts)}</td></tr>
              <tr className="finance-paycheck-net"><td>Total líquido a receber</td><td>{money(summary.net)}</td></tr>
            </tbody>
          </table>
          <p className="finance-paycheck-note">A lista detalhada de pacientes e valores por atendimento está disponível em relatório separado no Financeiro.</p>
          <footer className="finance-paycheck-signatures">
            <div>Assinatura do funcionário</div>
            <div>Assinatura da clínica</div>
          </footer>
          <p className="finance-paycheck-date">Data de geração: {generatedAt}</p>
        </article>
      ))}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body.mwf-finance-paycheck-printing * { visibility: hidden !important; }
          body.mwf-finance-paycheck-printing .finance-paycheck-print-area,
          body.mwf-finance-paycheck-printing .finance-paycheck-print-area * { visibility: visible !important; }
          body.mwf-finance-paycheck-printing .finance-paycheck-print-area { display: block !important; position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; background: #fff !important; color: #111827 !important; }
          .finance-paycheck-document { page-break-after: always; break-after: page; font-size: 10px; line-height: 1.25; }
          .finance-paycheck-document:last-child { page-break-after: auto; break-after: auto; }
          .finance-paycheck-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #111827; padding-bottom: 8px; margin-bottom: 10px; }
          .finance-paycheck-header h1 { margin: 2px 0 0; font-size: 18px; }
          .finance-paycheck-header p { margin: 0 0 2px; text-align: right; }
          .finance-paycheck-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
          .finance-paycheck-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px; }
          .finance-paycheck-table td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          .finance-paycheck-table td:last-child { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 700; }
          .finance-paycheck-net td { background: #eefcf7; font-weight: 700; }
          .finance-paycheck-note { border: 1px solid #cbd5e1; padding: 8px; margin: 10px 0 26px; }
          .finance-paycheck-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; text-align: center; }
          .finance-paycheck-signatures div { border-top: 1px solid #111827; padding-top: 6px; }
          .finance-paycheck-date { margin-top: 14px; text-align: right; }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, tone, onClick }: { label: string; value: string; tone: "neutral" | "positive" | "warning" | "danger"; onClick?: () => void }) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-300"
  }[tone];

  return (
    <Card className={cn("border p-4 shadow-none", onClick && "cursor-pointer transition-colors hover:border-[#1D9E75]")} onClick={onClick}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <strong className={cn("mt-2 block font-mono text-xl tracking-normal", toneClass)}>{value}</strong>
    </Card>
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
  onPartial,
  onCancel,
  onDelete,
  onCharge,
  onOpenPatient,
  sticky = false
}: {
  item: FinancialTransaction;
  primaryLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  onDetails: (item: FinancialTransaction) => void;
  onEdit: (item: FinancialTransaction) => void;
  onPaid: (item: FinancialTransaction) => void;
  onPartial?: (item: FinancialTransaction) => void;
  onCancel: (item: FinancialTransaction) => void;
  onDelete: (item: FinancialTransaction) => void;
  onCharge?: (item: FinancialTransaction) => void;
  onOpenPatient?: (item: FinancialTransaction) => void;
  sticky?: boolean;
}) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2", sticky && "sticky right-0 z-10 border-l bg-background shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.8)]")}>
      <div className="flex min-w-max justify-end gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => onDetails(item)}>Ver detalhes</Button>
        {onCharge && getOpenAmount(item) > 0 ? <Button type="button" size="sm" variant="outline" onClick={() => onCharge(item)}><MessageCircle className="h-4 w-4" />Cobrar via WhatsApp</Button> : null}
        {onOpenPatient && item.patient_id ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenPatient(item)}>Abrir ficha</Button> : null}
        {canEdit ? (
          <>
            <Button type="button" size="sm" onClick={() => onPaid(item)} disabled={isPending || item.derived_status === "pago"}>{primaryLabel}</Button>
            {onPartial ? <Button type="button" size="sm" variant="outline" onClick={() => onPartial(item)} disabled={isPending || item.derived_status === "pago"}>Baixa parcial</Button> : null}
            <Button type="button" size="sm" variant="outline" onClick={() => onCancel(item)} disabled={isPending || item.derived_status === "cancelado"}>Cancelar</Button>
            <IconButton label="Editar" onClick={() => onEdit(item)} icon={Edit3} />
          </>
        ) : null}
        {canDelete ? <IconButton label="Excluir" onClick={() => onDelete(item)} icon={Trash2} danger /> : null}
      </div>
    </td>
  );
}


function ChargeWhatsappModal({
  debts,
  clinic,
  onClose,
  onCopy,
  onOpenWhatsapp
}: {
  debts: FinancialTransaction[];
  clinic: ClinicWithReceiptData | null;
  onClose: () => void;
  onCopy: (text: string) => void;
  onOpenWhatsapp: (phone: string | null | undefined, text: string) => void;
}) {
  const [selectedIds, setSelectedIds] = React.useState(() => debts.map((debt) => debt.id));
  const [template, setTemplate] = React.useState<ChargeTemplate>("friendly");
  const selectedDebts = debts.filter((debt) => selectedIds.includes(debt.id));
  const firstDebt = debts[0];
  const clinicName = clinic?.name ?? firstDebt?.clinic_name ?? "Clínica";
  const pixKey = clinicPixKey(clinic);
  const total = selectedDebts.reduce((sum, debt) => sum + getOpenAmount(debt), 0);
  const message = buildChargeMessage({ patientName: firstDebt?.patient_name ?? "Paciente", clinicName, debts: selectedDebts, pixKey, template });
  const phone = firstDebt?.patient_phone ?? null;

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border-none p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Cobrar via WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Selecione os débitos e envie uma mensagem pronta ao paciente.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <DetailItem label="Paciente" value={firstDebt?.patient_name ?? "-"} />
          <DetailItem label="Telefone" value={phone || "Sem telefone cadastrado"} />
          <DetailItem label="PIX" value={pixKey || "Chave PIX não cadastrada"} />
        </div>

        <div className="mt-4">
          <SelectField label="Modelo da mensagem" value={template} onChange={(value) => setTemplate(value as ChargeTemplate)} options={[["friendly", "Cobrança amigável"], ["overdue", "Cobrança vencida"], ["reminder", "Lembrete de vencimento"], ["confirmation", "Confirmação de pagamento"]]} />
        </div>
        <div className="mt-4 rounded-md border">
          {debts.map((debt) => (
            <label key={debt.id} className="flex gap-3 border-b p-3 last:border-b-0">
              <input type="checkbox" checked={selectedIds.includes(debt.id)} onChange={() => toggle(debt.id)} />
              <span className="grid flex-1 gap-1">
                <strong>{debt.description ?? debt.service_name ?? debt.category ?? "Lançamento financeiro"}</strong>
                <span className="text-muted-foreground">Vencimento {formatDate(debt.due_date)} · em aberto {money(getOpenAmount(debt))}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
          <DetailItem label="Selecionados" value={String(selectedDebts.length)} />
          <DetailItem label="Valor total" value={money(total)} />
        </div>

        <textarea className="mt-4 min-h-64 w-full rounded-md border bg-background p-3 text-sm" readOnly value={message} />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onCopy(proofRequestMessage)}><Copy className="h-4 w-4" />Copiar mensagem do comprovante</Button>
          <Button type="button" variant="outline" onClick={() => onCopy(message)} disabled={selectedDebts.length === 0}><Copy className="h-4 w-4" />Copiar mensagem</Button>
          <Button type="button" onClick={() => onOpenWhatsapp(phone, message)} disabled={selectedDebts.length === 0}><MessageCircle className="h-4 w-4" />Abrir WhatsApp</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}

function ReceiptModal({
  snapshot,
  onClose,
  onPrint,
  onCopy,
  onShare,
  onOpenWhatsapp
}: {
  snapshot: ReceiptSnapshot;
  onClose: () => void;
  onPrint: () => void;
  onCopy: (text: string) => void;
  onShare: () => void;
  onOpenWhatsapp: (phone: string | null | undefined, text: string) => void;
}) {
  const { transaction, clinic, paidAmount, paymentMethod, paidAt, receiptNumber } = snapshot;
  const clinicName = clinic?.name ?? transaction.clinic_name;
  const receiptMessage = buildReceiptMessage(transaction.patient_name, clinicName);
  const thanksMessage = buildThanksMessage(clinicName);
  const logoUrl = clinicLogoUrl(clinic);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="receipt-print-root max-h-[90vh] w-full max-w-3xl overflow-y-auto border-none p-5 shadow-2xl">
        <div className="receipt-screen-actions flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Recibo de pagamento</h2>
            <p className="text-sm text-muted-foreground">Recibo disponível após a baixa financeira.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <article className="receipt-document mt-4 rounded-md border bg-background p-5">
          <header className="flex items-start justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo da clínica" className="h-12 w-12 rounded object-contain" />
              ) : null}
              <div><strong className="text-lg">{clinicName}</strong><p className="text-sm text-muted-foreground">{clinicLegalDetails(clinic)}</p></div>
            </div>
            <div className="text-right text-sm"><strong>{receiptNumber}</strong><p>{formatDate(paidAt)}</p></div>
          </header>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <DetailItem label="Paciente" value={transaction.patient_name} />
            <DetailItem label="CPF" value={transaction.patient_cpf ?? "-"} />
            <DetailItem label="Serviço" value={transaction.service_name ?? "-"} />
            <DetailItem label="Valor" value={money(paidAmount)} />
            <DetailItem label="Forma de pagamento" value={paymentMethodOptions.find(([value]) => value === paymentMethod)?.[1] ?? paymentMethod} />
            <DetailItem label="Data do pagamento" value={formatDate(paidAt)} />
            <DetailItem label="Responsável pela baixa" value="Financeiro" />
            <DetailItem label="Observações" value={transaction.notes ?? "-"} />
          </div>
        </article>

        <div className="receipt-screen-actions mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />Imprimir</Button>
          <Button type="button" variant="outline" onClick={onPrint}><ReceiptText className="h-4 w-4" />PDF</Button>
          <Button type="button" variant="outline" onClick={onShare}><Share2 className="h-4 w-4" />Compartilhar</Button>
          <Button type="button" variant="outline" onClick={() => onCopy(thanksMessage)}><Copy className="h-4 w-4" />Copiar agradecimento</Button>
          <Button type="button" variant="outline" onClick={() => onCopy(receiptMessage)}><Copy className="h-4 w-4" />Copiar mensagem</Button>
          <Button type="button" onClick={() => onOpenWhatsapp(transaction.patient_phone, receiptMessage)}><Send className="h-4 w-4" />Enviar recibo</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
        <style jsx global>{`
          @media print {
            @page { size: A4 portrait; margin: 10mm; }
            body.mwf-receipt-printing * { visibility: hidden !important; }
            body.mwf-receipt-printing .receipt-print-root,
            body.mwf-receipt-printing .receipt-print-root * { visibility: visible !important; }
            body.mwf-receipt-printing .receipt-screen-actions { display: none !important; }
            body.mwf-receipt-printing .receipt-print-root { display: block !important; position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-height: none !important; overflow: visible !important; background: #fff !important; color: #111827 !important; box-shadow: none !important; }
            body.mwf-receipt-printing .receipt-document { border: 1px solid #111827 !important; }
          }
        `}</style>
      </Card>
    </div>
  );
}function SettlementModal({
  item,
  amount,
  paymentMethod,
  paidAt,
  notes,
  isPending,
  onAmountChange,
  onPaymentMethodChange,
  onPaidAtChange,
  onNotesChange,
  onSubmit,
  onClose
}: {
  item: FinancialTransaction;
  amount: string;
  paymentMethod: PaymentMethod;
  paidAt: string;
  notes: string;
  isPending: boolean;
  onAmountChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onPaidAtChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const openAmount = getOpenAmount(item);
  const paidAmount = numberFromForm(amount);
  const remainingAmount = Math.max(openAmount - paidAmount, 0);
  const isPartial = paidAmount > 0 && paidAmount < openAmount;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-xl border-none p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Dar baixa</h2>
            <p className="text-sm text-muted-foreground">
              {item.transaction_type === "receita" ? "Recebimento" : "Pagamento"} de {money(openAmount)} em aberto.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
            <DetailItem label="Paciente" value={item.patient_name} />
            <DetailItem label="Serviço" value={item.service_name} />
            <DetailItem label="Valor total" value={money(Number(item.amount ?? 0))} />
            <DetailItem label="Valor já pago" value={money(getPaidAmount(item))} />
            <DetailItem label="Valor em aberto" value={money(openAmount)} />
            <DetailItem label="Saldo após baixa" value={money(remainingAmount)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Forma de pagamento"
              value={paymentMethod}
              onChange={(value) => onPaymentMethodChange(value as PaymentMethod)}
              options={settlementPaymentMethodOptions}
              required
            />
            <TextField
              label="Valor pago"
              type="number"
              step="0.01"
              value={amount}
              onChange={onAmountChange}
              required
            />
            <TextField
              label="Data da baixa"
              type="date"
              value={paidAt}
              onChange={onPaidAtChange}
              required
            />
          </div>
          <TextAreaField label="Observação" value={notes} onChange={onNotesChange} />
          <p className="text-sm text-muted-foreground">
            Tipo de baixa: {isPartial ? "parcial" : "total"}. Somente o valor confirmado será somado aos indicadores de caixa.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Confirmar baixa"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function TransactionDetailsModal({ item, settlements, canEdit, isPending, onPaid, onPartial, onEdit, onCharge, onReceipt, onCancelSettlement, onClose }: {
  item: FinancialTransaction;
  settlements: PaymentSettlement[];
  canEdit: boolean;
  isPending: boolean;
  onPaid: (item: FinancialTransaction) => void;
  onPartial: (item: FinancialTransaction) => void;
  onEdit: (item: FinancialTransaction) => void;
  onCharge: (item: FinancialTransaction) => void;
  onReceipt: (item: FinancialTransaction) => void;
  onCancelSettlement: (settlement: PaymentSettlement) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
      <Card className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto border-none p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Detalhes financeiros</h2>
            <p className="text-sm text-muted-foreground">{item.description ?? item.service_name ?? item.category ?? "Lançamento financeiro"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <DetailItem label="Clínica" value={item.clinic_name} />
          <DetailItem label="Status" value={statusLabel(item.derived_status)} />
          <DetailItem label="Paciente" value={item.patient_name} />
          <DetailItem label="Profissional" value={item.employee_name} />
          <DetailItem label="Serviço" value={item.service_name} />
          <DetailItem label="Categoria" value={item.category ?? "-"} />
          <DetailItem label="Valor total" value={money(Number(item.amount ?? 0))} />
          <DetailItem label="Valor pago" value={money(getPaidAmount(item))} />
          <DetailItem label="Valor em aberto" value={money(getOpenAmount(item))} />
          <DetailItem label="Vencimento" value={item.due_date} />
          <DetailItem label="Pagamento" value={item.payment_date ?? "-"} />
          <DetailItem label="Origem" value={item.origin ?? "-"} />
        </div>
        {item.notes ? <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{item.notes}</div> : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {canEdit && getOpenAmount(item) > 0 ? <Button type="button" onClick={() => onPaid(item)} disabled={isPending}>Receber pagamento</Button> : null}
          {canEdit && getOpenAmount(item) > 0 ? <Button type="button" variant="outline" onClick={() => onPartial(item)} disabled={isPending}>Baixa parcial</Button> : null}
          {canEdit ? <Button type="button" variant="outline" onClick={() => onEdit(item)} disabled={isPending}>Editar lançamento</Button> : null}
          {item.transaction_type === "receita" && getOpenAmount(item) > 0 ? <Button type="button" variant="outline" onClick={() => onCharge(item)}><MessageCircle className="h-4 w-4" />Cobrar via WhatsApp</Button> : null}
          <Button type="button" variant="outline" onClick={() => onReceipt(item)} disabled={getPaidAmount(item) <= 0}><ReceiptText className="h-4 w-4" />Gerar recibo</Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById(`financial-history-${item.id}`)?.scrollIntoView({ behavior: "smooth" })}>Histórico financeiro</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
        <div id={`financial-history-${item.id}`} className="mt-4 grid scroll-mt-4 gap-2">
            <h3 className="text-sm font-semibold">Baixas registradas</h3>
            {settlements.map((settlement) => (
              <div key={settlement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div><strong>{money(Number(settlement.amount))}</strong><p className="text-xs text-muted-foreground">{formatDate(settlement.paid_at)} · {settlement.payment_method ?? "Forma não informada"}</p></div>
                {canEdit ? <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => onCancelSettlement(settlement)}>Cancelar baixa</Button> : null}
              </div>
            ))}
            {settlements.length === 0 ? <p className="rounded-md border p-3 text-sm text-muted-foreground">Nenhuma baixa registrada para este lançamento.</p> : null}
        </div>
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


function FinanceFormModal({
  form,
  setForm,
  editingTransaction,
  clinics,
  patients,
  services,
  employees,
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
  employees: Employee[];
  isAdmMaster: boolean;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const isRevenue = form.transaction_type === "receita";
  const isManualRevenue = isRevenue && form.origin === "manual";
  const isEmployeeExpense = !isRevenue && isEmployeeExpenseCategory(form.category);
  const amount = numberFromForm(form.amount);
  const selectedClinicId = form.clinic_id ?? "";
  const employeeOptions = employees
    .filter((employee) => !selectedClinicId || employee.clinic_id === selectedClinicId)
    .map((employee) => [employee.id, employee.name] as [string, string]);

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
              label="Clínica"
              value={form.clinic_id ?? ""}
              onChange={(value) =>
                setForm((current) => ({ ...current, clinic_id: value, employee_id: "" }))
              }
              options={clinics.map((clinic) => [clinic.id, clinic.name])}
              disabled={!isAdmMaster}
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
                    setForm((current) => ({
                      ...current,
                      category: value,
                      employee_id: isEmployeeExpenseCategory(value) ? current.employee_id : ""
                    }))
                  }
                  options={expenseCategoryOptions}
                  required
                />
                {isEmployeeExpense ? (
                  <SelectField
                    label="Funcionário/Profissional"
                    value={form.employee_id ?? ""}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, employee_id: value }))
                    }
                    options={employeeOptions}
                    required
                  />
                ) : null}
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
            {isManualRevenue ? (
              <TextField
                label="Data de recebimento/pagamento"
                type="date"
                value={form.payment_date ?? ""}
                onChange={(value) =>
                  setForm((current) => ({ ...current, payment_date: value }))
                }
                required
              />
            ) : null}
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

