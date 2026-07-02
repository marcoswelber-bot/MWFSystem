import {
  MulticlinicReport,
  type MulticlinicAppointment,
  type MulticlinicFinancialTransaction,
  type MulticlinicPatient
} from "@/components/reports/multiclinic-report";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type FinancialTransaction =
  Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

async function readSupabaseList<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
) {
  try {
    const { data, error } = await query;

    if (error) {
      return {
        data: [],
        error: `[${label}] ${getErrorMessage(error)}`
      };
    }

    return {
      data: data ?? [],
      error: undefined
    };
  } catch (error) {
    return {
      data: [],
      error: `[${label}] ${getErrorMessage(error)}`
    };
  }
}

export default async function RelatorioMulticlinicaPage() {
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  const canViewReports = clinicScope.isAdmMaster || permissions.relatorios.view;
  let clinics: Clinic[] = [];
  let appointments: Appointment[] = [];
  let transactions: FinancialTransaction[] = [];
  let patients: Patient[] = [];
  let services: Service[] = [];
  let loadError: string | undefined;

  if (!canViewReports) {
    loadError = "Voce nao tem permissao para visualizar relatorios.";
  } else if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.isAdmMaster ? null : clinicScope.clinicId;

      const clinicsQuery = clinicFilter
        ? supabase.from("clinics").select("*").eq("id", clinicFilter)
        : supabase.from("clinics").select("*");

      const appointmentsQuery = clinicFilter
        ? supabase.from("appointments").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("appointments").select("*");

      const transactionsQuery = clinicFilter
        ? supabase
            .from("financial_transactions")
            .select("*")
            .eq("clinic_id", clinicFilter)
        : supabase.from("financial_transactions").select("*");

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      const [
        clinicsResult,
        appointmentsResult,
        transactionsResult,
        patientsResult,
        servicesResult
      ] = await Promise.all([
        readSupabaseList<Clinic>(
          "clinics",
          clinicsQuery.order("name", { ascending: true })
        ),
        readSupabaseList<Appointment>(
          "appointments",
          appointmentsQuery.order("appointment_date", { ascending: false })
        ),
        readSupabaseList<FinancialTransaction>(
          "financial_transactions",
          transactionsQuery.order("due_date", { ascending: false })
        ),
        readSupabaseList<Patient>(
          "patients",
          patientsQuery.order("full_name", { ascending: true })
        ),
        readSupabaseList<Service>(
          "services",
          servicesQuery.order("name", { ascending: true })
        )
      ]);

      clinics = clinicsResult.data;
      appointments = appointmentsResult.data;
      transactions = transactionsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;

      [
        clinicsResult.error,
        appointmentsResult.error,
        transactionsResult.error,
        patientsResult.error,
        servicesResult.error
      ].forEach((error) => {
        if (error) {
          loadError = appendLoadError(loadError, error);
        }
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const appointmentsForReport: MulticlinicAppointment[] = appointments.map(
    (appointment) => ({
      id: appointment.id,
      clinicId: appointment.clinic_id,
      patientId: appointment.patient_id,
      serviceId: appointment.service_id,
      appointmentDate: appointment.appointment_date,
      status: appointment.status
    })
  );
  const transactionsForReport: MulticlinicFinancialTransaction[] = transactions.map(
    (transaction) => ({
      id: transaction.id,
      clinicId: transaction.clinic_id,
      serviceId: transaction.service_id,
      transactionType: transaction.transaction_type,
      category: transaction.category,
      description: transaction.description,
      amount: Number(transaction.amount ?? 0),
      paidAmount: Number(transaction.paid_amount ?? 0),
      openAmount: Number(transaction.open_amount ?? Math.max(Number(transaction.amount ?? 0) - Number(transaction.paid_amount ?? 0), 0)),
      status: transaction.status,
      dueDate: transaction.due_date,
      paymentDate: transaction.payment_date,
      appointmentDate: transaction.appointment_date,
      commissionStatus: transaction.commission_status
    })
  );
  const patientsForReport: MulticlinicPatient[] = patients.map((patient) => ({
    id: patient.id,
    clinicId: patient.clinic_id,
    status: patient.status
  }));

  return (
    <MulticlinicReport
      clinics={clinics}
      appointments={appointmentsForReport}
      transactions={transactionsForReport}
      patients={patientsForReport}
      services={services}
      currentClinicId={clinicScope.clinicId}
      canSelectClinic={clinicScope.isAdmMaster}
      loadError={loadError}
    />
  );
}
