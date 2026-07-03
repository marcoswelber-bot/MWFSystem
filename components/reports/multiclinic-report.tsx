"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeDollarSign,
  Building2,
  CalendarCheck,
  ReceiptText,
  Search,
  TrendingUp,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReportPrintActions } from "@/components/reports/report-print-actions";
import type { Database } from "@/types/database";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

export type MulticlinicAppointment = {
  id: string;
  clinicId: string;
  patientId: string;
  serviceId: string;
  appointmentDate: string;
  status: string;
};

export type MulticlinicFinancialTransaction = {
  id: string;
  clinicId: string;
  serviceId: string | null;
  transactionType: string;
  category: string | null;
  description: string | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  appointmentDate: string | null;
  commissionStatus: string;
};

export type MulticlinicPatient = {
  id: string;
  clinicId: string | null;
  status: string;
};

type MulticlinicReportProps = {
  clinics: Clinic[];
  appointments: MulticlinicAppointment[];
  transactions: MulticlinicFinancialTransaction[];
  patients: MulticlinicPatient[];
  services: Service[];
  currentClinicId: string | null;
  canSelectClinic: boolean;
  loadError?: string;
};

type ClinicSummary = {
  clinicId: string;
  clinicName: string;
  clinicStatus: string;
  totalAppointments: number;
  realizedAppointments: number;
  cancelledAppointments: number;
  missedAppointments: number;
  revenueTotal: number;
  revenueExpected: number;
  revenueRealized: number;
  revenueOpen: number;
  commissionTotal: number;
  netEstimated: number;
  attendedPatients: number;
  averageTicket: number;
  activePatients: number;
};

type SortKey = keyof ClinicSummary;

const pageSize = 10;

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

function transactionDate(transaction: MulticlinicFinancialTransaction) {
  return transaction.paymentDate ?? transaction.appointmentDate ?? transaction.dueDate;
}

function isRevenue(transaction: MulticlinicFinancialTransaction) {
  return transaction.transactionType === "receita" && transaction.status !== "cancelado";
}

function expectedAmount(transaction: MulticlinicFinancialTransaction) {
  return Math.max(Number(transaction.amount ?? 0), 0);
}

function realizedAmount(transaction: MulticlinicFinancialTransaction) {
  return Math.max(Number(transaction.paidAmount ?? 0), 0);
}

function openAmount(transaction: MulticlinicFinancialTransaction) {
  return Math.max(Number(transaction.openAmount ?? Math.max(Number(transaction.amount ?? 0) - Number(transaction.paidAmount ?? 0), 0)), 0);
}

function isCommission(transaction: MulticlinicFinancialTransaction) {
  const text = normalizeText(`${transaction.category ?? ""} ${transaction.description ?? ""}`);

  return (
    transaction.transactionType === "despesa" &&
    transaction.status !== "cancelado" &&
    (transaction.commissionStatus === "generated" || text.includes("comiss"))
  );
}

function clinicStatusLabel(clinic: Clinic) {
  if (clinic.status) {
    return clinic.status;
  }

  return clinic.active === false ? "inactive" : "active";
}

function statusLabel(status: string) {
  if (status === "active") {
    return "Ativa";
  }

  if (status === "inactive") {
    return "Inativa";
  }

  return status || "-";
}

function statusClass(status: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  }

  if (status === "inactive" || status === "cancelado") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
}

