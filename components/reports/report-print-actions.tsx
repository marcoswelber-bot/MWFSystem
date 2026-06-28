"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportPrintActionsProps = {
  onExportCsv?: () => void;
  csvLabel?: string;
};

function printReport() {
  window.print();
}

export function ReportPrintActions({
  onExportCsv,
  csvLabel = "Exportar CSV"
}: ReportPrintActionsProps) {
  return (
    <div className="report-screen-only flex flex-col gap-2 sm:flex-row">
      {onExportCsv ? (
        <Button type="button" variant="outline" className="w-full" onClick={onExportCsv}>
          <Download className="h-4 w-4" />
          {csvLabel}
        </Button>
      ) : null}
      <Button type="button" variant="outline" className="w-full" onClick={printReport}>
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={printReport}>
        <Download className="h-4 w-4" />
        Exportar PDF
      </Button>
    </div>
  );
}
