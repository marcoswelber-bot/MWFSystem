"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
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
type StatusFilter = "all" | "active" | "inactive";

type PatientsManagerProps = {
  patients: Patient[];
  initialSearch: string;
  loadError?: string;
};

const emptyForm: PatientFormInput = {
  full_name: "",
  cpf: "",
  birth_date: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active"
};

function patientToForm(patient: Patient): PatientFormInput {
  return {
    full_name: patient.full_name,
    cpf: patient.cpf ?? "",
    birth_date: patient.birth_date ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    notes: patient.notes ?? "",
    status: patient.status
  };
}

export function PatientsManager({
  patients,
  initialSearch,
  loadError
}: PatientsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [form, setForm] = React.useState<PatientFormInput>(emptyForm);
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [message, setMessage] = React.useState<PatientActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

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

  function updateForm(field: keyof PatientFormInput, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function openCreateForm() {
    setEditingPatient(null);
    setForm(emptyForm);
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
                        onClick={() => openEditForm(patient)}
                        style={buttonStyle}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => togglePatientStatus(patient)}
                        style={buttonStyle}
                      >
                        {patient.status === "active" ? "Inativar" : "Ativar"}
                      </button>
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
