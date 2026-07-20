"use server";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";

export async function auditFinancialAction(input: { action: "charge_generated" | "charge_sent" | "pdf_generated" | "receipt_sent"; clinic_id: string; transaction_ids: string[] }) {
  try {
    await assertCan("financeiro", "view"); const scope = await getCurrentClinicScope();
    if (!scope.isAdmMaster && scope.clinicId !== input.clinic_id) throw new Error("Clinica fora do escopo permitido.");
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("operational_audit_logs").insert({ clinic_id: input.clinic_id, user_id: user?.id ?? null, action: input.action, entity_type: "financial_transaction", metadata: { transaction_ids: input.transaction_ids } });
    if (error) throw error; return { ok: true };
  } catch (error) { return { ok: false, message: getErrorMessage(error) }; }
}
