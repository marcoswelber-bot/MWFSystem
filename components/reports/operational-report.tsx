"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarCheck,
  CalendarClock,
  RotateCcw,
  Search,
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReportPrintActions } from "@/components/reports/report-print-actions";
import type { Database } from "@/types/database";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

export type OperationalAppointment = {
  id: string;
  clinicId: string;
  clinicName: string;
  patientId: string;
  patientIds: string[];
  patientName: string;
  patientNames: string[];
  employeeId: string;
  employeeName: string;
  serviceId: string;
  serviceName: string;
  serviceIsGroup: boolean;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  type: string;
  status: string;
  origin: string;
  notes: string | null;
  participantCount: number;
};

type OperationalReportProps = {
  rows: OperationalAppointment[];
  clinics: Clinic[];
  patients: Patient[];
  employees: Employee[];
  services: Service[];
  currentClinicId: string | null;
  canSelectClinic: boolean;
  loadError?: string;
};

type SortKey =
  | "appointmentDate"
  | "startTime"
  | "clinicName"
  | "patientName"
  | "employeeName"
  | "serviceName"
  | "type"
  | "status"
  | "origin"
  | "notes";

const pageSize = 10;

const typeOptions = [
  ["all", "Todos"],
  ["avulso", "Avulso"],
  ["pacote", "Pacote"],
  ["grupo", "Grupo"],
  ["avaliacao", "Avaliacao"],
  ["retorno", "Retorno"],
  ["encaixe", "Encaixe"],
  ["cortesia", "Cortesia"],
  ["convenio", "Convenio"],
  ["particular", "Particular"],
  ["reposicao", "Reposicao"],
  ["experimental", "Experimental"],
  ["reposicao_extra", "Reposicao extra"]
] as const;

const statusOptions = [
  ["all", "Todos"],
  ["agendado", "Agendado"],
  ["confirmado", "Confirmado"],
  ["realizado", "Realizado"],
  ["cancelado", "Cancelado"],
  ["faltou", "Faltou"],
  ["reagendado", "Reagendado"]
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function labelFromOptions(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}

function titleCaseStatus(status: string) {
  return labelFromOptions(statusOptions, status);
}

function typeLabel(type: string) {
  return labelFromOptions(typeOptions, type);
}

function originLabel(origin: string) {
  return typeLabel(origin);
}

function shortTime(value?: string | null) {
  return value ? value.slice(0, 5) : "-";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

function isPending(status: string) {
  return status !== "realizado" && status !== "cancelado" && status !== "faltou";
}

function isReplacement(row: OperationalAppointment) {
  return row.type.includes("reposicao") || row.origin.includes("reposicao");
}

function isGroup(row: OperationalAppointment) {
  return row.type === "grupo" || row.origin === "grupo" || row.serviceIsGroup;
}

function statusClass(status: string) {
  if (status === "realizado") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-100";
  }

  if (status === "cancelado") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  if (status === "faltou") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-100";
  }

  if (status === "confirmado") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100";
  }

  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100";
}

