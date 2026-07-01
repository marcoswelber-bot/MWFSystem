"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessProfileByEmail } from "@/lib/access-control";

const protectedRoutes = [
  "/dashboard",
  "/pacientes",
  "/agenda",
  "/funcionarios",
  "/financeiro",
  "/servicos",
  "/prontuarios",
  "/relatorios",
  "/configuracoes",
  "/portal"
] as const;

function normalizeRedirectRoute(value: FormDataEntryValue | null): Route {
  if (typeof value !== "string") {
    return "/dashboard" as Route;
  }

  const pathname = value.split("?")[0];

  if (protectedRoutes.includes(pathname as (typeof protectedRoutes)[number])) {
    return value as Route;
  }

  return "/dashboard" as Route;
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectedFrom = normalizeRedirectRoute(formData.get("redirectedFrom"));
  let errorMessage: string | null = null;
  let targetRoute: Route = redirectedFrom;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      // Mensagem amigável em vez de expor detalhes técnicos
      errorMessage = "Email ou senha incorretos.";
    } else {
      const profile = await getAccessProfileByEmail(email);

      if (profile.kind === "blocked" || profile.kind === "unknown") {
        await supabase.auth.signOut();
        errorMessage = "Seu acesso está bloqueado. Entre em contato com a administração.";
      } else if (profile.kind === "patient") {
        targetRoute = "/portal" as Route;
      }
    }
  } catch {
    errorMessage = "Erro ao conectar. Tente novamente em instantes.";
  }

  if (errorMessage) {
    redirect(`/login?error=${encodeURIComponent(errorMessage)}` as Route);
  }

  redirect(targetRoute);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
