"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import { createMedicalRecord, updateMedicalRecord, type MedicalRecordFormInput } from "@/app/(app)/prontuarios/actions";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];
type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];

type PatientTab =
  | "resumo"
  | "agenda"
  | "financeiro"
  | "pacotes"
  | "prontuario"
  | "documentos"
  | "whatsapp"
  | "timeline";

type TimelineFilter = "todos" | "cadastro" | "agenda" | "financeiro" | "pacotes" | "prontuario";

type TimelineItem = {
  id: string;
  date: string;
  type: Exclude<TimelineFilter, "todos">;
  title: string;
  description: string;
};

export type PatientIntegratedSheetProps = {
  patient: Patient;
  clinics: Clinic[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  patientPackages: PatientPackage[];
  medicalRecords: MedicalRecord[];
  employees: Employee[];
  services: Service[];
  onClose: () => void;
  onEdit: (patient: Patient) => void;
  onNavigate: (href: string) => void;
};

const tabs: Array<{ id: PatientTab; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "agenda", label: "Agenda" },
  { id: "financeiro", label: "Financeiro" },
  { id: "pacotes", label: "Pacotes" },
  { id: "prontuario", label: "Prontuario" },
  { id: "documentos", label: "Documentos" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "timeline", label: "Linha do tempo" }
];

