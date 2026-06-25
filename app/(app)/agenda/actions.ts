"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { assertCan } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];
type AppointmentParticipantInsert =
  Database["public"]["Tables"]["appointment_participants"]["Insert"];
type ScheduleBlockInsert =
  Database["public"]["Tables"]["schedule_blocks"]["Insert"];

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "realizado"
  | "cancelado"
  | "faltou";

export type AppointmentType =
  | "avulso"
  | "pacote"
  | "grupo"
  | "avaliacao"
  | "retorno"
  | "encaixe"
  | "cortesia"
  | "convenio"
  | "particular"
  | "reposicao"
  | "experimental"
  | "reposicao_extra";

export type AppointmentOrigin =
  | "pacote"
  | "avulso"
  | "grupo"
  | "convenio"
  | "cortesia"
  | "reposicao"
  | "avaliacao"
  | "retorno"
  | "encaixe"
  | "experimental"
  | "reposicao_extra";

export type AppointmentFormInput = {
  clinic_id?: string;
  patient_id: string;
  patient_ids?: string[];
  employee_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  notes?: string;
  status?: AppointmentStatus;
  sessions_contracted?: string;
  sessions_completed?: string;
  appointment_type?: AppointmentType;
  appointment_origin?: AppointmentOrigin;
  patient_package_id?: string;
  original_appointment_id?: string;
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

function cleanPatientIds(input: AppointmentFormInput) {
  const ids = input.patient_ids?.length ? input.patient_ids : [input.patient_id];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function cleanOptionalInteger(value?: string) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return undefined;
  }

  const parsedValue = Number.parseInt(cleanValue, 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
}

function normalizeAppointmentType(value?: string): AppointmentType {
  const allowedTypes: AppointmentType[] = [
    "avulso",
    "pacote",
    "grupo",
    "avaliacao",
    "retorno",
    "encaixe",
    "cortesia",
    "convenio",
    "particular",
    "reposicao",
    "experimental",
    "reposicao_extra"
  ];

  return allowedTypes.includes(value as AppointmentType)
    ? (value as AppointmentType)
    : "avulso";
}

function normalizeAppointmentOrigin(value?: string): AppointmentOrigin {
  const allowedOrigins: AppointmentOrigin[] = [
    "pacote",
    "avulso",
    "grupo",
    "convenio",
    "cortesia",
    "reposicao",
    "avaliacao",
    "retorno",
    "encaixe",
    "experimental",
    "reposicao_extra"
  ];

  return allowedOrigins.includes(value as AppointmentOrigin)
    ? (value as AppointmentOrigin)
    : "avulso";
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

function timeIntervalsOverlap(
  startTime?: string | null,
  endTime?: string | null,
  otherStartTime?: string | null,
  otherEndTime?: string | null
) {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime) ?? start;
  const otherStart = normalizeTime(otherStartTime);
  const otherEnd = normalizeTime(otherEndTime) ?? otherStart;

  if (!start || !end || !otherStart || !otherEnd) {
    return false;
  }

  if (start === end && otherStart === otherEnd) {
    return start === otherStart;
  }

  if (start === end) {
    return compareTime(start, otherStart) >= 0 && compareTime(start, otherEnd) < 0;
  }

  if (otherStart === otherEnd) {
    return compareTime(otherStart, start) >= 0 && compareTime(otherStart, end) < 0;
  }

  return compareTime(start, otherEnd) < 0 && compareTime(end, otherStart) > 0;
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
  const patientIds = cleanPatientIds(input);
  const appointmentType = normalizeAppointmentType(input.appointment_type);
  const appointmentOrigin = normalizeAppointmentOrigin(input.appointment_origin);
  const isReplacement =
    appointmentType === "reposicao" ||
    appointmentType === "reposicao_extra" ||
    appointmentOrigin === "reposicao" ||
    appointmentOrigin === "reposicao_extra";
  const originalAppointmentId = cleanOptionalValue(input.original_appointment_id);
  const patientPackageId = cleanOptionalValue(input.patient_package_id);
  const isPackageAppointment =
    appointmentType === "pacote" || appointmentOrigin === "pacote";
  const sessionsContracted = isReplacement
    ? 0
    : cleanOptionalInteger(input.sessions_contracted) ?? 1;

  if (patientIds.length === 0) {
    throw new Error("Selecione pelo menos um paciente.");
  }

  assertRequired(input.employee_id, "Selecione o profissional.");
  assertRequired(input.service_id, "Selecione o servico.");
  assertRequired(input.appointment_date, "Informe a data.");
  assertRequired(input.start_time, "Informe o horario.");

  if (input.appointment_date < new Date().toISOString().slice(0, 10)) {
    throw new Error("Nao e possivel agendar em datas passadas.");
  }

  if (isReplacement && !originalAppointmentId) {
    throw new Error("Selecione o atendimento original da reposicao.");
  }

  if (isPackageAppointment && !patientPackageId) {
    throw new Error("Selecione um pacote ativo do paciente.");
  }

  return {
    clinic_id: "",
    patient_id: patientIds[0],
    employee_id: input.employee_id,
    service_id: input.service_id,
    appointment_date: input.appointment_date,
    start_time: normalizeTime(input.start_time) ?? input.start_time,
    end_time: normalizeTime(input.end_time),
    notes: cleanOptionalValue(input.notes),
    status: input.status ?? "agendado",
    sessions_contracted: sessionsContracted,
    sessions_completed: cleanOptionalInteger(input.sessions_completed) ?? 0,
    appointment_type: appointmentType,
    appointment_origin: appointmentOrigin,
    patient_package_id: isPackageAppointment ? patientPackageId : null,
    original_appointment_id: originalAppointmentId,
    is_billable: !isReplacement && appointmentOrigin !== "cortesia",
    consumes_package_session: isPackageAppointment || isReplacement,
    package_session_status: isPackageAppointment ? "consume_pending" : "not_applied"
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
  const endTime = normalizeTime(payload.end_time ?? null) ?? startTime;
  const employeeId = String(payload.employee_id);
  const conflictingBlock = (blocks ?? []).find((block) => {
    if (block.employee_id && block.employee_id !== employeeId) {
      return false;
    }

    if (block.block_type === "dia_inteiro") {
      return true;
    }

    if (block.block_type === "horario") {
      return timeIntervalsOverlap(startTime, endTime, block.start_time, block.end_time);
    }

    return timeIntervalsOverlap(startTime, endTime, block.start_time, block.end_time);
  });

  if (conflictingBlock) {
    throw new Error("Não é possível agendar: horário bloqueado.");
  }
}

async function assertServiceCapacity(serviceId: string, patientIds: string[]) {
  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from("services")
    .select("is_group, participant_limit")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!service?.is_group && patientIds.length > 1) {
    throw new Error("Este servico esta configurado como atendimento individual.");
  }

  if (
    service?.is_group &&
    service.participant_limit &&
    patientIds.length > service.participant_limit
  ) {
    throw new Error("A quantidade de pacientes excede a capacidade do grupo.");
  }
}

async function assertActivePatientPackage(
  payload: AppointmentInsert | AppointmentUpdate
) {
  if (!payload.patient_package_id) {
    return;
  }

  const supabase = await createClient();
  const { data: patientPackage, error } = await supabase
    .from("patient_packages")
    .select("id")
    .eq("id", String(payload.patient_package_id))
    .eq("clinic_id", String(payload.clinic_id))
    .eq("patient_id", String(payload.patient_id))
    .eq("service_id", String(payload.service_id))
    .eq("status", "active")
    .gt("remaining_sessions", 0)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!patientPackage) {
    throw new Error("Selecione um pacote ativo do paciente.");
  }
}

