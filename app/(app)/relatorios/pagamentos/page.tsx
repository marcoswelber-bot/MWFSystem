import {
  PaymentsReport,
  type PaymentReportTransaction
} from "@/components/reports/payments-report";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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

export default async function RelatorioPagamentosPage() {
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  const canViewReports = clinicScope.isAdmMaster || permissions.relatorios.view;
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
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

      const transactionsQuery = clinicFilter
        ? supabase
            .from("financial_transactions")
            .select("*")
            .eq("clinic_id", clinicFilter)
            .eq("transaction_type", "receita")
        : supabase
            .from("financial_transactions")
            .select("*")
            .eq("transaction_type", "receita");

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      const [transactionsResult, clinicsResult, patientsResult, servicesResult] =
        await Promise.all([
          readSupabaseList<FinancialTransaction>(
            "financial_transactions",
            transactionsQuery.order("due_date", { ascending: false })
          ),
          readSupabaseList<Clinic>(
            "clinics",
            clinicsQuery.order("name", { ascending: true })
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

      transactions = transactionsResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      services = servicesResult.data;

      [
        transactionsResult.error,
        clinicsResult.error,
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

  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const patientsById = new Map(
    patients.map((patient) => [patient.id, patient.full_name])
  );
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const rows: PaymentReportTransaction[] = transactions.map((transaction) => ({
    id: transaction.id,
    clinicId: transaction.clinic_id,
    clinicName: clinicsById.get(transaction.clinic_id) ?? "Clinica nao encontrada",
    patientId: transaction.patient_id,
    patientName: transaction.patient_id
      ? patientsById.get(transaction.patient_id) ?? "Paciente nao encontrado"
      : "Paciente nao informado",
    serviceId: transaction.service_id,
    serviceName: transaction.service_id
      ? servicesById.get(transaction.service_id) ?? "Servico nao encontrado"
      : "-",
    origin: transaction.origin,
    amount: Number(transaction.amount ?? 0),
    paymentMethod: transaction.payment_method,
    status: transaction.status,
    dueDate: transaction.due_date,
    paymentDate: transaction.payment_date,
    appointmentDate: transaction.appointment_date,
    createdAt: transaction.created_at
  }));

  return (
    <PaymentsReport
      rows={rows}
      clinics={clinics}
      patients={patients}
      services={services}
      currentClinicId={clinicScope.clinicId}
      canSelectClinic={clinicScope.isAdmMaster}
      loadError={loadError}
    />
  );
}
