import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SemAcessoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Acesso ao sistema"
        title="Nenhum modulo liberado"
        description="Seu login esta ativo, mas ainda nao existem modulos liberados para o seu perfil."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Solicite acesso ao ADM Master
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Entre em contato com o ADM Master para liberar os modulos necessarios. Seu usuario, clinica e perfil permanecem preservados.
        </CardContent>
      </Card>
    </div>
  );
}
