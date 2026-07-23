"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { signInWithPassword } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  redirectedFrom: string;
  error?: string;
  message?: string;
  recoveryLabel?: string;
};

export function LoginForm({ redirectedFrom, error, message, recoveryLabel = "Esqueci minha senha" }: LoginFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  function togglePasswordVisibility() {
    setShowPassword((visible) => !visible);
    window.requestAnimationFrame(() => passwordRef.current?.focus());
  }

  return (
    <form action={signInWithPassword} className="space-y-5">
      <input type="hidden" name="redirectedFrom" value={redirectedFrom} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="seu@email.com" className="h-11" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-11 pr-12"
            required
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input name="rememberMe" type="checkbox" value="true" className="h-4 w-4 rounded border-input accent-primary" />
        <span>Manter conectado</span>
      </label>
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">{message}</p> : null}
      <Button className="h-11 w-full text-base font-semibold" type="submit">Entrar</Button>
      <a className="block text-center text-sm text-primary hover:underline" href="/login?recovery=form">{recoveryLabel}</a>
    </form>
  );
}
