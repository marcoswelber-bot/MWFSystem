import { ReportPlaceholder } from "@/components/reports/report-placeholder";

export default function RelatorioOperacionalPage() {
  return (
    <ReportPlaceholder
      title="Relatorio Operacional"
      description="Visao operacional de agenda, producao, comparecimento e desempenho assistencial."
      fileName="relatorio-operacional.csv"
    />
  );
}
