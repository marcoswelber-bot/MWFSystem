"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { Database } from "@/types/database";
import type { PermissionSet } from "@/lib/permission-modules";
import { PatientIntegratedSheet } from "@/components/patients/patient-integrated-sheet";
import {
  activatePatient,
  createPatient,
  deactivatePatient,
  deletePatient,
  type PatientActionResult,
  type PatientFormInput,
  updatePatient
} from "@/app/(app)/pacientes/actions";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];
type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type StatusFilter = "all" | "active" | "inactive";

type PatientsManagerProps = {
  patients: Patient[];
  clinics: Clinic[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  patientPackages: PatientPackage[];
  medicalRecords: MedicalRecord[];
  employees: Employee[];
  services: Service[];
  isAdmMaster: boolean;
  currentClinicId: string | null;
  initialSearch: string;
  loadError?: string;
  permissions?: PermissionSet;
};

const emptyForm: PatientFormInput = {
  full_name: "",
  clinic_id: "",
  cpf: "",
  birth_date: "",
  phone: "",
  email: "",
  portal_access: false,
  login_email: "",
  auth_password: "",
  address: "",
  notes: "",
  status: "active"
};

function patientToForm(patient: Patient): PatientFormInput {
  return {
    full_name: patient.full_name,
    clinic_id: patient.clinic_id ?? "",
    cpf: patient.cpf ?? "",
    birth_date: patient.birth_date ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    portal_access: patient.portal_access,
    login_email: patient.login_email ?? "",
    auth_password: "",
    address: patient.address ?? "",
    notes: patient.notes ?? "",
    status: patient.status
  };
}

export function PatientsManager({
  patients,
  clinics,
  appointments,
  transactions,
  patientPackages,
  medicalRecords,
  employees,
  services,
  isAdmMaster,
  currentClinicId,
  initialSearch,
  loadError,
  permissions
}: PatientsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [form, setForm] = React.useState<PatientFormInput>(emptyForm);
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<PatientActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );
  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;
  const canToggle = permissions?.toggle ?? true;
  const selectedPatient = selectedPatientId
    ? patients.find((patient) => patient.id === selectedPatientId) ?? null
    : null;

  const activeCount = patients.filter((patient) => patient.status === "active").length;
  const inactiveCount = patients.filter(
    (patient) => patient.status === "inactive"
  ).length;

  const filteredPatients = patients.filter((patient) => {
    if (statusFilter === "all") {
      return true;
    }

    return patient.status === statusFilter;
  });

  function updateForm(field: keyof PatientFormInput, value: string | boolean) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function openCreateForm() {
    setEditingPatient(null);
    setForm({
      ...emptyForm,
      clinic_id: isAdmMaster ? "" : currentClinicId ?? ""
    });
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(patient: Patient) {
    setEditingPatient(patient);
    setForm(patientToForm(patient));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingPatient(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function refreshPatients() {
    router.refresh();
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/pacientes?q=${encodeURIComponent(query)}` : "/pacientes");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.full_name.trim()) {
      setMessage({ ok: false, message: "Nome do paciente e obrigatorio." });
      return;
    }

    if (form.portal_access && !form.login_email?.trim()) {
      setMessage({
        ok: false,
        message: "Informe o email de login para liberar acesso ao portal."
      });
      return;
    }

    startTransition(async () => {
      const result = editingPatient
        ? await updatePatient(editingPatient.id, form)
        : await createPatient(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refreshPatients();
      }
    });
  }

  function togglePatientStatus(patient: Patient) {
    setMessage(null);
    startTransition(async () => {
      const result =
        patient.status === "active"
          ? await deactivatePatient(patient.id)
          : await activatePatient(patient.id);

      setMessage(result);

      if (result.ok) {
        refreshPatients();
      }
    });
  }

  function handleDeletePatient(patient: Patient) {
    const confirmed = window.confirm(
      `Excluir definitivamente o paciente ${patient.full_name}? Esta acao nao pode ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deletePatient(patient.id);
      setMessage(result);

      if (result.ok) {
        refreshPatients();
      }
    });
  }

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

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "end",
          justifyContent: "space-between",
          gap: "16px"
        }}
      >
        <form
          onSubmit={submitSearch}
          style={{ display: "flex", flex: "1 1 420px", gap: "8px" }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, CPF ou telefone"
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>
            Buscar
          </button>
        </form>

        {canCreate ? (
          <button
            type="button"
            onClick={openCreateForm}
            style={{
              ...buttonStyle,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))"
            }}
          >
            Novo paciente
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[
          ["all", "Todos"],
          ["active", "Ativos"],
          ["inactive", "Inativos"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value as StatusFilter)}
            style={{
              ...buttonStyle,
              background:
                statusFilter === value ? "hsl(var(--primary))" : "transparent",
              color:
                statusFilter === value
                  ? "hsl(var(--primary-foreground))"
                  : "inherit"
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{activeCount}</strong>
          <p>Pacientes ativos</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{filteredPatients.length}</strong>
          <p>Registros encontrados</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{inactiveCount}</strong>
          <p>Pacientes inativos</p>
        </div>
      </section>

      {selectedPatient ? (
        <PatientIntegratedSheet
          patient={selectedPatient}
          clinics={clinics}
          appointments={appointments}
          transactions={transactions}
          patientPackages={patientPackages}
          medicalRecords={medicalRecords}
          employees={employees}
          services={services}
          onClose={() => setSelectedPatientId(null)}
          onEdit={openEditForm}
          onNavigate={(href) => router.push(href as Route)}
        />
      ) : null}

      {formOpen ? (
        <section
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            display: "grid",
            gap: "16px",
            padding: "20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
                {editingPatient ? "Editar paciente" : "Novo paciente"}
              </h2>
              <p>Preencha os dados principais do cadastro.</p>
            </div>
            <button type="button" onClick={closeForm} style={buttonStyle}>
              Fechar
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gap: "14px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <label>
              Nome completo
              <input
                required
                value={form.full_name}
                onChange={(event) => updateForm("full_name", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Clinica/Unidade
              <select
                value={form.clinic_id ?? ""}
                onChange={(event) => updateForm("clinic_id", event.target.value)}
                disabled={!isAdmMaster}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              CPF
              <input
                value={form.cpf}
                onChange={(event) => updateForm("cpf", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Data de nascimento
              <input
                type="date"
                value={form.birth_date}
                onChange={(event) => updateForm("birth_date", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Telefone
              <input
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Tem acesso ao portal?
              <select
                value={form.portal_access ? "yes" : "no"}
                onChange={(event) =>
                  updateForm("portal_access", event.target.value === "yes")
                }
                style={inputStyle}
              >
                <option value="no">Nao</option>
                <option value="yes">Sim</option>
              </select>
            </label>
            <label>
              Email de login
              <input
                type="email"
                value={form.login_email}
                onChange={(event) => updateForm("login_email", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Senha provisoria
              <input
                type="password"
                autoComplete="new-password"
                value={form.auth_password}
                onChange={(event) =>
                  updateForm("auth_password", event.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label>
              Endereco
              <input
                value={form.address}
                onChange={(event) => updateForm("address", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observacoes
              <input
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                style={inputStyle}
              />
            </label>
            <div
              style={{
                display: "flex",
                gap: "8px",
                gridColumn: "1 / -1",
                justifyContent: "flex-end"
              }}
            >
              <button type="button" onClick={closeForm} style={buttonStyle}>
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

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Nome", "CPF", "Telefone", "Email", "Status", "Acoes"].map(
                (heading) => (
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
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <tr key={patient.id}>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {patient.full_name}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {patient.cpf ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {patient.phone ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {patient.email ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {patient.status === "active" ? "Ativo" : "Inativo"}
                  </td>
                  <td
                    style={{
                      borderBottom: "1px solid hsl(var(--border))",
                      padding: "10px",
                      textAlign: "right"
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPatientId(patient.id)}
                        style={{
                          ...buttonStyle,
                          background: "#1D9E75",
                          borderColor: "#1D9E75",
                          color: "white"
                        }}
                      >
                        Abrir ficha
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEditForm(patient)}
                          style={buttonStyle}
                        >
                          Editar
                        </button>
                      ) : null}
                      {canToggle ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => togglePatientStatus(patient)}
                          style={buttonStyle}
                        >
                          {patient.status === "active" ? "Inativar" : "Ativar"}
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeletePatient(patient)}
                          style={{
                            ...buttonStyle,
                            borderColor: "hsl(var(--destructive))",
                            color: "hsl(var(--destructive))"
                          }}
                        >
                          Excluir definitivo
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: "16px", textAlign: "center" }}>
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}