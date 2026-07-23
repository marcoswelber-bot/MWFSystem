"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessProfileByEmail } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";

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
  "/sem-acesso",
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

async function getEmployeeLandingRoute(): Promise<Route> {
  const permissions = await getCurrentPermissionMap();
  const destinations = [
    ["dashboard", "/dashboard"],
    ["agenda", "/agenda"],
    ["pacientes", "/pacientes"],
    ["funcionarios", "/funcionarios"],
    ["financeiro", "/financeiro"],
    ["pacotes", "/pacotes"],
    ["prontuarios", "/prontuarios"],
    ["relatorios", "/relatorios"],
    ["servicos", "/servicos"]
  ] as const;
  const destination = destinations.find(([moduleKey]) => permissions[moduleKey].view);
  return (destination?.[1] ?? "/sem-acesso") as Route;
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectedFrom = normalizeRedirectRoute(formData.get("redirectedFrom"));
  const rememberMe = formData.get("rememberMe") === "true";
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
      if (!rememberMe) {
        const cookieStore = await cookies();
        cookieStore.getAll().forEach((cookie) => {
          if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
            cookieStore.set(cookie.name, cookie.value, {
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production"
            });
          }
        });
      }
      const profile = await getAccessProfileByEmail(email);

      if (profile.kind === "blocked" || profile.kind === "unknown") {
        await supabase.auth.signOut();
        errorMessage = "Seu acesso está bloqueado. Entre em contato com a administração.";
      } else if (profile.kind === "patient") {
        targetRoute = "/portal" as Route;
      } else if (
        profile.kind === "employee" && targetRoute === "/dashboard"
      ) {
        targetRoute = await getEmployeeLandingRoute();
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

export async function requestPasswordRecovery(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const message = "Se o e-mail estiver cadastrado, voce recebera um link para redefinir sua senha.";
  try {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://mwf-system.vercel.app/redefinir-senha"
      });
    }
  } catch {
    // Resposta neutra para nao revelar quais contas existem.
  }
  redirect(`/login?recovery=sent&message=${encodeURIComponent(message)}` as Route);
}
