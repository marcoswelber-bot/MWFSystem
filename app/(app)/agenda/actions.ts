"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];
type ScheduleBlockInsert =
  Database["public"]["Tables"]["schedule_blocks"]["Insert"];

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "realizado"
  | "cancelado"
  | "faltou";

export type AppointmentFormInput = {
  clinic_id?: string;
  patient_id: string;
  employee_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  notes?: string;
  status?: AppointmentStatus;
};

export type ScheduleBlockFormInput = {
  clinic_id?: string;
  employee_id?: string;
  block_date: string;
  block_type: "dia_inteiro" | "periodo" | "horario";
  start_time?: string;
  end_time?: string;
  reason?: string;
};

export type AgendaActionResult = {
  ok: boolean;
  message: string;
};

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function assertRequired(value: string | undefined, message: string) {
  if (!value?.trim()) {
    throw new Error(message);
  }
}

function normalizeTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.length === 5 ? `${value}:00` : value;
}

function compareTime(value?: string | null, other?: string | null) {
  return (normalizeTime(value) ?? "").localeCompare(normalizeTime(other) ?? "");
}

async function resolveClinicId(inputClinicId?: string): Promise<string> {
  const clinicScope = await getCurrentClinicScope();

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    throw new Error("Usuario sem clinica vinculada.");
  }

  if (!clinicScope.isAdmMaster) {
    if (!clinicScope.clinicId) {
      throw new Error("Usuario sem clinica vinculada.");
    }

    return clinicScope.clinicId;
  }

  const clinicId = cleanOptionalValue(inputClinicId) ?? clinicScope.clinicId;

  if (!clinicId) {
    throw new Error("Selecione uma clinica ativa para usar a Agenda.");
  }

  return clinicId;
}

function getAppointmentPayload(input: AppointmentFormInput): AppointmentInsert {
  assertRequired(input.patient_id, "Selecione o paciente.");
  assertRequired(input.employee_id, "Selecione o profissional.");
  assertRequired(input.service_id, "Selecione o servico.");
  assertRequired(input.appointment_date, "Informe a data.");
  assertRequired(input.start_time, "Informe o horario.");

  return {
    clinic_id: "",
    patient_id: input.patient_id,
    employee_id: input.employee_id,
    service_id: input.service_id,
    appointment_date: input.appointment_date,
    start_time: normalizeTime(input.start_time) ?? input.start_time,
    end_time: normalizeTime(input.end_time),
    notes: cleanOptionalValue(input.notes),
    status: input.status ?? "agendado"
  };
}

function getBlockPayload(input: ScheduleBlockFormInput): ScheduleBlockInsert {
  assertRequired(input.block_date, "Informe a data do bloqueio.");

  if (input.block_type !== "dia_inteiro" && !input.start_time?.trim()) {
    throw new Error("Informe o horario inicial do bloqueio.");
  }

  if (input.block_type === "periodo" && !input.end_time?.trim()) {
    throw new Error("Informe o horario final do periodo.");
  }

  if (
    input.block_type === "periodo" &&
    compareTime(input.start_time, input.end_time) >= 0
  ) {
    throw new Error("O horario final deve ser maior que o horario inicial.");
  }

  return {
    clinic_id: "",
    employee_id: cleanOptionalValue(input.employee_id),
    block_date: input.block_date,
    block_type: input.block_type,
    start_time:
      input.block_type === "dia_inteiro" ? null : normalizeTime(input.start_time),
    end_time:
      input.block_type === "dia_inteiro"
        ? null
        : input.block_type === "horario"
          ? normalizeTime(input.start_time)
          : normalizeTime(input.end_time),
    reason: cleanOptionalValue(input.reason),
    status: "active"
  };
}

