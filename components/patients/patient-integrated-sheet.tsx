"use client";

import * as React from "react";
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

type TimelineFilter = "todos" | "agenda" | "financeiro" | "pacotes" | "prontuario";

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
  { id: "timeline", label: "Linha do tempo" }
];

const timelineFilters: Array<{ id: TimelineFilter; label: string }> = [
  { id: "todos", label: "Todos" },
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

function getAge(birthDate: string | null) {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
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
  if (!patientPackage.status || patientPackage.status.toLowerCase() !== "ativo") {
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
  const [activeTab, setActiveTab] = React.useState<PatientTab>("resumo");
  const [timelineFilter, setTimelineFilter] = React.useState<TimelineFilter>("todos");
  const [selectedRecord, setSelectedRecord] = React.useState<MedicalRecord | null>(null);
  const [editingRecord, setEditingRecord] = React.useState(false);
  const [recordForm, setRecordForm] = React.useState<MedicalRecordFormInput | null>(null);

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
  const age = getAge(patient.birth_date);
  const phone = normalizePhone(patient.phone);
  const whatsappHref = phone ? `https://wa.me/55${phone}` : null;

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

    return [...appointmentItems, ...financialItems, ...packageItems, ...recordItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [employeeById, packages, patientAppointments, patientTransactions, records, serviceById]);

  const visibleTimeline = timelineFilter === "todos" ? timeline : timeline.filter((item) => item.type === timelineFilter);

  const billingMessage = `Ola, ${patient.full_name}!\n\nIdentificamos valores pendentes no seu cadastro da ${clinic?.name ?? "clinica"}.\n\nValor em aberto: ${money(totalOpen)}\n\nCaso ja tenha realizado o pagamento, por favor envie o comprovante por este WhatsApp para que possamos identificar e dar baixa.\n\nAtenciosamente,\n${clinic?.name ?? "Equipe"}`;
  const reminderMessage = `Ola, ${patient.full_name}!\n\nLembramos do seu proximo atendimento em ${nextAppointment ? `${formatDate(nextAppointment.appointment_date)} as ${nextAppointment.start_time}` : "data a confirmar"}.\n\nAtenciosamente,\n${clinic?.name ?? "Equipe"}`;

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
              {patient.cpf ? `CPF ${patient.cpf}` : "CPF nao informado"} - {statusLabel(patient.status)}
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

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {field("Nascimento", `${formatDate(patient.birth_date)}${age !== null ? ` - ${age} anos` : ""}`)}
        {field("Telefone", compactText(patient.phone, "Nao informado"))}
        {field("Email", compactText(patient.email, "Nao informado"))}
        {field("Clinica", compactText(clinic?.name, "Nao vinculada"))}
        {field("Cadastro", formatDate(patient.created_at))}
        {field("Portal", patient.portal_access ? "Liberado" : "Sem acesso")}
      </div>

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {metric("Ultimo atendimento", lastAppointment ? formatDate(lastAppointment.appointment_date) : "-", "default")}
        {metric("Proximo atendimento", nextAppointment ? `${formatDate(nextAppointment.appointment_date)} ${nextAppointment.start_time}` : "-", "success")}
        {metric("Pacote ativo", activePackage ? `${activePackage.remaining_sessions} restantes` : "Nenhum", "default")}
        {metric("Valor em aberto", money(totalOpen), totalOpen > 0 ? "danger" : "success")}
        {metric("Total pago", money(totalPaid), "success")}
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

      {activeTab === "resumo" ? (
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div style={mutedCardStyle}>
            <h3 style={{ fontWeight: 800, marginTop: 0 }}>Resumo operacional</h3>
            <p>Atendimentos registrados: {patientAppointments.length}</p>
            <p>Prontuarios: {records.length}</p>
            <p>Pacotes cadastrados: {packages.length}</p>
            <button type="button" onClick={() => onNavigate(`/agenda?patientId=${patient.id}`)} style={primaryButtonStyle}>
              Abrir Agenda
            </button>
          </div>
          <div style={mutedCardStyle}>
            <h3 style={{ fontWeight: 800, marginTop: 0 }}>Resumo financeiro</h3>
            <p>Em aberto: {money(totalOpen)}</p>
            <p>Pago: {money(totalPaid)}</p>
            <p>Debitos pendentes: {openTransactions.length}</p>
            <button type="button" onClick={() => onNavigate(`/financeiro/baixas?patientId=${patient.id}`)} style={primaryButtonStyle}>
              Abrir baixas
            </button>
          </div>
          <div style={mutedCardStyle}>
            <h3 style={{ fontWeight: 800, marginTop: 0 }}>Observacoes</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{compactText(patient.notes, "Nenhuma observacao cadastrada.")}</p>
          </div>
        </div>
      ) : null}

      {activeTab === "agenda" ? (
        <div style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => onNavigate(`/agenda?patientId=${patient.id}&new=1`)} style={primaryButtonStyle}>
            Novo Agendamento
          </button>
        </div>
        <DataTable
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
            <button type="button" onClick={() => onNavigate(`/financeiro/baixas?patientId=${patient.id}`)} style={primaryButtonStyle}>Dar baixa</button>
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
          <button type="button" onClick={() => onNavigate(`/pacotes?patientId=${patient.id}`)} style={primaryButtonStyle}>Abrir Pacotes</button>
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
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><button type="button" onClick={() => { setSelectedRecord(null); setEditingRecord(true); setRecordForm({ patient_id: patient.id, employee_id: "", title: "", complaint: "", history: "", conduct: "", evolution: "", notes: "", status: "active" }); }} style={primaryButtonStyle}>Novo Prontuário</button><button type="button" onClick={() => onNavigate(`/prontuarios?patientId=${patient.id}`)} style={buttonStyle}>Abrir módulo</button></div>
          <DataTable
            empty="Nenhum registro de prontuario encontrado para este paciente."
            headers={["Data", "Titulo", "Profissional", "Evolucao", "Status"]}
            rows={records.map((record) => [
              formatDateTime(record.created_at),
              record.title,
              record.employee_id ? compactText(employeeById.get(record.employee_id)?.name, "Profissional") : "-",
              compactText(record.evolution ?? record.conduct ?? record.notes, "-"),
              statusLabel(record.status)
            ])}
            tableCellStyle={tableCellStyle}
            onRowClick={(rowIndex) => { const record = records[rowIndex]; if (record) { setSelectedRecord(record); setEditingRecord(false); setRecordForm({ patient_id: record.patient_id ?? "", employee_id: record.employee_id ?? "", title: record.title, complaint: record.complaint ?? "", history: record.history ?? "", conduct: record.conduct ?? "", evolution: record.evolution ?? "", notes: record.notes ?? "", status: record.status }); } }}
        />
          {selectedRecord ? (
            <div style={{ ...mutedCardStyle, display: "grid", gap: "8px" }}>
              <strong>{editingRecord ? "Editar prontuário" : "Visualizar prontuário"}</strong>
              <p><b>Título:</b> {selectedRecord.title}</p>
              <p><b>Queixa:</b> {selectedRecord.complaint ?? "-"}</p>
              <p><b>Histórico:</b> {selectedRecord.history ?? "-"}</p>
              <p><b>Evolução:</b> {selectedRecord.evolution ?? "-"}</p>
              <p><b>Conduta:</b> {selectedRecord.conduct ?? "-"}</p>
              <p><b>Observações:</b> {selectedRecord.notes ?? "-"}</p>
              <button type="button" onClick={() => setEditingRecord(true)} style={buttonStyle}>Editar</button>
            </div>
          ) : null}
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
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <MessageCard
            title="Cobranca manual"
            message={billingMessage}
            disabled={!phone}
            onCopy={() => navigator.clipboard.writeText(billingMessage)}
            onOpen={() => {
              if (whatsappHref) {
                window.open(`${whatsappHref}?text=${encodeURIComponent(billingMessage)}`, "_blank", "noopener,noreferrer");
              }
            }}
            buttonStyle={buttonStyle}
            primaryButtonStyle={primaryButtonStyle}
          />
          <MessageCard
            title="Lembrete de atendimento"
            message={reminderMessage}
            disabled={!phone}
            onCopy={() => navigator.clipboard.writeText(reminderMessage)}
            onOpen={() => {
              if (whatsappHref) {
                window.open(`${whatsappHref}?text=${encodeURIComponent(reminderMessage)}`, "_blank", "noopener,noreferrer");
              }
            }}
            buttonStyle={buttonStyle}
            primaryButtonStyle={primaryButtonStyle}
          />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
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
                <article key={item.id} style={mutedCardStyle}>
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
    <div style={{ overflowX: "auto" }}>
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











