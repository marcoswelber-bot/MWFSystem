"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CreditCard,
  Download,
  type LucideIcon
} from "lucide-react";
import { ModuleCard } from "@/components/module-card";

type ReportMenuItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  value: string;
  href: string;
};

const reports: ReportMenuItem[] = [
  {
    title: "Operacional",
    description: "Agenda e producao",
    icon: BarChart3,
    value: "12",
    href: "/relatorios/operacional"
  },
  {
    title: "Financeiro",
    description: "Receita e caixa",
    icon: Download,
    value: "09",
    href: "/relatorios/financeiro"
  },
  {
    title: "Multiclinica",
    description: "Comparativo de unidades",
    icon: Building2,
    value: "04",
    href: "/relatorios/multiclinica"
  },
  {
    title: "Pagamentos / Cobranca",
    description: "Recebimentos e inadimplencia",
    icon: CreditCard,
    value: "08",
    href: "/relatorios/pagamentos"
  }
];

export function ReportsMenu() {
  const router = useRouter();

  function openReport(href: string) {
    router.push(href as Route);
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {reports.map((report) => (
        <div
          key={report.href}
          role="button"
          tabIndex={0}
          className="block cursor-pointer rounded-lg outline-none ring-offset-background transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => openReport(report.href)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openReport(report.href);
            }
          }}
        >
          <ModuleCard
            title={report.title}
            description={report.description}
            icon={report.icon}
            value={report.value}
          />
        </div>
      ))}
    </section>
  );
}