async function consumePatientPackageSession(
  appointment: Database["public"]["Tables"]["appointments"]["Row"]
) {
  if (
    !appointment.patient_package_id ||
    !appointment.consumes_package_session ||
    appointment.package_session_status === "consumed"
  ) {
    return "not_applied";
  }

  const supabase = await createClient();
  const { data: patientPackage, error: packageError } = await supabase
    .from("patient_packages")
    .select("completed_sessions, remaining_sessions")
    .eq("id", appointment.patient_package_id)
    .eq("clinic_id", appointment.clinic_id)
    .eq("patient_id", appointment.patient_id)
    .eq("service_id", appointment.service_id)
    .eq("status", "active")
    .maybeSingle();

  if (packageError) {
    throw packageError;
  }

  if (!patientPackage || patientPackage.remaining_sessions <= 0) {
    throw new Error("Pacote sem sessoes restantes.");
  }

  const { error: updateError } = await supabase
    .from("patient_packages")
    .update({
      completed_sessions: patientPackage.completed_sessions + 1,
      remaining_sessions: Math.max(patientPackage.remaining_sessions - 1, 0)
    })
    .eq("id", appointment.patient_package_id);

  if (updateError) {
    throw updateError;
  }

  return "consumed";
}

async function syncAppointmentParticipants(
  appointmentId: string,
  patientIds: string[]
) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("appointment_participants")
    .delete()
    .eq("appointment_id", appointmentId);

  if (deleteError) {
    throw deleteError;
  }

  const rows: AppointmentParticipantInsert[] = patientIds.map((patientId) => ({
    appointment_id: appointmentId,
    patient_id: patientId
  }));

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("appointment_participants")
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}

