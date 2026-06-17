import { Building2, KeyRound, Settings, ShieldCheck } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Defina clínicas, permissões, dados institucionais, integrações e regras globais do sistema."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <ModuleCard title="Clínicas" description="Unidades cadastradas" icon={Building2} value="04" />
        <ModuleCard title="Permissões" description="Papéis e acessos" icon={ShieldCheck} value="03" />
        <ModuleCard title="Integrações" description="Supabase e serviços" icon={Settings} value="01" />
        <ModuleCard title="Segurança" description="Políticas e RLS" icon={KeyRound} value="RLS" />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Modelo de perfis</CardTitle>
          <CardDescription>
            Estrutura inicial para separar acesso total e acesso por clínica.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            ["ADM Master", "Acesso total à rede e configurações globais."],
            ["Administrador da clínica", "Acesso gerencial limitado à própria unidade."],
            ["Funcionário", "Acesso operacional conforme função."]
          ].map(([role, description]) => (
            <div key={role} className="rounded-md border p-4">
              <p className="font-semibold">{role}</p>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
