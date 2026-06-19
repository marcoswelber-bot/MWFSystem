import { Building2, KeyRound, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
        eyebrow="Administracao"
        title="Configuracoes"
        description="Defina clinicas, permissoes, cargos, integracoes e regras globais do sistema."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <ModuleCard title="Clinicas" description="Unidades cadastradas" icon={Building2} value="04" />
        <ModuleCard title="Permissoes" description="Acessos por usuario" icon={ShieldCheck} value="ACL" />
        <ModuleCard title="Integracoes" description="Supabase e servicos" icon={Settings} value="01" />
        <ModuleCard title="Seguranca" description="Politicas e RLS" icon={KeyRound} value="RLS" />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Permissoes de Usuarios</CardTitle>
          <CardDescription>
            Libere modulos e acoes por usuario. Somente o ADM Master pode administrar permissoes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/configuracoes/permissoes"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Abrir Permissoes de Usuarios
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Modelo de cargos</CardTitle>
          <CardDescription>
            ADM Master tem acesso total. Os demais cargos dependem das permissoes liberadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {[
            ["ADM MASTER", "Acesso total e permanente ao sistema."],
            ["Administrador", "Acesso conforme modulos liberados pelo ADM Master."],
            ["Gerente", "Acesso conforme rotina gerencial liberada."],
            ["Recepcao", "Acesso operacional liberado pelo ADM Master."],
            ["Profissional", "Acesso clinico/operacional liberado pelo ADM Master."]
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
