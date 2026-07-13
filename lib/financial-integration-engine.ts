import "server-only";

import { getCurrentClinicScope } from "@/lib/access-control";
import { createAdminClient } from "@/lib/supabase/admin";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type FinancialTransactionInsert =
  Database["public"]["Tables"]["financial_transactions"]["Insert"];

export type FinancialIntegrationResult = {
  financeIntegrationStatus: string;
  commissionIntegrationStatus: string;
  packageSessionStatus: string;
};

type RollbackState = {
  financialTransactionIds: string[];
  packageSnapshot: {
    id: string;
    completed_sessions: number;
    remaining_sessions: number;
  } | null;
};

function normalizeIntegrationKind(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isPackageAppointment(appointment: Appointment) {
  return (
    normalizeIntegrationKind(appointment.appointment_type) === "pacote" ||
    normalizeIntegrationKind(appointment.appointment_origin) === "pacote"
  );
}

function isSingleRevenueAppointment(appointment: Appointment) {
  return (
    normalizeIntegrationKind(appointment.appointment_type) === "avulso" ||
    normalizeIntegrationKind(appointment.appointment_origin) === "avulso"
  );
}

function calculateCommissionAmount(
  commissionType: string | null | undefined,
  commissionValue: number | null | undefined,
  baseValue: number
) {
  if (commissionType === "valor_fixo") {
    return Number(commissionValue ?? 0);
  }

  return (baseValue * Number(commissionValue ?? 0)) / 100;
}

function getServiceAmount(
  service?: { price?: number | null; default_price?: number | null } | null
) {
  return Number(service?.default_price ?? service?.price ?? 0);
}

async function insertFinancialTransaction(payload: FinancialTransactionInsert) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function createFinancialMovement(payload: FinancialTransactionInsert) {
  await insertFinancialTransaction(payload);
}

function validateRealizedAppointment(appointment: Appointment) {
  if (!appointment.clinic_id) {
    throw new Error("Atendimento sem clinica vinculada.");
  }

  if (!appointment.patient_id) {
    throw new Error("Atendimento sem paciente vinculado.");
  }

  if (!appointment.employee_id) {
    throw new Error("Atendimento sem profissional vinculado.");
  }

  if (!appointment.service_id) {
    throw new Error("Atendimento sem servico vinculado.");
  }

  if (!appointment.appointment_date) {
    throw new Error("Atendimento sem data vinculada.");
  }
}

async function rollbackIntegration(state: RollbackState) {
  const supabase = createAdminClient();

  if (state.financialTransactionIds.length > 0) {
    const { error } = await supabase
      .from("financial_transactions")
      .delete()
      .in("id", state.financialTransactionIds);

    if (error) {
      throw error;
    }
  }

  if (state.packageSnapshot) {
    const { error } = await supabase
      .from("patient_packages")
      .update({
        completed_sessions: state.packageSnapshot.completed_sessions,
        remaining_sessions: state.packageSnapshot.remaining_sessions
      })
      .eq("id", state.packageSnapshot.id);

    if (error) {
      throw error;
    }
  }
}

async function createSingleRevenue(appointment: Appointment, state: RollbackState) {
  if (isPackageAppointment(appointment)) {
    return "package_session";
  }

  if (
    !isSingleRevenueAppointment(appointment) ||
    normalizeIntegrationKind(appointment.appointment_origin) === "cortesia"
  ) {
    return appointment.is_billable ? "not_applicable" : "not_billable";
  }

  const supabase = createAdminClient();
  const { data: existingRevenue, error: existingRevenueError } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("future_agenda_source_id", appointment.id)
    .eq("transaction_type", "receita")
    .limit(1)
    .maybeSingle();

  if (existingRevenueError) {
    throw existingRevenueError;
  }

  if (existingRevenue) {
    return "generated";
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name,price,default_price")
    .eq("id", appointment.service_id)
    .maybeSingle();

  if (serviceError) {
    throw serviceError;
  }

  const amount = getServiceAmount(service);
  if (amount <= 0) {
    throw new Error("Valor do servico nao configurado para gerar receita.");
  }

  const transactionId = await insertFinancialTransaction({
    clinic_id: appointment.clinic_id,
    transaction_type: "receita",
    patient_id: appointment.patient_id,
    employee_id: appointment.employee_id,
    service_id: appointment.service_id,
    origin: "avulso",
    category: null,
    description: `Receita do atendimento avulso - ${service?.name ?? "Servico"} - ${appointment.appointment_date}`,
    amount,
    payment_method: null,
    due_date: appointment.appointment_date,
    payment_date: null,
    appointment_date: appointment.appointment_date,
    base_amount: amount,
    commission_type: null,
    commission_rule_id: null,
    status: "pendente",
    notes: `Gerado automaticamente pelo motor financeiro a partir do atendimento ${appointment.id}.`,
    future_agenda_source_id: appointment.id,
    future_package_source_id: null,
    commission_status: "not_applicable",
    whatsapp_status: "not_applicable",
    report_visibility: "ready"
  });
  state.financialTransactionIds.push(transactionId);

  return "generated";
}

async function consumePackageSession(appointment: Appointment, state: RollbackState) {
  if (
    !isPackageAppointment(appointment) ||
    !appointment.patient_package_id ||
    appointment.package_session_status === "consumed"
  ) {
    return appointment.package_session_status ?? "not_applied";
  }

  const supabase = createAdminClient();
  const { data: patientPackage, error: packageError } = await supabase
    .from("patient_packages")
    .select("completed_sessions,remaining_sessions")
    .eq("id", appointment.patient_package_id)
    .eq("clinic_id", appointment.clinic_id)
    .eq("patient_id", appointment.patient_id)
    .eq("service_id", appointment.service_id)
    .in("status", ["active", "ativo", "Ativo"])
    .maybeSingle();

  if (packageError) {
    throw packageError;
  }

  if (!patientPackage || patientPackage.remaining_sessions <= 0) {
    throw new Error("Pacote sem sessoes restantes.");
  }

  state.packageSnapshot = {
    id: appointment.patient_package_id,
    completed_sessions: patientPackage.completed_sessions,
    remaining_sessions: patientPackage.remaining_sessions
  };

  const { error: updateError } = await supabase
    .from("patient_packages")
    .update({
      completed_sessions: patientPackage.completed_sessions + 1,
      remaining_sessions: Math.max(patientPackage.remaining_sessions - 1, 0)
    })
    .eq("id", appointment.patient_package_id)
    .gt("remaining_sessions", 0)
    .select("id")
    .single();

  if (updateError) {
    throw updateError;
  }

  return "consumed";
}

async function createCommissionPayable(appointment: Appointment, state: RollbackState) {
  const supabase = createAdminClient();
  const { data: existingCommission, error: existingCommissionError } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("future_agenda_source_id", appointment.id)
    .eq("transaction_type", "despesa")
    .eq("commission_status", "generated")
    .limit(1)
    .maybeSingle();

  if (existingCommissionError) {
    throw existingCommissionError;
  }

  if (existingCommission) {
    return "generated";
  }

  const [
    { data: service, error: serviceError },
    { data: employee, error: employeeError },
    { data: patient, error: patientError }
  ] = await Promise.all([
    supabase
      .from("services")
      .select("name,price,default_price,is_group")
      .eq("id", appointment.service_id)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("name,commission_type,commission_value")
      .eq("id", appointment.employee_id)
      .maybeSingle(),
    supabase
      .from("patients")
      .select("full_name")
      .eq("id", appointment.patient_id)
      .maybeSingle()
  ]);

  if (serviceError) {
    throw serviceError;
  }

  if (employeeError) {
    throw employeeError;
  }

  if (patientError) {
    throw patientError;
  }

  const modality = service?.is_group ? "grupo" : "individual";
  const { data: commissionRules, error: commissionRuleError } = await supabase
    .from("professional_service_commissions")
    .select("*")
    .eq("professional_id", appointment.employee_id)
    .eq("service_id", appointment.service_id)
    .eq("active", true);

  if (commissionRuleError) {
    throw commissionRuleError;
  }

  const commissionRule =
    commissionRules?.find(
      (rule) => rule.modality === modality && rule.attendance_type === "presencial"
    ) ??
    commissionRules?.find((rule) => rule.modality === modality) ??
    commissionRules?.[0];

  let baseValue = getServiceAmount(service);

  if (appointment.patient_package_id) {
    const { data: patientPackage, error: patientPackageError } = await supabase
      .from("patient_packages")
      .select("unit_session_value")
      .eq("id", appointment.patient_package_id)
      .maybeSingle();

    if (patientPackageError) {
      throw patientPackageError;
    }

    baseValue = Number(patientPackage?.unit_session_value ?? baseValue);
  }

  if (baseValue <= 0) {
    baseValue = Number(commissionRule?.base_price ?? 0);
  }

  const commissionType =
    commissionRule?.commission_type ?? employee?.commission_type ?? null;
  const commissionValue =
    commissionRule?.commission_value ?? employee?.commission_value ?? null;
  const commissionAmount = commissionRule
    ? calculateCommissionAmount(
        commissionRule.commission_type,
        commissionRule.commission_value,
        baseValue
      )
    : calculateCommissionAmount(commissionType, commissionValue, baseValue);

  if (commissionAmount <= 0) {
    return "not_configured";
  }

  const transactionId = await insertFinancialTransaction({
    clinic_id: appointment.clinic_id,
    transaction_type: "despesa",
    patient_id: appointment.patient_id,
    employee_id: appointment.employee_id,
    service_id: appointment.service_id,
    origin: null,
    category: "Comissões",
    description: `Comissão do atendimento - Profissional: ${employee?.name ?? "Profissional"} - Paciente: ${patient?.full_name ?? "Paciente"} - Serviço: ${service?.name ?? "Servico"}`,
    amount: commissionAmount,
    payment_method: null,
    due_date: appointment.appointment_date,
    payment_date: null,
    appointment_date: appointment.appointment_date,
    base_amount: baseValue,
    commission_type: commissionType,
    commission_rule_id: commissionRule?.id ?? null,
    status: "pendente",
    notes: `Competencia ${appointment.appointment_date}. Atendimento ${appointment.id}.`,
    future_agenda_source_id: appointment.id,
    future_package_source_id: null,
    commission_status: "generated",
    whatsapp_status: "not_applicable",
    report_visibility: "ready"
  });
  state.financialTransactionIds.push(transactionId);

  return "generated";
}

async function updateAppointmentAsRealized(
  appointment: Appointment,
  integration: FinancialIntegrationResult
) {
  const supabase = createAdminClient();
  const sessionsContracted = appointment.sessions_contracted ?? 1;
  const sessionsCompleted =
    appointment.sessions_completed > 0
      ? appointment.sessions_completed
      : Math.min(sessionsContracted, 1);
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "realizado",
      performed_at: new Date().toISOString(),
      finance_integration_status: integration.financeIntegrationStatus,
      commission_integration_status: integration.commissionIntegrationStatus,
      package_session_status: integration.packageSessionStatus,
      sessions_completed: sessionsCompleted
    })
    .eq("id", appointment.id);

  if (error) {
    throw error;
  }
}

