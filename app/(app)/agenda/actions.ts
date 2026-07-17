"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinicScope } from "@/lib/access-control";
import { completeAppointmentAsRealized } from "@/lib/financial-integration-engine";
import { assertCan, canReopenAppointments } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  | "particular"
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

export type AppointmentBillingStatus = "pago" | "em_aberto" | "parcial" | "cortesia";
export type GroupParticipantStatus = "agendado" | "confirmado" | "realizado" | "faltou" | "cancelado";

export type GroupParticipantBillingInput = {
  participant_id: string;
  patient_package_id?: string;
  billing_status?: "pendente" | "pago" | "vencido" | "parcial" | "cortesia";
  payment_method?: "pix" | "dinheiro" | "cartao" | "boleto" | "parcelado" | "transferencia" | "outro";
  amount_due?: string;
  amount_paid?: string;
  notes?: string;
};

export type FinalizeAppointmentBillingInput = {
  appointment_id: string;
  payment_method?: "pix" | "dinheiro" | "cartao" | "boleto" | "parcelado" | "transferencia" | "outro";
  financial_status: AppointmentBillingStatus;
  paid_amount?: string;
  notes?: string;
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
    "particular",
    "experimental",
    "reposicao_extra"
  ];

  return allowedOrigins.includes(value as AppointmentOrigin)
    ? (value as AppointmentOrigin)
    : "avulso";
}