function downloadCsv(fileName: string, summaries: ClinicSummary[]) {
  const header = [
    "Clinica",
    "Total de atendimentos",
    "Atendimentos realizados",
    "Cancelados",
    "Faltas",
    "Receita prevista",
    "Receita realizada",
    "Valor em aberto",
    "Comissoes",
    "Valor liquido estimado",
    "Pacientes atendidos",
    "Ticket medio",
    "Status"
  ];
  const csvRows = summaries.map((summary) =>
    [
      summary.clinicName,
      String(summary.totalAppointments),
      String(summary.realizedAppointments),
      String(summary.cancelledAppointments),
      String(summary.missedAppointments),
      String(summary.revenueExpected),
      String(summary.revenueRealized),
      String(summary.revenueOpen),
      String(summary.commissionTotal),
      String(summary.netEstimated),
      String(summary.attendedPatients),
      String(summary.averageTicket),
      statusLabel(summary.clinicStatus)
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

function buildClinicSummary({
  clinic,
  appointments,
  transactions,
  patients
}: {
  clinic: Clinic;
  appointments: MulticlinicAppointment[];
  transactions: MulticlinicFinancialTransaction[];
  patients: MulticlinicPatient[];
}): ClinicSummary {
  const realizedAppointments = appointments.filter(
    (appointment) => appointment.status === "realizado"
  );
  const revenueTransactions = transactions.filter(isRevenue);
  const revenueExpected = revenueTransactions.reduce((total, transaction) => total + expectedAmount(transaction), 0);
  const revenueRealized = revenueTransactions.reduce((total, transaction) => total + realizedAmount(transaction), 0);
  const revenueOpen = revenueTransactions.reduce((total, transaction) => total + openAmount(transaction), 0);
  const revenueTotal = revenueExpected;
  const commissionTotal = transactions.filter(isCommission)
    .reduce((total, transaction) => total + Number(transaction.amount ?? 0), 0);
  const attendedPatients = new Set(
    realizedAppointments.map((appointment) => appointment.patientId)
  ).size;

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicStatus: clinicStatusLabel(clinic),
    totalAppointments: appointments.length,
    realizedAppointments: realizedAppointments.length,
    cancelledAppointments: appointments.filter(
      (appointment) => appointment.status === "cancelado"
    ).length,
    missedAppointments: appointments.filter((appointment) => appointment.status === "faltou")
      .length,
    revenueTotal,
    revenueExpected,
    revenueRealized,
    revenueOpen,
    commissionTotal,
    netEstimated: revenueTotal - commissionTotal,
    attendedPatients,
    averageTicket:
      realizedAppointments.length > 0 ? revenueTotal / realizedAppointments.length : 0,
    activePatients: patients.filter((patient) => patient.status === "active").length
  };
}

export function MulticlinicReport({
  clinics,
  appointments,
  transactions,
  patients,
  services,
  currentClinicId,
  canSelectClinic,
  loadError
}: MulticlinicReportProps) {
  const [startDate, setStartDate] = React.useState(monthStart());
  const [endDate, setEndDate] = React.useState(today());
  const [clinicId, setClinicId] = React.useState(currentClinicId ?? "all");
  const [status, setStatus] = React.useState("all");
  const [serviceId, setServiceId] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("revenueExpected");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [issuedAt, setIssuedAt] = React.useState("");

  const filteredSummaries = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return clinics
      .filter((clinic) => (clinicId === "all" ? true : clinic.id === clinicId))
      .filter((clinic) =>
        status === "all" ? true : clinicStatusLabel(clinic) === status
      )
      .map((clinic) => {
        const clinicAppointments = appointments
          .filter((appointment) => appointment.clinicId === clinic.id)
          .filter((appointment) =>
            startDate ? appointment.appointmentDate >= startDate : true
          )
          .filter((appointment) => (endDate ? appointment.appointmentDate <= endDate : true))
          .filter((appointment) =>
            serviceId === "all" ? true : appointment.serviceId === serviceId
          );
        const clinicTransactions = transactions
          .filter((transaction) => transaction.clinicId === clinic.id)
          .filter((transaction) => {
            const date = transactionDate(transaction);
            return startDate ? date >= startDate : true;
          })
          .filter((transaction) => {
            const date = transactionDate(transaction);
            return endDate ? date <= endDate : true;
          })
          .filter((transaction) =>
            serviceId === "all" ? true : transaction.serviceId === serviceId
          );
        const clinicPatients = patients.filter((patient) => patient.clinicId === clinic.id);

        return buildClinicSummary({
          clinic,
          appointments: clinicAppointments,
          transactions: clinicTransactions,
          patients: clinicPatients
        });
      })
      .filter((summary) => {
        if (!normalizedQuery) {
          return true;
        }

        return normalizeText(
          [
            summary.clinicName,
            statusLabel(summary.clinicStatus),
            String(summary.totalAppointments),
            String(summary.revenueExpected),
            String(summary.revenueRealized),
            String(summary.revenueOpen),
            String(summary.netEstimated)
          ].join(" ")
        ).includes(normalizedQuery);
      })
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), "pt-BR", { numeric: true });

        return sortDirection === "asc" ? result : -result;
      });
  }, [
    appointments,
    clinicId,
    clinics,
    endDate,
    patients,
    query,
    serviceId,
    sortDirection,
    sortKey,
    startDate,
    status,
    transactions
  ]);

  const totals = React.useMemo(() => {
    const revenueTotal = filteredSummaries.reduce(
      (total, summary) => total + summary.revenueTotal,
      0
    );
    const realizedAppointments = filteredSummaries.reduce(
      (total, summary) => total + summary.realizedAppointments,
      0
    );
    const activePatients = filteredSummaries.reduce(
      (total, summary) => total + summary.activePatients,
      0
    );
    const topRevenueClinic = filteredSummaries.reduce<ClinicSummary | null>(
      (best, summary) =>
        !best || summary.revenueExpected > best.revenueExpected ? summary : best,
      null
    );
    const topVolumeClinic = filteredSummaries.reduce<ClinicSummary | null>(
      (best, summary) =>
        !best || summary.realizedAppointments > best.realizedAppointments
          ? summary
          : best,
      null
    );

    return {
      clinicsAnalyzed: filteredSummaries.length,
      revenueTotal,
      realizedAppointments,
      activePatients,
      averageTicket: realizedAppointments > 0 ? revenueTotal / realizedAppointments : 0,
      topRevenueClinic,
      topVolumeClinic
    };
  }, [filteredSummaries]);

  const totalPages = Math.max(Math.ceil(filteredSummaries.length / pageSize), 1);
  const visibleSummaries = filteredSummaries.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const periodLabel = `${startDate || "inicio"} a ${endDate || "fim"}`;
  const printFileName = `Relatorio Multiclinica - ${periodLabel}.pdf`;
  const statusOptions = React.useMemo(
    () => [
      ["all", "Todos"] as [string, string],
      ...Array.from(new Set(clinics.map(clinicStatusLabel))).map(
        (clinicStatus) => [clinicStatus, statusLabel(clinicStatus)] as [string, string]
      )
    ],
    [clinics]
  );

  React.useEffect(() => {
    setPage(1);
  }, [clinicId, endDate, query, serviceId, startDate, status]);

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
  function renderSummaryRow(summary: ClinicSummary) {
    return (
      <tr key={summary.clinicId} className="align-top">
        <td className="px-4 py-3 font-medium">{summary.clinicName}</td>
        <td className="px-4 py-3">{summary.totalAppointments}</td>
        <td className="px-4 py-3">{summary.realizedAppointments}</td>
        <td className="px-4 py-3">{summary.cancelledAppointments}</td>
        <td className="px-4 py-3">{summary.missedAppointments}</td>
        <td className="px-4 py-3">{money(summary.revenueExpected)}</td>
        <td className="px-4 py-3">{money(summary.revenueRealized)}</td>
        <td className="px-4 py-3">{money(summary.revenueOpen)}</td>
        <td className="px-4 py-3">{money(summary.commissionTotal)}</td>
        <td className="px-4 py-3 font-semibold">{money(summary.netEstimated)}</td>
        <td className="px-4 py-3">{summary.attendedPatients}</td>
        <td className="px-4 py-3">{money(summary.averageTicket)}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              statusClass(summary.clinicStatus)
            )}
          >
            {statusLabel(summary.clinicStatus)}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <div className="report-print-area space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Relatorios
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Relatorio Multiclinica</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Compare clinicas usando atendimentos, pacientes e lancamentos financeiros
            ja existentes no sistema.
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
        <p className="report-print-title">Relatorio Multiclinica</p>
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

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <MetricCard icon={Building2} label="Clinicas analisadas" value={totals.clinicsAnalyzed} />
        <MetricCard icon={BadgeDollarSign} label="Receita prevista" value={money(totals.revenueTotal)} />
        <MetricCard icon={CalendarCheck} label="Atend. realizados" value={totals.realizedAppointments} />
        <MetricCard icon={Users} label="Pacientes ativos" value={totals.activePatients} />
        <MetricCard icon={ReceiptText} label="Ticket medio" value={money(totals.averageTicket)} />
        <MetricCard
          icon={TrendingUp}
          label="Maior receita"
          value={totals.topRevenueClinic?.clinicName ?? "-"}
        />
        <MetricCard
          icon={CalendarCheck}
          label="Maior volume"
          value={totals.topVolumeClinic?.clinicName ?? "-"}
        />
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
                placeholder="Pesquisar clinica"
              />
            </div>
          </label>
          <InputField
            label="Periodo inicial"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
          <InputField
            label="Periodo final"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
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
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={statusOptions}
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
          <div className="flex items-end xl:col-span-2">
            <ReportPrintActions
              printFileName={printFileName}
              onExportCsv={() =>
                downloadCsv("relatorio-multiclinica.csv", filteredSummaries)
              }
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableHeader label="Clinica" column="clinicName" onSort={toggleSort} />
                <SortableHeader label="Total atend." column="totalAppointments" onSort={toggleSort} />
                <SortableHeader label="Realizados" column="realizedAppointments" onSort={toggleSort} />
                <SortableHeader label="Cancelados" column="cancelledAppointments" onSort={toggleSort} />
                <SortableHeader label="Faltas" column="missedAppointments" onSort={toggleSort} />
                <SortableHeader label="Receita prevista" column="revenueExpected" onSort={toggleSort} />
                <SortableHeader label="Receita realizada" column="revenueRealized" onSort={toggleSort} />
                <SortableHeader label="Valor em aberto" column="revenueOpen" onSort={toggleSort} />
                <SortableHeader label="Comissoes" column="commissionTotal" onSort={toggleSort} />
                <SortableHeader label="Liquido estimado" column="netEstimated" onSort={toggleSort} />
                <SortableHeader label="Pacientes" column="attendedPatients" onSort={toggleSort} />
                <SortableHeader label="Ticket medio" column="averageTicket" onSort={toggleSort} />
                <SortableHeader label="Status" column="clinicStatus" onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y print:hidden">
              {visibleSummaries.length > 0 ? (
                visibleSummaries.map((summary) => renderSummaryRow(summary))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={13}
                  >
                    Nenhum dado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
            <tbody className="hidden divide-y print:table-row-group">
              {filteredSummaries.map((summary) => renderSummaryRow(summary))}
            </tbody>
          </table>
        </div>
        <div className="report-screen-only flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <span className="text-muted-foreground">
            Mostrando {visibleSummaries.length} de {filteredSummaries.length} clinicas.
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





