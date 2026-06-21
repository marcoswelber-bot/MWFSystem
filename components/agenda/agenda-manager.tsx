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
  updateAppointment,
  type AgendaActionResult,
  type AppointmentFormInput,
  type AppointmentStatus,
  type ScheduleBlockFormInput
} from "@/app/(app)/agenda/actions";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"] & {
  patient_name: string;
  employee_name: string;
  service_name: string;
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAppointmentForm: AppointmentFormInput = {
  clinic_id: "",
  patient_id: "",
  employee_id: "",
  service_id: "",
  appointment_date: today(),
  start_time: "",
  end_time: "",
  notes: "",
  status: "agendado"
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
    employee_id: appointment.employee_id,
    service_id: appointment.service_id,
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time.slice(0, 5),
    end_time: appointment.end_time?.slice(0, 5) ?? "",
    notes: appointment.notes ?? "",
    status: appointment.status as AppointmentStatus
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
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

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
  const activeCount = appointments.filter(
    (item) => !["cancelado", "faltou"].includes(item.status)
  ).length;
  const performedCount = appointments.filter(
    (item) => item.status === "realizado"
  ).length;
  const blockCount = blocks.length;

  const visibleAppointments = appointments.filter((appointment) => {
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
  });

  const visibleBlocks = blocks.filter((block) => {
    if (viewMode === "day") {
      return block.block_date === selectedDate;
    }

    if (viewMode === "week") {
      const start = startOfWeek(new Date(`${selectedDate}T00:00:00`));
      const end = addDays(start, 6);
      return block.block_date >= toDateKey(start) && block.block_date <= toDateKey(end);
    }

    return block.block_date.startsWith(selectedDate.slice(0, 7));
  });

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

    startTransition(async () => {
      const result = editingAppointment
        ? await updateAppointment(editingAppointment.id, appointmentForm)
        : await createAppointment(appointmentForm);
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
        <Counter title="Atendimentos" value={activeCount} />
        <Counter title="Realizados" value={performedCount} />
        <Counter title="Bloqueios" value={blockCount} />
      </section>

      <section style={panelStyle}>
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
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            style={{ ...inputStyle, maxWidth: "180px" }}
          />
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
              label="Paciente"
              value={appointmentForm.patient_id}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, patient_id: value }))
              }
              options={patients.map((patient) => [patient.id, patient.full_name])}
              inputStyle={inputStyle}
              required
            />
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
            <SelectField
              label="Servico"
              value={appointmentForm.service_id}
              onChange={(value) =>
                setAppointmentForm((current) => ({ ...current, service_id: value }))
              }
              options={visibleServices.map((service) => [service.id, service.name])}
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
        <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Agendamentos</h2>
        <DataTable
          headers={["Data", "Hora", "Paciente", "Profissional", "Servico", "Status", "Acoes"]}
          rows={visibleAppointments.map((appointment) => [
            formatDate(appointment.appointment_date),
            appointment.start_time.slice(0, 5),
            appointment.patient_name,
            appointment.employee_name,
            appointment.service_name,
            appointment.status,
            <ActionGroup key={appointment.id}>
              {canEdit ? (
                <button type="button" onClick={() => openEditAppointment(appointment)} style={buttonStyle}>
                  Editar
                </button>
              ) : null}
              {canDelete ? (
                <button type="button" onClick={() => removeAppointment(appointment)} style={buttonStyle}>
                  Excluir
                </button>
              ) : null}
            </ActionGroup>
          ])}
          emptyText="Nenhum agendamento encontrado para a visualizacao selecionada."
        />
      </section>

      <section style={panelStyle}>
        <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Bloqueios</h2>
        <DataTable
          headers={["Data", "Tipo", "Inicio", "Fim", "Profissional", "Motivo", "Acoes"]}
          rows={visibleBlocks.map((block) => [
            formatDate(block.block_date),
            block.block_type,
            block.start_time?.slice(0, 5) ?? "-",
            block.end_time?.slice(0, 5) ?? "-",
            block.employee_name,
            block.reason ?? "-",
            canDelete ? (
              <button key={block.id} type="button" onClick={() => removeBlock(block)} style={buttonStyle}>
                Excluir
              </button>
            ) : (
              "-"
            )
          ])}
          emptyText="Nenhum bloqueio encontrado para a visualizacao selecionada."
        />
      </section>
    </div>
  );
}

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};

function Counter({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
      <strong style={{ fontSize: "24px" }}>{value}</strong>
      <p>{title}</p>
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

function ActionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" }}>
      {children}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyText
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  emptyText: string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {headers.map((heading) => (
              <th
                key={heading}
                style={{
                  borderBottom: "1px solid hsl(var(--border))",
                  padding: "10px",
                  textAlign: heading === "Acoes" ? "right" : "left"
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={{
                      borderBottom: "1px solid hsl(var(--border))",
                      padding: "10px",
                      textAlign: cellIndex === row.length - 1 ? "right" : "left"
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} style={{ padding: "16px", textAlign: "center" }}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
