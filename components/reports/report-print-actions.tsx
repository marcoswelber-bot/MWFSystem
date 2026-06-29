"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportPrintActionsProps = {
  onExportCsv?: () => void;
  csvLabel?: string;
  printFileName?: string;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function printReport(fileName?: string) {
  const previousTitle = document.title;
  const nextTitle = sanitizeFileName(fileName || "MWFSystem - Relatorio.pdf");

  document.title = nextTitle;
  window.print();
  window.setTimeout(() => {
    document.title = previousTitle;
  }, 500);
}

export function ReportPrintActions({
  onExportCsv,
  csvLabel = "Exportar CSV",
  printFileName
}: ReportPrintActionsProps) {
  return (
    <div className="report-screen-only flex flex-col gap-2 sm:flex-row">
      {onExportCsv ? (
        <Button type="button" variant="outline" className="w-full" onClick={onExportCsv}>
          <Download className="h-4 w-4" />
          {csvLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => printReport(printFileName)}
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => printReport(printFileName)}
      >
        <Download className="h-4 w-4" />
        Exportar PDF
      </Button>
    </div>
  );
}
