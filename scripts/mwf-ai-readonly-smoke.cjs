const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const environment = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator <= 0) continue;
  let value = line.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  environment[line.slice(0, separator).trim()] = value;
}

const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Credenciais server-side de desenvolvimento indisponíveis.");

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  const tables = [
    "clinics",
    "patients",
    "appointments",
    "financial_transactions",
    "patient_packages",
    "medical_records",
    "employees",
    "services",
    "internal_notifications",
    "schedule_blocks"
  ];
  const summary = {};
  for (const table of tables) {
    const result = await supabase.from(table).select("*", { count: "exact", head: true });
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    summary[table] = result.count ?? 0;
  }

  const scoped = await supabase.from("clinics").select("id").limit(1).maybeSingle();
  if (scoped.data) {
    const clinicId = scoped.data.id;
    const checks = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("financial_transactions").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("patient_packages").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId)
    ]);
    if (checks.some((result) => result.error)) {
      throw new Error("Falha em consulta isolada por clínica.");
    }
    summary.clinicScopedQueries = "ok";
  }
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
