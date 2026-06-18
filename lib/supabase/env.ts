type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseConfig(): SupabaseConfig {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error ? ` Cause: ${error.cause.message}` : "";
    return `${error.name}: ${error.message}${cause}`;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown Supabase error";
}
