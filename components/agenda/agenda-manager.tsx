"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  LockKeyhole,
  MoreHorizontal,
  MessageCircle,
  Plus,
  RotateCw,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Trash2,
  UserCheck,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PermissionSet } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import {
  createAppointment,
  createScheduleBlock,
  deleteScheduleBlock,
  finalizeAppointmentBilling,
  reopenAppointment,
  restoreAppointmentOperationalStatus,
  setAppointmentStatus,
  updateAppointment,
  type AgendaActionResult,
  type AppointmentBillingStatus,
  type AppointmentFormInput,
  type AppointmentOrigin,
  type AppointmentStatus,
  type AppointmentType,
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
type ViewMode = "day" | "week" | "month";
type PaymentMethod = "pix" | "dinheiro" | "cartao" | "boleto" | "parcelado" | "transferencia" | "outro";
type FinalizeBillingForm = { financial_status: AppointmentBillingStatus; payment_method: PaymentMethod; paid_amount: string; notes: string };
type VisualStatus =
  | AppointmentStatus
  | "em_andamento"
  | "reagendado";
type AppointmentActionKey = "details" | "confirm" | "finalize" | "absence" | "undo_absence" | "reschedule" | "cancel" | "restore_cancelled" | "edit" | "new_appointment" | "reopen" | "receive" | "receipt" | "record" | "patient" | "whatsapp";
type AppointmentActionContext = { canEdit: boolean; canAdminCorrect: boolean };
type SavedWhatsappConfirmation = {
  id: string;
  href: string;
  message: string;
  patientName: string;
  date: string;
  time: string;
  employeeName: string;
  serviceName: string;
};

type AgendaManagerProps = {
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  clinics: Clinic[];
  patients: Patient[];
  employees: Employee[];
  services: Service[];
  patientPackages: PatientPackage[];
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
  initialPatientId?: string | null;
  initialAppointmentId?: string | null;
  initialOpenNew?: boolean;
  canReopen?: boolean;
};

const calendarStartHour = 7;
const calendarEndHour = 21;
const hourHeight = 116;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const paymentMethodOptions: Array<[PaymentMethod, string]> = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartão"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"],
  ["transferencia", "Transferência"],
  ["outro", "Outro"]
];

const billingStatusOptions: Array<[AppointmentBillingStatus, string]> = [
  ["pago", "Pago"],
  ["em_aberto", "Em aberto"],
  ["parcial", "Parcial"],
  ["cortesia", "Cortesia"]
];

const statusOptions: Array<[AppointmentStatus, string]> = [
  ["agendado", "Agendada"],
  ["confirmado", "Confirmada"],
  ["realizado", "Realizada"],
  ["cancelado", "Cancelado"],
  ["faltou", "Faltou"]
];

const appointmentTypeOptions: Array<[AppointmentType, string]> = [
  ["avulso", "Avulso"],
  ["pacote", "Pacote"],
  ["grupo", "Grupo"],
  ["avaliacao", "Avaliaço"],
  ["retorno", "Retorno"],
  ["encaixe", "Encaixe"],
  ["cortesia", "Cortesia"],
  ["convenio", "Convênio"],
  ["particular", "Particular"],
  ["reposicao", "Reposiço"],
  ["experimental", "Experimental"],
  ["reposicao", "Reposiço"],
];

const appointmentOriginOptions: Array<[AppointmentOrigin, string]> = [
  ["pacote", "Pacote"],
  ["avulso", "Avulso"],
  ["grupo", "Grupo"],
  ["convenio", "Convênio"],
  ["cortesia", "Cortesia"],
  ["reposicao", "Reposiço"],
  ["avaliacao", "Avaliaço"],
  ["retorno", "Retorno"],
  ["encaixe", "Encaixe"],
  ["particular", "Particular"],
  ["experimental", "Experimental"],
  ["reposicao", "Reposiço"],
];

const appointmentTypeLabels = Object.fromEntries(appointmentTypeOptions) as Record<
  AppointmentType,
  string
>;

const appointmentOriginLabels = Object.fromEntries(appointmentOriginOptions) as Record<
  AppointmentOrigin,
  string
>;

const statusStyles: Record<
  VisualStatus,
  {
    label: string;
    chip: string;
    border: string;
    surface: string;
    text: string;
    dot: string;
  }
> = {
  agendado: {
    label: "Agendada",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    border: "border-slate-300 dark:border-slate-600",
    surface: "bg-slate-50 dark:bg-slate-900/70",
    text: "text-slate-900 dark:text-slate-50",
    dot: "bg-slate-400"
  },
  confirmado: {
    label: "Confirmada",
    chip: "bg-blue-100 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-800",
    border: "border-blue-500",
    surface: "bg-gradient-to-br from-blue-50 via-white to-blue-100/70 dark:from-blue-950/80 dark:via-slate-950 dark:to-blue-950/50",
    text: "text-blue-950 dark:text-blue-50",
    dot: "bg-blue-500"
  },
  em_andamento: {
    label: "Em andamento",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200",
    border: "border-orange-500",
    surface: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-950 dark:text-orange-50",
    dot: "bg-orange-500"
  },
  realizado: {
    label: "Realizada",
    chip: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800",
    border: "border-emerald-500",
    surface: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 dark:from-emerald-950/80 dark:via-slate-950 dark:to-emerald-950/50",
    text: "text-emerald-950 dark:text-emerald-50",
    dot: "bg-emerald-500"
  },
  faltou: {
    label: "Faltou",
    chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
    border: "border-red-500",
    surface: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-950 dark:text-red-50",
    dot: "bg-red-500"
  },
  reagendado: {
    label: "Reagendado",
    chip: "bg-orange-100 text-orange-800 ring-1 ring-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:ring-orange-800",
    border: "border-orange-500",
    surface: "bg-gradient-to-br from-orange-50 via-white to-orange-100/70 dark:from-orange-950/80 dark:via-slate-950 dark:to-orange-950/50",
    text: "text-orange-950 dark:text-orange-50",
    dot: "bg-orange-500"
  },
  cancelado: {
    label: "Cancelado",
    chip: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    border: "border-zinc-400",
    surface: "bg-zinc-50 dark:bg-zinc-900/70",
    text: "text-zinc-900 dark:text-zinc-50",
    dot: "bg-zinc-400"
  }
};

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
  sessions_completed: "0",
  appointment_type: "avulso",
  appointment_origin: "avulso",
  patient_package_id: "",
  original_appointment_id: ""
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

function today() {
  return new Date().toISOString().slice(0, 10);
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

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatShortDate(value: string) {
  return toDate(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short"
  });
}

function formatWeekday(value: string) {
  return toDate(value).toLocaleDateString("pt-BR", {
    weekday: "short"
  });
}

function fullDate(value: string) {
  return toDate(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function monthTitle(value: string) {
  return toDate(value).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

function getPeriodLabel(mode: ViewMode, selectedDate: string) {
  if (mode === "day") {
    return fullDate(selectedDate);
  }

  if (mode === "week") {
    const start = startOfWeek(toDate(selectedDate));
    return `${formatShortDate(toDateKey(start))} - ${formatShortDate(
      toDateKey(addDays(start, 6))
    )}`;
  }

  return monthTitle(selectedDate);
}

function normalizeStatus(status: string): AppointmentStatus {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "finalizado" || normalized === "finalizada") return "realizado";
  return statusOptions.some(([value]) => value === normalized)
    ? (normalized as AppointmentStatus)
    : "agendado";
}

function parseMinutes(value?: string | null) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function nowTimeValue() {
  return new Date().toTimeString().slice(0, 5);
}

function isPastDate(value: string) {
  return value < today();
}

function isSameOrFutureTime(value: string) {
  return value >= nowTimeValue();
}

function isTimeAfter(value?: string | null, other?: string | null) {
  return compareTime(value, other) > 0;
}

function timeSlotOptions() {
  const slots: Array<[string, string]> = [];

  for (let hour = calendarStartHour; hour <= calendarEndHour; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === calendarEndHour && minute > 0) {
        continue;
      }

      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      slots.push([value, value]);
    }
  }

  return slots;
}

function blockAppliesToEmployee(block: ScheduleBlock, employeeId?: string) {
  return !block.employee_id || (!!employeeId && block.employee_id === employeeId);
}

function compareTime(value?: string | null, other?: string | null) {
  return (value ?? "").slice(0, 5).localeCompare((other ?? "").slice(0, 5));
}

function timeIntervalsOverlap(
  startTime?: string | null,
  endTime?: string | null,
  otherStartTime?: string | null,
  otherEndTime?: string | null
) {
  const start = startTime?.slice(0, 5);
  const end = endTime?.slice(0, 5) || start;
  const otherStart = otherStartTime?.slice(0, 5);
  const otherEnd = otherEndTime?.slice(0, 5) || otherStart;

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

function isFullDayBlocked(
  date: string,
  blocks: ScheduleBlock[],
  employeeId?: string
) {
  return blocks.some(
    (block) =>
      block.block_date === date &&
      block.block_type === "dia_inteiro" &&
      blockAppliesToEmployee(block, employeeId)
  );
}

function isTimeBlocked(
  date: string,
  startTime: string,
  endTime: string | undefined,
  blocks: ScheduleBlock[],
  employeeId?: string
) {
  return blocks.some((block) => {
    if (block.block_date !== date || !blockAppliesToEmployee(block, employeeId)) {
      return false;
    }

    if (block.block_type === "dia_inteiro") {
      return true;
    }

    return timeIntervalsOverlap(
      startTime,
      endTime || startTime,
      block.start_time,
      block.end_time || block.start_time
    );
  });
}

function isInProgress(appointment: Appointment, now = new Date()) {
  if (appointment.appointment_date !== today()) {
    return false;
  }

  const status = normalizeStatus(appointment.status);
  if (status === "realizado" || status === "cancelado" || status === "faltou") {
    return false;
  }

  const start = parseMinutes(appointment.start_time);
  const end = parseMinutes(appointment.end_time) ?? (start === null ? null : start + 45);
  const current = now.getHours() * 60 + now.getMinutes();

  return start !== null && end !== null && current >= start && current < end;
}

function getVisualStatus(appointment: Appointment): VisualStatus {
  if (appointment.status === "reagendado") {
    return "reagendado";
  }

  if (isInProgress(appointment)) {
    return "em_andamento";
  }

  return normalizeStatus(appointment.status);
}

function getAppointmentAvailableActions(appointment: Appointment, context: AppointmentActionContext) {
  const actions = new Set<AppointmentActionKey>(["details", "patient", "whatsapp"]);
  const status = normalizeStatus(appointment.status);
  const inAttendance = getVisualStatus(appointment) === "em_andamento";
  if (status !== "cancelado") actions.add("record");
  if (context.canEdit && inAttendance) { actions.add("finalize"); return actions; }
  if (context.canEdit && status === "agendado") ["confirm", "finalize", "absence", "reschedule", "cancel", "edit"].forEach((a) => actions.add(a as AppointmentActionKey));
  else if (context.canEdit && status === "confirmado") ["finalize", "absence", "reschedule", "cancel", "edit"].forEach((a) => actions.add(a as AppointmentActionKey));
  else if (status === "realizado") {
    if (appointment.is_billable && appointment.finance_integration_status !== "completed") actions.add("receive");
    if (appointment.is_billable && appointment.finance_integration_status === "completed") actions.add("receipt");
    if (context.canAdminCorrect) actions.add("reopen");
  } else if (status === "faltou") {
    if (context.canAdminCorrect) actions.add("undo_absence");
    if (context.canEdit) actions.add("reschedule");
  } else if (status === "cancelado") {
    if (context.canAdminCorrect) actions.add("restore_cancelled");
    if (context.canEdit) actions.add("new_appointment");
  }
  return actions;
}

function getPrimaryAppointmentAction(actions: Set<AppointmentActionKey>) {
  return (["confirm", "finalize", "receive", "undo_absence", "restore_cancelled"] as AppointmentActionKey[]).find((action) => actions.has(action)) ?? null;
}
function getAppointmentType(appointment: Appointment): AppointmentType {
  return appointmentTypeOptions.some(([value]) => value === appointment.appointment_type)
    ? (appointment.appointment_type as AppointmentType)
    : "avulso";
}

function getAppointmentOrigin(appointment: Appointment): AppointmentOrigin {
  return appointmentOriginOptions.some(
    ([value]) => value === appointment.appointment_origin
  )
    ? (appointment.appointment_origin as AppointmentOrigin)
    : "avulso";
}

function isReplacementAppointment(appointment: Appointment) {
  return (
    getAppointmentType(appointment) === "reposicao" ||
    getAppointmentType(appointment) === "reposicao" ||
    getAppointmentOrigin(appointment) === "reposicao" ||
    getAppointmentOrigin(appointment) === "reposicao"
  );
}

function getStatusLabel(appointment: Appointment) {
  const status = normalizeStatus(appointment.status);
  const replacementLabels: Record<AppointmentStatus, string> = {
    agendado: "Agendada",
    confirmado: "Confirmada",
    realizado: "Realizada",
    faltou: "Faltou",
    cancelado: "Cancelada"
  };

  return isReplacementAppointment(appointment)
    ? replacementLabels[status]
    : statusStyles[getVisualStatus(appointment)].label;
}

function appointmentToForm(appointment: Appointment): AppointmentFormInput {
  return {
    clinic_id: appointment.clinic_id,
    patient_id: appointment.patient_id,
    patient_ids: appointment.patient_ids,
    employee_id: appointment.employee_id,
    service_id: appointment.service_id,
    appointment_date: appointment.appointment_date,
    start_time: formatTime(appointment.start_time),
    end_time: appointment.end_time ? formatTime(appointment.end_time) : "",
    notes: appointment.notes ?? "",
    status: normalizeStatus(appointment.status),
    sessions_contracted: String(appointment.sessions_contracted ?? 1),
    sessions_completed: String(appointment.sessions_completed ?? 0),
    appointment_type: getAppointmentType(appointment),
    appointment_origin: getAppointmentOrigin(appointment),
    patient_package_id: appointment.patient_package_id ?? "",
    original_appointment_id: appointment.original_appointment_id ?? ""
  };
}

function getDaysForMode(mode: ViewMode, selectedDate: string) {
  if (mode === "day") {
    return [selectedDate];
  }

  if (mode === "week") {
    const start = startOfWeek(toDate(selectedDate));
    return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(start, index)));
  }

  const [year, month] = selectedDate.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);
  const firstWeekday = firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1;
  const totalCells = Math.ceil((firstWeekday + lastDate.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) =>
    toDateKey(addDays(new Date(year, month - 1, 1 - firstWeekday), index))
  );
}

