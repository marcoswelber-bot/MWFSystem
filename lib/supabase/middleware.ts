import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getErrorMessage, getSupabaseConfig } from "@/lib/supabase/env";

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
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });
  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  let supabaseConfig: ReturnType<typeof getSupabaseConfig>;

  try {
    supabaseConfig = getSupabaseConfig();
  } catch (error) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", getErrorMessage(error));
      return NextResponse.redirect(url);
    }

    return response;
  }

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;

  try {
    const {
      data: { user: currentUser }
    } = await supabase.auth.getUser();
    user = currentUser;
  } catch (error) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", getErrorMessage(error));
      return NextResponse.redirect(url);
    }

    return response;
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
