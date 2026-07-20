"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";

export type ClinicHoursInput = { weekday: number; is_open: boolean; opens_at: string; closes_at: string; break_starts_at: string; break_ends_at: string };
export type ClinicSettingsInput = { clinic_id: string; pix_key_type: string; pix_key: string; pix_holder: string; pix_bank: string; hours: ClinicHoursInput[] };

function digits(value: string) { return value.replace(/\D/g, ""); }
function validatePix(type: string, key: string) {
  if (!key.trim()) throw new Error("Informe a chave PIX.");
  if (type === "cpf" && digits(key).length !== 11) throw new Error("CPF da chave PIX deve ter 11 digitos.");
  if (type === "cnpj" && digits(key).length !== 14) throw new Error("CNPJ da chave PIX deve ter 14 digitos.");
  if (type === "celular" && !/^\+?[1-9]\d{9,14}$/.test(key.replace(/[\s()-]/g, ""))) throw new Error("Informe um celular PIX valido.");
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error("Informe um email PIX valido.");
  if (type === "aleatoria" && !/^[0-9a-fA-F-]{32,36}$/.test(key)) throw new Error("Informe uma chave aleatoria PIX valida.");
}

export async function saveClinicSettings(input: ClinicSettingsInput) {
  try {
    await assertCan("clinicas", "edit");
    const scope = await getCurrentClinicScope();
    const clinicId = scope.isAdmMaster ? input.clinic_id : scope.clinicId;
    if (!clinicId || clinicId !== input.clinic_id) throw new Error("Clinica fora do escopo permitido.");
    validatePix(input.pix_key_type, input.pix_key.trim());
    if (!input.pix_holder.trim()) throw new Error("Informe o titular da chave PIX.");
    for (const day of input.hours) {
      if (day.is_open && (!day.opens_at || !day.closes_at || day.opens_at >= day.closes_at)) throw new Error("Revise os horarios de abertura e fechamento.");
      if ((day.break_starts_at || day.break_ends_at) && (!day.break_starts_at || !day.break_ends_at || day.break_starts_at >= day.break_ends_at)) throw new Error("Revise o intervalo informado.");
    }
    const supabase = await createClient();
    const { error: clinicError } = await supabase.from("clinics").update({
      pix_key_type: input.pix_key_type, pix_key: input.pix_key.trim(), pix_holder: input.pix_holder.trim(), pix_bank: input.pix_bank.trim() || null
    }).eq("id", clinicId);
    if (clinicError) throw clinicError;
    const { error: hoursError } = await supabase.from("clinic_opening_hours").upsert(input.hours.map((day) => ({
      clinic_id: clinicId, weekday: day.weekday, is_open: day.is_open,
      opens_at: day.is_open ? day.opens_at : null, closes_at: day.is_open ? day.closes_at : null,
      break_starts_at: day.is_open && day.break_starts_at ? day.break_starts_at : null,
      break_ends_at: day.is_open && day.break_ends_at ? day.break_ends_at : null
    })), { onConflict: "clinic_id,weekday" });
    if (hoursError) throw hoursError;
    revalidatePath("/clinicas"); revalidatePath("/agenda");
    return { ok: true, message: "PIX e horario de funcionamento atualizados." };
  } catch (error) { return { ok: false, message: getErrorMessage(error) }; }
}
