import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function loadEnv(path) {
  const content = await readFile(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

await loadEnv(process.env.PERF_ENV_FILE ?? ".env.reset.local");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase audit credentials are unavailable.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const today = new Date().toISOString().slice(0, 10);
const start = new Date(`${today}T00:00:00Z`);
start.setUTCDate(start.getUTCDate() - 7);
const end = new Date(`${today}T00:00:00Z`);
end.setUTCDate(end.getUTCDate() + 35);
const fromDate = start.toISOString().slice(0, 10);
const toDate = end.toISOString().slice(0, 10);

const { data: clinics, error: clinicError } = await supabase.from("clinics").select("id,name").limit(1);
if (clinicError) throw clinicError;
const clinicId = process.env.PERF_CLINIC_ID ?? clinics?.[0]?.id;
if (!clinicId) throw new Error("No clinic is available for the audit.");

const before = [
  ["patients.list", () => supabase.from("patients").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false })],
  ["patients.appointments", () => supabase.from("appointments").select("*").eq("clinic_id", clinicId).order("appointment_date", { ascending: false })],
  ["patients.finance", () => supabase.from("financial_transactions").select("*").eq("clinic_id", clinicId).order("due_date", { ascending: false })],
  ["patients.packages", () => supabase.from("patient_packages").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false })],
  ["patients.records", () => supabase.from("medical_records").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false })],
  ["agenda.appointments", () => supabase.from("appointments").select("*").eq("clinic_id", clinicId).order("appointment_date")],
  ["agenda.blocks", () => supabase.from("schedule_blocks").select("*").eq("clinic_id", clinicId).order("block_date")],
  ["records.list", () => supabase.from("medical_records").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false })],
  ["finance.transactions", () => supabase.from("financial_transactions").select("*").eq("clinic_id", clinicId).order("due_date", { ascending: false })]
];

const after = [
  ["patients.list", () => supabase.from("patients").select("id,clinic_id,full_name,cpf,birth_date,phone,email,address,notes,status,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).range(0, 49)],
  ["agenda.appointments", () => supabase.from("appointments").select("*").eq("clinic_id", clinicId).gte("appointment_date", fromDate).lte("appointment_date", toDate).order("appointment_date")],
  ["agenda.blocks", () => supabase.from("schedule_blocks").select("*").eq("clinic_id", clinicId).gte("block_date", fromDate).lte("block_date", toDate).order("block_date")],
  ["records.list", () => supabase.from("medical_records").select("id,clinic_id,patient_id,employee_id,title,status,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).range(0, 49)],
  ["finance.transactions", () => supabase.from("financial_transactions").select("*").eq("clinic_id", clinicId).order("due_date", { ascending: false }).range(0, 99)]
];

async function measure(label, queryFactory) {
  const samples = [];
  let result;
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    result = await queryFactory();
    samples.push(performance.now() - started);
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }
  samples.sort((a, b) => a - b);
  const payload = JSON.stringify(result.data ?? []);
  return { query: label, duration_ms_median: Number(samples[1].toFixed(1)), records: result.data?.length ?? 0, bytes: Buffer.byteLength(payload) };
}

const mode = process.argv.includes("--after") ? "after" : "before";
const definitions = mode === "after" ? after : before;
const results = [];
for (const [label, query] of definitions) results.push(await measure(label, query));
console.log(JSON.stringify({ measured_at: new Date().toISOString(), mode, clinic_id: clinicId, range: { from: fromDate, to: toDate }, queries: results, totals: { queries: results.length, records: results.reduce((sum, item) => sum + item.records, 0), bytes: results.reduce((sum, item) => sum + item.bytes, 0), duration_ms: Number(results.reduce((sum, item) => sum + item.duration_ms_median, 0).toFixed(1)) } }, null, 2));
