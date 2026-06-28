import {
  OperationalReport,
  type OperationalAppointment
} from "@/components/reports/operational-report";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type AppointmentParticipant =
  Database["public"]["Tables"]["appointment_participants"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
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

export default async function RelatorioOperacionalPage() {
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  const canViewReports = clinicScope.isAdmMaster || permissions.relatorios.view;
  let appointments: Appointment[] = [];
  let participants: AppointmentParticipant[] = [];
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let employees: Employee[] = [];
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
        ? supabase
            .from("appointments")
            .select("*")
            .eq("clinic_id", clinicFilter)
            .order("appointment_date", { ascending: false })
            .order("start_time", { ascending: false })
        : supabase
            .from("appointments")
            .select("*")
            .order("appointment_date", { ascending: false })
            .order("start_time", { ascending: false });

      const patientsQuery = clinicFilter
        ? supabase.from("patients").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("patients").select("*");

      const employeesQuery = clinicFilter
        ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("employees").select("*");

      const servicesQuery = clinicFilter
        ? supabase.from("services").select("*").eq("clinic_id", clinicFilter)
        : supabase.from("services").select("*");

      const [appointmentsResult, clinicsResult, patientsResult, employeesResult, servicesResult] =
        await Promise.all([
          readSupabaseList<Appointment>("appointments", appointmentsQuery),
          readSupabaseList<Clinic>(
            "clinics",
            clinicsQuery.order("name", { ascending: true })
          ),
          readSupabaseList<Patient>(
            "patients",
            patientsQuery.order("full_name", { ascending: true })
          ),
          readSupabaseList<Employee>(
            "employees",
            employeesQuery.order("name", { ascending: true })
          ),
          readSupabaseList<Service>(
            "services",
            servicesQuery.order("name", { ascending: true })
          )
        ]);

      appointments = appointmentsResult.data;
      clinics = clinicsResult.data;
      patients = patientsResult.data;
      employees = employeesResult.data;
      services = servicesResult.data;

      if (appointments.length > 0) {
        const participantsResult = await readSupabaseList<AppointmentParticipant>(
          "appointment_participants",
          supabase
            .from("appointment_participants")
            .select("*")
            .in(
              "appointment_id",
              appointments.map((appointment) => appointment.id)
            )
        );
        participants = participantsResult.data;

        if (participantsResult.error) {
          loadError = appendLoadError(loadError, participantsResult.error);
        }
      }

      [
        appointmentsResult.error,
        clinicsResult.error,
        patientsResult.error,
        employeesResult.error,
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
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const participantsByAppointmentId = participants.reduce(
    (accumulator, participant) => {
      const current = accumulator.get(participant.appointment_id) ?? [];
      current.push(participant.patient_id);
      accumulator.set(participant.appointment_id, current);
      return accumulator;
    },
    new Map<string, string[]>()
  );
  const rows: OperationalAppointment[] = appointments.map((appointment) => {
    const service = servicesById.get(appointment.service_id);
    const patientIds =
      participantsByAppointmentId.get(appointment.id) ?? [appointment.patient_id];
    const patientNames = patientIds.map(
      (patientId) => patientsById.get(patientId) ?? "Paciente nao encontrado"
    );
    const appointmentType = appointment.appointment_type ?? "avulso";

    return {
      id: appointment.id,
      clinicId: appointment.clinic_id,
      clinicName: clinicsById.get(appointment.clinic_id) ?? "Clinica nao encontrada",
      patientId: appointment.patient_id,
      patientIds,
      patientName: patientNames.join(", "),
      patientNames,
      employeeId: appointment.employee_id,
      employeeName:
        employeesById.get(appointment.employee_id) ?? "Profissional nao encontrado",
      serviceId: appointment.service_id,
      serviceName: service?.name ?? "Servico nao encontrado",
      serviceIsGroup: service?.is_group ?? false,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      type: appointmentType,
      status: appointment.status,
      origin: appointment.appointment_origin ?? appointmentType,
      notes: appointment.notes,
      participantCount: patientIds.length
    };
  });

  return (
    <OperationalReport
      rows={rows}
      clinics={clinics}
      patients={patients}
      employees={employees}
      services={services}
      currentClinicId={clinicScope.clinicId}
      canSelectClinic={clinicScope.isAdmMaster}
      loadError={loadError}
    />
  );
}
