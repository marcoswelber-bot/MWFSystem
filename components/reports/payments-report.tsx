"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  ReceiptText,
  Search,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReportPrintActions } from "@/components/reports/report-print-actions";
import type { Database } from "@/types/database";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

export type PaymentReportTransaction = {
  id: string;
  clinicId: string;
  clinicName: string;
  patientId: string | null;
  patientName: string;
  serviceId: string | null;
  serviceName: string;
  origin: string | null;
  amount: number;
  paymentMethod: string | null;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  appointmentDate: string | null;
  createdAt: string;
};

type PaymentsReportProps = {
  rows: PaymentReportTransaction[];
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  currentClinicId: string | null;
  canSelectClinic: boolean;
  loadError?: string;
};

type PaymentStatus = "pago" | "em_aberto" | "parcial" | "vencido" | "cancelado";
type PaymentRow = PaymentReportTransaction & {
  reportDate: string;
  normalizedStatus: PaymentStatus;
  paidAmount: number;
  openAmount: number;
};
type SortKey =
  | "reportDate"
  | "patientName"
  | "clinicName"
  | "serviceName"
  | "origin"
  | "amount"
  | "paidAmount"
  | "openAmount"
  | "paymentMethod"
  | "normalizedStatus"
  | "dueDate"
  | "paymentDate";

