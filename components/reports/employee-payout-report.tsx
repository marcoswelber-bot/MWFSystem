"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeDollarSign,
  Eye,
  FileText,
  Filter,
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
type Employee = Database["public"]["Tables"]["employees"]["Row"];

export type PayoutTransaction = {
  id: string;
  clinic_id: string;
  clinic_name: string;
  employee_id: string;
  employee_name: string;
  patient_name: string;
  service_name: string;
  appointment_id: string | null;
  appointment_date: string | null;
  due_date: string;
  transaction_type: string;
  origin: string | null;
  category: string | null;
  description: string | null;
  base_amount: number | null;
  commission_type: string | null;
  amount: number;
  status: string;
  commission_status: string;
};

type PayoutType = "all" | "salary" | "commission" | "adjustment" | "discount" | "bonus";
type PayoutStatus = "all" | "open" | "paid" | "cancelled";
type SortKey =
  | "employeeName"
  | "clinicName"
  | "appointmentCount"
  | "commissionTotal"
  | "salaryTotal"
  | "adjustmentTotal"
  | "discountTotal"
  | "grossTotal"
  | "netTotal"
  | "status";

type EmployeePayoutReportProps = {
  transactions: PayoutTransaction[];
  clinics: Clinic[];
  employees: Employee[];
  currentClinicId: string | null;
  canSelectClinic: boolean;
  loadError?: string;
};

type EmployeeSummary = {
  employeeId: string;
  employeeName: string;
  clinicName: string;
  appointmentCount: number;
  commissionTotal: number;
  salaryTotal: number;
  adjustmentTotal: number;
  bonusTotal: number;
  discountTotal: number;
  grossTotal: number;
  netTotal: number;
  status: string;
  period: string;
  rows: PayoutTransaction[];
};

const payoutTypeOptions: Array<[PayoutType, string]> = [
  ["all", "Todos"],
  ["salary", "Salario fixo"],
  ["commission", "Comissao"],
  ["adjustment", "Ajuste"],
  ["discount", "Desconto"],
  ["bonus", "Bonus"]
];

