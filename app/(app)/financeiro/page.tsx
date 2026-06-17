import { ArrowDownRight, ArrowUpRight, CircleDollarSign } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";

export default function FinanceiroPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Gestão financeira"
        title="Financeiro"
        description="Prepare contas a receber, despesas, repasses, formas de pagamento, caixa por unidade e visão consolidada para ADM Master."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Receitas" description="Entrada prevista" icon={ArrowUpRight} value="R$ 86,4k" />
        <ModuleCard title="Despesas" description="Saída prevista" icon={ArrowDownRight} value="R$ 21,9k" />
        <ModuleCard title="Saldo" description="Resultado do mês" icon={CircleDollarSign} value="R$ 64,5k" />
      </section>
    </div>
  );
}
