"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";

const protectedRoutes = [
  "/dashboard",
  "/pacientes",
  "/agenda",
  "/funcionarios",
  "/financeiro",
  "/servicos",
  "/prontuarios",
  "/relatorios",
  "/configuracoes"
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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorMessage = getErrorMessage(error);
    }
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  if (errorMessage) {
    redirect(`/login?error=${encodeURIComponent(errorMessage)}` as Route);
  }

  redirect(redirectedFrom);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
