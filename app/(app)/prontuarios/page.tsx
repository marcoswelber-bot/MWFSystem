import { ClipboardList, FilePlus2, LockKeyhole } from "lucide-react";
import { ModuleCard } from "@/components/module-card";
import { PageHeader } from "@/components/page-header";

export default function ProntuariosPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Registros clínicos"
        title="Prontuários"
        description="Base para evolução clínica, anexos, histórico de atendimento e controle de privacidade por perfil e clínica."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <ModuleCard title="Prontuários" description="Registros existentes" icon={ClipboardList} value="1.026" />
        <ModuleCard title="Novas evoluções" description="Criadas esta semana" icon={FilePlus2} value="84" />
        <ModuleCard title="Acesso seguro" description="Preparado para RLS" icon={LockKeyhole} value="Ativo" />
      </section>
    </div>
  );
}
