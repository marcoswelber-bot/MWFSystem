import { Suspense } from "react";
import { Activity, Building2 } from "lucide-react";
import { signInWithPassword } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    redirectedFrom?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-[1fr_440px]">
        <section className="hidden flex-col justify-between border-r bg-secondary/40 p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-semibold">MWFSystem</p>
              <p className="text-sm text-muted-foreground">Gestão multiclínica</p>
            </div>
          </div>

          <div className="max-w-xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <Building2 className="h-4 w-4 text-primary" />
              Perfil ADM Master preparado para acesso global
            </div>
            <h1 className="text-4xl font-semibold tracking-normal">
              Controle operacional, clínico e financeiro em um só painel.
            </h1>
            <p className="text-lg text-muted-foreground">
              Estrutura pronta para múltiplas clínicas, equipes, agenda,
              prontuários, relatórios e integração Supabase.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Ambiente seguro com autenticação por email e senha.
          </p>
        </section>

        <section className="flex min-h-screen flex-col p-4 sm:p-6">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <Suspense>
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Acessar o sistema</CardTitle>
                  <CardDescription>
                    Entre com seu email e senha para continuar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={signInWithPassword} className="space-y-4">
                    <input
                      type="hidden"
                      name="redirectedFrom"
                      value={params.redirectedFrom ?? "/dashboard"}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="admin@clinica.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    {params.error ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {params.error}
                      </p>
                    ) : null}
                    <Button className="w-full" type="submit">
                      Entrar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
