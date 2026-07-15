import { AgendaManager } from "@/components/agenda/agenda-manager";
import { ActionableAlertsWrapper } from "@/components/actionable-alerts-wrapper";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getAgendaActionableAlerts } from "@/lib/module-alerts";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"] & {
  patient_name: string;
  patient_names: string[];
  patient_ids: string[];
  employee_name: string;
  service_name: string;
  service_is_group: boolean;
  participant_limit: number | null;
  original_appointment_label: string | null;
};
type ScheduleBlock = Database["public"]["Tables"]["schedule_blocks"]["Row"] & {
  employee_name: string;
};
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];

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

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ patientId?: string; appointmentId?: string; new?: string }> }) {
  const params = await searchParams;
  const permissions = await getCurrentPermissionMap();
  const clinicScope = await getCurrentClinicScope();
  let clinics: Clinic[] = [];
  let patients: Patient[] = [];
  let employees: Employee[] = [];
  let services: Service[] = [];
  let patientPackages: PatientPackage[] = [];
  let rawAppointments: Database["public"]["Tables"]["appointments"]["Row"][] = [];
  let rawParticipants: Database["public"]["Tables"]["appointment_participants"]["Row"][] =
    [];
  let rawBlocks: Database["public"]["Tables"]["schedule_blocks"]["Row"][] = [];
  let loadError: string | undefined;

  if (!clinicScope.clinicId) {
    loadError = clinicScope.isAdmMaster
      ? "Selecione uma clinica ativa no topo para usar a Agenda."
      : "Usuario sem clinica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const [
        clinicsResult,
        patientsResult,
        employeesResult,
        servicesResult,
        patientPackagesResult,
        appointmentsResult,
        blocksResult
      ] = await Promise.all([
        readSupabaseList<Clinic>(
          "clinics",
          (clinicScope.isAdmMaster
            ? supabase.from("clinics").select("*")
            : supabase.from("clinics").select("*").eq("id", clinicScope.clinicId)
          ).order("name", { ascending: true })
        ),
        readSupabaseList<Patient>(
          "patients",
          supabase
            .from("patients")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .eq("status", "active")
            .order("full_name", { ascending: true })
        ),
        readSupabaseList<Employee>(
          "employees",
          supabase
            .from("employees")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .eq("status", "active")
            .order("name", { ascending: true })
        ),
        readSupabaseList<Service>(
          "services",
          supabase
            .from("services")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .order("name", { ascending: true })
        ),
        readSupabaseList<PatientPackage>(
          "patient_packages",
          supabase
            .from("patient_packages")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .eq("status", "active")
            .gt("remaining_sessions", 0)
            .order("expiration_date", { ascending: true })
        ),
        readSupabaseList<Database["public"]["Tables"]["appointments"]["Row"]>(
          "appointments",
          supabase
            .from("appointments")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .order("appointment_date", { ascending: true })
            .order("start_time", { ascending: true })
        ),
        readSupabaseList<Database["public"]["Tables"]["schedule_blocks"]["Row"]>(
          "schedule_blocks",
          supabase
            .from("schedule_blocks")
            .select("*")
            .eq("clinic_id", clinicScope.clinicId)
            .eq("status", "active")
            .order("block_date", { ascending: true })
            .order("start_time", { ascending: true })
        )
      ]);

      clinics = clinicsResult.data;
      patients = patientsResult.data;
      employees = employeesResult.data;
      services = servicesResult.data;
      patientPackages = patientPackagesResult.data;
      rawAppointments = appointmentsResult.data;
      rawBlocks = blocksResult.data;

      if (rawAppointments.length > 0) {
        const participantsResult = await readSupabaseList<
          Database["public"]["Tables"]["appointment_participants"]["Row"]
        >(
          "appointment_participants",
          supabase
            .from("appointment_participants")
            .select("*")
            .in(
              "appointment_id",
              rawAppointments.map((appointment) => appointment.id)
            )
        );
        rawParticipants = participantsResult.data;

        if (participantsResult.error) {
          loadError = appendLoadError(loadError, participantsResult.error);
        }
      }

      [
        clinicsResult.error,
        patientsResult.error,
        employeesResult.error,
        servicesResult.error,
        patientPackagesResult.error,
        appointmentsResult.error,
        blocksResult.error
      ].forEach((error) => {
        if (error) {
          loadError = appendLoadError(loadError, error);
        }
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const patientsById = new Map(
    patients.map((patient) => [patient.id, patient.full_name])
  );
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const serviceDetailsById = new Map(services.map((service) => [service.id, service]));
  const participantsByAppointmentId = rawParticipants.reduce(
    (accumulator, participant) => {
      const current = accumulator.get(participant.appointment_id) ?? [];
      current.push(participant.patient_id);
      accumulator.set(participant.appointment_id, current);
      return accumulator;
    },
    new Map<string, string[]>()
  );
  const rawAppointmentsById = new Map(
    rawAppointments.map((appointment) => [appointment.id, appointment])
  );
  const scopedRawAppointments = params.patientId ? rawAppointments.filter((appointment) => appointment.patient_id === params.patientId || (participantsByAppointmentId.get(appointment.id) ?? []).includes(params.patientId!)) : rawAppointments;
  const appointments: Appointment[] = scopedRawAppointments.map((appointment) => ({
    ...appointment,
    patient_ids:
      participantsByAppointmentId.get(appointment.id) ?? [appointment.patient_id],
    patient_names: (
      participantsByAppointmentId.get(appointment.id) ?? [appointment.patient_id]
    ).map((patientId) => patientsById.get(patientId) ?? "Paciente nao encontrado"),
    patient_name: patientsById.get(appointment.patient_id) ?? "Paciente nao encontrado",
    employee_name:
      employeesById.get(appointment.employee_id) ?? "Profissional nao encontrado",
    service_name: servicesById.get(appointment.service_id) ?? "Servico nao encontrado",
    service_is_group: serviceDetailsById.get(appointment.service_id)?.is_group ?? false,
    participant_limit:
      serviceDetailsById.get(appointment.service_id)?.participant_limit ?? null,
    original_appointment_label: appointment.original_appointment_id
      ? (() => {
          const original = rawAppointmentsById.get(appointment.original_appointment_id);
          if (!original) {
            return "Atendimento original nao encontrado";
          }

          return `${patientsById.get(original.patient_id) ?? "Paciente"} - ${original.appointment_date} ${original.start_time.slice(0, 5)}`;
        })()
      : null
  }));
  const blocks: ScheduleBlock[] = rawBlocks.map((block) => ({
    ...block,
    employee_name: block.employee_id
      ? employeesById.get(block.employee_id) ?? "Profissional nao encontrado"
      : "Clinica"
  }));

  const agendaAlerts = await getAgendaActionableAlerts();

  return (
    <div>

      <ActionableAlertsWrapper alerts={agendaAlerts} />

      <AgendaManager
        appointments={appointments}
        blocks={blocks}
        clinics={clinics}
        patients={patients}
        employees={employees}
        services={services}
        patientPackages={patientPackages}
        currentClinicId={clinicScope.clinicId}
        isAdmMaster={clinicScope.isAdmMaster}
        loadError={loadError}
        permissions={permissions.agenda}
        initialPatientId={params.patientId ?? null}
        initialAppointmentId={params.appointmentId ?? null}
        initialOpenNew={params.new === "1"}
      />
    </div>
  );
}

