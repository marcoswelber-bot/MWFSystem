"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  deleteEmployee,
  type EmployeeActionResult,
  type EmployeeFormInput,
  updateEmployee
} from "@/app/(app)/funcionarios/actions";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type StatusFilter = "all" | "active" | "inactive";

type EmployeesManagerProps = {
  employees: Employee[];
  initialSearch: string;
  loadError?: string;
};

const emptyForm: EmployeeFormInput = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  role: "",
  commission_type: "",
  commission_value: "",
  status: "active"
};

function employeeToForm(employee: Employee): EmployeeFormInput {
  return {
    name: employee.name,
    phone: employee.phone ?? "",
    whatsapp: employee.whatsapp ?? "",
    email: employee.email ?? "",
    role: employee.role ?? "",
    commission_type: employee.commission_type ?? "",
    commission_value:
      employee.commission_value === null ? "" : String(employee.commission_value),
    status: employee.status
  };
}

export function EmployeesManager({
  employees,
  initialSearch,
  loadError
}: EmployeesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);
  const [form, setForm] = React.useState<EmployeeFormInput>(emptyForm);
  const [search, setSearch] = React.useState(initialSearch);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [message, setMessage] = React.useState<EmployeeActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  const activeCount = employees.filter(
    (employee) => employee.status === "active"
  ).length;
  const inactiveCount = employees.filter(
    (employee) => employee.status === "inactive"
  ).length;

  const filteredEmployees = employees.filter((employee) => {
    if (statusFilter === "all") {
      return true;
    }

    return employee.status === statusFilter;
  });

  function updateForm(field: keyof EmployeeFormInput, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function openCreateForm() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);
    setForm(employeeToForm(employee));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function refreshEmployees() {
    router.refresh();
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(
      query ? `/funcionarios?q=${encodeURIComponent(query)}` : "/funcionarios"
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim()) {
      setMessage({ ok: false, message: "Nome do funcionario e obrigatorio." });
      return;
    }

    startTransition(async () => {
      const result = editingEmployee
        ? await updateEmployee(editingEmployee.id, form)
        : await createEmployee(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refreshEmployees();
      }
    });
  }

  function toggleEmployeeStatus(employee: Employee) {
    setMessage(null);
    startTransition(async () => {
      const result =
        employee.status === "active"
          ? await deactivateEmployee(employee.id)
          : await activateEmployee(employee.id);

      setMessage(result);

      if (result.ok) {
        refreshEmployees();
      }
    });
  }

  function handleDeleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Excluir definitivamente o funcionario ${employee.name}? Esta acao nao pode ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      setMessage(result);

      if (result.ok) {
        refreshEmployees();
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
            placeholder="Buscar por nome, telefone, email ou funcao"
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
          Novo funcionario
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
          <p>Funcionarios ativos</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{filteredEmployees.length}</strong>
          <p>Registros encontrados</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{inactiveCount}</strong>
          <p>Funcionarios inativos</p>
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
                {editingEmployee ? "Editar funcionario" : "Novo funcionario"}
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
              Nome
              <input
                required
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
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
              WhatsApp
              <input
                value={form.whatsapp}
                onChange={(event) => updateForm("whatsapp", event.target.value)}
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
              Funcao
              <input
                value={form.role}
                onChange={(event) => updateForm("role", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Tipo de comissao
              <input
                value={form.commission_type}
                onChange={(event) =>
                  updateForm("commission_type", event.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label>
              Valor da comissao
              <input
                inputMode="decimal"
                value={form.commission_value}
                onChange={(event) =>
                  updateForm("commission_value", event.target.value)
                }
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
              {["Nome", "Funcao", "Telefone", "Email", "Status", "Acoes"].map(
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
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {employee.name}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {employee.role ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {employee.phone ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {employee.email ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {employee.status === "active" ? "Ativo" : "Inativo"}
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
                        onClick={() => openEditForm(employee)}
                        style={buttonStyle}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggleEmployeeStatus(employee)}
                        style={buttonStyle}
                      >
                        {employee.status === "active" ? "Inativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteEmployee(employee)}
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
                  Nenhum funcionario encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
