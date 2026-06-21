"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import type { PermissionSet } from "@/lib/permission-modules";
import {
  createAppointment,
  createScheduleBlock,
  deleteAppointment,
  deleteScheduleBlock,
  setAppointmentStatus,
  updateAppointment,
  type AgendaActionResult,
  type AppointmentFormInput,
  type AppointmentStatus,
  type ScheduleBlockFormInput
} from "@/app/(app)/agenda/actions";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"] & {
  patient_name: string;
  patient_names: string[];
  patient_ids: string[];
  employee_name: string;
  service_name: string;
  service_is_group: boolean;
  participant_limit: number | null;
};
type ScheduleBlock = Database["public"]["Tables"]["schedule_blocks"]["Row"] & {
  employee_name: string;
};
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type ViewMode = "day" | "week" | "month";

type AgendaManagerProps = {
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  clinics: Clinic[];
  patients: Patient[];
  employees: Employee[];
  services: Service[];
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
};

const statusOptions: Array<[AppointmentStatus, string]> = [
  ["agendado", "Agendado"],
  ["confirmado", "Confirmado"],
  ["realizado", "Realizado"],
  ["cancelado", "Cancelado"],
  ["faltou", "Faltou"]
];

const statusStyles: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  agendado: { label: "Agendado", color: "#1d4ed8", bg: "#dbeafe" },
  confirmado: { label: "Confirmado", color: "#047857", bg: "#d1fae5" },
  realizado: { label: "Realizado", color: "#4b5563", bg: "#e5e7eb" },
  faltou: { label: "Faltou", color: "#b91c1c", bg: "#fee2e2" },
  cancelado: { label: "Cancelado", color: "#c2410c", bg: "#ffedd5" }
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAppointmentForm: AppointmentFormInput = {
  clinic_id: "",
  patient_id: "",
  patient_ids: [],
  employee_id: "",
  service_id: "",
  appointment_date: today(),
  start_time: "",
  end_time: "",
  notes: "",
  status: "agendado",
  sessions_contracted: "1",
  sessions_completed: "0"
};

const emptyBlockForm: ScheduleBlockFormInput = {
  clinic_id: "",
  employee_id: "",
  block_date: today(),
  block_type: "periodo",
  start_time: "",
  end_time: "",
  reason: ""
};

function appointmentToForm(appointment: Appointment): AppointmentFormInput {
  return {
    clinic_id: appointment.clinic_id,
    patient_id: appointment.patient_id,
    patient_ids: appointment.patient_ids,
    employee_id: appointment.employee_id,
    service_id: appointment.service_id,
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time.slice(0, 5),
    end_time: appointment.end_time?.slice(0, 5) ?? "",
    notes: appointment.notes ?? "",
    status: appointment.status as AppointmentStatus,
    sessions_contracted: String(appointment.sessions_contracted ?? 1),
    sessions_completed: String(appointment.sessions_completed ?? 0)
  };
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short"
  });
}

function fullDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function normalizeStatus(status: string): AppointmentStatus {
  return statusOptions.some(([value]) => value === status)
    ? (status as AppointmentStatus)
    : "agendado";
}

function getPeriodLabel(mode: ViewMode, selectedDate: string) {
  if (mode === "day") {
    return fullDate(selectedDate);
  }

  if (mode === "week") {
    const start = startOfWeek(new Date(`${selectedDate}T00:00:00`));
    return `${fullDate(toDateKey(start))} a ${fullDate(toDateKey(addDays(start, 6)))}`;
  }

  return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};

