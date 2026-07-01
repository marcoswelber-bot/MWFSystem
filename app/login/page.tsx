import { Suspense } from "react";
import { Activity, Building2, Shield } from "lucide-react";
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
    <main className="min-h-screen bg-[hsl(226,55%,16%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-[1fr_480px]">
        <section className="hidden flex-col justify-between p-12 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-blue-300">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">MWFSystem</p>
              <p className="text-sm text-white/60">Gestão multiclínica</p>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-blue-200">
              <Shield className="h-4 w-4" />
              Sistema seguro com controle de acesso por perfil
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Gestão clínica, operacional e financeira em um só lugar.
            </h1>
            <p className="text-lg leading-relaxed text-white/70">
              Controle completo de múltiplas clínicas, equipes, agenda,
              prontuários e relatórios financeiros.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Building2 className="h-4 w-4" />
              Multiclínica
            </div>
            <div className="h-4 w-px bg-white/20" />
            <p className="text-sm text-white/50">
              Criptografia de ponta a ponta
            </p>
          </div>
        </section>

        <section className="flex min-h-screen flex-col bg-background p-4 sm:p-6 lg:rounded-l-3xl">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <Suspense>
              <Card className="w-full max-w-md border-0 shadow-xl">
                <CardHeader className="space-y-1 pb-6">
                  <CardTitle className="text-2xl font-bold">Bem-vindo de volta</CardTitle>
                  <CardDescription>
                    Entre com seu email e senha para acessar o sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={signInWithPassword} className="space-y-5">
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
                        placeholder="seu@email.com"
                        className="h-11"
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
                        className="h-11"
                        required
                      />
                    </div>
                    {params.error ? (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {params.error}
                      </p>
                    ) : null}
                    <Button className="h-11 w-full text-base font-semibold" type="submit">
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
