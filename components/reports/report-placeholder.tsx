"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportPrintActions } from "@/components/reports/report-print-actions";

type PlaceholderRow = {
  id: string;
  periodo: string;
  clinica: string;
  indicador: string;
  valor: string;
  status: string;
};

type SortKey = keyof PlaceholderRow;

const rows: PlaceholderRow[] = [
  {
    id: "preview-1",
    periodo: "-",
    clinica: "-",
    indicador: "Tela em desenvolvimento",
    valor: "-",
    status: "Em desenvolvimento"
  }
];

function downloadCsv(fileName: string, data: PlaceholderRow[]) {
  const header = ["Periodo", "Clinica", "Indicador", "Valor", "Status"];
  const csvRows = data.map((row) =>
    [row.periodo, row.clinica, row.indicador, row.valor, row.status]
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

export function ReportPlaceholder({
  title,
  description,
  fileName
}: {
  title: string;
  description: string;
  fileName: string;
}) {
  const [query, setQuery] = React.useState("");
  const [clinic, setClinic] = React.useState("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("indicador");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);
  const [issuedAt, setIssuedAt] = React.useState("");
  const pageSize = 10;
  const filteredRows = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        const content = Object.values(row).join(" ").toLowerCase();
        return normalizedQuery ? content.includes(normalizedQuery) : true;
      })
      .filter((row) => (clinic === "all" ? true : row.clinica === clinic))
      .filter((row) => (startDate ? row.periodo >= startDate : true))
      .filter((row) => (endDate ? row.periodo <= endDate : true))
      .sort((a, b) => {
        const result = String(a[sortKey]).localeCompare(String(b[sortKey]));
        return sortDirection === "asc" ? result : -result;
      });
  }, [clinic, endDate, query, sortDirection, sortKey, startDate]);
  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

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
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>
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
        <p className="report-print-title">{title}</p>
        <p>
          Clinica: {clinic === "all" ? "Todas" : clinic}
        </p>
        <p>
          Periodo: {startDate || "-"} ate {endDate || "-"}
        </p>
        <p>Data de emissao: {issuedAt || "-"}</p>
      </div>

      <Card className="border-dashed p-8 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-semibold">Tela em desenvolvimento</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A estrutura do relatorio ja esta pronta para receber os dados definitivos.
        </p>
      </Card>

      <Card className="report-screen-only border-none p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pesquisa
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                placeholder="Pesquisar"
              />
            </div>
          </label>
          <SelectField label="Clinica" value={clinic} onChange={setClinic} options={[["all", "Todas"]]} />
          <InputField label="Periodo inicial" type="date" value={startDate} onChange={setStartDate} />
          <InputField label="Periodo final" type="date" value={endDate} onChange={setEndDate} />
          <div className="flex items-end">
            <ReportPrintActions onExportCsv={() => downloadCsv(fileName, filteredRows)} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableHeader label="Periodo" column="periodo" onSort={toggleSort} />
                <SortableHeader label="Clinica" column="clinica" onSort={toggleSort} />
                <SortableHeader label="Indicador" column="indicador" onSort={toggleSort} />
                <SortableHeader label="Valor" column="valor" onSort={toggleSort} />
                <SortableHeader label="Status" column="status" onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{row.periodo}</td>
                  <td className="px-4 py-3">{row.clinica}</td>
                  <td className="px-4 py-3 font-medium">{row.indicador}</td>
                  <td className="px-4 py-3">{row.valor}</td>
                  <td className="px-4 py-3">{row.status}</td>
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
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
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