export function AgendaManager({
  appointments,
  blocks,
  clinics,
  patients,
  employees,
  services,
  currentClinicId,
  isAdmMaster,
  loadError,
  permissions
}: AgendaManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [viewMode, setViewMode] = React.useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = React.useState(today());
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  const [appointmentFormOpen, setAppointmentFormOpen] = React.useState(false);
  const [blockFormOpen, setBlockFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] =
    React.useState<Appointment | null>(null);
  const [appointmentForm, setAppointmentForm] =
    React.useState<AppointmentFormInput>(emptyAppointmentForm);
  const [blockForm, setBlockForm] =
    React.useState<ScheduleBlockFormInput>(emptyBlockForm);
  const [message, setMessage] = React.useState<AgendaActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;
  const visibleServices = services.filter((service) => service.status === "active");
  const selectedService = services.find(
    (service) => service.id === appointmentForm.service_id
  );
  const selectedPatients = appointmentForm.patient_ids ?? [];
  const performedCount = appointments.filter(
    (item) => item.status === "realizado"
  ).length;
  const groupCount = appointments.filter((item) => item.service_is_group).length;

  const visibleAppointments = appointments
    .filter((appointment) => {
      if (employeeFilter !== "all" && appointment.employee_id !== employeeFilter) {
        return false;
      }

      if (viewMode === "day") {
        return appointment.appointment_date === selectedDate;
      }

      if (viewMode === "week") {
        const start = startOfWeek(new Date(`${selectedDate}T00:00:00`));
        const end = addDays(start, 6);
        return (
          appointment.appointment_date >= toDateKey(start) &&
          appointment.appointment_date <= toDateKey(end)
        );
      }

      return appointment.appointment_date.startsWith(selectedDate.slice(0, 7));
    })
    .sort((a, b) =>
      `${a.appointment_date} ${a.start_time}`.localeCompare(
        `${b.appointment_date} ${b.start_time}`
      )
    );

  const visibleBlocks = blocks
    .filter((block) => {
      if (
        employeeFilter !== "all" &&
        block.employee_id &&
        block.employee_id !== employeeFilter
      ) {
        return false;
      }

      if (viewMode === "day") {
        return block.block_date === selectedDate;
      }

      if (viewMode === "week") {
        const start = startOfWeek(new Date(`${selectedDate}T00:00:00`));
        const end = addDays(start, 6);
        return block.block_date >= toDateKey(start) && block.block_date <= toDateKey(end);
      }

      return block.block_date.startsWith(selectedDate.slice(0, 7));
    })
    .sort((a, b) =>
      `${a.block_date} ${a.start_time ?? "00:00"}`.localeCompare(
        `${b.block_date} ${b.start_time ?? "00:00"}`
      )
    );

  const days = React.useMemo(() => {
    if (viewMode === "day") {
      return [selectedDate];
    }

    if (viewMode === "week") {
      const start = startOfWeek(new Date(`${selectedDate}T00:00:00`));
      return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
    }

    const [year, month] = selectedDate.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, index) =>
      `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`
    );
  }, [selectedDate, viewMode]);

  const inputStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--input))",
    borderRadius: "6px",
    padding: "10px",
    width: "100%",
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))"
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--input))",
    borderRadius: "6px",
    padding: "10px 14px",
    fontWeight: 600
  };

  const panelStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    display: "grid",
    gap: "16px",
    padding: "20px"
  };

  function refresh() {
    router.refresh();
  }

  function openCreateAppointment() {
    setEditingAppointment(null);
    setAppointmentForm({
      ...emptyAppointmentForm,
      clinic_id: currentClinicId ?? "",
      appointment_date: selectedDate
    });
    setMessage(null);
    setAppointmentFormOpen(true);
  }

  function openEditAppointment(appointment: Appointment) {
    setEditingAppointment(appointment);
    setAppointmentForm(appointmentToForm(appointment));
    setMessage(null);
    setAppointmentFormOpen(true);
  }

  function openRescheduleAppointment(appointment: Appointment) {
    openEditAppointment(appointment);
    setMessage({ ok: true, message: "Ajuste data e horario para reagendar." });
  }

  function closeAppointmentForm() {
    setEditingAppointment(null);
    setAppointmentForm(emptyAppointmentForm);
    setAppointmentFormOpen(false);
  }

  function openBlockForm() {
    setBlockForm({
      ...emptyBlockForm,
      clinic_id: currentClinicId ?? "",
      block_date: selectedDate
    });
    setMessage(null);
    setBlockFormOpen(true);
  }

  function closeBlockForm() {
    setBlockForm(emptyBlockForm);
    setBlockFormOpen(false);
  }

  function submitAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const patientIds = selectedService?.is_group
      ? appointmentForm.patient_ids ?? []
      : [appointmentForm.patient_id].filter(Boolean);

    startTransition(async () => {
      const result = editingAppointment
        ? await updateAppointment(editingAppointment.id, {
            ...appointmentForm,
            patient_id: patientIds[0] ?? "",
            patient_ids: patientIds
          })
        : await createAppointment({
            ...appointmentForm,
            patient_id: patientIds[0] ?? "",
            patient_ids: patientIds
          });
      setMessage(result);

      if (result.ok) {
        closeAppointmentForm();
        refresh();
      }
    });
  }

  function submitBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createScheduleBlock(blockForm);
      setMessage(result);

      if (result.ok) {
        closeBlockForm();
        refresh();
      }
    });
  }

  function changeStatus(appointment: Appointment, status: AppointmentStatus) {
    startTransition(async () => {
      const result = await setAppointmentStatus(appointment.id, status);
      setMessage(result);
      if (result.ok) {
        refresh();
      }
    });
  }

  function removeAppointment(appointment: Appointment) {
    if (!window.confirm("Excluir este agendamento?")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteAppointment(appointment.id);
      setMessage(result);
      if (result.ok) {
        refresh();
      }
    });
  }

  function removeBlock(block: ScheduleBlock) {
    if (!window.confirm("Excluir este bloqueio?")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteScheduleBlock(block.id);
      setMessage(result);
      if (result.ok) {
        refresh();
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {message ? (
        <div
          style={{
            border: `1px solid ${message.ok ? "hsl(var(--primary))" : "hsl(var(--destructive))"}`,
            borderRadius: "6px",
            color: message.ok ? "hsl(var(--primary))" : "hsl(var(--destructive))",
            padding: "12px"
          }}
        >
          {message.message}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }}
      >
        <Counter title="Atendimentos no periodo" value={visibleAppointments.length} />
        <Counter title="Realizados" value={performedCount} />
        <Counter title="Atendimentos em grupo" value={groupCount} />
        <Counter title="Bloqueios visiveis" value={visibleBlocks.length} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                ["day", "Diaria"],
                ["week", "Semanal"],
                ["month", "Mensal"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewMode(value as ViewMode)}
                  style={{
                    ...buttonStyle,
                    background: viewMode === value ? "hsl(var(--primary))" : "transparent",
                    color: viewMode === value ? "hsl(var(--primary-foreground))" : "inherit"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {canCreate ? (
                <button
                  type="button"
                  onClick={openCreateAppointment}
                  style={{
                    ...buttonStyle,
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))"
                  }}
                >
                  Novo agendamento
                </button>
              ) : null}
              {canCreate ? (
                <button type="button" onClick={openBlockForm} style={buttonStyle}>
                  Novo bloqueio
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <TextField
              label="Data base"
              type="date"
              value={selectedDate}
              onChange={setSelectedDate}
              inputStyle={inputStyle}
            />
            <SelectField
              label="Visao por profissional"
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={[
                ["all", "Todos os profissionais"],
                ...employees.map((employee) => [employee.id, employee.name] as [string, string])
              ]}
              inputStyle={inputStyle}
            />
          </div>

          <strong>{getPeriodLabel(viewMode, selectedDate)}</strong>
        </div>
      </section>

      {appointmentFormOpen ? (
        <section style={panelStyle}>
          <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
            {editingAppointment ? "Editar agendamento" : "Novo agendamento"}
          </h2>
          <form onSubmit={submitAppointment} style={formGridStyle}>
            <SelectField
              label="Clinica"
              value={appointmentForm.clinic_id ?? ""}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, clinic_id: value }))
              }
              options={clinics.map((clinic) => [clinic.id, clinic.name])}
              inputStyle={inputStyle}
              disabled={!isAdmMaster}
            />
            <SelectField
              label="Servico"
              value={appointmentForm.service_id}
              onChange={(value) => {
                const service = services.find((item) => item.id === value);
                setAppointmentForm((current) => ({
                  ...current,
                  service_id: value,
                  patient_ids: service?.is_group ? current.patient_ids : []
                }));
              }}
              options={visibleServices.map((service) => [service.id, service.name])}
              inputStyle={inputStyle}
              required
            />
            {selectedService?.is_group ? (
              <MultiSelectField
                label="Pacientes do grupo"
                value={selectedPatients}
                onChange={(value) =>
                  setAppointmentForm((current) => ({
                    ...current,
                    patient_id: value[0] ?? "",
                    patient_ids: value
                  }))
                }
                options={patients.map((patient) => [patient.id, patient.full_name])}
                inputStyle={inputStyle}
                helper={`${selectedPatients.length}/${selectedService.participant_limit ?? "sem limite"} vagas ocupadas`}
              />
            ) : (
              <SelectField
                label="Paciente"
                value={appointmentForm.patient_id}
                onChange={(value) =>
                  setAppointmentForm((current) => ({
                    ...current,
                    patient_id: value,
                    patient_ids: value ? [value] : []
                  }))
                }
                options={patients.map((patient) => [patient.id, patient.full_name])}
                inputStyle={inputStyle}
                required
              />
            )}
            <SelectField
              label="Profissional"
              value={appointmentForm.employee_id}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, employee_id: value }))
              }
              options={employees.map((employee) => [employee.id, employee.name])}
              inputStyle={inputStyle}
              required
            />
            <TextField
              label="Data"
              type="date"
              value={appointmentForm.appointment_date}
              onChange={(value) =>
                setAppointmentForm((current) => ({
                  ...current,
                  appointment_date: value
                }))
              }
              inputStyle={inputStyle}
              required
            />
            <TextField
              label="Horario"
              type="time"
              value={appointmentForm.start_time}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, start_time: value }))
              }
              inputStyle={inputStyle}
              required
            />
            <TextField
              label="Horario final"
              type="time"
              value={appointmentForm.end_time ?? ""}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, end_time: value }))
              }
              inputStyle={inputStyle}
            />
            <TextField
              label="Sessoes contratadas"
              type="number"
              value={appointmentForm.sessions_contracted ?? "1"}
              onChange={(value) =>
                setAppointmentForm((current) => ({
                  ...current,
                  sessions_contracted: value
                }))
              }
              inputStyle={inputStyle}
            />
            <SelectField
              label="Status"
              value={appointmentForm.status ?? "agendado"}
              onChange={(value) =>
                setAppointmentForm((current) => ({
                  ...current,
                  status: value as AppointmentStatus
                }))
              }
              options={statusOptions}
              inputStyle={inputStyle}
            />
            <TextAreaField
              label="Observacoes"
              value={appointmentForm.notes ?? ""}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, notes: value }))
              }
              inputStyle={inputStyle}
            />
            <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button type="button" onClick={closeAppointmentForm} style={buttonStyle}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  ...buttonStyle,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))"
                }}
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {blockFormOpen ? (
        <section style={panelStyle}>
          <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Novo bloqueio</h2>
          <form onSubmit={submitBlock} style={formGridStyle}>
            <SelectField
              label="Clinica"
              value={blockForm.clinic_id ?? ""}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, clinic_id: value }))
              }
              options={clinics.map((clinic) => [clinic.id, clinic.name])}
              inputStyle={inputStyle}
              disabled={!isAdmMaster}
            />
            <SelectField
              label="Profissional"
              value={blockForm.employee_id ?? ""}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, employee_id: value }))
              }
              options={employees.map((employee) => [employee.id, employee.name])}
              inputStyle={inputStyle}
            />
            <TextField
              label="Data"
              type="date"
              value={blockForm.block_date}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, block_date: value }))
              }
              inputStyle={inputStyle}
              required
            />
            <SelectField
              label="Tipo"
              value={blockForm.block_type}
              onChange={(value) =>
                setBlockForm((current) => ({
                  ...current,
                  block_type: value as ScheduleBlockFormInput["block_type"]
                }))
              }
              options={[
                ["dia_inteiro", "Dia inteiro"],
                ["periodo", "Periodo"],
                ["horario", "Horario especifico"]
              ]}
              inputStyle={inputStyle}
            />
            <TextField
              label="Inicio"
              type="time"
              value={blockForm.start_time ?? ""}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, start_time: value }))
              }
              inputStyle={inputStyle}
            />
            <TextField
              label="Fim"
              type="time"
              value={blockForm.end_time ?? ""}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, end_time: value }))
              }
              inputStyle={inputStyle}
            />
            <TextAreaField
              label="Motivo"
              value={blockForm.reason ?? ""}
              onChange={(value) =>
                setBlockForm((current) => ({ ...current, reason: value }))
              }
              inputStyle={inputStyle}
            />
            <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button type="button" onClick={closeBlockForm} style={buttonStyle}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  ...buttonStyle,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))"
                }}
              >
                {isPending ? "Salvando..." : "Salvar bloqueio"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section style={panelStyle}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Agenda profissional</h2>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Atendimentos, bloqueios, status e capacidade por profissional.
          </p>
        </div>

        <div style={{ display: "grid", gap: viewMode === "month" ? "10px" : "14px" }}>
          {days.map((day) => {
            const dayAppointments = visibleAppointments.filter(
              (appointment) => appointment.appointment_date === day
            );
            const dayBlocks = visibleBlocks.filter((block) => block.block_date === day);

            return (
              <section
                key={day}
                style={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  display: "grid",
                  gap: "12px",
                  padding: "14px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <strong>{formatDate(day)}</strong>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    {dayAppointments.length} atendimento(s)
                  </span>
                </div>

                {dayBlocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    canDelete={canDelete}
                    buttonStyle={buttonStyle}
                    onDelete={() => removeBlock(block)}
                  />
                ))}

                {dayAppointments.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      gridTemplateColumns:
                        viewMode === "day"
                          ? "repeat(auto-fit, minmax(300px, 1fr))"
                          : "repeat(auto-fit, minmax(240px, 1fr))"
                    }}
                  >
                    {dayAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        isPending={isPending}
                        buttonStyle={buttonStyle}
                        onStatus={(status) => changeStatus(appointment, status)}
                        onEdit={() => openEditAppointment(appointment)}
                        onReschedule={() => openRescheduleAppointment(appointment)}
                        onDelete={() => removeAppointment(appointment)}
                      />
                    ))}
                  </div>
                ) : dayBlocks.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--muted-foreground))",
                      padding: "18px",
                      textAlign: "center"
                    }}
                  >
                    Nenhum atendimento ou bloqueio neste dia.
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AppointmentCard({
  appointment,
  canEdit,
  canDelete,
  isPending,
  buttonStyle,
  onStatus,
  onEdit,
  onReschedule,
  onDelete
}: {
  appointment: Appointment;
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  buttonStyle: React.CSSProperties;
  onStatus: (status: AppointmentStatus) => void;
  onEdit: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  const status = normalizeStatus(appointment.status);
  const statusStyle = statusStyles[status];
  const sessionsContracted = appointment.sessions_contracted ?? 1;
  const sessionsCompleted = appointment.sessions_completed ?? 0;
  const sessionsRemaining = Math.max(sessionsContracted - sessionsCompleted, 0);
  const occupied = appointment.patient_ids.length || 1;
  const capacity = appointment.participant_limit ?? occupied;

  return (
    <article
      style={{
        border: `1px solid ${statusStyle.color}`,
        borderLeft: `6px solid ${statusStyle.color}`,
        borderRadius: "8px",
        display: "grid",
        gap: "12px",
        padding: "14px"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <strong style={{ fontSize: "18px" }}>
            {appointment.start_time.slice(0, 5)}
            {appointment.end_time ? ` - ${appointment.end_time.slice(0, 5)}` : ""}
          </strong>
          <p>{appointment.service_name}</p>
        </div>
        <span
          style={{
            background: statusStyle.bg,
            borderRadius: "999px",
            color: statusStyle.color,
            fontSize: "12px",
            fontWeight: 700,
            padding: "6px 10px"
          }}
        >
          {statusStyle.label}
        </span>
      </div>

      <div style={{ display: "grid", gap: "6px" }}>
        <Info label="Paciente" value={appointment.patient_names.join(", ")} />
        <Info label="Profissional" value={appointment.employee_name} />
        <Info
          label="Tipo"
          value={appointment.service_is_group ? "Grupo" : "Individual"}
        />
        {appointment.service_is_group ? (
          <Info label="Vagas" value={`${occupied}/${capacity} ocupadas`} />
        ) : null}
      </div>

      <div
        style={{
          background: "hsl(var(--muted))",
          borderRadius: "8px",
          display: "grid",
          gap: "8px",
          gridTemplateColumns: "repeat(3, 1fr)",
          padding: "10px",
          textAlign: "center"
        }}
      >
        <SessionCounter label="Contratadas" value={sessionsContracted} />
        <SessionCounter label="Realizadas" value={sessionsCompleted} />
        <SessionCounter label="Restantes" value={sessionsRemaining} />
      </div>

      {appointment.notes ? (
        <p style={{ color: "hsl(var(--muted-foreground))" }}>{appointment.notes}</p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {canEdit && status !== "confirmado" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onStatus("confirmado")}
            style={buttonStyle}
          >
            Confirmar
          </button>
        ) : null}
        {canEdit && status !== "realizado" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onStatus("realizado")}
            style={buttonStyle}
          >
            Realizado
          </button>
        ) : null}
        {canEdit && status !== "faltou" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onStatus("faltou")}
            style={buttonStyle}
          >
            Faltou
          </button>
        ) : null}
        {canEdit ? (
          <>
            <button type="button" onClick={onReschedule} style={buttonStyle}>
              Reagendar
            </button>
            <button type="button" onClick={onEdit} style={buttonStyle}>
              Editar
            </button>
          </>
        ) : null}
        {canDelete ? (
          <button type="button" onClick={onDelete} style={buttonStyle}>
            Excluir
          </button>
        ) : null}
      </div>
    </article>
  );
}