function normalizeIntegrationKind(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isGroupKind(value?: string | null) {
  return normalizeIntegrationKind(value) === "grupo";
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

async function applyZeroChargeAuthorization(payload: AppointmentInsert | AppointmentUpdate) {
  const isCourtesy = payload.appointment_type === "cortesia" || payload.appointment_origin === "cortesia";
  if (!isCourtesy) return;

  if (!(await canReopenAppointments())) {
    throw new Error("Somente administradores autorizados podem cadastrar cortesia.");
  }
  const reason = cleanOptionalValue(payload.notes ?? undefined);
  if (!reason) {
    throw new Error("Informe o motivo da cortesia nas observações.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auditMarker = "[CORTESIA AUTORIZADA";
  if (!reason.includes(auditMarker)) {
    payload.notes = `${reason}\n${auditMarker} em ${new Date().toISOString()} por ${user?.email ?? "usuário autenticado"}]`;
  }
  payload.is_billable = false;
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
  patientIds: string[],
  appointmentId?: string
) {
  const supabase = await createClient();
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("is_group, participant_limit")
    .eq("id", String(payload.service_id))
    .maybeSingle();

  if (serviceError) {
    throw serviceError;
  }

  const isGroupAppointment =
    service?.is_group ||
    isGroupKind(payload.appointment_type) ||
    isGroupKind(payload.appointment_origin);

  let appointmentsQuery = supabase
    .from("appointments")
    .select("id,service_id,appointment_type,appointment_origin,patient_id")
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

  if ((appointments ?? []).length > 0 && !isGroupAppointment) {
    throw new Error("Este profissional ja possui atendimento neste horario.");
  }

  if (isGroupAppointment && (appointments ?? []).length > 0) {
    const conflictingIndividual = (appointments ?? []).find(
      (appointment) =>
        appointment.service_id !== payload.service_id ||
        (!isGroupKind(appointment.appointment_type) &&
          !isGroupKind(appointment.appointment_origin))
    );

    if (conflictingIndividual) {
      throw new Error("Este profissional ja possui atendimento neste horario.");
    }

    if (service?.participant_limit) {
      const appointmentIds = (appointments ?? []).map((appointment) => appointment.id);
      const { data: participants, error: participantsError } = await supabase
        .from("appointment_participants")
        .select("appointment_id,patient_id")
        .in("appointment_id", appointmentIds);

      if (participantsError) {
        throw participantsError;
      }

      const participantCountByAppointment = (participants ?? []).reduce(
        (accumulator, participant) => {
          accumulator.set(
            participant.appointment_id,
            (accumulator.get(participant.appointment_id) ?? 0) + 1
          );
          return accumulator;
        },
        new Map<string, number>()
      );
      const occupiedSeats = (appointments ?? []).reduce(
        (total, appointment) =>
          total + (participantCountByAppointment.get(appointment.id) ?? 1),
        0
      );

      if (occupiedSeats + patientIds.length > service.participant_limit) {
        throw new Error("A capacidade maxima do grupo foi atingida.");
      }
    }
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

async function assertServiceCapacity(
  payload: AppointmentInsert | AppointmentUpdate,
  patientIds: string[]
) {
  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from("services")
    .select("is_group, participant_limit")
    .eq("id", String(payload.service_id))
    .maybeSingle();

  if (error) {
    throw error;
  }

  const isGroupAppointment =
    service?.is_group ||
    isGroupKind(payload.appointment_type) ||
    isGroupKind(payload.appointment_origin);

  if (!isGroupAppointment && patientIds.length > 1) {
    throw new Error("Este servico esta configurado como atendimento individual.");
  }

  if (
    isGroupAppointment &&
    service?.participant_limit &&
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

async function syncAppointmentParticipants(
  appointmentId: string,
  patientIds: string[]
) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("appointment_participants")
    .select("id,patient_id,status,package_session_consumed,financial_transaction_id,commission_id")
    .eq("appointment_id", appointmentId);

  if (existingError) throw existingError;
  const desired = new Set(patientIds);
  const removed = (existing ?? []).filter((participant) => !desired.has(participant.patient_id));
  const protectedParticipant = removed.find((participant) =>
    participant.status === "realizado" || participant.package_session_consumed ||
    participant.financial_transaction_id || participant.commission_id
  );
  if (protectedParticipant) {
    throw new Error("Reabra e reverta o participante finalizado antes de removê-lo do grupo.");
  }
  const removedIds = removed.map((participant) => participant.id);
  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("appointment_participants").delete().in("id", removedIds);
    if (deleteError) throw deleteError;
  }

  const existingPatients = new Set((existing ?? []).map((participant) => participant.patient_id));
  const rows: AppointmentParticipantInsert[] = patientIds
    .filter((patientId) => !existingPatients.has(patientId))
    .map((patientId) => ({
    appointment_id: appointmentId,
    patient_id: patientId,
    status: "agendado",
    package_session_consumed: false,
    billing_status: "pendente",
    amount_paid: 0,
    legacy_aggregate: false
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
  const supabase = createAdminClient();
  let medicalRecordId = appointment.medical_record_id;
  const financeIntegrationStatus = appointment.is_billable
    ? "pending"
    : "not_billable";
  const packageSessionStatus = appointment.consumes_package_session
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
    } else {
      const { error: historyUpdateError } = await supabase
        .from("patient_session_history")
        .update({
          status: "realizado",
          finance_integration_status: financeIntegrationStatus,
          commission_integration_status: "pending",
          package_session_status: packageSessionStatus
        })
        .eq("id", existingHistory.id);

      if (historyUpdateError) {
        throw historyUpdateError;
      }
    }
  }

  if (medicalRecordId !== appointment.medical_record_id) {
    const { error: updateRecordLinkError } = await supabase
      .from("appointments")
      .update({ medical_record_id: medicalRecordId })
      .eq("id", appointmentId);

    if (updateRecordLinkError) {
      throw updateRecordLinkError;
    }
  }

  await completeAppointmentAsRealized(appointmentId);

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function createAppointment(
  input: AppointmentFormInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "create");
    const supabase = await createClient();
    const payload = getAppointmentPayload(input);
    await applyZeroChargeAuthorization(payload);
    const patientIds = cleanPatientIds(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    payload.status = "agendado";
    await assertServiceCapacity(payload, patientIds);
    await assertActivePatientPackage(payload);
    await assertNoAppointmentConflict(payload, patientIds);

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
    await applyZeroChargeAuthorization(payload);
    const patientIds = cleanPatientIds(input);
    payload.clinic_id = await resolveClinicId(input.clinic_id);
    delete payload.status;
    await assertServiceCapacity(payload, patientIds);
    await assertActivePatientPackage(payload);
    await assertNoAppointmentConflict(payload, patientIds, id);

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

    revalidatePath("/agenda");
    return { ok: true, message: "Agendamento atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

function cleanMoney(value?: string) {
  const parsed = Number.parseFloat(value?.replace(",", ".") ?? "0");
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export async function finalizeAppointmentBilling(
  input: FinalizeAppointmentBillingInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    assertRequired(input.appointment_id, "Atendimento obrigatório.");
    const supabase = await createClient();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", input.appointment_id)
      .single();

    if (appointmentError) {
      return { ok: false, message: getErrorMessage(appointmentError) };
    }

    if (appointment.appointment_type === "grupo" || appointment.appointment_origin === "grupo") {
      return { ok: false, message: "Finalize os participantes individualmente ou use Finalizar presentes." };
    }
    if (appointment.status === "realizado") {
      return { ok: false, message: "Este atendimento já foi finalizado." };
    }
    if (input.financial_status === "parcial" && cleanMoney(input.paid_amount) <= 0) {
      return { ok: false, message: "Informe o valor pago para atendimento parcial." };
    }
    await completeAppointmentSideEffects(appointment.id, appointment);

    const { data: revenue, error: revenueError } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("future_agenda_source_id", appointment.id)
      .eq("transaction_type", "receita")
      .maybeSingle();

    if (revenueError) {
      return { ok: false, message: getErrorMessage(revenueError) };
    }

    if (input.financial_status === "cortesia") {
      if (revenue?.id) {
        const { error } = await supabase
          .from("financial_transactions")
          .delete()
          .eq("id", revenue.id);
        if (error) return { ok: false, message: getErrorMessage(error) };
      }
    } else if (revenue?.id) {
      const amount = Number(revenue.amount ?? 0);
      const paidAmount =
        input.financial_status === "pago"
          ? amount
          : input.financial_status === "parcial"
            ? Math.min(cleanMoney(input.paid_amount), amount)
            : 0;

      if (input.financial_status === "parcial" && paidAmount <= 0) {
        return { ok: false, message: "Informe o valor pago para atendimento parcial." };
      }

      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status:
            input.financial_status === "pago"
              ? "pago"
              : input.financial_status === "parcial"
                ? "parcial"
                : "pendente",
          paid_amount: paidAmount,
          payment_method: input.payment_method ?? revenue.payment_method ?? "pix",
          payment_date: paidAmount > 0 ? new Date().toISOString().slice(0, 10) : null,
          notes: [revenue.notes, input.notes].filter(Boolean).join(" ") || revenue.notes
        })
        .eq("id", revenue.id);

      if (error) return { ok: false, message: getErrorMessage(error) };
    }

    if (input.notes?.trim()) {
      await supabase
        .from("appointments")
        .update({ notes: [appointment.notes, input.notes.trim()].filter(Boolean).join(" ") })
        .eq("id", appointment.id);
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
    return { ok: true, message: "Atendimento finalizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function reopenAppointment(
  appointmentId: string,
  reason: string
): Promise<AgendaActionResult> {
  try {
    if (!(await canReopenAppointments())) {
      throw new Error("Apenas administradores autorizados podem reabrir atendimentos.");
    }

    assertRequired(appointmentId, "Atendimento obrigatorio.");
    assertRequired(reason, "Informe o motivo da reabertura.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reopen_appointment", {
      p_appointment_id: appointmentId,
      p_reason: reason.trim()
    });

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
    revalidatePath("/pacotes");
    revalidatePath("/prontuarios");
    revalidatePath("/relatorios");
    return { ok: true, message: "Atendimento reaberto com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function restoreAppointmentOperationalStatus(
  appointmentId: string,
  expectedStatus: "faltou" | "cancelado",
  reason: string
): Promise<AgendaActionResult> {
  try {
    if (!(await canReopenAppointments())) {
      throw new Error("Apenas administradores autorizados podem corrigir este status.");
    }

    assertRequired(appointmentId, "Atendimento obrigatorio.");
    assertRequired(reason, "Informe o motivo da correcao.");

    const supabase = await createClient();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (appointmentError) {
      return { ok: false, message: getErrorMessage(appointmentError) };
    }

    if (appointment.appointment_type === "grupo" || appointment.appointment_origin === "grupo") {
      return { ok: false, message: "Restaure o participante individualmente no detalhe do grupo." };
    }

    if (appointment.status !== expectedStatus) {
      return {
        ok: false,
        message:
          expectedStatus === "faltou"
            ? "Este atendimento nao esta marcado como falta."
            : "Este atendimento nao esta cancelado."
      };
    }

    if (expectedStatus === "cancelado") {
      const { data: participants, error: participantsError } = await supabase
        .from("appointment_participants")
        .select("patient_id")
        .eq("appointment_id", appointment.id);

      if (participantsError) {
        return { ok: false, message: getErrorMessage(participantsError) };
      }

      const patientIds = Array.from(
        new Set([appointment.patient_id, ...(participants ?? []).map((item) => item.patient_id)])
      );
      await assertNoAppointmentConflict(appointment, patientIds, appointment.id);
    }

    const nextStatus: AppointmentStatus = expectedStatus === "faltou" ? "confirmado" : "agendado";
    const correctionNote = `${expectedStatus === "faltou" ? "Falta desfeita" : "Cancelamento restaurado"}: ${reason.trim()}`;
    const { data: updatedAppointment, error } = await supabase
      .from("appointments")
      .update({
        status: nextStatus,
        notes: [appointment.notes, correctionNote].filter(Boolean).join(" "),
        updated_at: new Date().toISOString()
      })
      .eq("id", appointment.id)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
    if (!updatedAppointment) {
      return { ok: false, message: "O status deste atendimento ja foi alterado por outro usuario." };
    }

    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: expectedStatus === "faltou" ? "Falta desfeita com sucesso." : "Agendamento restaurado com sucesso."
    };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  observation?: string
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();

    const { data: currentAppointment, error: currentAppointmentError } = await supabase
      .from("appointments").select("appointment_type,appointment_origin").eq("id", id).single();
    if (currentAppointmentError) return { ok: false, message: getErrorMessage(currentAppointmentError) };
    if (currentAppointment.appointment_type === "grupo" || currentAppointment.appointment_origin === "grupo") {
      return { ok: false, message: "Use as ações individuais ou em lote do detalhe do grupo." };
    }

    if (status === "realizado") {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (appointmentError) {
        return { ok: false, message: getErrorMessage(appointmentError) };
      }

      await completeAppointmentSideEffects(appointment.id, appointment);
      revalidatePath("/agenda");
      return { ok: true, message: "Status do agendamento atualizado." };
    }

    const { data, error } = await supabase
      .from("appointments")
      .update({ status, ...(observation?.trim() ? { notes: observation.trim() } : {}) })
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

function revalidateGroupParticipantPaths() {
  revalidatePath("/agenda");
  revalidatePath("/pacientes");
  revalidatePath("/pacotes");
  revalidatePath("/financeiro");
  revalidatePath("/comissoes");
  revalidatePath("/prontuarios");
  revalidatePath("/relatorios");
  revalidatePath("/dashboard");
}

export async function setGroupParticipantStatus(
  participantId: string,
  status: Exclude<GroupParticipantStatus, "realizado">,
  notes?: string
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_group_participant_status", {
      p_participant_id: participantId,
      p_status: status,
      p_notes: cleanOptionalValue(notes)
    });
    if (error) throw error;
    revalidateGroupParticipantPaths();
    return { ok: true, message: "Participante atualizado sem alterar os demais." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function configureGroupParticipant(
  input: GroupParticipantBillingInput
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const { error } = await supabase.rpc("configure_group_participant", {
      p_participant_id: input.participant_id,
      p_patient_package_id: cleanOptionalValue(input.patient_package_id),
      p_billing_status: input.patient_package_id ? "pacote" : input.billing_status ?? "pendente",
      p_payment_method: cleanOptionalValue(input.payment_method),
      p_amount_due: cleanMoney(input.amount_due),
      p_amount_paid: cleanMoney(input.amount_paid),
      p_notes: cleanOptionalValue(input.notes)
    });
    if (error) throw error;
    revalidateGroupParticipantPaths();
    return { ok: true, message: "Pacote e cobrança do participante atualizados." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function finalizeGroupParticipant(participantId: string): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const { error } = await supabase.rpc("finalize_group_participant", {
      p_participant_id: participantId
    });
    if (error) throw error;
    revalidateGroupParticipantPaths();
    return { ok: true, message: "Participante finalizado individualmente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function reopenGroupParticipant(
  participantId: string,
  reason: string
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    if (!reason.trim()) throw new Error("Informe o motivo da reabertura.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reopen_group_participant", {
      p_participant_id: participantId,
      p_reason: reason.trim()
    });
    if (error) throw error;
    revalidateGroupParticipantPaths();
    return { ok: true, message: "Participante reaberto e efeitos individuais revertidos." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateGroupParticipantsInBatch(
  appointmentId: string,
  action: "confirm_all" | "finalize_present" | "cancel_all"
): Promise<AgendaActionResult> {
  try {
    await assertCan("agenda", "edit");
    const supabase = await createClient();
    const { data: participants, error } = await supabase.from("appointment_participants")
      .select("id,status").eq("appointment_id", appointmentId);
    if (error) throw error;
    const targets = (participants ?? []).filter((participant) => {
      if (action === "confirm_all") return participant.status === "agendado";
      if (action === "finalize_present") return ["agendado", "confirmado"].includes(participant.status ?? "");
      return !["realizado", "cancelado"].includes(participant.status ?? "");
    });
    for (const participant of targets) {
      const result = action === "finalize_present"
        ? await supabase.rpc("finalize_group_participant", { p_participant_id: participant.id })
        : await supabase.rpc("set_group_participant_status", {
            p_participant_id: participant.id,
            p_status: action === "confirm_all" ? "confirmado" : "cancelado",
            p_notes: action === "cancel_all" ? "Cancelamento em lote do grupo." : null
          });
      if (result.error) throw result.error;
    }
    revalidateGroupParticipantPaths();
    return { ok: true, message: `${targets.length} participante(s) atualizado(s).` };
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
