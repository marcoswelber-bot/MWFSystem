import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getCurrentAccessProfile } from "@/lib/access-control";

export default async function PatientPortalPage() {
  const profile = await getCurrentAccessProfile();

  if (!profile) {
    redirect("/login?redirectedFrom=/portal");
  }

  if (profile.kind === "adm_master" || profile.kind === "employee") {
    redirect("/dashboard");
  }

  if (profile.kind === "blocked" || profile.kind === "unknown") {
    redirect(`/login?error=${encodeURIComponent(profile.reason)}`);
  }

  const patient = profile.patient;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/90 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Portal do Paciente
            </p>
            <h1 className="text-xl font-semibold">{patient.full_name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-3 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Minhas informações</CardTitle>
            <CardDescription>Dados principais do seu cadastro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Email:</span>{" "}
              {patient.email ?? patient.login_email ?? "-"}
            </p>
            <p>
              <span className="font-medium">Telefone:</span>{" "}
              {patient.phone ?? "-"}
            </p>
            <p>
              <span className="font-medium">CPF:</span> {patient.cpf ?? "-"}
            </p>
            <p>
              <span className="font-medium">Nascimento:</span>{" "}
              {patient.birth_date ?? "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Minha agenda</CardTitle>
            <CardDescription>Seus próximos atendimentos aparecerão aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento disponível no momento.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comunicados</CardTitle>
            <CardDescription>Avisos da clínica para você.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum comunicado disponível no momento.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