function BlockCard({
  block,
  canDelete,
  buttonStyle,
  onDelete
}: {
  block: ScheduleBlock;
  canDelete: boolean;
  buttonStyle: React.CSSProperties;
  onDelete: () => void;
}) {
  const timeLabel =
    block.block_type === "dia_inteiro"
      ? "Dia inteiro"
      : `${block.start_time?.slice(0, 5) ?? "--:--"}${
          block.end_time ? ` - ${block.end_time.slice(0, 5)}` : ""
        }`;

  return (
    <article
      style={{
        background: "#fef3c7",
        border: "1px solid #d97706",
        borderLeft: "6px solid #d97706",
        borderRadius: "8px",
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        justifyContent: "space-between",
        padding: "12px"
      }}
    >
      <div>
        <strong>Bloqueio - {timeLabel}</strong>
        <p style={{ color: "#92400e" }}>
          {block.employee_name} {block.reason ? `- ${block.reason}` : ""}
        </p>
      </div>
      {canDelete ? (
        <button type="button" onClick={onDelete} style={buttonStyle}>
          Excluir bloqueio
        </button>
      ) : null}
    </article>
  );
}

function Counter({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
      <strong style={{ fontSize: "24px" }}>{value}</strong>
      <p>{title}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}: </span>
      <strong>{value}</strong>
    </p>
  );
}

function SessionCounter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
        {label}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputStyle,
  type = "text",
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputStyle: React.CSSProperties;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  inputStyle
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputStyle: React.CSSProperties;
}) {
  return (
    <label style={{ gridColumn: "1 / -1" }}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        style={inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  inputStyle,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  inputStyle: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      >
        <option value="">Selecione</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelectField({
  label,
  value,
  onChange,
  options,
  inputStyle,
  helper
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: Array<[string, string]>;
  inputStyle: React.CSSProperties;
  helper: string;
}) {
  return (
    <label>
      {label}
      <select
        multiple
        value={value}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions, (option) => option.value))
        }
        style={{ ...inputStyle, minHeight: "120px" }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <small style={{ color: "hsl(var(--muted-foreground))" }}>{helper}</small>
    </label>
  );
}