const pageSize = 10;
const statusOptions: Array<[PaymentStatus | "all", string]> = [
  ["all", "Todos"],
  ["pago", "Pago"],
  ["em_aberto", "Em aberto"],
  ["parcial", "Parcial"],
  ["vencido", "Vencido"],
  ["cancelado", "Cancelado"]
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`)
  );
}

function normalizeStatus(row: PaymentReportTransaction): PaymentStatus {
  const status = normalizeText(row.status).replace(/[^a-z0-9]+/g, "_");
  const dueDate = row.dueDate?.slice(0, 10);
  const now = today();

  if (status.includes("cancel")) {
    return "cancelado";
  }

  if (status.includes("parcial")) {
    return "parcial";
  }

  if (status.includes("pago") || status.includes("paid")) {
    return "pago";
  }

  if (status.includes("venc") || (dueDate && dueDate < now)) {
    return "vencido";
  }

  return "em_aberto";
}

function statusLabel(status: PaymentStatus) {
  return statusOptions.find(([value]) => value === status)?.[1] ?? status;
}

function statusClass(status: PaymentStatus) {
  if (status === "pago") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  }

  if (status === "vencido") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100";
  }

  if (status === "parcial") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
  }

  if (status === "cancelado") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-100";
}

function paymentAmounts(row: PaymentReportTransaction, status: PaymentStatus) {
  if (status === "pago") {
    return { paidAmount: row.amount, openAmount: 0 };
  }

  if (status === "cancelado") {
    return { paidAmount: 0, openAmount: 0 };
  }

  return { paidAmount: 0, openAmount: row.amount };
}

function buildPaymentRow(row: PaymentReportTransaction): PaymentRow {
  const normalizedStatus = normalizeStatus(row);
  const amounts = paymentAmounts(row, normalizedStatus);

  return {
    ...row,
    reportDate: row.paymentDate ?? row.dueDate ?? row.createdAt.slice(0, 10),
    normalizedStatus,
    paidAmount: amounts.paidAmount,
    openAmount: amounts.openAmount
  };
}

function downloadCsv(fileName: string, rows: PaymentRow[]) {
  const header = [
    "Data",
    "Paciente",
    "Clinica",
    "Servico",
    "Origem",
    "Valor total",
    "Valor pago",
    "Valor em aberto",
    "Forma de pagamento",
    "Status",
    "Data de vencimento",
    "Data de pagamento"
  ];
  const csvRows = rows.map((row) =>
    [
      row.reportDate,
      row.patientName,
      row.clinicName,
      row.serviceName,
      row.origin ?? "-",
      String(row.amount),
      String(row.paidAmount),
      String(row.openAmount),
      row.paymentMethod ?? "-",
      statusLabel(row.normalizedStatus),
      row.dueDate,
      row.paymentDate ?? ""
    ]
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...csvRows].join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function PaymentsReport({
  rows,
  clinics,
  patients,
  services,
  currentClinicId,
  canSelectClinic,
  loadError
}: PaymentsReportProps) {
  const [clinicId, setClinicId] = React.useState(currentClinicId ?? "all");
  const [startDate, setStartDate] = React.useState(monthStart());
  const [endDate, setEndDate] = React.useState(today());
  const [patientId, setPatientId] = React.useState("all");
  const [serviceId, setServiceId] = React.useState("all");
  const [paymentMethod, setPaymentMethod] = React.useState("all");
  const [status, setStatus] = React.useState<PaymentStatus | "all">("all");
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("reportDate");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [issuedAt, setIssuedAt] = React.useState("");
  const paymentMethods = React.useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.paymentMethod).filter(Boolean))).sort(
        (a, b) => String(a).localeCompare(String(b), "pt-BR")
      ) as string[],
    [rows]
  );
  const filteredRows = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return rows
      .map(buildPaymentRow)
      .filter((row) => (clinicId === "all" ? true : row.clinicId === clinicId))
      .filter((row) => (startDate ? row.reportDate >= startDate : true))
      .filter((row) => (endDate ? row.reportDate <= endDate : true))
      .filter((row) => (patientId === "all" ? true : row.patientId === patientId))
      .filter((row) => (serviceId === "all" ? true : row.serviceId === serviceId))
      .filter((row) =>
        paymentMethod === "all" ? true : row.paymentMethod === paymentMethod
      )
      .filter((row) => (status === "all" ? true : row.normalizedStatus === status))
      .filter((row) => {
        if (!normalizedQuery) {
          return true;
        }

        return normalizeText(
          [
            row.reportDate,
            row.patientName,
            row.clinicName,
            row.serviceName,
            row.origin,
            row.paymentMethod,
            statusLabel(row.normalizedStatus)
          ].join(" ")
        ).includes(normalizedQuery);
      })
      .sort((a, b) => {
        const left = a[sortKey] ?? "";
        const right = b[sortKey] ?? "";
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), "pt-BR", { numeric: true });

        return sortDirection === "asc" ? result : -result;
      });
  }, [
    clinicId,
    endDate,
    patientId,
    paymentMethod,
    query,
    rows,
    serviceId,
    sortDirection,
    sortKey,
    startDate,
    status
  ]);
  const totals = React.useMemo(() => {
    const totalReceived = filteredRows.reduce(
      (total, row) => total + row.paidAmount,
      0
    );
    const paidRows = filteredRows.filter((row) => row.normalizedStatus === "pago");

    return {
      totalReceived,
      totalOpen: filteredRows
        .filter((row) => row.normalizedStatus === "em_aberto")
        .reduce((total, row) => total + row.openAmount, 0),
      totalOverdue: filteredRows
        .filter((row) => row.normalizedStatus === "vencido")
        .reduce((total, row) => total + row.openAmount, 0),
      totalPartial: filteredRows
        .filter((row) => row.normalizedStatus === "parcial")
        .reduce((total, row) => total + row.openAmount, 0),
      debtorPatients: new Set(
        filteredRows
          .filter((row) => row.openAmount > 0 && row.patientId)
          .map((row) => row.patientId)
      ).size,
      averageReceivedTicket: paidRows.length > 0 ? totalReceived / paidRows.length : 0
    };
  }, [filteredRows]);
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedClinicName =
    clinicId === "all"
      ? "Todas as clinicas"
      : clinics.find((clinic) => clinic.id === clinicId)?.name ?? "Clinica";
  const periodLabel = `${startDate || "inicio"} a ${endDate || "fim"}`;
  const printFileName = `${selectedClinicName} - Relatorio de Debitos - ${periodLabel}.pdf`;

  React.useEffect(() => {
    setPage(1);
  }, [
    clinicId,
    endDate,
    patientId,
    paymentMethod,
    query,
    serviceId,
    startDate,
    status
  ]);

  React.useEffect(() => {
    setIssuedAt(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date())
    );
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="report-print-area space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Relatorios
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Pagamentos / Cobranca
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Acompanhe recebimentos, valores em aberto, vencidos e pacientes devedores
            usando apenas lancamentos existentes no Financeiro.
          </p>
        </div>
        <div className="report-screen-only">
          <Button asChild variant="outline">
            <Link href="/relatorios">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Relatorios
            </Link>
          </Button>
        </div>
      </div>

      <div className="report-print-meta hidden text-sm text-muted-foreground">
        <p className="report-print-system">MWFSystem</p>
        <p className="report-print-title">Pagamentos / Cobranca</p>
        <p>
          Clinica:{" "}
          {clinicId === "all"
            ? "Todas"
            : clinics.find((clinic) => clinic.id === clinicId)?.name ?? "-"}
        </p>
        <p>
          Periodo: {startDate || "-"} ate {endDate || "-"}
        </p>
        <p>Data de emissao: {issuedAt || "-"}</p>
      </div>

      {loadError ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {loadError}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={BadgeDollarSign} label="Total recebido" value={money(totals.totalReceived)} />
        <MetricCard icon={ReceiptText} label="Total em aberto" value={money(totals.totalOpen)} />
        <MetricCard icon={CalendarClock} label="Total vencido" value={money(totals.totalOverdue)} />
        <MetricCard icon={CreditCard} label="Total parcial" value={money(totals.totalPartial)} />
        <MetricCard icon={Users} label="Pacientes devedores" value={totals.debtorPatients} />
        <MetricCard icon={BadgeDollarSign} label="Ticket medio recebido" value={money(totals.averageReceivedTicket)} />
      </div>

      <Card className="report-screen-only border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="space-y-1 text-sm xl:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pesquisa
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                placeholder="Pesquisar paciente, clinica, servico ou origem"
              />
            </div>
          </label>
          <SelectField
            label="Clinica"
            value={clinicId}
            onChange={setClinicId}
            disabled={!canSelectClinic}
            options={[
              ...(canSelectClinic ? [["all", "Todas"] as [string, string]] : []),
              ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])
            ]}
          />
          <InputField label="Periodo inicial" type="date" value={startDate} onChange={setStartDate} />
          <InputField label="Periodo final" type="date" value={endDate} onChange={setEndDate} />
          <SelectField
            label="Paciente"
            value={patientId}
            onChange={setPatientId}
            options={[
              ["all", "Todos"],
              ...patients.map((patient) => [patient.id, patient.full_name] as [string, string])
            ]}
          />
          <SelectField
            label="Servico"
            value={serviceId}
            onChange={setServiceId}
            options={[
              ["all", "Todos"],
              ...services.map((service) => [service.id, service.name] as [string, string])
            ]}
          />
          <SelectField
            label="Forma de pagamento"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              ["all", "Todas"],
              ...paymentMethods.map((method) => [method, method] as [string, string])
            ]}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as PaymentStatus | "all")}
            options={statusOptions}
          />
          <div className="flex items-end xl:col-span-2">
            <ReportPrintActions
              printFileName={printFileName}
              onExportCsv={() => downloadCsv("relatorio-pagamentos.csv", filteredRows)}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableHeader label="Data" column="reportDate" onSort={toggleSort} />
                <SortableHeader label="Paciente" column="patientName" onSort={toggleSort} />
                <SortableHeader label="Clinica" column="clinicName" onSort={toggleSort} />
                <SortableHeader label="Servico" column="serviceName" onSort={toggleSort} />
                <SortableHeader label="Origem" column="origin" onSort={toggleSort} />
                <SortableHeader label="Valor total" column="amount" onSort={toggleSort} />
                <SortableHeader label="Valor pago" column="paidAmount" onSort={toggleSort} />
                <SortableHeader label="Valor aberto" column="openAmount" onSort={toggleSort} />
                <SortableHeader label="Forma" column="paymentMethod" onSort={toggleSort} />
                <SortableHeader label="Status" column="normalizedStatus" onSort={toggleSort} />
                <SortableHeader label="Vencimento" column="dueDate" onSort={toggleSort} />
                <SortableHeader label="Pagamento" column="paymentDate" onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.length > 0 ? (
                visibleRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">{formatDate(row.reportDate)}</td>
                    <td className="px-4 py-3 font-medium">{row.patientName}</td>
                    <td className="px-4 py-3">{row.clinicName}</td>
                    <td className="px-4 py-3">{row.serviceName}</td>
                    <td className="px-4 py-3">{row.origin ?? "-"}</td>
                    <td className="px-4 py-3">{money(row.amount)}</td>
                    <td className="px-4 py-3">{money(row.paidAmount)}</td>
                    <td className="px-4 py-3 font-semibold">{money(row.openAmount)}</td>
                    <td className="px-4 py-3">{row.paymentMethod ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          statusClass(row.normalizedStatus)
                        )}
                      >
                        {statusLabel(row.normalizedStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-3">{formatDate(row.paymentDate)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={12}
                  >
                    Nenhum pagamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="report-screen-only flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <span className="text-muted-foreground">
            Mostrando {visibleRows.length} de {filteredRows.length} lancamentos.
            Pagina {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            >
              Proxima
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="report-metric-card border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-bold">{value}</p>
        </div>
        <div className="report-metric-icon rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function SortableHeader({
  label,
  column,
  onSort
}: {
  label: string;
  column: SortKey;
  onSort: (column: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold"
        onClick={() => onSort(column)}
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

function InputField({
  label,
  value,
  onChange,
  type
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
