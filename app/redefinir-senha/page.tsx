"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    const checkSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery"
        });
        if (!mounted) return;
        window.history.replaceState({}, "", "/redefinir-senha");
        setReady(!error);
        setInvalid(Boolean(error));
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(Boolean(data.session));
      setInvalid(!data.session);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setInvalid(false);
      }
    });
    void checkSession();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!password || !confirmation) return setMessage("Preencha os dois campos de senha.");
    if (password.length < 8) return setMessage("A nova senha deve ter no minimo 8 caracteres.");
    if (password !== confirmation) return setMessage("As senhas informadas nao sao iguais.");
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      setInvalid(true);
      return setMessage("O link de recuperacao e invalido, expirou ou ja foi utilizado. Solicite um novo link.");
    }
    await supabase.auth.signOut();
    setMessage("Senha alterada com sucesso");
    window.setTimeout(() => window.location.assign("/login?message=Senha%20alterada%20com%20sucesso"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie uma nova senha para acessar o MWFSystem.</CardDescription>
        </CardHeader>
        <CardContent>
          {invalid && !ready ? (
            <div className="space-y-4">
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">O link de recuperacao e invalido, expirou ou ja foi utilizado.</p>
              <a className="block text-center text-sm text-primary hover:underline" href="/login?recovery=form">Solicitar novo link</a>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {[{ id: "password", label: "Nova senha", value: password, set: setPassword }, { id: "confirmation", label: "Confirmar nova senha", value: confirmation, set: setConfirmation }].map((field) => (
                <div className="space-y-2" key={field.id}>
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <div className="relative">
                    <Input id={field.id} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required value={field.value} onChange={(event) => field.set(event.target.value)} className="pr-11" />
                    <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-0 top-0 flex h-full w-11 items-center justify-center" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
              ))}
              {message ? <p className="rounded-lg border p-3 text-sm">{message}</p> : null}
              <Button className="h-11 w-full" disabled={!ready || saving} type="submit">{saving ? "Salvando..." : "Salvar nova senha"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