async function completeAppointmentSideEffects(
  appointmentId: string,
  appointment: Database["public"]["Tables"]["appointments"]["Row"]
) {
  const supabase = await createClient();
  let medicalRecordId = appointment.medical_record_id;
  const financeIntegrationStatus = appointment.is_billable
    ? "pending"
    : "not_billable";
  let packageSessionStatus = appointment.consumes_package_session
    ? "consume_pending"
    : "not_applied";
  const { data: participants, error: participantsError } = await supabase
    .from("appointment_participants")
    .select("patient_id")
    .eq("appointment_id", appointmentId);

  if (participantsError) {
    throw participantsError;
  }

  const patientIds = (participants ?? []).map((participant) => participant.patient_id);
  const sessionPatientIds = patientIds.length > 0 ? patientIds : [appointment.patient_id];

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

  for (const patientId of sessionPatientIds) {
    const { data: existingHistory, error: existingHistoryError } = await supabase
      .from("patient_session_history")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (existingHistoryError) {
      throw existingHistoryError;
    }

    if (!existingHistory) {
      const { error: historyError } = await supabase
        .from("patient_session_history")
        .insert({
          clinic_id: appointment.clinic_id,
          patient_id: patientId,
          employee_id: appointment.employee_id,
          service_id: appointment.service_id,
          appointment_id: appointmentId,
          session_date: appointment.appointment_date,
          status: "realizado",
          notes: appointment.notes,
          finance_integration_status: financeIntegrationStatus,
          commission_integration_status: "pending",
          package_session_status: packageSessionStatus
        });

      if (historyError) {
        throw historyError;
      }
    }
  }

  const sessionsContracted = appointment.sessions_contracted ?? 1;
  const sessionsCompleted =
    appointment.sessions_completed > 0
      ? appointment.sessions_completed
      : Math.min(sessionsContracted, 1);

  if (appointment.patient_package_id && appointment.package_session_status !== "consumed") {
    packageSessionStatus = await consumePatientPackageSession(appointment);
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      medical_record_id: medicalRecordId,
      performed_at: new Date().toISOString(),
      finance_integration_status: financeIntegrationStatus,
      commission_integration_status: "pending",
      package_session_status: packageSessionStatus,
      sessions_completed: sessionsCompleted
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
    const patientIds = cleanPatientIds(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    await assertServiceCapacity(payload.service_id, patientIds);
    await assertActivePatientPackage(payload);
    await assertNoAppointmentConflict(payload);

    const { data, error } = await supabase
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await syncAppointmentParticipants(data.id, patientIds);

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
    const patientIds = cleanPatientIds(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    await assertServiceCapacity(String(payload.service_id), patientIds);
    await assertActivePatientPackage(payload);
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

    await syncAppointmentParticipants(data.id, patientIds);

    if (data.status === "realizado") {
      await completeAppointmentSideEffects(data.id, data);
    }

    revalidatePath("/agenda");
    return { ok: true, message: "Agendamento atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
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
    return { ok: true, message: "Status do agendamento atualizado." };
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
