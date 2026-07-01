"use server";

import { revalidatePath } from "next/cache";
import { setAppointmentStatus } from "@/app/(app)/agenda/actions";
import { markFinancialTransactionAsPaid } from "@/app/(app)/financeiro/actions";

export type AlertActionResult = {
  ok: boolean;
  message: string;
};

export async function handleAlertAction(
  alertId: string,
  action: string,
  referenceId: string
): Promise<AlertActionResult> {
  try {
    // Acoes de Agenda
    if (action === "marcar_realizado") {
      const result = await setAppointmentStatus(referenceId, "realizado");
      if (result.ok) revalidatePath("/dashboard");
      return result;
    }

    if (action === "registrar_falta") {
      const result = await setAppointmentStatus(referenceId, "faltou");
      if (result.ok) revalidatePath("/dashboard");
      return result;
    }

    if (action === "cancelar_agendamento") {
      const result = await setAppointmentStatus(referenceId, "cancelado");
      if (result.ok) revalidatePath("/dashboard");
      return result;
    }

    if (action === "confirmar_agendamento") {
      const result = await setAppointmentStatus(referenceId, "confirmado");
      if (result.ok) revalidatePath("/dashboard");
      return result;
    }

    // Acoes Financeiras
    if (action === "dar_baixa") {
      const result = await markFinancialTransactionAsPaid(referenceId);
      if (result.ok) revalidatePath("/dashboard");
      return result;
    }

    return { ok: false, message: "Acao nao reconhecida." };
  } catch {
    return { ok: false, message: "Erro ao executar a acao. Tente novamente." };
  }
}

export async function ignoreAlert(
  alertId: string,
  reason: string
): Promise<void> {
  // Por enquanto, apenas revalida as paginas
  // Futuramente: salvar no banco com usuario, data e motivo
  void alertId;
  void reason;
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
}