function shiftSelectedDate(selectedDate: string, mode: ViewMode, direction: -1 | 1) {
  const date = toDate(selectedDate);

  if (mode === "day") {
    return toDateKey(addDays(date, direction));
  }

  if (mode === "week") {
    return toDateKey(addDays(date, direction * 7));
  }

  date.setMonth(date.getMonth() + direction);
  return toDateKey(date);
}

function getCalendarPosition(startTime: string, endTime?: string | null) {
  const start = parseMinutes(startTime) ?? calendarStartHour * 60;
  const end = parseMinutes(endTime) ?? start + 45;
  const dayStart = calendarStartHour * 60;
  const dayEnd = calendarEndHour * 60;
  const top = Math.max(start - dayStart, 0) * (hourHeight / 60);
  const height = Math.max(Math.min(end, dayEnd) - Math.max(start, dayStart), 30) * (hourHeight / 60);

  return { top, height: Math.max(height, 58) };
}

function currentTimeTop() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes - calendarStartHour * 60) * (hourHeight / 60);
}

function getBlockTimeLabel(block: ScheduleBlock) {
  if (block.block_type === "dia_inteiro") {
    return "Dia inteiro";
  }

  if (block.block_type === "horario") {
    return formatTime(block.start_time);
  }

  return `${formatTime(block.start_time)} - ${formatTime(block.end_time)}`;
}

function getAppointmentMessage(
  result: AgendaActionResult,
  mode: "create" | "update" | "status" | "delete" | "block"
) {
  if (!result.ok) {
    return result;
  }

  const messages = {
    create: "Agendamento salvo com sucesso.",
    update: "Registro atualizado com sucesso.",
    status: "Registro atualizado com sucesso.",
    delete: "Registro excluído com sucesso.",
    block: "Horário bloqueado com sucesso.",
  };

  return { ok: true, message: messages[mode] };
}

function getBlockPosition(block: ScheduleBlock) {
  if (block.block_type === "dia_inteiro") {
    return {
      top: 8,
      height: (calendarEndHour - calendarStartHour) * hourHeight - 16
    };
  }

  return getCalendarPosition(
    block.start_time ?? `${calendarStartHour}:00`,
    block.end_time ?? block.start_time
  );
}