function downloadCsv(fileName: string, rows: OperationalAppointment[]) {
  const header = [
    "Data",
    "Horario",
    "Clinica",
    "Paciente",
    "Profissional",
    "Servico",
    "Tipo",
    "Status",
    "Origem",
    "Observacoes"
  ];
  const csvRows = rows.map((row) =>
    [
      row.appointmentDate,
      `${shortTime(row.startTime)} - ${shortTime(row.endTime)}`,
      row.clinicName,
      row.patientName,
      row.employeeName,
      row.serviceName,
      typeLabel(row.type),
      titleCaseStatus(row.status),
      originLabel(row.origin),
      row.notes ?? ""
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

export function OperationalReport({
  rows,
  clinics,
  patients,
  employees,
  services,
  currentClinicId,
  canSelectClinic,
  loadError
}: OperationalReportProps) {
  const [query, setQuery] = React.useState("");
  const [clinicId, setClinicId] = React.useState(currentClinicId ?? "all");
  const [startDate, setStartDate] = React.useState(monthStart());
  const [endDate, setEndDate] = React.useState(today());
  const [employeeId, setEmployeeId] = React.useState("all");
  const [patientId, setPatientId] = React.useState("all");
  const [serviceId, setServiceId] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("appointmentDate");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [issuedAt, setIssuedAt] = React.useState("");

  const filteredRows = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return rows
      .filter((row) => (clinicId === "all" ? true : row.clinicId === clinicId))
      .filter((row) =>
        startDate ? row.appointmentDate >= startDate : true
      )
      .filter((row) => (endDate ? row.appointmentDate <= endDate : true))
      .filter((row) => (employeeId === "all" ? true : row.employeeId === employeeId))
      .filter((row) =>
        patientId === "all" ? true : row.patientIds.includes(patientId)
      )
      .filter((row) => (serviceId === "all" ? true : row.serviceId === serviceId))
      .filter((row) => (type === "all" ? true : row.type === type))
      .filter((row) => (status === "all" ? true : row.status === status))
      .filter((row) => {
        if (!normalizedQuery) {
          return true;
        }

        return normalizeText(
          [
            row.appointmentDate,
            row.startTime,
            row.endTime,
            row.clinicName,
            row.patientName,
            row.employeeName,
            row.serviceName,
            typeLabel(row.type),
            titleCaseStatus(row.status),
            originLabel(row.origin),
            row.notes
          ].join(" ")
        ).includes(normalizedQuery);
      })
      .sort((a, b) => {
        const first = a[sortKey] ?? "";
        const second = b[sortKey] ?? "";
        const result = String(first).localeCompare(String(second), "pt-BR", {
          numeric: true
        });
        return sortDirection === "asc" ? result : -result;
      });
  }, [
    clinicId,
    employeeId,
    endDate,
    patientId,
    query,
    rows,
    serviceId,
    sortDirection,
    sortKey,
    startDate,
    status,
    type
  ]);

  const totals = React.useMemo(() => {
    const realized = filteredRows.filter((row) => row.status === "realizado").length;
    const missed = filteredRows.filter((row) => row.status === "faltou").length;
    const attendanceBase = realized + missed;

    return {
      total: filteredRows.length,
      realized,
      pending: filteredRows.filter((row) => isPending(row.status)).length,
      cancelled: filteredRows.filter((row) => row.status === "cancelado").length,
      missed,
      replacements: filteredRows.filter(isReplacement).length,
      groups: filteredRows.filter(isGroup).length,
      attendanceRate: attendanceBase > 0 ? (realized / attendanceBase) * 100 : 0
    };
  }, [filteredRows]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedClinicName =
    clinicId === "all"
      ? "Todas as clinicas"
      : clinics.find((clinic) => clinic.id === clinicId)?.name ?? "Clinica";
  const periodLabel = `${startDate || "inicio"} a ${endDate || "fim"}`;
  const printFileName = `${selectedClinicName} - Relatorio Operacional - ${periodLabel}.pdf`;

  React.useEffect(() => {
    setPage(1);
  }, [clinicId, employeeId, endDate, patientId, query, serviceId, startDate, status, type]);

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

  return (
    <div className="report-print-area space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Relatorios
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Relatorio Operacional</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Acompanhe atendimentos da Agenda por periodo, clinica, profissional,
            paciente, servico, tipo e status.
          </p>
        </div>
        <div className="report-screen-only flex flex-col gap-2 sm:flex-row">
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
        <p className="report-print-title">Relatorio Operacional</p>
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
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          {loadError}
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard icon={CalendarClock} label="Total de atendimentos" value={totals.total} />
        <MetricCard icon={UserCheck} label="Realizados" value={totals.realized} />
        <MetricCard icon={CalendarClock} label="Pendentes" value={totals.pending} />
        <MetricCard icon={UserX} label="Cancelados" value={totals.cancelled} />
        <MetricCard icon={UserX} label="Faltas" value={totals.missed} />
        <MetricCard icon={RotateCcw} label="Reposicoes" value={totals.replacements} />
        <MetricCard icon={Users} label="Atend. em grupo" value={totals.groups} />
        <MetricCard
          icon={CalendarCheck}
          label="Comparecimento"
          value={`${totals.attendanceRate.toFixed(1)}%`}
        />
      </div>

      <Card className="report-screen-only border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
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
                placeholder="Pesquisar"
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
            label="Profissional"
            value={employeeId}
            onChange={setEmployeeId}
            options={[
              ["all", "Todos"],
              ...employees.map((employee) => [employee.id, employee.name] as [string, string])
            ]}
          />
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
            label="Tipo"
            value={type}
            onChange={setType}
            options={[...typeOptions]}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={[...statusOptions]}
          />
          <div className="flex items-end xl:col-span-2">
            <ReportPrintActions
              printFileName={printFileName}
              onExportCsv={() => downloadCsv("relatorio-operacional.csv", filteredRows)}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableHeader label="Data" column="appointmentDate" onSort={toggleSort} />
                <SortableHeader label="Horario" column="startTime" onSort={toggleSort} />
                <SortableHeader label="Clinica" column="clinicName" onSort={toggleSort} />
                <SortableHeader label="Paciente" column="patientName" onSort={toggleSort} />
                <SortableHeader label="Profissional" column="employeeName" onSort={toggleSort} />
                <SortableHeader label="Servico" column="serviceName" onSort={toggleSort} />
                <SortableHeader label="Tipo" column="type" onSort={toggleSort} />
                <SortableHeader label="Status" column="status" onSort={toggleSort} />
                <SortableHeader label="Origem" column="origin" onSort={toggleSort} />
                <SortableHeader label="Observacoes" column="notes" onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.length > 0 ? (
                visibleRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">{formatDate(row.appointmentDate)}</td>
                    <td className="px-4 py-3">
                      {shortTime(row.startTime)} - {shortTime(row.endTime)}
                    </td>
                    <td className="px-4 py-3">{row.clinicName}</td>
                    <td className="px-4 py-3 font-medium">
                      {row.patientName}
                      {row.participantCount > 1 ? (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {row.participantCount} pacientes
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.employeeName}</td>
                    <td className="px-4 py-3">{row.serviceName}</td>
                    <td className="px-4 py-3">{typeLabel(row.type)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          statusClass(row.status)
                        )}
                      >
                        {titleCaseStatus(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{originLabel(row.origin)}</td>
                    <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                      {row.notes || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={10}
                  >
                    Nenhum atendimento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="report-screen-only flex flex-col gap-3 border-t px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <span className="text-muted-foreground">
            Mostrando {visibleRows.length} de {filteredRows.length} registros. Pagina{" "}
            {page} de {totalPages}
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
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
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