const timelineFilters: Array<{ id: TimelineFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "cadastro", label: "Cadastro" },
  { id: "agenda", label: "Agenda" },
  { id: "financeiro", label: "Financeiro" },
  { id: "pacotes", label: "Pacotes" },
  { id: "prontuario", label: "Prontuario" }
];

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [date] = value.split("T");
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(parsed);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function ageFromBirthDate(value: string | null | undefined) {
  if (!value) return "Não informada";
  const birth = new Date(`${value.split("T")[0]}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return "Não informada";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return `${Math.max(age, 0)} anos`;
}

function statusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    pendente: "Pendente",
    pago: "Pago",
    vencido: "Vencido",
    parcial: "Parcial",
    realizado: "Realizado",
    realizada: "Realizada",
    agendada: "Agendada",
    cancelado: "Cancelado",
    cancelada: "Cancelada",
    faltou: "Faltou",
    ativo: "Ativo",
    finalizado: "Finalizado",
    vencido_pacote: "Vencido"
  };

  if (!value) {
    return "-";
  }

  return labels[value.toLowerCase()] ?? value;
}

function getOpenAmount(transaction: FinancialTransaction) {
  return Number(transaction.open_amount ?? Math.max(Number(transaction.amount ?? 0) - Number(transaction.paid_amount ?? 0), 0));
}

function getPaidAmount(transaction: FinancialTransaction) {
  return Number(transaction.paid_amount ?? 0);
}

function isActivePackage(patientPackage: PatientPackage) {
  if (!patientPackage.status || !["active", "ativo"].includes(patientPackage.status.toLowerCase())) {
    return false;
  }

  if (patientPackage.expiration_date) {
    const expiration = new Date(`${patientPackage.expiration_date}T23:59:59`);
    if (!Number.isNaN(expiration.getTime()) && expiration < new Date()) {
      return false;
    }
  }

  return Number(patientPackage.remaining_sessions ?? 0) > 0;
}

function compactText(value: string | null | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}

function field(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>{label}</span>
      <strong style={{ fontSize: "14px" }}>{value}</strong>
    </div>
  );
}

function metric(label: string, value: React.ReactNode, tone = "default") {
  const color = tone === "danger" ? "#b42318" : tone === "success" ? "#067647" : "inherit";

  return (
    <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "10px", padding: "14px", background: "hsl(var(--card))" }}>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px", margin: 0 }}>{label}</p>
      <strong style={{ color, display: "block", fontSize: "20px", marginTop: "6px" }}>{value}</strong>
    </div>
  );
}

export function PatientIntegratedSheet({
  patient,
  clinics,
  appointments,
  transactions,
  patientPackages,
  medicalRecords,
  employees,
  services,
  onClose,
  onEdit,
  onNavigate
}: PatientIntegratedSheetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<PatientTab>("resumo");
  const [timelineFilter, setTimelineFilter] = React.useState<TimelineFilter>("todos");
  const [selectedRecord, setSelectedRecord] = React.useState<MedicalRecord | null>(null);
  const [editingRecord, setEditingRecord] = React.useState(false);
  const [recordForm, setRecordForm] = React.useState<MedicalRecordFormInput | null>(null);
  const [recordMessage, setRecordMessage] = React.useState<string | null>(null);
  const [recordSaving, setRecordSaving] = React.useState(false);
  const [freeMessage, setFreeMessage] = React.useState("");
  const [quickForm, setQuickForm] = React.useState<MedicalRecordFormInput>({ patient_id: patient.id, employee_id: "", title: "Evolução clínica", complaint: "", history: "", conduct: "", evolution: "", notes: "", status: "active" });
  const [quickSaving, setQuickSaving] = React.useState(false);
  const [quickMessage, setQuickMessage] = React.useState<string | null>(null);

  const clinicById = React.useMemo(
    () => new Map(clinics.map((clinic) => [clinic.id, clinic])),
    [clinics]
  );
  const employeeById = React.useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );
  const serviceById = React.useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services]
  );

  const clinic = patient.clinic_id ? clinicById.get(patient.clinic_id) : null;
  const patientAppointments = appointments
    .filter((appointment) => appointment.patient_id === patient.id)
    .sort((a, b) => `${b.appointment_date} ${b.start_time}`.localeCompare(`${a.appointment_date} ${a.start_time}`));
  const patientTransactions = transactions
    .filter((transaction) => transaction.patient_id === patient.id)
    .filter((transaction) => transaction.patient_id === patient.id && transaction.commission_status !== "generated" && !(transaction.transaction_type === "despesa" && transaction.employee_id))
  const packages = patientPackages
    .filter((patientPackage) => patientPackage.patient_id === patient.id)
    .sort((a, b) => (b.purchase_date ?? "").localeCompare(a.purchase_date ?? ""));
  const records = medicalRecords
    .filter((record) => record.patient_id === patient.id)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const today = new Date().toISOString().slice(0, 10);
  const nextAppointment = [...patientAppointments]
    .reverse()
    .find((appointment) => appointment.appointment_date >= today && appointment.status !== "cancelado");
  const lastAppointment = patientAppointments.find((appointment) => appointment.appointment_date < today || appointment.status === "realizado");
  const activePackage = packages.find(isActivePackage);
  const openTransactions = patientTransactions.filter((transaction) => getOpenAmount(transaction) > 0 && transaction.status !== "cancelado");
  const paidTransactions = patientTransactions.filter((transaction) => getPaidAmount(transaction) > 0 || transaction.status === "pago");
  const totalOpen = openTransactions.reduce((sum, transaction) => sum + getOpenAmount(transaction), 0);
  const totalPaid = paidTransactions.reduce((sum, transaction) => sum + getPaidAmount(transaction), 0);
  const lastPayment = paidTransactions[0] ?? null;
  const lastEvolution = records[0] ?? null;
  const responsibleEmployee = employeeById.get(nextAppointment?.employee_id ?? lastAppointment?.employee_id ?? records[0]?.employee_id ?? "");
  const completedSessions = packages.reduce((sum, item) => sum + Number(item.completed_sessions ?? 0), 0);
  const remainingSessions = packages.reduce((sum, item) => sum + Number(item.remaining_sessions ?? 0), 0);
  const phone = normalizePhone(patient.phone);
  const whatsappHref = phone ? `https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}` : null;

  const timeline = React.useMemo<TimelineItem[]>(() => {
    const appointmentItems = patientAppointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      date: appointment.appointment_date,
      type: "agenda" as const,
      title: `${formatDate(appointment.appointment_date)} ${appointment.start_time}`,
      description: `${compactText(serviceById.get(appointment.service_id)?.name, "Servico")} com ${compactText(employeeById.get(appointment.employee_id)?.name, "profissional")} - ${statusLabel(appointment.status)}`
    }));

    const financialItems = patientTransactions.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      date: transaction.due_date,
      type: "financeiro" as const,
      title: `${statusLabel(transaction.status)} - ${money(transaction.amount)}`,
      description: `${compactText(transaction.description, compactText(transaction.origin, "Lancamento financeiro"))} - em aberto ${money(getOpenAmount(transaction))}`
    }));

    const packageItems = packages.map((patientPackage) => ({
      id: `package-${patientPackage.id}`,
      date: patientPackage.purchase_date,
      type: "pacotes" as const,
      title: `${statusLabel(patientPackage.status)} - ${patientPackage.contracted_sessions} sessoes`,
      description: `${compactText(serviceById.get(patientPackage.service_id)?.name, "Servico")} - restantes ${patientPackage.remaining_sessions}`
    }));

    const recordItems = records.map((record) => ({
      id: `record-${record.id}`,
      date: record.created_at,
      type: "prontuario" as const,
      title: record.title,
      description: compactText(record.evolution ?? record.conduct ?? record.notes, "Registro clinico")
    }));

    const registrationItem: TimelineItem = { id: `patient-${patient.id}`, date: patient.created_at, type: "cadastro", title: "Cadastro do paciente", description: `${patient.full_name} foi cadastrado na clinica.` };

    return [registrationItem, ...appointmentItems, ...financialItems, ...packageItems, ...recordItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [employeeById, packages, patient.id, patient.created_at, patient.full_name, patientAppointments, patientTransactions, records, serviceById]);

  const visibleTimeline = timelineFilter === "todos" ? timeline : timeline.filter((item) => item.type === timelineFilter);

  const billingMessage = `Ola, ${patient.full_name}!\n\nIdentificamos valores pendentes no seu cadastro da ${clinic?.name ?? "clinica"}.\n\nValor em aberto: ${money(totalOpen)}\n\nCaso ja tenha realizado o pagamento, por favor envie o comprovante por este WhatsApp para que possamos identificar e dar baixa.\n\nAtenciosamente,\n${clinic?.name ?? "Equipe"}`;
  const reminderMessage = `Ola, ${patient.full_name}!\n\nLembramos do seu proximo atendimento em ${nextAppointment ? `${formatDate(nextAppointment.appointment_date)} as ${nextAppointment.start_time}` : "data a confirmar"}.\n\nAtenciosamente,\n${clinic?.name ?? "Equipe"}`;
  const confirmationMessage = `Ola, ${patient.full_name}! Confirmamos seu atendimento na ${clinic?.name ?? "clinica"} em ${nextAppointment ? `${formatDate(nextAppointment.appointment_date)} as ${nextAppointment.start_time}, para ${serviceById.get(nextAppointment.service_id)?.name ?? "seu atendimento"}` : "data e horario a confirmar"}.`;
  const receiptMessage = `Ola, ${patient.full_name}! Seu recibo de ${lastPayment ? money(getPaidAmount(lastPayment)) : "pagamento"} na ${clinic?.name ?? "clinica"} esta disponivel. Acesse o financeiro para gerar o documento.`;
  const packageMessage = `Ola, ${patient.full_name}! Seu pacote de ${activePackage ? serviceById.get(activePackage.service_id)?.name ?? "servicos" : "servicos"} possui ${activePackage?.remaining_sessions ?? 0} sessoes restantes. Fale conosco para renovar.`;
  const thanksMessage = `Ola, ${patient.full_name}! A ${clinic?.name ?? "nossa equipe"} agradece pela confianca. Conte conosco!`;

  function openTimelineItem(item: TimelineItem) {
    if (item.type === "agenda") onNavigate("/agenda?patientId=" + patient.id + "&appointmentId=" + item.id.replace("appointment-", ""));
    if (item.type === "financeiro") onNavigate("/financeiro?patientId=" + patient.id);
    if (item.type === "pacotes") onNavigate("/pacotes?patientId=" + patient.id);
    if (item.type === "prontuario") setActiveTab("prontuario");
  }

  function exportTimelineCsv() {
    const escape = (value: string) => '"' + value.replaceAll('"', '""') + '"';
    const rows = [["Data", "Tipo", "Titulo", "Descricao"], ...visibleTimeline.map((item) => [formatDateTime(item.date), item.type, item.title, item.description])];
    const csv = rows.map((row) => row.map(escape).join(";")).join(String.fromCharCode(10));
    const url = URL.createObjectURL(new Blob(["ï»¿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "historico-" + patient.full_name.replaceAll(" ", "-").toLowerCase() + ".csv"; link.click(); URL.revokeObjectURL(url);
  }

  function printCurrentView() {
    const previousTitle = document.title;
    document.title = "Ficha - " + patient.full_name;
    window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
    window.print();
  }
  async function saveRecord() {
    if (!recordForm?.title?.trim()) { setRecordMessage("Título do prontuário é obrigatório."); return; }
    setRecordSaving(true); setRecordMessage(null);
    const result = selectedRecord ? await updateMedicalRecord(selectedRecord.id, recordForm) : await createMedicalRecord({ ...recordForm, patient_id: patient.id });
    setRecordSaving(false); setRecordMessage(result.message);
    if (result.ok) { setEditingRecord(false); setSelectedRecord(null); }
  }

  async function saveQuickEvolution(keepForm: boolean) {
    if (!quickForm.complaint?.trim() && !quickForm.evolution?.trim() && !quickForm.conduct?.trim() && !quickForm.notes?.trim()) { setQuickMessage("Preencha ao menos um campo da evolução."); return; }
    setQuickSaving(true); setQuickMessage(null);
    const result = await createMedicalRecord({ ...quickForm, patient_id: patient.id, title: quickForm.complaint?.trim() || "Evolução clínica" });
    setQuickSaving(false); setQuickMessage(result.message);
    if (result.ok) {
      setQuickForm({ patient_id: patient.id, employee_id: quickForm.employee_id, title: "Evolução clínica", complaint: "", history: "", conduct: "", evolution: "", notes: "", status: "active" });
      if (keepForm) setQuickMessage("Evolução salva. Pronto para o próximo registro.");
      router.refresh();
    }
  }

  const wrapperStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    display: "grid",
    gap: "18px",
    padding: "18px",
    background: "hsl(var(--card))"
  };
  const buttonStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--input))",
    borderRadius: "8px",
    padding: "9px 12px",
    fontWeight: 600
  };
  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#1D9E75",
    borderColor: "#1D9E75",
    color: "white"
  };
  const mutedCardStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    borderRadius: "10px",
    padding: "14px",
    background: "hsl(var(--muted) / 0.24)"
  };
  const tableCellStyle: React.CSSProperties = {
    borderBottom: "1px solid hsl(var(--border))",
    padding: "10px",
    textAlign: "left"
  };

  return (
    <section style={wrapperStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div
            style={{
              alignItems: "center",
              background: "#1D9E75",
              borderRadius: "999px",
              color: "white",
              display: "flex",
              fontSize: "22px",
              fontWeight: 800,
              height: "64px",
              justifyContent: "center",
              width: "64px"
            }}
          >
            {initials(patient.full_name)}
          </div>
          <div>
            <p style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}>Ficha integrada do paciente</p>
            <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "2px 0" }}>{patient.full_name}</h2>
            <p style={{ margin: 0 }}>
              {ageFromBirthDate(patient.birth_date)} · {statusLabel(patient.status)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <button type="button" onClick={() => onEdit(patient)} style={buttonStyle}>
            Editar cadastro
          </button>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ ...buttonStyle, textDecoration: "none" }}>
              Abrir WhatsApp
            </a>
          ) : null}
          <button type="button" onClick={onClose} style={buttonStyle}>
            Fechar ficha
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {field("Idade", ageFromBirthDate(patient.birth_date))}
        {field("Telefone / WhatsApp", compactText(patient.phone, "Não informado"))}
        {field("Convênio", "Particular")}
        {field("Profissional responsável", compactText(responsibleEmployee?.name, "Não informado"))}
        {field("Status", statusLabel(patient.status))}
        {field("Proximo atendimento", nextAppointment ? formatDate(nextAppointment.appointment_date) + " " + nextAppointment.start_time : "-")}
        {field("Ultimo atendimento", lastAppointment ? formatDate(lastAppointment.appointment_date) : "-")}
        {field("Pacote ativo", activePackage ? compactText(serviceById.get(activePackage.service_id)?.name, "Pacote ativo") : "Nenhum")}
        {field("Sessoes restantes", activePackage?.remaining_sessions ?? 0)}
        {field("Valor em aberto", money(totalOpen))}
        {field("Total pago", money(totalPaid))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button type="button" onClick={() => onNavigate("/agenda?patientId=" + patient.id + "&new=1")} style={primaryButtonStyle}>Agendar retorno</button>
        <button type="button" onClick={() => onNavigate("/financeiro/baixas?patientId=" + patient.id)} style={primaryButtonStyle}>Receber</button>
        <button type="button" onClick={() => whatsappHref && window.open(whatsappHref + "?text=" + encodeURIComponent(billingMessage), "_blank")} disabled={!whatsappHref || totalOpen <= 0} style={buttonStyle}>Cobrar via WhatsApp</button>
        <button type="button" onClick={printCurrentView} style={buttonStyle}>Imprimir ficha</button>
        <button type="button" onClick={printCurrentView} style={buttonStyle}>Gerar PDF</button>
        <button type="button" onClick={() => onNavigate("/financeiro/baixas?patientId=" + patient.id)} style={buttonStyle}>Gerar recibo</button>
        <button type="button" onClick={() => setActiveTab("whatsapp")} disabled={!whatsappHref} style={buttonStyle}>Enviar WhatsApp</button>
        <button type="button" onClick={() => onNavigate("/pacotes?patientId=" + patient.id)} style={buttonStyle}>Renovar pacote</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...buttonStyle,
              background: activeTab === tab.id ? "#1D9E75" : "transparent",
              borderColor: activeTab === tab.id ? "#1D9E75" : "hsl(var(--input))",
              color: activeTab === tab.id ? "white" : "inherit"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <aside style={{ ...mutedCardStyle, display: "grid", gap: "10px" }}>
        <h3 style={{ fontWeight: 800, margin: 0 }}>Ações rápidas</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" onClick={() => onNavigate(`/agenda?patientId=${patient.id}&new=1`)} style={primaryButtonStyle}>Novo agendamento</button>
          <button type="button" onClick={() => onNavigate(`/financeiro/baixas?patientId=${patient.id}`)} style={buttonStyle}>Receber pagamento</button>
          <button type="button" onClick={() => onNavigate(`/pacotes?patientId=${patient.id}`)} style={buttonStyle}>Pacotes</button>
          <button type="button" onClick={() => onNavigate(`/financeiro?patientId=${patient.id}`)} style={buttonStyle}>Histórico financeiro</button>
          <button type="button" onClick={() => setActiveTab("timeline")} style={buttonStyle}>Histórico de atendimentos</button>
          <button type="button" onClick={() => whatsappHref && window.open(whatsappHref, "_blank")} disabled={!whatsappHref} style={buttonStyle}>WhatsApp</button>
          <button type="button" onClick={printCurrentView} style={buttonStyle}>Imprimir</button>
        </div>
      </aside>

      {activeTab === "resumo" ? (
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div style={{ textAlign: "left" }}>{metric("Sessões realizadas", completedSessions)}</div>
          <button type="button" onClick={() => nextAppointment && onNavigate("/agenda?patientId=" + patient.id + "&appointmentId=" + nextAppointment.id)} disabled={!nextAppointment} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Proximo atendimento", nextAppointment ? formatDate(nextAppointment.appointment_date) + " " + nextAppointment.start_time : "-")}</button>
          <button type="button" onClick={() => lastAppointment && onNavigate("/agenda?patientId=" + patient.id + "&appointmentId=" + lastAppointment.id)} disabled={!lastAppointment} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Ultimo atendimento", lastAppointment ? formatDate(lastAppointment.appointment_date) : "-")}</button>
          <button type="button" onClick={() => activePackage && onNavigate("/pacotes?patientId=" + patient.id)} disabled={!activePackage} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Sessões restantes", remainingSessions)}</button>
          <button type="button" onClick={() => activePackage && onNavigate("/pacotes?patientId=" + patient.id)} disabled={!activePackage} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Pacotes ativos", packages.filter(isActivePackage).length)}</button>
          <button type="button" onClick={() => totalOpen > 0 && onNavigate("/financeiro/baixas?patientId=" + patient.id)} disabled={totalOpen <= 0} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Pendências financeiras", money(totalOpen), totalOpen > 0 ? "danger" : "success")}</button>
          <button type="button" onClick={() => paidTransactions.length > 0 && onNavigate("/financeiro?patientId=" + patient.id)} disabled={paidTransactions.length === 0} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Total pago", money(totalPaid), "success")}</button>
          <button type="button" onClick={() => lastPayment && onNavigate("/financeiro?patientId=" + patient.id)} disabled={!lastPayment} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Ultimo pagamento", lastPayment ? formatDate(lastPayment.updated_at ?? lastPayment.due_date) : "-")}</button>
          <button type="button" onClick={() => lastEvolution && setActiveTab("prontuario")} disabled={!lastEvolution} style={{ ...mutedCardStyle, textAlign: "left" }}>{metric("Ultima evolucao", lastEvolution ? formatDateTime(lastEvolution.created_at) : "-")}</button>
        </div>
      ) : null}
      {activeTab === "agenda" ? (
        <div style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => onNavigate(`/agenda?patientId=${patient.id}&new=1`)} style={primaryButtonStyle}>
            Novo Agendamento
          </button>
        </div>
        {nextAppointment ? <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {["Editar", "Reagendar", "Cancelar", "Registrar falta", "Finalizar atendimento", "Abrir atendimento"].map((label) => <button key={label} type="button" onClick={() => onNavigate("/agenda?patientId=" + patient.id + "&appointmentId=" + nextAppointment.id)} style={buttonStyle}>{label}</button>)}
          <button type="button" disabled={!whatsappHref} onClick={() => whatsappHref && window.open(whatsappHref + "?text=" + encodeURIComponent(confirmationMessage), "_blank")} style={buttonStyle}>Enviar confirmacao</button>
          <button type="button" disabled={!whatsappHref} onClick={() => whatsappHref && window.open(whatsappHref + "?text=" + encodeURIComponent(reminderMessage), "_blank")} style={buttonStyle}>Enviar lembrete</button>
        </div> : null}        <DataTable
          empty="Nenhum atendimento encontrado para este paciente."
          headers={["Data", "Horario", "Servico", "Profissional", "Tipo", "Status"]}
          rows={patientAppointments.map((appointment) => [
            formatDate(appointment.appointment_date),
            `${appointment.start_time}${appointment.end_time ? ` - ${appointment.end_time}` : ""}`,
            compactText(serviceById.get(appointment.service_id)?.name, "Servico"),
            compactText(employeeById.get(appointment.employee_id)?.name, "Profissional"),
            statusLabel(appointment.appointment_type),
            statusLabel(appointment.status)
          ])}
          tableCellStyle={tableCellStyle}
          onRowClick={(rowIndex) => { const appointment = patientAppointments[rowIndex]; if (appointment) onNavigate(`/agenda?patientId=${patient.id}&appointmentId=${appointment.id}`); }}
        />
        </div>
      ) : null}

      {activeTab === "financeiro" ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="button" onClick={() => onNavigate(`/financeiro?patientId=${patient.id}`)} style={buttonStyle}>Abrir Financeiro</button>
            <button type="button" onClick={() => onNavigate(`/financeiro/baixas?patientId=${patient.id}`)} style={primaryButtonStyle}>Dar baixa</button><button type="button" onClick={() => onNavigate("/financeiro/baixas?patientId=" + patient.id)} style={buttonStyle}>Baixa parcial</button><button type="button" disabled={!whatsappHref || totalOpen <= 0} onClick={() => whatsappHref && window.open(whatsappHref + "?text=" + encodeURIComponent(billingMessage), "_blank")} style={buttonStyle}>Cobrar via WhatsApp</button><button type="button" onClick={() => onNavigate("/financeiro/baixas?patientId=" + patient.id)} style={buttonStyle}>Gerar / Enviar recibo</button>
          </div>
          <DataTable
            empty="Nenhum lancamento financeiro encontrado para este paciente."
            headers={["Vencimento", "Origem", "Descricao", "Valor", "Pago", "Em aberto", "Status"]}
            rows={patientTransactions.map((transaction) => [
              formatDate(transaction.due_date),
              compactText(transaction.origin, "-"),
              compactText(transaction.description, "Lancamento"),
              money(transaction.amount),
              money(getPaidAmount(transaction)),
              money(getOpenAmount(transaction)),
              statusLabel(transaction.status)
            ])}
            tableCellStyle={tableCellStyle}
          onRowClick={() => onNavigate(`/financeiro?patientId=${patient.id}`)} 
        />
        </div>
      ) : null}

      {activeTab === "pacotes" ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><button type="button" onClick={() => onNavigate(`/pacotes?patientId=${patient.id}`)} style={primaryButtonStyle}>Novo / Abrir pacote</button><button type="button" onClick={() => onNavigate("/pacotes?patientId=" + patient.id)} style={buttonStyle}>Renovar pacote</button><button type="button" onClick={() => onNavigate("/agenda?patientId=" + patient.id + "&new=1")} style={buttonStyle}>Agendar sessao</button></div>
          <DataTable
            empty="Nenhum pacote encontrado para este paciente."
            headers={["Servico", "Status", "Contratadas", "Realizadas", "Restantes", "Validade", "Valor"]}
            rows={packages.map((patientPackage) => [
              compactText(serviceById.get(patientPackage.service_id)?.name, "Servico"),
              statusLabel(patientPackage.status),
              patientPackage.contracted_sessions,
              patientPackage.completed_sessions,
              patientPackage.remaining_sessions,
              formatDate(patientPackage.expiration_date),
              money(patientPackage.total_value)
            ])}
            tableCellStyle={tableCellStyle}
          onRowClick={() => onNavigate(`/pacotes?patientId=${patient.id}`)} 
        />
        </div>
      ) : null}

      {activeTab === "prontuario" ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <section style={{ ...mutedCardStyle, display: "grid", gap: "12px" }}>
            <div><h3 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Nova evolução</h3><p style={{ color: "hsl(var(--muted-foreground))", margin: "4px 0 0" }}>Data automática: {formatDateTime(new Date().toISOString())}</p></div>
            <label>Profissional<select value={quickForm.employee_id ?? ""} onChange={(e) => setQuickForm((f) => ({ ...f, employee_id: e.target.value }))} style={{ width: "100%", padding: "10px" }}><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
            <label>Queixa principal<textarea value={quickForm.complaint ?? ""} onChange={(e) => setQuickForm((f) => ({ ...f, complaint: e.target.value }))} style={{ minHeight: "64px", width: "100%" }} /></label>
            <label>Evolução<textarea value={quickForm.evolution ?? ""} onChange={(e) => setQuickForm((f) => ({ ...f, evolution: e.target.value }))} style={{ minHeight: "110px", width: "100%" }} /></label>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label>Conduta<textarea value={quickForm.conduct ?? ""} onChange={(e) => setQuickForm((f) => ({ ...f, conduct: e.target.value }))} style={{ minHeight: "80px", width: "100%" }} /></label>
              <label>Observações<textarea value={quickForm.notes ?? ""} onChange={(e) => setQuickForm((f) => ({ ...f, notes: e.target.value }))} style={{ minHeight: "80px", width: "100%" }} /></label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}><button type="button" onClick={() => saveQuickEvolution(false)} disabled={quickSaving} style={primaryButtonStyle}>{quickSaving ? "Salvando..." : "Salvar evolução"}</button><button type="button" onClick={() => saveQuickEvolution(true)} disabled={quickSaving} style={buttonStyle}>Salvar e nova evolução</button></div>
            {quickMessage ? <p style={{ margin: 0 }}>{quickMessage}</p> : null}
          </section>

          <section style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}><h3 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Linha do tempo</h3><button type="button" onClick={() => onNavigate("/prontuarios?q=" + encodeURIComponent(patient.full_name))} style={buttonStyle}>Abrir prontuário completo</button></div>
            {records.length ? records.map((record) => <article key={record.id} style={{ borderLeft: "3px solid #1D9E75", padding: "4px 0 12px 16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}><div><strong>{formatDateTime(record.created_at)}</strong><p style={{ color: "hsl(var(--muted-foreground))", margin: "3px 0" }}>{record.employee_id ? compactText(employeeById.get(record.employee_id)?.name, "Profissional") : "Profissional não informado"}</p></div><div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}><button type="button" onClick={() => { setSelectedRecord(record); setEditingRecord(false); }} style={buttonStyle}>Visualizar</button><button type="button" onClick={() => { setSelectedRecord(record); setEditingRecord(true); setRecordForm({ patient_id: record.patient_id ?? "", employee_id: record.employee_id ?? "", title: record.title, complaint: record.complaint ?? "", history: record.history ?? "", conduct: record.conduct ?? "", evolution: record.evolution ?? "", notes: record.notes ?? "", status: record.status }); }} style={buttonStyle}>Editar</button><button type="button" onClick={printCurrentView} style={buttonStyle}>Imprimir</button></div></div>
              <p style={{ margin: "6px 0 0" }}>{compactText(record.evolution ?? record.complaint ?? record.conduct ?? record.notes, "Registro clínico")}</p>
            </article>) : <p>Nenhuma evolução registrada.</p>}
          </section>

          {selectedRecord ? <section style={{ ...mutedCardStyle, display: "grid", gap: "8px" }}><strong>{editingRecord ? "Editar evolução" : "Detalhes da evolução"}</strong>{editingRecord ? <><textarea value={recordForm?.complaint ?? ""} onChange={(e) => setRecordForm((f) => f ? { ...f, complaint: e.target.value } : f)} placeholder="Queixa principal" /><textarea value={recordForm?.evolution ?? ""} onChange={(e) => setRecordForm((f) => f ? { ...f, evolution: e.target.value } : f)} placeholder="Evolução" /><textarea value={recordForm?.conduct ?? ""} onChange={(e) => setRecordForm((f) => f ? { ...f, conduct: e.target.value } : f)} placeholder="Conduta" /><textarea value={recordForm?.notes ?? ""} onChange={(e) => setRecordForm((f) => f ? { ...f, notes: e.target.value } : f)} placeholder="Observações" /><button type="button" onClick={saveRecord} disabled={recordSaving} style={primaryButtonStyle}>{recordSaving ? "Salvando..." : "Salvar alterações"}</button></> : <><p><b>Queixa:</b> {selectedRecord.complaint ?? "-"}</p><p><b>Evolução:</b> {selectedRecord.evolution ?? "-"}</p><p><b>Conduta:</b> {selectedRecord.conduct ?? "-"}</p><p><b>Observações:</b> {selectedRecord.notes ?? "-"}</p></>}{recordMessage ? <p>{recordMessage}</p> : null}</section> : null}
        </div>
      ) : null}
      {activeTab === "documentos" ? (
        <div style={{ ...mutedCardStyle, display: "grid", gap: "10px" }}>
          <h3 style={{ fontWeight: 800, margin: 0 }}>Documentos</h3>
          <p style={{ margin: 0 }}>
            Estrutura preparada para leitura de documentos vinculados ao paciente quando o modulo de documentos estiver disponivel.
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}>
            Nenhum documento foi criado ou migrado nesta etapa.
          </p>
        </div>
      ) : null}

      {activeTab === "whatsapp" ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {[["Confirmacao de agendamento", confirmationMessage], ["Lembrete", reminderMessage], ["Cobranca", billingMessage], ["Envio de recibo", receiptMessage], ["Pacote terminando", packageMessage], ["Agradecimento", thanksMessage]].map(([title, message]) => (
              <MessageCard key={title} title={title} message={message} disabled={!phone} onCopy={() => navigator.clipboard.writeText(message)} onOpen={() => { if (whatsappHref) window.open(whatsappHref + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer"); }} buttonStyle={buttonStyle} primaryButtonStyle={primaryButtonStyle} />
            ))}
          </div>
          <article style={{ ...mutedCardStyle, display: "grid", gap: "10px" }}><h3 style={{ margin: 0 }}>Mensagem livre</h3><textarea value={freeMessage} onChange={(event) => setFreeMessage(event.target.value)} placeholder={"Ola, " + patient.full_name + "..."} style={{ minHeight: "110px", width: "100%" }} /><button type="button" disabled={!phone || !freeMessage.trim()} onClick={() => { if (whatsappHref) window.open(whatsappHref + "?text=" + encodeURIComponent(freeMessage), "_blank", "noopener,noreferrer"); }} style={primaryButtonStyle}>Abrir WhatsApp</button></article>
        </div>
      ) : null}
      {activeTab === "timeline" ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="button" onClick={printCurrentView} style={buttonStyle}>Imprimir / Gerar PDF</button><button type="button" onClick={exportTimelineCsv} style={buttonStyle}>Exportar CSV</button>
            {timelineFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTimelineFilter(filter.id)}
                style={{
                  ...buttonStyle,
                  background: timelineFilter === filter.id ? "#1D9E75" : "transparent",
                  color: timelineFilter === filter.id ? "white" : "inherit"
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {visibleTimeline.length > 0 ? (
              visibleTimeline.map((item) => (
                <article key={item.id} onClick={() => openTimelineItem(item)} style={{ ...mutedCardStyle, cursor: item.type === "cadastro" ? "default" : "pointer" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}>
                    <strong>{item.title}</strong>
                    <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "13px" }}>{formatDateTime(item.date)}</span>
                  </div>
                  <p style={{ margin: "6px 0 0" }}>{item.description}</p>
                </article>
              ))
            ) : (
              <p style={{ color: "hsl(var(--muted-foreground))" }}>Nenhum evento encontrado para o filtro selecionado.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DataTable({
  headers,
  rows,
  empty,
  tableCellStyle,
  onRowClick
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  empty: string;
  tableCellStyle: React.CSSProperties;
  onRowClick?: (rowIndex: number) => void;
}) {
  if (rows.length === 0) {
    return <p style={{ color: "hsl(var(--muted-foreground))" }}>{empty}</p>;
  }

  return (
    <div style={{ maxWidth: "100%", overflow: "hidden" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={{ ...tableCellStyle, color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} onClick={() => onRowClick?.(rowIndex)} style={onRowClick ? { cursor: "pointer" } : undefined}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} style={tableCellStyle}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageCard({
  title,
  message,
  disabled,
  onCopy,
  onOpen,
  buttonStyle,
  primaryButtonStyle
}: {
  title: string;
  message: string;
  disabled: boolean;
  onCopy: () => void;
  onOpen: () => void;
  buttonStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
}) {
  return (
    <article style={{ border: "1px solid hsl(var(--border))", borderRadius: "10px", display: "grid", gap: "12px", padding: "14px" }}>
      <h3 style={{ fontWeight: 800, margin: 0 }}>{title}</h3>
      <pre style={{ background: "hsl(var(--muted) / 0.35)", borderRadius: "8px", fontFamily: "inherit", margin: 0, padding: "12px", whiteSpace: "pre-wrap" }}>
        {message}
      </pre>
      {disabled ? <p style={{ color: "hsl(var(--destructive))", margin: 0 }}>Telefone do paciente nao informado.</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button type="button" onClick={onCopy} style={buttonStyle}>
          Copiar mensagem
        </button>
        <button type="button" onClick={onOpen} disabled={disabled} style={primaryButtonStyle}>
          Abrir WhatsApp
        </button>
      </div>
    </article>
  );
}