export function AgendaManager({
  appointments,
  blocks,
  clinics,
  patients,
  employees,
  services,
  patientPackages,
  currentClinicId,
  isAdmMaster,
  loadError,
  permissions,
  initialPatientId,
  initialAppointmentId,
  initialOpenNew,
  canReopen
}: AgendaManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [viewMode, setViewMode] = React.useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = React.useState(today());
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  const [serviceFilter, setServiceFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [pendingFilter, setPendingFilter] = React.useState("all");
  const [clinicFilter, setClinicFilter] = React.useState(currentClinicId ?? "all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = React.useState(false);
  const [blockFormOpen, setBlockFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] =
    React.useState<Appointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [appointmentForm, setAppointmentForm] =
    React.useState<AppointmentFormInput>(emptyAppointmentForm);
  const [blockForm, setBlockForm] =
    React.useState<ScheduleBlockFormInput>(emptyBlockForm);
  const [message, setMessage] = React.useState<AgendaActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );
  const [appointmentFormMessage, setAppointmentFormMessage] =
    React.useState<AgendaActionResult | null>(null);
  const [savedWhatsappConfirmations, setSavedWhatsappConfirmations] = React.useState<SavedWhatsappConfirmation[]>([]);
  const [finalizingAppointment, setFinalizingAppointment] = React.useState<Appointment | null>(null);
  const [finalizeMessage, setFinalizeMessage] = React.useState<AgendaActionResult | null>(null);
  const [reopeningAppointment, setReopeningAppointment] = React.useState<Appointment | null>(null);
  const [reopenReason, setReopenReason] = React.useState("");
  const [reopenMessage, setReopenMessage] = React.useState<AgendaActionResult | null>(null);
  const [statusCorrection, setStatusCorrection] = React.useState<{ appointment: Appointment; kind: "faltou" | "cancelado" } | null>(null);
  const [statusCorrectionReason, setStatusCorrectionReason] = React.useState("");
  const [statusCorrectionMessage, setStatusCorrectionMessage] = React.useState<AgendaActionResult | null>(null);
  const [finalizeForm, setFinalizeForm] = React.useState<FinalizeBillingForm>({
    financial_status: "em_aberto",
    payment_method: "pix",
    paid_amount: "0",
    notes: ""
  });

  const canCreate = isAdmMaster || (permissions?.create ?? true);
  const canEdit = isAdmMaster || (permissions?.edit ?? true);
  const canDelete = isAdmMaster || (permissions?.delete ?? true);
  const canAdminCorrect = Boolean(canReopen || isAdmMaster);
  const visibleServices = services.filter((service) => service.status === "active");
  const selectedService = services.find(
    (service) => service.id === appointmentForm.service_id
  );
  const visibleDays = React.useMemo(
    () => getDaysForMode(viewMode, selectedDate),
    [selectedDate, viewMode]
  );
  const visibleDaySet = React.useMemo(() => new Set(visibleDays), [visibleDays]);
  const scopedBlocks = React.useMemo(
    () =>
      blocks.filter((block) => clinicFilter === "all" || block.clinic_id === clinicFilter),
    [blocks, clinicFilter]
  );

  const filteredEmployees = React.useMemo(() => {
    const byClinic =
      clinicFilter === "all"
        ? employees
        : employees.filter((employee) => employee.clinic_id === clinicFilter);

    if (employeeFilter === "all") {
      return byClinic;
    }

    return byClinic.filter((employee) => employee.id === employeeFilter);
  }, [clinicFilter, employeeFilter, employees]);

  const calendarEmployees = filteredEmployees.length > 0 ? filteredEmployees : employees;
  const normalizedSearch = searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const visibleAppointments = appointments
    .filter((appointment) => {
      if (clinicFilter !== "all" && appointment.clinic_id !== clinicFilter) {
        return false;
      }

      if (employeeFilter !== "all" && appointment.employee_id !== employeeFilter) return false;
      if (serviceFilter !== "all" && appointment.service_id !== serviceFilter) return false;
      if (statusFilter !== "all" && normalizeStatus(appointment.status) !== statusFilter) return false;
      if (typeFilter !== "all" && getAppointmentType(appointment) !== typeFilter) return false;
      if (groupFilter === "group" && !appointment.service_is_group && getAppointmentType(appointment) !== "grupo") return false;
      if (groupFilter === "individual" && (appointment.service_is_group || getAppointmentType(appointment) === "grupo")) return false;
      if (pendingFilter === "pending" && appointment.finance_integration_status === "completed") return false;
      if (pendingFilter === "unsettled" && !(normalizeStatus(appointment.status) === "realizado" && appointment.finance_integration_status !== "completed")) return false;
      if (normalizedSearch) {
        const searchablePatients = appointment.patient_ids.map((patientId) => patients.find((patient) => patient.id === patientId)).filter(Boolean);
        const searchableText = [appointment.patient_names.join(" "), appointment.service_name, appointment.employee_name, ...searchablePatients.flatMap((patient) => [patient?.phone, patient?.cpf])].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!searchableText.includes(normalizedSearch)) return false;
      }

      return visibleDaySet.has(appointment.appointment_date);
    })
    .sort((a, b) =>
      `${a.appointment_date} ${a.start_time}`.localeCompare(
        `${b.appointment_date} ${b.start_time}`
      )
    );

  const visibleBlocks = scopedBlocks
    .filter((block) => {
      if (
        employeeFilter !== "all" &&
        block.employee_id &&
        block.employee_id !== employeeFilter
      ) {
        return false;
      }

      return visibleDaySet.has(block.block_date);
    })
    .sort((a, b) =>
      `${a.block_date} ${a.start_time ?? "00:00"}`.localeCompare(
        `${b.block_date} ${b.start_time ?? "00:00"}`
      )
    );

  const dayAppointments = visibleAppointments.filter(
    (appointment) => appointment.appointment_date === selectedDate
  );
  const dayBlocks = visibleBlocks.filter((block) => block.block_date === selectedDate);
  const completedToday = dayAppointments.filter(
    (appointment) => normalizeStatus(appointment.status) === "realizado"
  ).length;
  const inProgressToday = dayAppointments.filter((appointment) =>
    isInProgress(appointment)
  ).length;
  const nextAppointment = appointments
    .filter((appointment) => {
      const status = normalizeStatus(appointment.status);
      const appointmentDateTime = new Date(`${appointment.appointment_date}T${formatTime(appointment.start_time)}:00`);
      return (status === "agendado" || status === "confirmado")
        && appointmentDateTime >= new Date()
        && (clinicFilter === "all" || appointment.clinic_id === clinicFilter)
        && (employeeFilter === "all" || appointment.employee_id === employeeFilter)
        && (serviceFilter === "all" || appointment.service_id === serviceFilter);
    })
    .sort((a, b) => `${a.appointment_date} ${a.start_time}`.localeCompare(`${b.appointment_date} ${b.start_time}`))[0];

  function selectAgendaDate(date: string) {
    if (isPastDate(date) || isFullDayBlocked(date, scopedBlocks)) {
      setMessage({ ok: false, message: "Data bloqueada para agendamento" });
      return false;
    }

    setSelectedDate(date);
    return true;
  }

  function refresh() {
    router.refresh();
  }

  function openCreateAppointment(date = selectedDate, employeeId = "", startTime = "") {
    if (isPastDate(date) || isFullDayBlocked(date, scopedBlocks, employeeId)) {
      setMessage({ ok: false, message: "Data bloqueada para agendamento" });
      return;
    }

    setEditingAppointment(null);
    setAppointmentForm({
      ...emptyAppointmentForm,
      clinic_id: clinicFilter !== "all" ? clinicFilter : currentClinicId ?? "",
      employee_id: employeeId,
      appointment_date: date,
      start_time: startTime
    });
    setMessage(null);
    setAppointmentFormMessage(null);
    setAppointmentFormOpen(true);
  }

  function openEditAppointment(appointment: Appointment) {
    setEditingAppointment(appointment);
    setAppointmentForm(appointmentToForm(appointment));
    setMessage(null);
    setAppointmentFormMessage(null);
    setAppointmentFormOpen(true);
  }

  React.useEffect(() => {
    const selected = initialAppointmentId ? appointments.find((item) => item.id === initialAppointmentId) : null;
    if (selected) {
      setSelectedAppointment(selected);
    } else if (initialOpenNew && initialPatientId) {
      setEditingAppointment(null);
      setAppointmentForm((current) => ({ ...current, patient_id: initialPatientId, patient_ids: [initialPatientId], clinic_id: currentClinicId ?? "" }));
      setAppointmentFormOpen(true);
    }
  }, [initialAppointmentId, initialOpenNew, initialPatientId, appointments, currentClinicId]);

  React.useEffect(() => {
    setSelectedAppointment((current) => {
      if (!current) return current;
      return appointments.find((appointment) => appointment.id === current.id) ?? null;
    });
  }, [appointments]);
  function openRescheduleAppointment(appointment: Appointment) {
    openEditAppointment(appointment);
    setMessage({ ok: true, message: "Ajuste data e horário para reagendar." });
  }

  function closeAppointmentForm() {
    setEditingAppointment(null);
    setAppointmentForm(emptyAppointmentForm);
    setAppointmentFormMessage(null);
    setAppointmentFormOpen(false);
  }

  function openBlockForm(date = selectedDate, employeeId = "") {
    setBlockForm({
      ...emptyBlockForm,
      clinic_id: clinicFilter !== "all" ? clinicFilter : currentClinicId ?? "",
      employee_id: employeeId,
      block_date: date
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
    setAppointmentFormMessage(null);

    const isGroupAppointment =
      appointmentForm.appointment_type === "grupo" || Boolean(selectedService?.is_group);
    const patientIds = isGroupAppointment
      ? appointmentForm.patient_ids ?? []
      : [appointmentForm.patient_id].filter(Boolean);

    if (
      isPastDate(appointmentForm.appointment_date) ||
      isFullDayBlocked(
        appointmentForm.appointment_date,
        scopedBlocks,
        appointmentForm.employee_id
      ) ||
      isTimeBlocked(
        appointmentForm.appointment_date,
        appointmentForm.start_time,
        appointmentForm.end_time,
        scopedBlocks,
        appointmentForm.employee_id
      ) ||
      (!!appointmentForm.end_time &&
        !isTimeAfter(appointmentForm.end_time, appointmentForm.start_time))
    ) {
      setAppointmentFormMessage({
        ok: false,
        message: "Não foi possível salvar: data ou horário bloqueado.",
      });
      return;
    }

    const appointmentType = appointmentForm.appointment_type ?? "avulso";
    const appointmentPayload = {
      ...appointmentForm,
      appointment_origin: appointmentType,
      patient_id: patientIds[0] ?? "",
      patient_ids: patientIds
    };

    startTransition(async () => {
      const result = editingAppointment
        ? await updateAppointment(editingAppointment.id, appointmentPayload)
        : await createAppointment(appointmentPayload);

      if (result.ok) {
        setMessage(
          getAppointmentMessage(result, editingAppointment ? "update" : "create")
        );
        const savedPatient = patients.find((item) => item.id === patientIds[0]);
        const savedEmployee = employees.find((item) => item.id === appointmentPayload.employee_id);
        const savedService = services.find((item) => item.id === appointmentPayload.service_id);
        const savedClinic = clinics.find((item) => item.id === appointmentPayload.clinic_id);
        const savedPhone = (savedPatient?.phone ?? "").replace(/\D/g, "");
        const savedLines = [editingAppointment ? "Seu atendimento foi reagendado." : "Seu atendimento foi agendado com sucesso.", "", "Data: " + appointmentPayload.appointment_date, "Horário: " + appointmentPayload.start_time, "Profissional: " + (savedEmployee?.name ?? "Profissional"), "Serviço: " + (savedService?.name ?? "Serviço"), "Clínica: " + (savedClinic?.name ?? "Clínica")];
        const confirmation: SavedWhatsappConfirmation = {
          id: `${Date.now()}-${patientIds[0]}`,
          href: savedPhone ? "https://wa.me/" + (savedPhone.startsWith("55") ? savedPhone : "55" + savedPhone) : "",
          message: "Ola, " + (savedPatient?.full_name ?? "paciente") + "." + String.fromCharCode(10) + String.fromCharCode(10) + savedLines.join(String.fromCharCode(10)),
          patientName: savedPatient?.full_name ?? "Paciente",
          date: formatShortDate(appointmentPayload.appointment_date),
          time: formatTime(appointmentPayload.start_time),
          employeeName: savedEmployee?.name ?? "Profissional",
          serviceName: savedService?.name ?? "Serviço"
        };
        setSavedWhatsappConfirmations((current) => [...current, confirmation]);
        closeAppointmentForm();
        refresh();
      } else {
        setAppointmentFormMessage({
          ok: false,
          message: `Não foi possível salvar o agendamento.`,
        });
      }
    });
  }

  function submitBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createScheduleBlock(blockForm);
      setMessage(getAppointmentMessage(result, "block"));

      if (result.ok) {
        closeBlockForm();
        refresh();
      }
    });
  }

  function getServiceValue(serviceId: string) {
    const service = services.find((item) => item.id === serviceId) as (Service & { price?: number | null; promotional_price?: number | null }) | undefined;
    return Number(service?.default_price ?? service?.price ?? service?.promotional_price ?? 0);
  }

  function openFinalizeAppointment(appointment: Appointment) {
    const value = getServiceValue(appointment.service_id);
    setFinalizingAppointment(appointment);
    setFinalizeMessage(null);
    setFinalizeForm({
      financial_status: "em_aberto",
      payment_method: "pix",
      paid_amount: value > 0 ? String(value) : "0",
      notes: ""
    });
    setMessage(null);
  }

  function closeFinalizeAppointment() {
    setFinalizingAppointment(null);
    setFinalizeMessage(null);
    setFinalizeForm({ financial_status: "em_aberto", payment_method: "pix", paid_amount: "0", notes: "" });
  }

  function submitFinalizeAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finalizingAppointment) return;

    startTransition(async () => {
      const result = await finalizeAppointmentBilling({
        appointment_id: finalizingAppointment.id,
        financial_status: finalizeForm.financial_status,
        payment_method: finalizeForm.payment_method,
        paid_amount: finalizeForm.paid_amount,
        notes: finalizeForm.notes
      });
      if (result.ok) {
        setMessage(getAppointmentMessage(result, "status"));
        closeFinalizeAppointment();
        refresh();
      } else {
        setFinalizeMessage(result);
      }
    });
  }

  function openReopenAppointment(appointment: Appointment) {
    setSelectedAppointment(null);
    setReopeningAppointment(appointment);
    setReopenReason("");
    setReopenMessage(null);
  }

  function closeReopenAppointment() {
    if (isPending) return;
    setReopeningAppointment(null);
    setReopenReason("");
    setReopenMessage(null);
  }

  function submitReopenAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reopeningAppointment || !reopenReason.trim() || isPending) return;

    startTransition(async () => {
      const result = await reopenAppointment(reopeningAppointment.id, reopenReason.trim());
      if (!result.ok) {
        setReopenMessage(result);
        return;
      }

      setMessage(result);
      setReopeningAppointment(null);
      setReopenReason("");
      setReopenMessage(null);
      refresh();
    });
  }
  function openStatusCorrection(appointment: Appointment, kind: "faltou" | "cancelado") {
    setSelectedAppointment(null);
    setStatusCorrection({ appointment, kind });
    setStatusCorrectionReason("");
    setStatusCorrectionMessage(null);
  }

  function closeStatusCorrection() {
    if (isPending) return;
    setStatusCorrection(null);
    setStatusCorrectionReason("");
    setStatusCorrectionMessage(null);
  }

  function submitStatusCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusCorrection || !statusCorrectionReason.trim() || isPending) return;
    startTransition(async () => {
      const result = await restoreAppointmentOperationalStatus(statusCorrection.appointment.id, statusCorrection.kind, statusCorrectionReason.trim());
      if (!result.ok) { setStatusCorrectionMessage(result); return; }
      setMessage(result);
      setStatusCorrection(null);
      setStatusCorrectionReason("");
      setStatusCorrectionMessage(null);
      refresh();
    });
  }
  function changeStatus(appointment: Appointment, status: AppointmentStatus) {
    if (status === "cancelado" && !window.confirm(`Cancelar o atendimento de ${appointment.patient_name}?`)) {
      return;
    }
    const observation = status === "cancelado" || status === "faltou" ? window.prompt(status === "cancelado" ? "Informe o motivo do cancelamento:" : "Observaço da falta:") : undefined;
    if ((status === "cancelado" || status === "faltou") && observation === null) return;
    startTransition(async () => {
      const result = await setAppointmentStatus(appointment.id, status, observation ?? undefined);
      setMessage(getAppointmentMessage(result, "status"));
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
      setMessage(getAppointmentMessage(result, "delete"));
      if (result.ok) {
        refresh();
      }
    });
  }

  return (
    <div className="agenda-workspace grid gap-4 scroll-smooth">
      {message ? (
        <SystemMessage message={message} onClose={() => setMessage(null)} />
      ) : null}
      {savedWhatsappConfirmations.length > 0 ? (
        <div className="grid gap-2">
          {savedWhatsappConfirmations.map((confirmation) => (
            <Card key={confirmation.id} className="flex flex-col gap-3 border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">Agendamento salvo. Deseja enviar a confirmação?</p>
                <p className="mt-1"><strong>Paciente:</strong> {confirmation.patientName}</p>
                <p>{confirmation.date} as {confirmation.time}</p>
                <p className="truncate"><strong>Profissional:</strong> {confirmation.employeeName} <span className="mx-1 text-emerald-600/60">|</span> <strong>Serviço:</strong> {confirmation.serviceName}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" size="sm" disabled={!confirmation.href} onClick={() => window.open(confirmation.href + "?text=" + encodeURIComponent(confirmation.message), "_blank", "noopener,noreferrer")}><MessageCircle className="h-4 w-4" />Enviar WhatsApp</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSavedWhatsappConfirmations((current) => current.filter((item) => item.id !== confirmation.id))}>Fechar</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 p-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30">
          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <>
                <Button type="button" onClick={() => openCreateAppointment()}>
                  <CalendarPlus className="h-4 w-4" />
                  Novo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openBlockForm()}
                >
                  <LockKeyhole className="h-4 w-4" />
                  Bloquear
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Periodo anterior"
              onClick={() =>
                selectAgendaDate(shiftSelectedDate(selectedDate, viewMode, -1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Próximo período"
              onClick={() =>
                selectAgendaDate(shiftSelectedDate(selectedDate, viewMode, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => selectAgendaDate(today())}
            >
              Hoje
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(150px,.7fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(230px,1.3fr)_auto] xl:items-end">
          <FieldShell label="Data">
            <input
              type="date"
              value={selectedDate}
              min={today()}
              onChange={(event) => selectAgendaDate(event.target.value)}
              className="agenda-input"
            />
          </FieldShell>
          <FieldShell label="Profissional">
            <select
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
              className="agenda-input"
            >
              <option value="all">Todos os profissionais</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="Clínica">
            <select
              value={clinicFilter}
              onChange={(event) => setClinicFilter(event.target.value)}
              disabled={!isAdmMaster}
              className="agenda-input disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAdmMaster ? <option value="all">Todas as clínicas</option> : null}
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="Pesquisa">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="agenda-input pl-9" placeholder="Paciente, telefone, CPF ou Serviço" />
            </div>
          </FieldShell>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5 shadow-inner dark:border-slate-800 dark:bg-slate-900/80">
            {[
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setViewMode(value as ViewMode)}
                className={cn(
                  "h-10 rounded-lg px-3 text-sm font-semibold transition-all duration-200",
                  viewMode === value
                    ? "bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(37,99,235,0.28)]"
                    : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm dark:hover:bg-slate-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 border-t border-slate-200/70 bg-slate-50/50 p-4 sm:grid-cols-[minmax(180px,280px)_auto] sm:items-end dark:border-slate-800 dark:bg-slate-900/30">
          <FieldShell label="Status"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="agenda-input"><option value="all">Todos os status</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FieldShell>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMoreFiltersOpen((open) => !open)} aria-expanded={moreFiltersOpen}><SlidersHorizontal className="h-4 w-4" />Mais filtros</Button>
        </div>
        {moreFiltersOpen ? <div className="grid gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldShell label="Serviço"><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="agenda-input"><option value="all">Todos</option>{visibleServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></FieldShell>
          <FieldShell label="Tipo"><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="agenda-input"><option value="all">Todos</option>{appointmentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FieldShell>
          <FieldShell label="Formato"><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="agenda-input"><option value="all">Todos</option><option value="individual">Individual</option><option value="group">Coletivo</option></select></FieldShell>
          <FieldShell label="Pendencia"><select value={pendingFilter} onChange={(event) => setPendingFilter(event.target.value)} className="agenda-input"><option value="all">Todas</option><option value="pending">Com pendencia</option><option value="unsettled">Sem baixa</option></select></FieldShell>
        </div> : null}
      </Card>

      <section className="hidden gap-3 lg:grid lg:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          label="Atendimentos do dia"
          value={dayAppointments.length}
          detail={fullDate(selectedDate)}
        />
        <MetricCard
          icon={Check}
          label="Realizados"
          value={completedToday}
          detail="Status finalizado"
        />
        <MetricCard
          icon={Clock}
          label="Em andamento"
          value={inProgressToday}
          detail="Agora"
        />
        <MetricCard
          icon={Ban}
          label="Bloqueios"
          value={dayBlocks.length}
          detail="Dia selecionado"
        />
      </section>

      <div className="grid items-start gap-4 scroll-smooth xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <Card className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-5 text-white dark:border-slate-800">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                {getPeriodLabel(viewMode, selectedDate)}
              </h2>
              <p className="text-sm text-slate-300">
                Grade operacional por horários e profissionais
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-200 shadow-inner backdrop-blur">
              <MoreHorizontal className="h-4 w-4" />
              Pronto para arrastar e soltar
            </div>
          </div>

          {viewMode === "month" ? (
            <MonthGrid
              selectedDate={selectedDate}
              days={visibleDays}
              appointments={visibleAppointments}
              blocks={visibleBlocks}
              onOpenAppointment={setSelectedAppointment}
              onSelectDate={(date) => {
                if (selectAgendaDate(date)) {
                  setViewMode("day");
                }
              }}
            />
          ) : (
            <div className="max-h-[calc(100vh-190px)] min-h-[720px] scroll-smooth overflow-auto bg-gradient-to-br from-slate-100/90 via-white to-blue-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20">
              <div className="grid gap-5 p-4 sm:p-5">
                {visibleDays.map((day) => (
                  <DayTimeline
                    key={day}
                    day={day}
                    employees={calendarEmployees}
                    appointments={visibleAppointments.filter(
                      (appointment) => appointment.appointment_date === day
                    )}
                    blocks={visibleBlocks.filter((block) => block.block_date === day)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canAdminCorrect={canAdminCorrect}
                    isPending={isPending}
                    onCreateAppointment={openCreateAppointment}
                    onCreateBlock={openBlockForm}
                    onStatus={changeStatus}
                    onFinalize={openFinalizeAppointment}
                    onEdit={setSelectedAppointment}
                    onDeleteBlock={removeBlock}
                    onUndoAbsence={(appointment) => openStatusCorrection(appointment, "faltou")}
                    onRestoreCancelled={(appointment) => openStatusCorrection(appointment, "cancelado")}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>

        <aside className="hidden gap-4 self-start xl:sticky xl:top-[72px] xl:grid">
          <MiniMonthCalendar
            selectedDate={selectedDate}
            blocks={scopedBlocks}
            onSelectDate={selectAgendaDate}
          />
          <SidePanel
            selectedDate={selectedDate}
            nextAppointment={nextAppointment}
            dayAppointments={dayAppointments}
            dayBlocks={dayBlocks}
            canEdit={canEdit}
            canAdminCorrect={canAdminCorrect}
            isPending={isPending}
            onOpen={setSelectedAppointment}
            onFinalize={openFinalizeAppointment}
            onStatus={changeStatus}
            onUndoAbsence={(appointment) => openStatusCorrection(appointment, "faltou")}
            onRestoreCancelled={(appointment) => openStatusCorrection(appointment, "cancelado")}
          />
        </aside>
      </div>

      {appointmentFormOpen ? (
        <AppointmentFormModal
          editingAppointment={editingAppointment}
          form={appointmentForm}
          setForm={setAppointmentForm}
          appointments={appointments}
          clinics={clinics}
          patients={patients}
          employees={employees}
          services={visibleServices}
          patientPackages={patientPackages}
          blocks={scopedBlocks}
          selectedService={selectedService}
          formMessage={appointmentFormMessage}
          isAdmMaster={isAdmMaster}
          isPending={isPending}
          onSubmit={submitAppointment}
          onClose={closeAppointmentForm}
        />
      ) : null}

      {selectedAppointment ? (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          patients={patients}
          clinics={clinics}
          patientPackages={patientPackages}
          canEdit={canEdit}
          isPending={isPending}
          onClose={() => setSelectedAppointment(null)}
          onEdit={() => { setSelectedAppointment(null); openEditAppointment(selectedAppointment); }}
          onReschedule={() => { setSelectedAppointment(null); openRescheduleAppointment(selectedAppointment); }}
          onStatus={(status) => changeStatus(selectedAppointment, status)}
          onFinalize={() => { setSelectedAppointment(null); openFinalizeAppointment(selectedAppointment); }}
          canReopen={Boolean(canReopen || isAdmMaster)}
          onReopen={() => openReopenAppointment(selectedAppointment)}
          onUndoAbsence={() => openStatusCorrection(selectedAppointment, "faltou")}
          onRestoreCancelled={() => openStatusCorrection(selectedAppointment, "cancelado")}
          onCreateNew={() => { const appointment = selectedAppointment; setSelectedAppointment(null); openCreateAppointment(appointment.appointment_date); setAppointmentForm((current) => ({ ...current, patient_id: appointment.patient_id, patient_ids: appointment.patient_ids })); }}
          onNavigate={(href) => router.push(href as never)}
        />
      ) : null}

      {reopeningAppointment ? (
        <ReopenAppointmentModal
          appointment={reopeningAppointment}
          reason={reopenReason}
          setReason={setReopenReason}
          message={reopenMessage}
          isPending={isPending}
          onSubmit={submitReopenAppointment}
          onClose={closeReopenAppointment}
        />
      ) : null}
      {statusCorrection ? (
        <StatusCorrectionModal appointment={statusCorrection.appointment} kind={statusCorrection.kind} reason={statusCorrectionReason} setReason={setStatusCorrectionReason} message={statusCorrectionMessage} isPending={isPending} onSubmit={submitStatusCorrection} onClose={closeStatusCorrection} />
      ) : null}
      {finalizingAppointment ? (
        <FinalizeAppointmentModal
          appointment={finalizingAppointment}
          serviceValue={getServiceValue(finalizingAppointment.service_id)}
          form={finalizeForm}
          setForm={setFinalizeForm}
          message={finalizeMessage}
          isPending={isPending}
          onSubmit={submitFinalizeAppointment}
          onClose={closeFinalizeAppointment}
        />
      ) : null}

      {blockFormOpen ? (
        <BlockFormModal
          form={blockForm}
          setForm={setBlockForm}
          clinics={clinics}
          employees={employees}
          isAdmMaster={isAdmMaster}
          isPending={isPending}
          onSubmit={submitBlock}
          onClose={closeBlockForm}
        />
      ) : null}
    </div>
  );
}

function SystemMessage({
  message,
  onClose
}: {
  message: AgendaActionResult;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-sm",
        message.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      )}
    >
      <span>{message.message}</span>
      <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-black/5">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-3xl font-semibold tracking-normal">
            {value}
          </strong>
          <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
        </div>
        <span className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

function DayTimeline({
  day,
  employees,
  appointments,
  blocks,
  canEdit,
  canDelete,
  canAdminCorrect,
  isPending,
  onCreateAppointment,
  onCreateBlock,
  onStatus,
  onFinalize,
  onEdit,
  onDeleteBlock,
  onUndoAbsence,
  onRestoreCancelled
}: {
  day: string;
  employees: Employee[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  canEdit: boolean;
  canDelete: boolean;
  canAdminCorrect: boolean;
  isPending: boolean;
  onCreateAppointment: (date?: string, employeeId?: string, startTime?: string) => void;
  onCreateBlock: (date?: string, employeeId?: string) => void;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onFinalize: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onDeleteBlock: (block: ScheduleBlock) => void;
  onUndoAbsence: (appointment: Appointment) => void;
  onRestoreCancelled: (appointment: Appointment) => void;
}) {
  const hours = Array.from(
    { length: calendarEndHour - calendarStartHour + 1 },
    (_, index) => calendarStartHour + index
  );
  const gridHeight = (calendarEndHour - calendarStartHour) * hourHeight;
  const showNow = day === today();
  const nowTop = currentTimeTop();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="grid gap-3 p-3 md:hidden">
        <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-gradient-to-r from-slate-50 to-blue-50 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-blue-950/40">
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{formatWeekday(day)}</p>
            <strong className="text-sm">{formatShortDate(day)}</strong>
          </div>
          <Button type="button" size="sm" onClick={() => onCreateAppointment(day)}>
            <Plus className="h-4 w-4" /><span>Novo horario</span>
          </Button>
        </div>
        {appointments.length ? (
          <div className="grid gap-2">
            {appointments.map((appointment) => {
              const appointmentStyle = statusStyles[getVisualStatus(appointment)];
              return (
                <article key={appointment.id} role="button" tabIndex={0} onClick={() => onEdit(appointment)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(appointment); }} className={cn("cursor-pointer rounded-xl border border-slate-200/70 border-l-4 p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.14)] dark:border-slate-800", appointmentStyle.border, appointmentStyle.surface)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{formatTime(appointment.start_time)}{appointment.end_time ? ` - ${formatTime(appointment.end_time)}` : ""}</p>
                      <h3 className="truncate text-sm font-semibold">{appointment.patient_names.join(", ")}</h3>
                      <p className="truncate text-xs text-muted-foreground">{appointment.service_name}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", appointmentStyle.chip)}>{getStatusLabel(appointment)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded bg-background/80 px-2 py-1">{appointment.employee_name}</span>
                    <span className="rounded bg-background/80 px-2 py-1">{appointment.is_billable ? (appointment.finance_integration_status === "completed" ? "Pagamento recebido" : "Pagamento pendente") : "Cortesia"}</span>
                    {appointment.patient_package_id ? <span className="rounded bg-violet-100 px-2 py-1 text-violet-700 dark:bg-violet-950 dark:text-violet-200">Pacote</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Horario livre ? toque em Novo horario para agendar.</p>
        )}
      </div>
      <div className="sticky top-0 z-20 hidden border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl md:grid dark:border-slate-800 dark:bg-slate-950/90">
        <div
          className="grid min-w-[860px]"
          style={{
            gridTemplateColumns: `88px repeat(${Math.max(employees.length, 1)}, minmax(320px, 1fr))`
          }}
        >
          <div className="border-r border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {formatWeekday(day)}
            </p>
            <strong className="text-sm">{formatShortDate(day)}</strong>
          </div>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-2 border-r border-slate-200/80 bg-white/80 p-3 last:border-r-0 dark:border-slate-800 dark:bg-slate-950/80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{employee.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {appointments.filter((item) => item.employee_id === employee.id).length} atend.
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Novo agendamento"
                    onClick={() => onCreateAppointment(day, employee.id)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-muted-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Novo bloqueio"
                    onClick={() => onCreateBlock(day, employee.id)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-muted-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
                  >
                    <LockKeyhole className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhum profissional para exibir.
            </div>
          )}
        </div>
      </div>

      <div className="relative hidden overflow-x-auto md:block">
        <div
          className="grid min-w-[860px]"
          style={{
            gridTemplateColumns: `88px repeat(${Math.max(employees.length, 1)}, minmax(320px, 1fr))`,
            minHeight: gridHeight
          }}
        >
          <div className="relative border-r border-slate-200/80 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/70">
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className="border-b border-slate-200/70 px-3 py-3 text-right text-base font-bold tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300"
                style={{ height: hourHeight }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {employees.length > 0 ? (
            employees.map((employee) => (
              <div
                key={employee.id}
                className="relative border-r border-slate-200/70 bg-white/75 last:border-r-0 dark:border-slate-800 dark:bg-slate-950/75"
                style={{ minHeight: gridHeight }}
              >
                {hours.slice(0, -1).map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    title="Agendar neste horario"
                    onClick={() => onCreateAppointment(day, employee.id, String(hour).padStart(2, "0") + ":00")}
                    className="block w-full border-b border-dashed border-slate-200/80 text-left transition-colors duration-200 hover:bg-blue-50/80 dark:border-slate-800 dark:hover:bg-blue-950/25"
                    style={{ height: hourHeight }}
                  >
                    <span className="sr-only">Novo agendamento as {String(hour).padStart(2, "0")}:00</span>
                  </button>
                ))}

                {blocks
                  .filter((block) => !block.employee_id || block.employee_id === employee.id)
                  .map((block) => (
                    <TimelineBlock
                      key={block.id}
                      block={block}
                      position={getBlockPosition(block)}
                      canDelete={canDelete}
                      onDelete={() => onDeleteBlock(block)}
                    />
                  ))}

                {appointments
                  .filter((appointment) => appointment.employee_id === employee.id)
                  .map((appointment, appointmentIndex, employeeAppointments) => (
                    <TimelineAppointment
                      key={appointment.id}
                      appointment={appointment}
                      position={(() => { const base = getCalendarPosition(appointment.start_time, appointment.end_time); const sameSlot = employeeAppointments.slice(0, appointmentIndex).filter((item) => item.start_time === appointment.start_time).length; return { ...base, top: base.top + sameSlot * (Math.min(base.height, 112) + 6), height: Math.min(base.height, 112) }; })()}
                      canEdit={canEdit}
                      canAdminCorrect={canAdminCorrect}
                      isPending={isPending}
                      onStatus={(status) => onStatus(appointment, status)}
                      onFinalize={() => onFinalize(appointment)}
                      onEdit={() => onEdit(appointment)}
                      onUndoAbsence={() => onUndoAbsence(appointment)}
                      onRestoreCancelled={() => onRestoreCancelled(appointment)}
                    />
                  ))}
              </div>
            ))
          ) : (
            <div className="relative bg-background" style={{ minHeight: gridHeight }}>
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Cadastre ou selecione um profissional para montar a grade.
              </div>
            </div>
          )}

          {showNow && nowTop >= 0 && nowTop <= gridHeight ? (
            <div
              className="pointer-events-none absolute left-[88px] right-0 z-30 h-px bg-gradient-to-r from-rose-500 via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              style={{ top: nowTop }}
            >
              <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)] dark:border-slate-950" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TimelineAppointment({
  appointment,
  position,
  canEdit,
  canAdminCorrect,
  isPending,
  onStatus,
  onFinalize,
  onEdit,
  onUndoAbsence,
  onRestoreCancelled
}: {
  appointment: Appointment;
  position: { top: number; height: number };
  canEdit: boolean;
  canAdminCorrect: boolean;
  isPending: boolean;
  onStatus: (status: AppointmentStatus) => void;
  onFinalize: () => void;
  onEdit: () => void;
  onUndoAbsence: () => void;
  onRestoreCancelled: () => void;
}) {
  const visualStatus = getVisualStatus(appointment);
  const availableActions = getAppointmentAvailableActions(appointment, { canEdit, canAdminCorrect });
  const primaryAction = getPrimaryAppointmentAction(availableActions);
  const style = statusStyles[visualStatus];
  const sessionsContracted = appointment.sessions_contracted ?? 1;
  const sessionsCompleted = appointment.sessions_completed ?? 0;
  const sessionsRemaining = Math.max(sessionsContracted - sessionsCompleted, 0);
  const appointmentType = getAppointmentType(appointment);
  const appointmentOrigin = getAppointmentOrigin(appointment);
  const isReplacement = isReplacementAppointment(appointment);

  return (
    <article
      draggable={false}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
        onEdit();
      }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(); }}
      data-dnd-ready="appointment"
      className={cn(
        "absolute left-2 right-2 z-10 grid cursor-pointer gap-2 overflow-hidden rounded-xl border border-white/80 border-l-[6px] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-sm transition-all duration-200 hover:z-20 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(15,23,42,0.22)] dark:border-white/10 dark:ring-white/5",
        style.border,
        style.surface,
        style.text
      )}
      style={{ top: position.top, minHeight: position.height }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold tabular-nums">
            {formatTime(appointment.start_time)}
            {appointment.end_time ? ` - ${formatTime(appointment.end_time)}` : ""}
          </p>
          <h3 className="truncate text-base font-bold tracking-tight">
            {appointment.patient_names.join(", ")}
          </h3>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm", style.chip)}>
          {getStatusLabel(appointment)}
        </span>
      </div>

      <div className="grid gap-1 text-sm">
        <p className="truncate font-medium">{appointment.service_name}</p>
        <p className="truncate text-muted-foreground">{appointment.employee_name}</p>
        <p className="truncate text-muted-foreground">{appointment.is_billable ? (appointment.finance_integration_status === "completed" ? "Pagamento recebido" : "Pagamento pendente") : "Cortesia"}</p>
        <div className="flex flex-wrap gap-1">
          <span
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold",
              isReplacement
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"
                : "bg-background/80 text-muted-foreground"
            )}
          >
            {appointmentTypeLabels[appointmentType]}
          </span>
          <span className="rounded-md bg-background/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            Origem: {appointmentOriginLabels[appointmentOrigin]}
          </span>
        </div>
        {appointment.original_appointment_label ? (
          <p className="truncate text-[11px] text-muted-foreground">
            Original: {appointment.original_appointment_label}
          </p>
        ) : null}
      </div>

      <div className="hidden grid-cols-3 gap-1 text-center text-[11px] 2xl:grid">
        <MiniStat label="Contr." value={sessionsContracted} />
        <MiniStat label="Real." value={sessionsCompleted} />
        <MiniStat label="Rest." value={sessionsRemaining} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-black/5 pt-2 dark:border-white/10">
        <AppointmentPrimaryAction action={primaryAction} isPending={isPending} onConfirm={() => onStatus("confirmado")} onFinalize={onFinalize} onUndoAbsence={onUndoAbsence} onRestoreCancelled={onRestoreCancelled} onOpen={onEdit} />
        <IconAction label="Ver detalhes" onClick={onEdit} icon={MoreHorizontal} />
      </div>
    </article>
  );
}

function TimelineBlock({
  block,
  position,
  canDelete,
  onDelete
}: {
  block: ScheduleBlock;
  position: { top: number; height: number };
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <article
      className="absolute left-1 right-1 z-[5] overflow-hidden rounded-md border border-red-900/50 bg-[repeating-linear-gradient(135deg,rgba(127,29,29,0.22)_0px,rgba(127,29,29,0.22)_8px,rgba(127,29,29,0.12)_8px,rgba(127,29,29,0.12)_16px)] p-3 text-red-950 shadow-sm dark:text-red-100"
      style={{ top: position.top, minHeight: position.height }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase">Bloqueio</p>
          <p className="truncate text-sm font-semibold">{getBlockTimeLabel(block)}</p>
          <p className="truncate text-xs">{block.employee_name}</p>
          <p className="truncate text-xs">{block.reason ?? "Sem motivo informado"}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            title="Excluir bloqueio"
            onClick={onDelete}
            className="rounded-md bg-red-950/10 p-1.5 text-red-950 hover:bg-red-950/20 dark:text-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MonthGrid({
  selectedDate,
  days,
  appointments,
  blocks,
  onSelectDate,
  onOpenAppointment
}: {
  selectedDate: string;
  days: string[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  onSelectDate: (date: string) => void;
  onOpenAppointment: (appointment: Appointment) => void;
}) {
  const selectedMonth = selectedDate.slice(0, 7);

  return (
    <div className="grid gap-px bg-slate-200/80 p-px dark:bg-slate-800">
      <div className="grid grid-cols-7 gap-px bg-slate-200/80 dark:bg-slate-800">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((day) => (
          <div
            key={day}
            className="bg-slate-900 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-200 dark:bg-black"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200/80 dark:bg-slate-800">
        {days.map((day) => {
          const dayAppointments = appointments.filter(
            (appointment) => appointment.appointment_date === day
          );
          const dayBlocks = blocks.filter((block) => block.block_date === day);
          const muted = day.slice(0, 7) !== selectedMonth;
          const hasBlock = dayBlocks.length > 0;
          const blockedDay = isPastDate(day) || isFullDayBlocked(day, blocks);

          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(day)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDate(day); } }}
              className={cn(
                "min-h-[150px] bg-white p-3 text-left transition-all duration-200 hover:relative hover:z-10 hover:bg-blue-50/70 hover:shadow-inner dark:bg-slate-950 dark:hover:bg-blue-950/20",
                muted && "bg-muted/30 text-muted-foreground",
                hasBlock &&
                  "bg-red-50/80 ring-1 ring-inset ring-red-900/15 dark:bg-red-950/20",
                blockedDay &&
                  "cursor-not-allowed text-muted-foreground hover:bg-red-50/80 dark:hover:bg-red-950/20"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{toDate(day).getDate()}</span>
                {day === today() ? (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Hoje
                  </span>
                ) : null}
              </div>
              <div className="grid gap-1">
                {dayBlocks.slice(0, 1).map((block) => (
                  <span
                    key={block.id}
                    className="truncate rounded-md bg-red-900 px-2 py-1 text-[11px] font-semibold text-white"
                  >
                    {getBlockTimeLabel(block)}
                  </span>
                ))}
                {dayAppointments.slice(0, 3).map((appointment) => {
                  const style = statusStyles[getVisualStatus(appointment)];
                  return (
                    <span
                      key={appointment.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => { event.stopPropagation(); onOpenAppointment(appointment); }}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onOpenAppointment(appointment); } }}
                      className={cn(
                        "truncate rounded-lg px-2 py-1.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5 transition-transform hover:scale-[1.02] dark:ring-white/10",
                        style.chip
                      )}
                    >
                      {formatTime(appointment.start_time)}{" "}
                      {isReplacementAppointment(appointment) ? "Reposiço" : ""}
                      {appointment.patient_name}
                    </span>
                  );
                })}
                {dayAppointments.length + dayBlocks.length > 4 ? (
                  <span className="inline-flex w-fit rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-sm dark:bg-white dark:text-slate-950">
                    +{dayAppointments.length + dayBlocks.length - 4} registros
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniMonthCalendar({
  selectedDate,
  blocks,
  onSelectDate
}: {
  selectedDate: string;
  blocks: ScheduleBlock[];
  onSelectDate: (date: string) => void;
}) {
  const days = getDaysForMode("month", selectedDate);
  const selectedMonth = selectedDate.slice(0, 7);

  return (
    <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-200/70 pb-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold">Mini calendário</p>
          <p className="text-xs capitalize text-muted-foreground">
            {monthTitle(selectedDate)}
          </p>
        </div>
        <CalendarClock className="h-5 w-5 text-primary" />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 text-muted-foreground">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const dayBlocks = blocks.filter((block) => block.block_date === day);
          const hasBlock = dayBlocks.length > 0;
          const blockedDay = isPastDate(day) || isFullDayBlocked(day, blocks);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(day)}
              title={hasBlock ? "Data com bloqueio" : undefined}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors hover:bg-secondary",
                day === selectedDate &&
                  "bg-primary text-primary-foreground hover:bg-primary",
                day.slice(0, 7) !== selectedMonth && "text-muted-foreground/50",
                hasBlock &&
                  "bg-red-100 text-red-900 ring-1 ring-inset ring-red-900/20 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-100",
                blockedDay && "cursor-not-allowed opacity-70"
              )}
            >
              {toDate(day).getDate()}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SidePanel({
  selectedDate,
  nextAppointment,
  dayAppointments,
  dayBlocks,
  canEdit,
  canAdminCorrect,
  isPending,
  onOpen,
  onFinalize,
  onStatus,
  onUndoAbsence,
  onRestoreCancelled
}: {
  selectedDate: string;
  nextAppointment?: Appointment;
  dayAppointments: Appointment[];
  dayBlocks: ScheduleBlock[];
  canEdit: boolean;
  canAdminCorrect: boolean;
  isPending: boolean;
  onOpen: (appointment: Appointment) => void;
  onFinalize: (appointment: Appointment) => void;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onUndoAbsence: (appointment: Appointment) => void;
  onRestoreCancelled: (appointment: Appointment) => void;
}) {
  return (
    <div className="grid gap-5 scroll-smooth">
      <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Próximo atendimento</h3>
        </div>
        {nextAppointment ? (
          <AppointmentSummary appointment={nextAppointment} canEdit={canEdit} canAdminCorrect={canAdminCorrect} isPending={isPending} onOpen={() => onOpen(nextAppointment)} onFinalize={() => onFinalize(nextAppointment)} onStatus={(status) => onStatus(nextAppointment, status)} onUndoAbsence={() => onUndoAbsence(nextAppointment)} onRestoreCancelled={() => onRestoreCancelled(nextAppointment)} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum próximo atendimento.</p>
        )}
      </Card>

      <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
          <ListChecks className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Agenda do dia</h3>
            <p className="text-xs text-muted-foreground">{fullDate(selectedDate)}</p>
          </div>
        </div>
        <div className="grid max-h-[340px] scroll-smooth gap-2.5 overflow-auto pr-1">
          {dayAppointments.length > 0 ? (
            dayAppointments.map((appointment) => (
              <AppointmentSummary key={appointment.id} appointment={appointment} compact canEdit={canEdit} canAdminCorrect={canAdminCorrect} isPending={isPending} onOpen={() => onOpen(appointment)} onFinalize={() => onFinalize(appointment)} onStatus={(status) => onStatus(appointment, status)} onUndoAbsence={() => onUndoAbsence(appointment)} onRestoreCancelled={() => onRestoreCancelled(appointment)} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sem atendimentos no dia.</p>
          )}
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
          <Search className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Resumo do dia</h3>
        </div>
        <div className="grid gap-2 text-sm">
          <SideStat label="Atendimentos" value={dayAppointments.length} />
          <SideStat
            label="Confirmados"
            value={
              dayAppointments.filter(
                (appointment) => normalizeStatus(appointment.status) === "confirmado"
              ).length
            }
          />
          <SideStat
            label="Realizados"
            value={
              dayAppointments.filter(
                (appointment) => normalizeStatus(appointment.status) === "realizado"
              ).length
            }
          />
          <SideStat label="Bloqueios" value={dayBlocks.length} />
        </div>
      </Card>
    </div>
  );
}

function AppointmentSummary({
  appointment,
  compact = false,
  canEdit = false,
  canAdminCorrect = false,
  isPending = false,
  onOpen,
  onFinalize,
  onStatus,
  onUndoAbsence,
  onRestoreCancelled
}: {
  appointment: Appointment;
  compact?: boolean;
  canEdit?: boolean;
  canAdminCorrect?: boolean;
  isPending?: boolean;
  onOpen?: () => void;
  onFinalize?: () => void;
  onStatus?: (status: AppointmentStatus) => void;
  onUndoAbsence?: () => void;
  onRestoreCancelled?: () => void;
}) {
  const style = statusStyles[getVisualStatus(appointment)];
  const availableActions = getAppointmentAvailableActions(appointment, { canEdit, canAdminCorrect });
  const primaryAction = getPrimaryAppointmentAction(availableActions);
  const appointmentType = getAppointmentType(appointment);
  const appointmentOrigin = getAppointmentOrigin(appointment);
  const isReplacement = isReplacementAppointment(appointment);

  return (
    <div role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined} onClick={(event) => { if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return; onOpen?.(); }} onKeyDown={(event) => { if (onOpen && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }} className={cn("rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm", onOpen && "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-blue-800 dark:hover:bg-blue-950/20") }>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {formatTime(appointment.start_time)}
            {appointment.end_time ? ` - ${formatTime(appointment.end_time)}` : ""}
          </p>
          <p className="truncate text-sm font-semibold">
            {appointment.patient_names.join(", ")}
          </p>
        </div>
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", style.chip)}>
          {getStatusLabel(appointment)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[10px] font-semibold",
            isReplacement
              ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"
              : "bg-muted text-muted-foreground"
          )}
        >
          {appointmentTypeLabels[appointmentType]}
        </span>
        <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          {appointmentOriginLabels[appointmentOrigin]}
        </span>
      </div>
      {compact ? <div className="mt-2 flex flex-wrap gap-1">
        <AppointmentPrimaryAction action={primaryAction} isPending={isPending} onConfirm={() => onStatus?.("confirmado")} onFinalize={() => onFinalize?.()} onUndoAbsence={() => onUndoAbsence?.()} onRestoreCancelled={() => onRestoreCancelled?.()} onOpen={() => onOpen?.()} />
        {onOpen ? <IconAction label="Ver detalhes" icon={MoreHorizontal} onClick={onOpen} /> : null}
      </div> : null}      {!compact ? (
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
          <p>{appointment.service_name}</p>
          <p>{appointment.employee_name}</p>
          {appointment.original_appointment_label ? (
            <p>Original: {appointment.original_appointment_label}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SideStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/70 px-2 py-1">
      <strong>{value}</strong>
      <span className="block text-muted-foreground">{label}</span>
    </div>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  danger = false
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 text-[11px] font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-200",
        danger && "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AppointmentPrimaryAction({ action, isPending, onConfirm, onFinalize, onUndoAbsence, onRestoreCancelled, onOpen }: {
  action: AppointmentActionKey | null;
  isPending: boolean;
  onConfirm: () => void;
  onFinalize: () => void;
  onUndoAbsence: () => void;
  onRestoreCancelled: () => void;
  onOpen: () => void;
}) {
  if (action === "confirm") return <IconAction label="Confirmar" disabled={isPending} onClick={onConfirm} icon={Check} />;
  if (action === "finalize") return <IconAction label="Finalizar" disabled={isPending} onClick={onFinalize} icon={UserCheck} />;
  if (action === "undo_absence") return <IconAction label="Desfazer falta" disabled={isPending} onClick={onUndoAbsence} icon={RotateCw} />;
  if (action === "restore_cancelled") return <IconAction label="Restaurar" disabled={isPending} onClick={onRestoreCancelled} icon={RotateCw} />;
  if (action === "receive") return <IconAction label="Receber" disabled={isPending} onClick={onOpen} icon={UserCheck} />;
  return null;
}
function AppointmentDetailModal({
  appointment, patients, clinics, patientPackages, canEdit, isPending,
  onClose, onEdit, onReschedule, onStatus, onFinalize, canReopen, onReopen, onUndoAbsence, onRestoreCancelled, onCreateNew, onNavigate
}: {
  appointment: Appointment; patients: Patient[]; clinics: Clinic[]; patientPackages: PatientPackage[];
  canEdit: boolean; isPending: boolean; onClose: () => void; onEdit: () => void; onReschedule: () => void;
  onStatus: (status: AppointmentStatus) => void; onFinalize: () => void; canReopen: boolean; onReopen: () => void; onUndoAbsence: () => void; onRestoreCancelled: () => void; onCreateNew: () => void; onNavigate: (href: string) => void;
}) {
  const patient = patients.find((item) => item.id === appointment.patient_id);
  const clinic = clinics.find((item) => item.id === appointment.clinic_id);
  const patientPackage = appointment.patient_package_id ? patientPackages.find((item) => item.id === appointment.patient_package_id) : null;
  const phone = (patient?.phone ?? "").replace(/\D/g, "");
  const whatsapp = phone ? "https://wa.me/" + (phone.startsWith("55") ? phone : "55" + phone) : "";
  const isGroup = appointment.service_is_group || getAppointmentType(appointment) === "grupo";
  const availableActions = getAppointmentAvailableActions(appointment, { canEdit, canAdminCorrect: canReopen });
  const occupancy = Math.max(appointment.patient_ids.length, 1);
  const financialLabel = appointment.is_billable ? appointment.finance_integration_status : "Cortesia / nao faturavel";
  const packageLabel = patientPackage ? patientPackage.remaining_sessions + " sessões restantes" : "Sem pacote vinculado";
  const nl = String.fromCharCode(10);
  const messageBase = "Ola, " + appointment.patient_name + "." + nl + nl;
  const detailLines = ["Data: " + formatShortDate(appointment.appointment_date), "Horário: " + formatTime(appointment.start_time), "Profissional: " + appointment.employee_name, "Serviço: " + appointment.service_name, "Clínica: " + (clinic?.name ?? "Clínica")].join(nl);
  const messages = {
    confirmacao: messageBase + "Seu atendimento foi agendado com sucesso." + nl + nl + detailLines + nl + nl + "Caso precise remarcar, entre em contato conosco.",
    lembrete: messageBase + "Lembramos que seu atendimento esta agendado para:" + nl + nl + detailLines + nl + nl + "Esperamos voce.",
    reagendamento: messageBase + ["Seu atendimento foi reagendado.", "", "Nova data: " + formatShortDate(appointment.appointment_date), "Novo horario: " + formatTime(appointment.start_time), "Profissional: " + appointment.employee_name].join(nl)
  };  const openWhatsapp = (message: string) => { if (whatsapp) window.open(whatsapp + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer"); };

  return (
    <ModalShell title="Detalhe rapido do agendamento" icon={CalendarClock} onClose={onClose}>
      <div className="grid gap-5 scroll-smooth">
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
          <PackageDetail label="Paciente" value={appointment.patient_names.join(", ")} />
          <PackageDetail label="Telefone" value={patient?.phone ?? "Não informado"} />
          <PackageDetail label="Serviço" value={appointment.service_name} />
          <PackageDetail label="Profissional" value={appointment.employee_name} />
          <PackageDetail label="Clínica" value={clinic?.name ?? "Não encontrada"} />
          <PackageDetail label="Data" value={formatShortDate(appointment.appointment_date)} />
          <PackageDetail label="Horário" value={formatTime(appointment.start_time) + (appointment.end_time ? " - " + formatTime(appointment.end_time) : "")} />
          <PackageDetail label="Status" value={getStatusLabel(appointment)} />
          <PackageDetail label="Tipo" value={appointmentTypeLabels[getAppointmentType(appointment)]} />
          <PackageDetail label="Pacote" value={packageLabel} />
          <PackageDetail label="Situacao financeira" value={financialLabel} />
          <PackageDetail label="Observações" value={appointment.notes ?? "Sem observações"} />
          {isGroup ? <PackageDetail label="Ocupacao coletiva" value={occupancy + "/" + (appointment.participant_limit ?? "sem limite")} /> : null}
        </div>
        {isGroup ? <div className="rounded-lg border p-3"><strong>Participantes</strong><p className="mt-1 text-sm text-muted-foreground">{appointment.patient_names.join(", ")}</p></div> : null}
        <div className="flex flex-wrap gap-2">
          {availableActions.has("reopen") ? <Button type="button" variant="outline" disabled={isPending} onClick={onReopen}><RotateCw className="h-4 w-4" />Reabrir atendimento</Button> : null}
          {availableActions.has("undo_absence") ? <Button type="button" variant="outline" disabled={isPending} onClick={onUndoAbsence}><RotateCw className="h-4 w-4" />Desfazer falta</Button> : null}
          {availableActions.has("restore_cancelled") ? <Button type="button" variant="outline" disabled={isPending} onClick={onRestoreCancelled}><RotateCw className="h-4 w-4" />Restaurar agendamento</Button> : null}
          {availableActions.has("confirm") ? <Button type="button" variant="outline" disabled={isPending} onClick={() => onStatus("confirmado")}><Check className="h-4 w-4" />Confirmar presença</Button> : null}
          {availableActions.has("finalize") ? <Button type="button" disabled={isPending} onClick={onFinalize}><UserCheck className="h-4 w-4" />Finalizar atendimento</Button> : null}
          {availableActions.has("absence") ? <Button type="button" variant="outline" disabled={isPending} onClick={() => onStatus("faltou")}><Ban className="h-4 w-4" />Registrar falta</Button> : null}
          {availableActions.has("reschedule") ? <Button type="button" variant="outline" disabled={isPending} onClick={onReschedule}><RotateCw className="h-4 w-4" />Reagendar</Button> : null}
          {availableActions.has("cancel") ? <Button type="button" variant="outline" disabled={isPending} onClick={() => onStatus("cancelado")}><X className="h-4 w-4" />Cancelar</Button> : null}
          {availableActions.has("edit") ? <Button type="button" onClick={onEdit}>Editar</Button> : null}
          {availableActions.has("new_appointment") ? <Button type="button" variant="outline" disabled={isPending} onClick={onCreateNew}><CalendarPlus className="h-4 w-4" />Criar novo agendamento</Button> : null}
          {availableActions.has("record") ? <Button type="button" variant="outline" onClick={() => onNavigate("/prontuarios?q=" + encodeURIComponent(appointment.patient_name))}>Abrir prontuário</Button> : null}
          <Button type="button" variant="outline" onClick={() => onNavigate("/pacientes?patientId=" + appointment.patient_id)}>Abrir ficha</Button>
          {availableActions.has("receive") ? <Button type="button" variant="outline" onClick={() => onNavigate("/financeiro/baixas?patientId=" + appointment.patient_id)}>Receber pagamento</Button> : null}
          {availableActions.has("receipt") ? <Button type="button" variant="outline" onClick={() => onNavigate("/financeiro?patientId=" + appointment.patient_id)}>Emitir recibo</Button> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!whatsapp} onClick={() => openWhatsapp(messages.confirmacao)}><MessageCircle className="h-4 w-4" />WhatsApp: confirmacao</Button>
          <Button type="button" variant="outline" disabled={!whatsapp} onClick={() => openWhatsapp(messages.lembrete)}>WhatsApp: lembrete</Button>
          <Button type="button" variant="outline" disabled={!whatsapp} onClick={() => openWhatsapp(messages.reagendamento)}>WhatsApp: reagendamento</Button>
        </div>
      </div>
    </ModalShell>
  );
}
function StatusCorrectionModal({ appointment, kind, reason, setReason, message, isPending, onSubmit, onClose }: {
  appointment: Appointment; kind: "faltou" | "cancelado"; reason: string; setReason: (value: string) => void;
  message: AgendaActionResult | null; isPending: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void;
}) {
  const undoAbsence = kind === "faltou";
  return <ModalShell title={undoAbsence ? "Desfazer falta" : "Restaurar agendamento"} icon={RotateCw} onClose={onClose}>
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
        <PackageDetail label="Paciente" value={appointment.patient_names.join(", ") || appointment.patient_name} />
        <PackageDetail label="Atendimento" value={`${formatShortDate(appointment.appointment_date)} às ${formatTime(appointment.start_time)}`} />
        <PackageDetail label="Profissional" value={appointment.employee_name} />
        <PackageDetail label="Status atual" value={getStatusLabel(appointment)} />
      </div>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">{undoAbsence ? "A falta será desfeita e o atendimento voltará para Confirmado, sem gerar efeitos financeiros." : "O agendamento será restaurado na data e horário originais após a verificação de conflitos."}</p>
      <TextAreaField label="Motivo da correção" value={reason} onChange={setReason} required />
      {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message.message}</p> : null}
      <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" disabled={isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isPending || !reason.trim()}>{isPending ? "Processando..." : undoAbsence ? "Confirmar correção" : "Restaurar agendamento"}</Button></div>
    </form>
  </ModalShell>;
}
function ReopenAppointmentModal({
  appointment,
  reason,
  setReason,
  message,
  isPending,
  onSubmit,
  onClose
}: {
  appointment: Appointment;
  reason: string;
  setReason: (value: string) => void;
  message: AgendaActionResult | null;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Reabrir atendimento" icon={RotateCw} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <PackageDetail label="Paciente" value={appointment.patient_names.join(", ") || appointment.patient_name} />
          <PackageDetail label="Atendimento" value={`${formatShortDate(appointment.appointment_date)} às ${formatTime(appointment.start_time)}`} />
          <PackageDetail label="Profissional" value={appointment.employee_name} />
          <PackageDetail label="Serviço" value={appointment.service_name} />
        </div>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          A reabertura desfará automaticamente a finalização e restaurará os vínculos aplicáveis pela lógica existente.
        </p>
        <TextAreaField label="Motivo da reabertura" value={reason} onChange={setReason} required />
        {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{message.message}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isPending || !reason.trim()}>{isPending ? "Reabrindo..." : "Confirmar reabertura"}</Button>
        </div>
      </form>
    </ModalShell>
  );
}
function FinalizeAppointmentModal({
  appointment,
  serviceValue,
  form,
  setForm,
  message,
  isPending,
  onSubmit,
  onClose
}: {
  appointment: Appointment;
  serviceValue: number;
  form: FinalizeBillingForm;
  setForm: React.Dispatch<React.SetStateAction<FinalizeBillingForm>>;
  message: AgendaActionResult | null;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const isPartial = form.financial_status === "parcial";

  return (
    <ModalShell title="Finalizar atendimento" icon={UserCheck} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-2">
          <PackageDetail label="Paciente" value={appointment.patient_names.join(", ") || appointment.patient_name || "-"} />
          <PackageDetail label="Profissional" value={appointment.employee_name ?? "-"} />
          <PackageDetail label="Serviço" value={appointment.service_name ?? "-"} />
          <PackageDetail label="Valor" value={currencyFormatter.format(serviceValue)} />
          <PackageDetail label="Pacote" value={appointment.patient_package_id ? "Vinculado" : "Sem pacote"} />
          {appointment.patient_package_id ? <PackageDetail label="Sessões restantes" value={String(Math.max((appointment.sessions_contracted ?? 1) - (appointment.sessions_completed ?? 0), 0))} /> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Forma de pagamento"
            value={form.payment_method}
            onChange={(value) => setForm((current) => ({ ...current, payment_method: value as PaymentMethod }))}
            options={paymentMethodOptions}
          />
          <SelectField
            label="Status financeiro"
            value={form.financial_status}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                financial_status: value as AppointmentBillingStatus,
                paid_amount: value === "parcial" ? current.paid_amount : value === "pago" ? String(serviceValue) : "0"
              }))
            }
            options={billingStatusOptions}
          />
          {isPartial ? (
            <TextField
              label="Valor pago"
              type="number"
              value={form.paid_amount}
              onChange={(value) => setForm((current) => ({ ...current, paid_amount: value }))}
              minValue="0"
              required
            />
          ) : null}
          <div className="md:col-span-2">
            <TextAreaField
              label="Observaço"
              value={form.notes}
              onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
            />
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Ao confirmar, o atendimento será marcado como realizado e o financeiro será atualizado conforme o status escolhido.
        </div>

        {serviceValue <= 0 && form.financial_status !== "cortesia" ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            Este serviço está sem valor configurado. Configure o valor do serviço ou selecione Cortesia para concluir sem gerar receita.
          </p>
        ) : null}
        {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{message.message}</p> : null}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            Finalizar atendimento
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function AppointmentFormModal({
  editingAppointment,
  form,
  setForm,
  appointments,
  clinics,
  patients,
  employees,
  services,
  patientPackages,
  blocks,
  selectedService,
  formMessage,
  isAdmMaster,
  isPending,
  onSubmit,
  onClose
}: {
  editingAppointment: Appointment | null;
  form: AppointmentFormInput;
  setForm: React.Dispatch<React.SetStateAction<AppointmentFormInput>>;
  appointments: Appointment[];
  clinics: Clinic[];
  patients: Patient[];
  employees: Employee[];
  services: Service[];
  patientPackages: PatientPackage[];
  blocks: ScheduleBlock[];
  selectedService?: Service;
  formMessage: AgendaActionResult | null;
  isAdmMaster: boolean;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const selectedPatients = form.patient_ids ?? [];
  const appointmentType = form.appointment_type ?? "avulso";
  const isPackageAppointment = appointmentType === "pacote";
  const isGroupAppointment = appointmentType === "grupo" || Boolean(selectedService?.is_group);
  const participantLimit = selectedService?.participant_limit ?? null;
  const occupiedGroupSeats = appointments
    .filter(
      (appointment) =>
        appointment.id !== editingAppointment?.id &&
        appointment.clinic_id === form.clinic_id &&
        appointment.employee_id === form.employee_id &&
        appointment.service_id === form.service_id &&
        appointment.appointment_date === form.appointment_date &&
        formatTime(appointment.start_time) === form.start_time &&
        ["agendado", "confirmado", "realizado"].includes(
          normalizeStatus(appointment.status)
        ) &&
        (appointment.service_is_group || getAppointmentType(appointment) === "grupo")
    )
    .reduce(
      (total, appointment) =>
        total + Math.max(appointment.patient_ids.length, 1),
      0
    );
  const groupProjectedSeats = occupiedGroupSeats + selectedPatients.length;
  const groupCapacityExceeded =
    isGroupAppointment &&
    Boolean(participantLimit) &&
    groupProjectedSeats > Number(participantLimit);
  const availablePatientPackages = patientPackages.filter(
    (patientPackage) =>
      patientPackage.clinic_id === form.clinic_id &&
      patientPackage.patient_id === form.patient_id &&
      patientPackage.service_id === form.service_id &&
      patientPackage.status === "active" &&
      patientPackage.remaining_sessions > 0
  );
  const selectedPatientPackage = patientPackages.find(
    (patientPackage) => patientPackage.id === form.patient_package_id
  );
  const isReplacement =
    appointmentType === "reposicao" || appointmentType === "reposicao_extra";
  const shouldShowOriginalAppointment =
    appointmentType === "reposicao" || appointmentType === "retorno";
  const dateBlocked =
    !form.appointment_date ||
    isPastDate(form.appointment_date) ||
    isFullDayBlocked(form.appointment_date, blocks, form.employee_id);
  const startTimeOptions = timeSlotOptions().filter(([time]) => {
    if (dateBlocked) {
      return false;
    }

    if (form.appointment_date === today() && !isSameOrFutureTime(time)) {
      return false;
    }

    return !isTimeBlocked(
      form.appointment_date,
      time,
      form.end_time,
      blocks,
      form.employee_id
    );
  });
  const endTimeOptions = timeSlotOptions().filter(([time]) => {
    if (dateBlocked || !form.start_time) {
      return false;
    }

    if (form.appointment_date === today() && !isSameOrFutureTime(time)) {
      return false;
    }

    if (!isTimeAfter(time, form.start_time)) {
      return false;
    }

    return !isTimeBlocked(
      form.appointment_date,
      form.start_time,
      time,
      blocks,
      form.employee_id
    );
  });
  const selectedTimeBlocked =
    !!form.appointment_date &&
    !!form.start_time &&
    isTimeBlocked(
      form.appointment_date,
      form.start_time,
      form.end_time,
      blocks,
      form.employee_id
    );
  const selectedEndTimeBlocked =
    !!form.end_time &&
    (!isTimeAfter(form.end_time, form.start_time) ||
      isTimeBlocked(
        form.appointment_date,
        form.start_time,
        form.end_time,
        blocks,
        form.employee_id
      ));
  const schedulingBlocked =
    dateBlocked || selectedTimeBlocked || selectedEndTimeBlocked || groupCapacityExceeded;

  return (
    <ModalShell
      title={editingAppointment ? "Editar agendamento" : "Novo agendamento"}
      icon={CalendarPlus}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Clínica"
            value={form.clinic_id ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, clinic_id: value }))}
            options={clinics.map((clinic) => [clinic.id, clinic.name])}
            disabled={!isAdmMaster}
          />
          <SelectField
            label="Serviço"
            value={form.service_id}
            onChange={(value) => {
              const service = services.find((item) => item.id === value);
              setForm((current) => ({
                ...current,
                service_id: value,
                patient_ids:
                  current.appointment_type === "grupo" || service?.is_group
                    ? current.patient_ids
                    : [],
                patient_package_id: ""
              }));
            }}
            options={services.map((service) => [service.id, service.name])}
            required
          />
          <SelectField
            label="Tipo de atendimento"
            value={form.appointment_type ?? "avulso"}
            onChange={(value) =>
              setForm((current) => {
                const appointmentType = value as AppointmentType;
                const keepOriginal = appointmentType === "reposicao" || appointmentType === "retorno";
                return {
                  ...current,
                  appointment_type: appointmentType,
                  appointment_origin: appointmentType,
                  original_appointment_id: keepOriginal
                    ? current.original_appointment_id
                    : "",
                  patient_ids:
                    appointmentType === "grupo"
                      ? current.patient_ids
                      : current.patient_id
                        ? [current.patient_id]
                        : [],
                  patient_package_id:
                    appointmentType === "pacote" ? current.patient_package_id : ""
                };
              })
            }
            options={appointmentTypeOptions}
          />
          {shouldShowOriginalAppointment ? (
            <SelectField
              label="Atendimento original"
              value={form.original_appointment_id ?? ""}
              onChange={(value) =>
                setForm((current) => ({ ...current, original_appointment_id: value }))
              }
              options={appointments
                .filter((appointment) => appointment.id !== editingAppointment?.id)
                .map((appointment) => [
                  appointment.id,
                  `${appointment.patient_name} - ${appointment.appointment_date} ${formatTime(appointment.start_time)}`
                ])}
              placeholder={
                isReplacement
                  ? "Selecione a falta original"
                  : "Selecione o atendimento original"
              }
            />
          ) : null}
          {isGroupAppointment ? (
            <div className="grid gap-3 md:col-span-2">
              <MultiSelectField
                label="Pacientes do grupo"
                value={selectedPatients}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    patient_id: value[0] ?? "",
                    patient_ids: value,
                    patient_package_id: ""
                  }))
                }
                options={patients.map((patient) => [patient.id, patient.full_name])}
                helper={`${groupProjectedSeats}/${participantLimit ?? "sem limite"} vagas ocupadas`}
              />
              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-3">
                <PackageDetail
                  label="Capacidade máxima"
                  value={participantLimit ?? "Sem limite"}
                />
                <PackageDetail label="Vagas ocupadas" value={occupiedGroupSeats} />
                <PackageDetail
                  label="Selecionadas"
                  value={selectedPatients.length}
                />
              </div>
            </div>
          ) : (
            <SelectField
              label="Paciente"
              value={form.patient_id}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  patient_id: value,
                  patient_ids: value ? [value] : [],
                  patient_package_id: ""
                }))
              }
              options={patients.map((patient) => [patient.id, patient.full_name])}
              required
            />
          )}
          <SelectField
            label="Profissional"
            value={form.employee_id}
            onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))}
            options={employees.map((employee) => [employee.id, employee.name])}
            required
          />
          {isPackageAppointment ? (
            <div className="grid gap-3 md:col-span-2">
              <SelectField
                label="Pacote do paciente"
                value={form.patient_package_id ?? ""}
                onChange={(value) =>
                  setForm((current) => ({ ...current, patient_package_id: value }))
                }
                options={availablePatientPackages.map((patientPackage) => [
                  patientPackage.id,
                  `${patientPackage.completed_sessions}/${patientPackage.contracted_sessions} realizadas - validade ${patientPackage.expiration_date ?? "sem validade"}`
                ])}
                required
                placeholder={
                  form.patient_id && form.service_id
                    ? "Selecione um pacote ativo"
                    : "Selecione paciente e Serviço"
                }
              />
              {selectedPatientPackage ? (
                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-4">
                  <PackageDetail
                    label="Contratadas"
                    value={selectedPatientPackage.contracted_sessions}
                  />
                  <PackageDetail
                    label="Realizadas"
                    value={selectedPatientPackage.completed_sessions}
                  />
                  <PackageDetail
                    label="Restantes"
                    value={selectedPatientPackage.remaining_sessions}
                  />
                  <PackageDetail
                    label="Validade"
                    value={selectedPatientPackage.expiration_date ?? "-"}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <TextField
            label="Data"
            type="date"
            value={form.appointment_date}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                appointment_date: value,
                start_time: "",
                end_time: ""
              }))
            }
            minValue={today()}
            required
          />
          <SelectField
            label="Horário inicial"
            value={form.start_time}
            onChange={(value) =>
              setForm((current) => ({ ...current, start_time: value, end_time: "" }))
            }
            options={startTimeOptions}
            placeholder={
              dateBlocked
                ? "Data bloqueada para agendamento"
                : "Selecione um horario"
            }
            disabled={dateBlocked || startTimeOptions.length === 0}
            required
          />
          <SelectField
            label="Horário final"
            value={form.end_time ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, end_time: value }))}
            options={endTimeOptions}
            placeholder={
              form.start_time ? "Selecione um horario" : "Selecione o horario inicial"
            }
            disabled={dateBlocked || !form.start_time || endTimeOptions.length === 0}
          />
          {false ? (
            <>
          <TextField
            label="Quantidade contratada"
            type="number"
            value={form.sessions_contracted ?? "1"}
            onChange={(value) =>
              setForm((current) => ({ ...current, sessions_contracted: value }))
            }
            disabled={isReplacement}
            helper={
              isReplacement
                ? "Reposição não aumenta a quantidade contratada."
                : undefined
            }
          />
          <TextField
            label="Quantidade realizada"
            type="number"
            value={form.sessions_completed ?? "0"}
            onChange={(value) =>
              setForm((current) => ({ ...current, sessions_completed: value }))
            }
          />
          <SelectField
            label="Status"
            value={form.status ?? "agendado"}
            onChange={(value) =>
              setForm((current) => ({ ...current, status: value as AppointmentStatus }))
            }
            options={statusOptions}
          />
            </>
          ) : null}
        </div>
        {formMessage ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {formMessage.message}
          </p>
        ) : null}
        {schedulingBlocked ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {groupCapacityExceeded
              ? "Capacidade máxima do grupo atingida."
              : "Data bloqueada para agendamento"}
          </p>
        ) : null}
        <TextAreaField
          label="Observações"
          value={form.notes ?? ""}
          onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || schedulingBlocked}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function PackageDetail({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md bg-background/70 px-3 py-2">
      <span className="block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <strong className="text-sm">{value}</strong>
    </div>
  );
}

function BlockFormModal({
  form,
  setForm,
  clinics,
  employees,
  isAdmMaster,
  isPending,
  onSubmit,
  onClose
}: {
  form: ScheduleBlockFormInput;
  setForm: React.Dispatch<React.SetStateAction<ScheduleBlockFormInput>>;
  clinics: Clinic[];
  employees: Employee[];
  isAdmMaster: boolean;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Novo bloqueio" icon={LockKeyhole} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Clínica"
            value={form.clinic_id ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, clinic_id: value }))}
            options={clinics.map((clinic) => [clinic.id, clinic.name])}
            disabled={!isAdmMaster}
          />
          <SelectField
            label="Profissional"
            value={form.employee_id ?? ""}
            onChange={(value) =>
              setForm((current) => ({ ...current, employee_id: value }))
            }
            options={employees.map((employee) => [employee.id, employee.name])}
            placeholder="Toda a clínica"
          />
          <TextField
            label="Data"
            type="date"
            value={form.block_date}
            onChange={(value) => setForm((current) => ({ ...current, block_date: value }))}
            required
          />
          <SelectField
            label="Tipo"
            value={form.block_type}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                block_type: value as ScheduleBlockFormInput["block_type"]
              }))
            }
            options={[
              ["dia_inteiro", "Dia inteiro"],
              ["periodo", "Período"],
              ["horario", "Horário"]
            ]}
          />
          <TextField
            label="Horário específico"
            type="time"
            value={form.start_time ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, start_time: value }))}
          />
          <TextField
            label="Horário final"
            type="time"
            value={form.end_time ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, end_time: value }))}
          />
        </div>
        <TextAreaField
          label="Motivo"
          value={form.reason ?? ""}
          onChange={(value) => setForm((current) => ({ ...current, reason: value }))}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar bloqueio"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  icon: Icon,
  children,
  onClose
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      modalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      modalRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-md sm:p-5">
      <Card ref={modalRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl scroll-m-4 overflow-auto rounded-2xl border border-white/20 bg-white/95 shadow-[0_32px_100px_rgba(0,0,0,0.38)] outline-none backdrop-blur-xl sm:max-h-[92vh] dark:border-slate-700 dark:bg-slate-950/95">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-5 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-transparent p-2 text-muted-foreground transition-all duration-200 hover:rotate-90 hover:border-slate-200 hover:bg-slate-100 hover:text-foreground dark:hover:border-slate-700 dark:hover:bg-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </Card>
    </div>
  );
}

function FieldShell({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  minValue,
  helper
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  minValue?: string;
  helper?: string;
}) {
  return (
    <FieldShell label={label}>
      <input
        type={type}
        min={minValue ?? (type === "number" ? "0" : undefined)}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="agenda-input disabled:cursor-not-allowed disabled:opacity-70"
      />
      {helper ? (
        <span className="text-xs normal-case text-muted-foreground">{helper}</span>
      ) : null}
    </FieldShell>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <FieldShell label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        required={required}
        className="agenda-input resize-none"
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  placeholder = "Selecione"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="agenda-input disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function MultiSelectField({
  label,
  value,
  onChange,
  options,
  helper
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: Array<[string, string]>;
  helper: string;
}) {
  return (
    <FieldShell label={label}>
      <select
        multiple
        value={value}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions, (option) => option.value))
        }
        className="agenda-input min-h-[130px]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <span className="text-xs normal-case text-muted-foreground">{helper}</span>
    </FieldShell>
  );
}
