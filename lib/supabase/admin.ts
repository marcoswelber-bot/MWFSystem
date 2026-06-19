import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