async function assertNoAppointmentConflict(
  payload: AppointmentInsert | AppointmentUpdate,
  appointmentId?: string
) {
  const supabase = await createClient();

  let appointmentsQuery = supabase
    .from("appointments")
    .select("id")
    .eq("employee_id", String(payload.employee_id))
    .eq("appointment_date", String(payload.appointment_date))
    .eq("start_time", String(payload.start_time))
    .in("status", ["agendado", "confirmado", "realizado"]);

  if (appointmentId) {
    appointmentsQuery = appointmentsQuery.neq("id", appointmentId);
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery;

  if (appointmentsError) {
    throw appointmentsError;
  }

  if ((appointments ?? []).length > 0) {
    throw new Error("Este profissional ja possui atendimento neste horario.");
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("schedule_blocks")
    .select("*")
    .eq("clinic_id", String(payload.clinic_id))
    .eq("block_date", String(payload.appointment_date))
    .eq("status", "active");

  if (blocksError) {
    throw blocksError;
  }

  const startTime = normalizeTime(String(payload.start_time));
  const employeeId = String(payload.employee_id);
  const conflictingBlock = (blocks ?? []).find((block) => {
    if (block.employee_id && block.employee_id !== employeeId) {
      return false;
    }

    if (block.block_type === "dia_inteiro") {
      return true;
    }

    if (block.block_type === "horario") {
      return normalizeTime(block.start_time) === startTime;
    }

    return (
      compareTime(startTime, block.start_time) >= 0 &&
      compareTime(startTime, block.end_time) < 0
    );
  });

  if (conflictingBlock) {
    throw new Error("Existe um bloqueio na agenda para este horario.");
  }
}

async function completeAppointmentSideEffects(
  appointmentId: string,
  appointment: Database["public"]["Tables"]["appointments"]["Row"]
) {
  const supabase = await createClient();
  let medicalRecordId = appointment.medical_record_id;

  if (!medicalRecordId) {
    const { data: existingRecord, error: existingRecordError } = await supabase
      .from("medical_records")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existingRecordError) {
      throw existingRecordError;
    }

    medicalRecordId = existingRecord?.id ?? null;
  }

  if (!medicalRecordId) {
    const { data: medicalRecord, error: medicalRecordError } = await supabase
      .from("medical_records")
      .insert({
        clinic_id: appointment.clinic_id,
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        employee_id: appointment.employee_id,
        title: `Atendimento realizado em ${appointment.appointment_date}`,
        notes: appointment.notes,
        status: "active"
      })
      .select("id")
      .single();

    if (medicalRecordError) {
      throw medicalRecordError;
    }

    medicalRecordId = medicalRecord.id;
  }

  const { data: existingHistory, error: existingHistoryError } = await supabase
    .from("patient_session_history")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existingHistoryError) {
    throw existingHistoryError;
  }

  if (!existingHistory) {
    const { error: historyError } = await supabase
      .from("patient_session_history")
      .insert({
        clinic_id: appointment.clinic_id,
        patient_id: appointment.patient_id,
        employee_id: appointment.employee_id,
        service_id: appointment.service_id,
        appointment_id: appointmentId,
        session_date: appointment.appointment_date,
        status: "realizado",
        notes: appointment.notes,
        finance_integration_status: "pending",
        commission_integration_status: "pending",
        package_session_status: "not_applied"
      });

    if (historyError) {
      throw historyError;
    }
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      medical_record_id: medicalRecordId,
      performed_at: new Date().toISOString(),
      finance_integration_status: "pending",
      commission_integration_status: "pending",
      package_session_status: "not_applied"
    })
    .eq("id", appointmentId);

  if (updateError) {
    throw updateError;
  }
}

export async function createAppointment(
  input: AppointmentFormInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "create");
    const supabase = await createClient();
    const payload = getAppointmentPayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    await assertNoAppointmentConflict(payload);

    const { data, error } = await supabase
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    if (data.status === "realizado") {
      await completeAppointmentSideEffects(data.id, data);
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Agendamento cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateAppointment(
  id: string,
  input: AppointmentFormInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const payload = getAppointmentPayload(input) satisfies AppointmentUpdate;
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    await assertNoAppointmentConflict(payload, id);

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    if (data.status === "realizado") {
      await completeAppointmentSideEffects(data.id, data);
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Agendamento atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteAppointment(id: string): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "delete");
    const supabase = await createClient();
    const { error } = await supabase.from("appointments").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Agendamento excluido." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createScheduleBlock(
  input: ScheduleBlockFormInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "create");
    const supabase = await createClient();
    const payload = getBlockPayload(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);

    const { error } = await supabase.from("schedule_blocks").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Bloqueio cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteScheduleBlock(id: string): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "delete");
    const supabase = await createClient();
    const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Bloqueio excluido." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
