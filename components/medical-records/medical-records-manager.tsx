"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import {
  activateMedicalRecord,
  createMedicalRecord,
  deactivateMedicalRecord,
  deleteMedicalRecord,
  type MedicalRecordActionResult,
  type MedicalRecordFormInput,
  updateMedicalRecord
} from "@/app/(app)/prontuarios/actions";

type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"];

export type PatientOption = {
  id: string;
  full_name: string;
};

export type EmployeeOption = {
  id: string;
  name: string;
};

type DisplayMedicalRecord = MedicalRecord & {
  patient_name: string;
  employee_name: string;
};

type StatusFilter = "all" | "active" | "inactive";

type MedicalRecordsManagerProps = {
  records: DisplayMedicalRecord[];
  patients: PatientOption[];
  employees: EmployeeOption[];
  initialSearch: string;
  loadError?: string;
};

const emptyForm: MedicalRecordFormInput = {
  patient_id: "",
  employee_id: "",
  title: "",
  complaint: "",
  history: "",
  conduct: "",
  evolution: "",
  notes: "",
  status: "active"
};

function recordToForm(record: DisplayMedicalRecord): MedicalRecordFormInput {
  return {
    patient_id: record.patient_id ?? "",
    employee_id: record.employee_id ?? "",
    title: record.title,
    complaint: record.complaint ?? "",
    history: record.history ?? "",
    conduct: record.conduct ?? "",
    evolution: record.evolution ?? "",
    notes: record.notes ?? "",
    status: record.status
  };
}

export function MedicalRecordsManager({
  records,
  patients,
  employees,
  initialSearch,
  loadError
}: MedicalRecordsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] =
    React.useState<DisplayMedicalRecord | null>(null);
  const [form, setForm] = React.useState<MedicalRecordFormInput>(emptyForm);
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [message, setMessage] = React.useState<MedicalRecordActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  const activeCount = records.filter((record) => record.status === "active").length;
  const inactiveCount = records.filter(
    (record) => record.status === "inactive"
  ).length;

  const filteredRecords = records.filter((record) => {
    if (statusFilter === "all") {
      return true;
    }

    return record.status === statusFilter;
  });

  function updateForm(field: keyof MedicalRecordFormInput, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function openCreateForm() {
    setEditingRecord(null);
    setForm(emptyForm);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(record: DisplayMedicalRecord) {
    setEditingRecord(record);
    setForm(recordToForm(record));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingRecord(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function refreshRecords() {
    router.refresh();
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(
      query ? `/prontuarios?q=${encodeURIComponent(query)}` : "/prontuarios"
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.title.trim()) {
      setMessage({ ok: false, message: "Titulo do prontuario e obrigatorio." });
      return;
    }

    startTransition(async () => {
      const result = editingRecord
        ? await updateMedicalRecord(editingRecord.id, form)
        : await createMedicalRecord(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refreshRecords();
      }
    });
  }

  function toggleRecordStatus(record: DisplayMedicalRecord) {
    setMessage(null);
    startTransition(async () => {
      const result =
        record.status === "active"
          ? await deactivateMedicalRecord(record.id)
          : await activateMedicalRecord(record.id);

      setMessage(result);

      if (result.ok) {
        refreshRecords();
      }
    });
  }

  function handleDeleteRecord(record: DisplayMedicalRecord) {
    const confirmed = window.confirm(
      `Excluir definitivamente o prontuario ${record.title}? Esta acao nao pode ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteMedicalRecord(record.id);
      setMessage(result);

      if (result.ok) {
        refreshRecords();
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
            placeholder="Buscar por titulo, paciente ou observacoes"
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
          Novo prontuario
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
          <p>Prontuarios ativos</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{filteredRecords.length}</strong>
          <p>Registros encontrados</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{inactiveCount}</strong>
          <p>Prontuarios inativos</p>
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
                {editingRecord ? "Editar prontuario" : "Novo prontuario"}
              </h2>
              <p>Preencha os dados clinicos principais.</p>
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
              Paciente
              <select
                value={form.patient_id}
                onChange={(event) => updateForm("patient_id", event.target.value)}
                style={inputStyle}
              >
                <option value="">
                  {patients.length ? "Sem paciente vinculado" : "Nenhum paciente cadastrado"}
                </option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Funcionario
              <select
                value={form.employee_id}
                onChange={(event) => updateForm("employee_id", event.target.value)}
                style={inputStyle}
              >
                <option value="">
                  {employees.length
                    ? "Sem funcionario vinculado"
                    : "Nenhum funcionario cadastrado"}
                </option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input
                required
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Queixa
              <textarea
                value={form.complaint}
                onChange={(event) => updateForm("complaint", event.target.value)}
                rows={3}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Historico
              <textarea
                value={form.history}
                onChange={(event) => updateForm("history", event.target.value)}
                rows={3}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Conduta
              <textarea
                value={form.conduct}
                onChange={(event) => updateForm("conduct", event.target.value)}
                rows={3}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Evolucao
              <textarea
                value={form.evolution}
                onChange={(event) => updateForm("evolution", event.target.value)}
                rows={3}
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observacoes
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
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
              {["Paciente", "Funcionario", "Titulo", "Observacoes", "Status", "Acoes"].map(
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
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {record.patient_name}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {record.employee_name}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {record.title}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {record.notes ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {record.status === "active" ? "Ativo" : "Inativo"}
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
                        onClick={() => openEditForm(record)}
                        style={buttonStyle}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggleRecordStatus(record)}
                        style={buttonStyle}
                      >
                        {record.status === "active" ? "Inativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteRecord(record)}
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
                  Nenhum prontuario encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