export async function completeAppointmentAsRealized(
  appointmentId: string
): Promise<FinancialIntegrationResult> {
  const supabase = await createClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!appointment) {
    throw new Error("Atendimento nao encontrado para integracao financeira.");
  }

  validateRealizedAppointment(appointment);

  const rollbackState: RollbackState = {
    financialTransactionIds: [],
    packageSnapshot: null
  };

  try {
    const financeIntegrationStatus = await createSingleRevenue(
      appointment,
      rollbackState
    );
    const commissionIntegrationStatus = await createCommissionPayable(
      appointment,
      rollbackState
    );
    const packageSessionStatus = await consumePackageSession(
      appointment,
      rollbackState
    );
    const integration = {
      financeIntegrationStatus,
      commissionIntegrationStatus,
      packageSessionStatus
    };

    await updateAppointmentAsRealized(appointment, integration);

    return integration;
  } catch (error) {
    try {
      await rollbackIntegration(rollbackState);
    } catch (rollbackError) {
      throw new Error(
        `${getErrorMessage(error)} Rollback financeiro falhou: ${getErrorMessage(
          rollbackError
        )}`
      );
    }

    throw error;
  }
}

export async function getOperationalFinanceSnapshot() {
  const clinicScope = await getCurrentClinicScope();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const yearMonth = today.slice(0, 7);

  const transactionQuery = clinicScope.clinicId
    ? supabase
        .from("financial_transactions")
        .select("*")
        .eq("clinic_id", clinicScope.clinicId)
    : supabase.from("financial_transactions").select("*");
  const appointmentQuery = clinicScope.clinicId
    ? supabase
        .from("appointments")
        .select("*")
        .eq("clinic_id", clinicScope.clinicId)
        .eq("status", "realizado")
    : supabase.from("appointments").select("*").eq("status", "realizado");
  const packageQuery = clinicScope.clinicId
    ? supabase
        .from("patient_packages")
        .select("*")
        .eq("clinic_id", clinicScope.clinicId)
        .in("status", ["active", "ativo", "Ativo"])
    : supabase.from("patient_packages").select("*").in("status", ["active", "ativo", "Ativo"]);

  const [
    { data: transactions, error: transactionsError },
    { data: appointments, error: appointmentsError },
    { data: packages, error: packagesError }
  ] = await Promise.all([transactionQuery, appointmentQuery, packageQuery]);

  if (transactionsError) {
    throw new Error(getErrorMessage(transactionsError));
  }

  if (appointmentsError) {
    throw new Error(getErrorMessage(appointmentsError));
  }

  if (packagesError) {
    throw new Error(getErrorMessage(packagesError));
  }

  const activeTransactions = (transactions ?? []).filter(
    (item) => item.status !== "cancelado"
  );
  const paidTransactions = activeTransactions.filter((item) => item.status === "pago");
  const receivables = activeTransactions.filter(
    (item) => item.transaction_type === "receita" && item.status !== "pago"
  );
  const pendingCommissions = activeTransactions.filter(
    (item) =>
      item.transaction_type === "despesa" &&
      item.commission_status === "generated" &&
      item.status === "pendente"
  );
  const sum = (items: typeof activeTransactions) =>
    items.reduce((total, item) => total + Number(item.amount ?? 0), 0);

  return {
    revenueTotal: sum(
      activeTransactions.filter((item) => item.transaction_type === "receita")
    ),
    expenseTotal: sum(
      activeTransactions.filter((item) => item.transaction_type === "despesa")
    ),
    realizedBalance:
      sum(paidTransactions.filter((item) => item.transaction_type === "receita")) -
      sum(paidTransactions.filter((item) => item.transaction_type === "despesa")),
    dailyRevenue: sum(
      activeTransactions.filter(
        (item) => item.transaction_type === "receita" && item.due_date === today
      )
    ),
    monthlyRevenue: sum(
      activeTransactions.filter(
        (item) =>
          item.transaction_type === "receita" && item.due_date.startsWith(yearMonth)
      )
    ),
    receivablesTotal: sum(receivables),
    receivablesCount: receivables.length,
    pendingCommissionsTotal: sum(pendingCommissions),
    pendingCommissionsCount: pendingCommissions.length,
    realizedAppointments: appointments?.length ?? 0,
    remainingSessions: (packages ?? []).reduce(
      (total, item) => total + Number(item.remaining_sessions ?? 0),
      0
    )
  };
}
