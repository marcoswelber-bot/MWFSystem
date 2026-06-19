"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  createCrudRecord,
  deleteCrudRecord,
  setCrudRecordStatus,
  updateCrudRecord,
  type CrudActionResult,
  type CrudPayload,
  type CrudTable,
  type CrudValue
} from "@/lib/actions/entity-crud";
import type { PermissionSet } from "@/lib/permission-modules";

export type EntityRecord = {
  id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: CrudValue | undefined;
};

type FieldType = "text" | "email" | "number" | "textarea" | "select" | "checkbox";

export type EntityField = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type EntityColumn = {
  key: string;
  label: string;
  render?: (record: EntityRecord) => string;
};

type EntityCrudManagerProps = {
  table: CrudTable;
  basePath: Route;
  entityLabel: string;
  entityLabelPlural: string;
  newButtonLabel: string;
  searchPlaceholder: string;
  records: EntityRecord[];
  fields: EntityField[];
  columns: EntityColumn[];
  initialSearch: string;
  loadError?: string;
  permissions?: PermissionSet;
};

type StatusFilter = "all" | "active" | "inactive";

function getEmptyForm(fields: EntityField[]) {
  return fields.reduce<CrudPayload>((accumulator, field) => {
    accumulator[field.name] = field.type === "checkbox" ? true : "";
    return accumulator;
  }, {});
}

function recordToForm(record: EntityRecord, fields: EntityField[]) {
  return fields.reduce<CrudPayload>((accumulator, field) => {
    const value = record[field.name];
    accumulator[field.name] = value ?? (field.type === "checkbox" ? false : "");
    return accumulator;
  }, {});
}

function normalizeFormValue(field: EntityField, value: CrudValue) {
  if (field.type === "number") {
    if (value === "" || value === null) {
      return null;
    }

    return Number(value);
  }

  return value;
}

function getPayload(fields: EntityField[], form: CrudPayload) {
  return fields.reduce<CrudPayload>((payload, field) => {
    payload[field.name] = normalizeFormValue(field, form[field.name] ?? null);
    return payload;
  }, {});
}

function displayValue(value: CrudValue | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  return String(value);
}

export function EntityCrudManager({
  table,
  basePath,
  entityLabel,
  entityLabelPlural,
  newButtonLabel,
  searchPlaceholder,
  records,
  fields,
  columns,
  initialSearch,
  loadError,
  permissions
}: EntityCrudManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<EntityRecord | null>(null);
  const [form, setForm] = React.useState<CrudPayload>(() => getEmptyForm(fields));
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [message, setMessage] = React.useState<CrudActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );
  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;
  const canToggle = permissions?.toggle ?? true;

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

  function updateForm(field: EntityField, value: CrudValue) {
    setForm((currentForm) => ({ ...currentForm, [field.name]: value }));
  }

  function openCreateForm() {
    setEditingRecord(null);
    setForm(getEmptyForm(fields));
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(record: EntityRecord) {
    setEditingRecord(record);
    setForm(recordToForm(record, fields));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingRecord(null);
    setForm(getEmptyForm(fields));
    setFormOpen(false);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    const nextPath = query
      ? `${basePath}?q=${encodeURIComponent(query)}`
      : basePath;
    router.push(nextPath as Route);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const missingRequiredField = fields.find((field) => {
      const value = form[field.name];
      return field.required && (typeof value !== "string" || !value.trim());
    });

    if (missingRequiredField) {
      setMessage({
        ok: false,
        message: `${missingRequiredField.label} e obrigatorio.`
      });
      return;
    }

    const payload = getPayload(fields, form);

    startTransition(async () => {
      const result = editingRecord
        ? await updateCrudRecord(table, basePath, editingRecord.id, payload)
        : await createCrudRecord(table, basePath, payload);

      setMessage(result);

      if (result.ok) {
        closeForm();
        router.refresh();
      }
    });
  }

  function toggleStatus(record: EntityRecord) {
    setMessage(null);
    startTransition(async () => {
      const result = await setCrudRecordStatus(
        table,
        basePath,
        record.id,
        record.status === "active" ? "inactive" : "active"
      );

      setMessage(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function deleteRecord(record: EntityRecord) {
    const displayName = String(record.name ?? record.title ?? entityLabel);
    const confirmed = window.confirm(
      `Excluir definitivamente ${displayName}? Esta acao nao pode ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteCrudRecord(table, basePath, record.id);
      setMessage(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

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
            placeholder={searchPlaceholder}
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
            {newButtonLabel}
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
          <p>{entityLabelPlural} ativos</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{filteredRecords.length}</strong>
          <p>Registros encontrados</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{inactiveCount}</strong>
          <p>{entityLabelPlural} inativos</p>
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
                {editingRecord ? `Editar ${entityLabel}` : newButtonLabel}
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
            {fields.map((field) => (
              <label
                key={field.name}
                style={field.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}
              >
                {field.label}
                {field.type === "select" ? (
                  <select
                    required={field.required}
                    value={String(form[field.name] ?? "")}
                    onChange={(event) => updateForm(field, event.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Selecione</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    required={field.required}
                    value={String(form[field.name] ?? "")}
                    onChange={(event) => updateForm(field, event.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    style={inputStyle}
                  />
                ) : field.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.name])}
                    onChange={(event) => updateForm(field, event.target.checked)}
                    style={{ marginLeft: "10px" }}
                  />
                ) : (
                  <input
                    required={field.required}
                    type={field.type ?? "text"}
                    value={String(form[field.name] ?? "")}
                    onChange={(event) => updateForm(field, event.target.value)}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                )}
              </label>
            ))}

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
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    borderBottom: "1px solid hsl(var(--border))",
                    padding: "10px",
                    textAlign: "left"
                  }}
                >
                  {column.label}
                </th>
              ))}
              <th
                style={{
                  borderBottom: "1px solid hsl(var(--border))",
                  padding: "10px",
                  textAlign: "right"
                }}
              >
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record.id}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}
                    >
                      {column.render
                        ? column.render(record)
                        : displayValue(record[column.key])}
                    </td>
                  ))}
                  <td
                    style={{
                      borderBottom: "1px solid hsl(var(--border))",
                      padding: "10px",
                      textAlign: "right"
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end" }}>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEditForm(record)}
                          style={buttonStyle}
                        >
                          Editar
                        </button>
                      ) : null}
                      {canToggle ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => toggleStatus(record)}
                          style={buttonStyle}
                        >
                          {record.status === "active" ? "Inativar" : "Ativar"}
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => deleteRecord(record)}
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
                <td
                  colSpan={columns.length + 1}
                  style={{ padding: "16px", textAlign: "center" }}
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