const payoutStatusOptions: Array<[PayoutStatus, string]> = [
  ["all", "Todos"],
  ["open", "Em aberto"],
  ["paid", "Pago"],
  ["cancelled", "Cancelado"]
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

function getPayoutType(row: PayoutTransaction): Exclude<PayoutType, "all"> {
  const text = normalizeText(`${row.category ?? ""} ${row.description ?? ""}`);

  if (row.commission_status === "generated" || text.includes("comiss")) {
    return "commission";
  }

  if (text.includes("salario") || text.includes("salary")) {
    return "salary";
  }

  if (text.includes("desconto")) {
    return "discount";
  }

  if (text.includes("bonus") || text.includes("bonific")) {
    return "bonus";
  }

  return "adjustment";
}

function getPayoutStatus(status: string): Exclude<PayoutStatus, "all"> {
  if (status === "pago") {
    return "paid";
  }

  if (status === "cancelado") {
    return "cancelled";
  }

  return "open";
}

function statusLabel(status: string) {
  if (status === "paid") {
    return "Pago";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return "Em aberto";
}

function statusClass(status: string) {
  if (status === "paid") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  }

  if (status === "cancelled") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
}

function typeLabel(type: PayoutType) {
  return payoutTypeOptions.find(([value]) => value === type)?.[1] ?? "Ajuste";
}

function commissionReference(row: PayoutTransaction) {
  const amount = Number(row.amount ?? 0);
  const baseAmount = Number(row.base_amount ?? 0);

  if (row.commission_type === "valor_fixo") {
    return money(amount);
  }

  if (row.commission_type === "percentual" && baseAmount > 0) {
    return `${((amount / baseAmount) * 100).toFixed(2)}%`;
  }

  return row.commission_type ?? "-";
}

function rowDate(row: PayoutTransaction) {
  return row.appointment_date ?? row.due_date;
}

function sumByType(rows: PayoutTransaction[], type: Exclude<PayoutType, "all">) {
  return rows
    .filter((row) => getPayoutType(row) === type)
    .reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function downloadCsv(fileName: string, summaries: EmployeeSummary[]) {
  const header = [
    "Funcionario",
    "Clinica",
    "Atendimentos",
    "Comissao",
    "Salario fixo",
    "Bonus/Ajustes",
    "Descontos",
    "Total bruto",
    "Total liquido",
    "Status",
    "Periodo"
  ];
  const csvRows = summaries.map((summary) =>
    [
      summary.employeeName,
      summary.clinicName,
      String(summary.appointmentCount),
      String(summary.commissionTotal),
      String(summary.salaryTotal),
      String(summary.adjustmentTotal + summary.bonusTotal),
      String(summary.discountTotal),
      String(summary.grossTotal),
      String(summary.netTotal),
      statusLabel(summary.status),
      summary.period
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

function buildSummaries(rows: PayoutTransaction[], startDate: string, endDate: string) {
  const byEmployee = new Map<string, PayoutTransaction[]>();

  for (const row of rows) {
    const key = row.employee_id;
    byEmployee.set(key, [...(byEmployee.get(key) ?? []), row]);
  }

  return Array.from(byEmployee.entries())
    .map(([employeeId, employeeRows]) => {
      const commissionTotal = sumByType(employeeRows, "commission");
      const salaryTotal = sumByType(employeeRows, "salary");
      const adjustmentTotal = sumByType(employeeRows, "adjustment");
      const bonusTotal = sumByType(employeeRows, "bonus");
      const discountTotal = sumByType(employeeRows, "discount");
      const grossTotal = commissionTotal + salaryTotal + adjustmentTotal + bonusTotal;
      const netTotal = grossTotal - discountTotal;
      const statuses = employeeRows.map((row) => getPayoutStatus(row.status));
      const status = statuses.includes("open")
        ? "open"
        : statuses.includes("paid")
          ? "paid"
          : "cancelled";
      const appointmentCount = new Set(
        employeeRows
          .filter((row) => getPayoutType(row) === "commission")
          .map((row) => row.appointment_id)
          .filter(Boolean)
      ).size;

      return {
        employeeId,
        employeeName: employeeRows[0]?.employee_name ?? "Funcionario",
        clinicName: employeeRows[0]?.clinic_name ?? "Clinica",
        appointmentCount,
        commissionTotal,
        salaryTotal,
        adjustmentTotal,
        bonusTotal,
        discountTotal,
        grossTotal,
        netTotal,
        status,
        period: `${startDate} ate ${endDate}`,
        rows: employeeRows
      } satisfies EmployeeSummary;
    })
    .sort((a, b) => b.netTotal - a.netTotal);
}

export function EmployeePayoutReport({
  transactions,
  clinics,
  employees,
  currentClinicId,
  canSelectClinic,
  loadError
}: EmployeePayoutReportProps) {
  const [clinicId, setClinicId] = React.useState(currentClinicId ?? "all");
  const [startDate, setStartDate] = React.useState(monthStart());
  const [endDate, setEndDate] = React.useState(today());
  const [employeeId, setEmployeeId] = React.useState("all");
  const [type, setType] = React.useState<PayoutType>("all");
  const [status, setStatus] = React.useState<PayoutStatus>("all");
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("netTotal");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [issuedAt, setIssuedAt] = React.useState("");
  const pageSize = 10;

  const filteredRows = React.useMemo(
    () =>
      transactions.filter((row) => {
        const date = rowDate(row);

        if (clinicId !== "all" && row.clinic_id !== clinicId) {
          return false;
        }

        if (employeeId !== "all" && row.employee_id !== employeeId) {
          return false;
        }

        if (date < startDate || date > endDate) {
          return false;
        }

        if (type !== "all" && getPayoutType(row) !== type) {
          return false;
        }

        if (status !== "all" && getPayoutStatus(row.status) !== status) {
          return false;
        }

        return true;
      }),
    [clinicId, employeeId, endDate, startDate, status, transactions, type]
  );

  const summaries = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return buildSummaries(filteredRows, startDate, endDate)
      .filter((summary) => {
        if (!normalizedQuery) {
          return true;
        }

        return normalizeText(
          `${summary.employeeName} ${summary.clinicName} ${summary.status} ${summary.period}`
        ).includes(normalizedQuery);
      })
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));

        return sortDirection === "asc" ? result : -result;
      });
  }, [endDate, filteredRows, query, sortDirection, sortKey, startDate]);
  const totalPages = Math.max(Math.ceil(summaries.length / pageSize), 1);
  const visibleSummaries = React.useMemo(
    () => summaries.slice((page - 1) * pageSize, page * pageSize),
    [page, summaries]
  );
  const selectedSummary =
    summaries.find((summary) => summary.employeeId === selectedEmployeeId) ??
    summaries[0] ??
    null;
  const totals = React.useMemo(() => {
    const commissionTotal = sumByType(filteredRows, "commission");
    const salaryTotal = sumByType(filteredRows, "salary");
    const adjustmentTotal = sumByType(filteredRows, "adjustment");
    const bonusTotal = sumByType(filteredRows, "bonus");
    const discountTotal = sumByType(filteredRows, "discount");
    const grossTotal = commissionTotal + salaryTotal + adjustmentTotal + bonusTotal;

    return {
      commissionTotal,
      salaryTotal,
      adjustmentTotal: adjustmentTotal + bonusTotal,
      discountTotal,
      grossTotal,
      netTotal: grossTotal - discountTotal,
      openEmployees: summaries.filter((summary) => summary.status === "open").length
    };
  }, [filteredRows, summaries]);

  React.useEffect(() => {
    setPage(1);
  }, [clinicId, employeeId, endDate, query, startDate, status, type]);

  React.useEffect(() => {
    setIssuedAt(new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date()));
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  const selectedClinicName =
    clinicId === "all"
      ? "Todas as clinicas"
      : clinics.find((clinic) => clinic.id === clinicId)?.name ?? "Clinica";
  const selectedEmployeeName =
    selectedSummary?.employeeName ??
    (employeeId === "all"
      ? "Todos os funcionarios"
      : employees.find((employee) => employee.id === employeeId)?.name ?? "Funcionario");
  const periodLabel = `${startDate || "inicio"} a ${endDate || "fim"}`;
  const printFileName = `${selectedClinicName} - Contracheque - ${selectedEmployeeName} - ${periodLabel}.pdf`;

  return (
    <div className="report-print-area space-y-5">
      <div className="report-screen-only flex justify-end">
        <Button asChild variant="outline">
          <Link href="/relatorios">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Relatorios
          </Link>
        </Button>
      </div>

      <div className="report-print-meta hidden text-sm text-muted-foreground">
        <p className="report-print-system">MWFSystem</p>
        <p className="report-print-title">Repasse / Contracheque</p>
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

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total de comissoes" value={money(totals.commissionTotal)} icon={BadgeDollarSign} />
        <MetricCard label="Salarios fixos" value={money(totals.salaryTotal)} icon={ReceiptText} />
        <MetricCard label="Bonus/Ajustes" value={money(totals.adjustmentTotal)} icon={FileText} />
        <MetricCard label="Descontos" value={money(totals.discountTotal)} icon={FileText} />
        <MetricCard label="Total bruto" value={money(totals.grossTotal)} icon={BadgeDollarSign} />
        <MetricCard label="Total liquido" value={money(totals.netTotal)} icon={Users} />
      </section>

      <Card className="report-screen-only border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SelectFilter
            label="Clinica"
            value={clinicId}
            onChange={setClinicId}
            disabled={!canSelectClinic}
            options={[
              ["all", "Todas"],
              ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])
            ]}
          />
          <Field label="Periodo inicial" type="date" value={startDate} onChange={setStartDate} />
          <Field label="Periodo final" type="date" value={endDate} onChange={setEndDate} />
          <SelectFilter
            label="Funcionario"
            value={employeeId}
            onChange={setEmployeeId}
            options={[
              ["all", "Todos"],
              ...employees.map((employee) => [employee.id, employee.name] as [string, string])
            ]}
          />
          <SelectFilter label="Tipo" value={type} onChange={(value) => setType(value as PayoutType)} options={payoutTypeOptions} />
          <SelectFilter label="Status" value={status} onChange={(value) => setStatus(value as PayoutStatus)} options={payoutStatusOptions} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_420px]">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pesquisa
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                placeholder="Pesquisar funcionario, clinica ou status"
              />
            </div>
          </label>
          <div className="flex items-end">
            <ReportPrintActions
              printFileName={printFileName}
              onExportCsv={() => downloadCsv("relatorio-financeiro-repasses.csv", summaries)}
            />
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Funcionarios em aberto" value={String(totals.openEmployees)} icon={Users} />
        <MetricCard label="Linhas lidas" value={String(filteredRows.length)} icon={ReceiptText} />
        <MetricCard label="Periodo" value={`${startDate} ate ${endDate}`} icon={FileText} />
        <MetricCard label="Fonte" value="financial_transactions" icon={ReceiptText} />
      </section>

      {summaries.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum repasse encontrado para os filtros selecionados. O relatorio le apenas lancamentos existentes em financial_transactions.
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortableHeader label="Funcionario/Profissional" column="employeeName" onSort={toggleSort} />
                    <SortableHeader label="Clinica" column="clinicName" onSort={toggleSort} />
                    <SortableHeader label="Atendimentos" column="appointmentCount" onSort={toggleSort} />
                    <SortableHeader label="Comissao" column="commissionTotal" onSort={toggleSort} />
                    <SortableHeader label="Salario fixo" column="salaryTotal" onSort={toggleSort} />
                    <SortableHeader label="Bonus/Ajustes" column="adjustmentTotal" onSort={toggleSort} />
                    <SortableHeader label="Descontos" column="discountTotal" onSort={toggleSort} />
                    <SortableHeader label="Total bruto" column="grossTotal" onSort={toggleSort} />
                    <SortableHeader label="Total liquido" column="netTotal" onSort={toggleSort} />
                    <SortableHeader label="Status" column="status" onSort={toggleSort} />
                    <th className="px-4 py-3">Periodo</th>
                    <th className="report-screen-only px-4 py-3">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleSummaries.map((summary) => (
                    <tr key={summary.employeeId} className="align-top">
                      <td className="px-4 py-3 font-medium">{summary.employeeName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{summary.clinicName}</td>
                      <td className="px-4 py-3">{summary.appointmentCount}</td>
                      <td className="px-4 py-3">{money(summary.commissionTotal)}</td>
                      <td className="px-4 py-3">{money(summary.salaryTotal)}</td>
                      <td className="px-4 py-3">{money(summary.adjustmentTotal + summary.bonusTotal)}</td>
                      <td className="px-4 py-3">{money(summary.discountTotal)}</td>
                      <td className="px-4 py-3">{money(summary.grossTotal)}</td>
                      <td className="px-4 py-3 font-semibold">{money(summary.netTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", statusClass(summary.status))}>
                          {statusLabel(summary.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{summary.period}</td>
                      <td className="report-screen-only px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(summary.employeeId)}>
                          <Eye className="h-4 w-4" />
                          Visualizar detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="report-screen-only flex items-center justify-between border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
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

          <div className="report-screen-only">
            <EmployeeDetails summary={selectedSummary} />
          </div>
        </div>
      )}
    </div>
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
    <Card className="report-metric-card border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="mb-3 flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <Icon className="report-metric-icon h-4 w-4 shrink-0" />
      </div>
      <p className="break-words text-xl font-semibold">{value}</p>
    </Card>
  );
}

function EmployeeDetails({ summary }: { summary: EmployeeSummary | null }) {
  if (!summary) {
    return (
      <Card className="border-dashed p-5 text-sm text-muted-foreground">
        Selecione um funcionario para visualizar os detalhes.
      </Card>
    );
  }

  return (
    <Card className="border-none p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Detalhes do funcionario</p>
        <h3 className="text-lg font-semibold">{summary.employeeName}</h3>
        <p className="text-sm text-muted-foreground">{summary.period}</p>
      </div>

      <div className="space-y-3">
        {summary.rows.map((row) => (
          <div key={row.id} className="rounded-lg border p-3 text-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.service_name}</p>
                <p className="text-xs text-muted-foreground">{row.patient_name}</p>
              </div>
              <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", statusClass(getPayoutStatus(row.status)))}>
                {statusLabel(getPayoutStatus(row.status))}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <Detail label="Data" value={rowDate(row)} />
              <Detail label="Origem" value={row.origin ?? row.category ?? typeLabel(getPayoutType(row))} />
              <Detail label="Valor do servico" value={money(Number(row.base_amount ?? 0))} />
              <Detail label="Percentual/valor" value={commissionReference(row)} />
              <Detail label="Valor comissao" value={money(Number(row.amount ?? 0))} />
              <Detail label="Lancamento" value={typeLabel(getPayoutType(row))} />
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
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

function SelectFilter({
  label,
  value,
  onChange,
  options,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
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
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
