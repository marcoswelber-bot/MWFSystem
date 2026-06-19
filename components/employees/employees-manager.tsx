"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import {
  activateEmployee,
  createEmployee,
  deactivateEmployee,
  deleteProfessionalCommission,
  deleteEmployee,
  type EmployeeActionResult,
  type EmployeeFormInput,
  type ProfessionalCommissionFormInput,
  saveProfessionalCommission,
  setProfessionalCommissionStatus,
  updateEmployee
} from "@/app/(app)/funcionarios/actions";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type CommissionRule =
  Database["public"]["Tables"]["professional_service_commissions"]["Row"] & {
    employee_name: string;
    service_name: string;
  };
type CommissionHistory =
  Database["public"]["Tables"]["professional_service_commission_history"]["Row"] & {
    employee_name: string;
    service_name: string;
  };
type StatusFilter = "all" | "active" | "inactive";
type ActiveTab = "employees" | "commissions";

type EmployeesManagerProps = {
  employees: Employee[];
  services: Service[];
  commissionRules: CommissionRule[];
  commissionHistory: CommissionHistory[];
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

const emptyCommissionForm: ProfessionalCommissionFormInput = {
  professional_id: "",
  service_id: "",
  attendance_type: "presencial",
  modality: "individual",
  group_calculation_mode: "por_paciente",
  base_price: "",
  commission_type: "percentual",
  commission_value: "",
  active: true,
  notes: "",
  change_reason: ""
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

function commissionToForm(rule: CommissionRule): ProfessionalCommissionFormInput {
  return {
    id: rule.id,
    professional_id: rule.professional_id,
    service_id: rule.service_id,
    attendance_type: rule.attendance_type,
    modality: rule.modality,
    group_calculation_mode: rule.group_calculation_mode,
    base_price: rule.base_price === null ? "" : String(rule.base_price),
    commission_type: rule.commission_type,
    commission_value: String(rule.commission_value),
    active: rule.active,
    notes: rule.notes ?? "",
    change_reason: ""
  };
}

function money(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(value);
}

function estimateCommission(basePrice?: string, type?: string, value?: string) {
  const base = Number((basePrice ?? "").replace(",", "."));
  const commission = Number((value ?? "").replace(",", "."));

  if (Number.isNaN(commission)) {
    return 0;
  }

  if (type === "valor_fixo") {
    return commission;
  }

  if (Number.isNaN(base)) {
    return 0;
  }

  return (base * commission) / 100;
}

export function EmployeesManager({
  employees,
  services,
  commissionRules,
  commissionHistory,
  initialSearch,
  loadError
}: EmployeesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formOpen, setFormOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("employees");
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);
  const [editingCommission, setEditingCommission] =
    React.useState<CommissionRule | null>(null);
  const [form, setForm] = React.useState<EmployeeFormInput>(emptyForm);
  const [commissionForm, setCommissionForm] =
    React.useState<ProfessionalCommissionFormInput>(emptyCommissionForm);
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

  const filteredCommissionRules = commissionRules.filter((rule) => {
    if (statusFilter === "all") {
      return true;
    }

    return statusFilter === "active" ? rule.active : !rule.active;
  });

  const estimatedCommission = estimateCommission(
    commissionForm.base_price,
    commissionForm.commission_type,
    commissionForm.commission_value
  );

  function updateForm(field: keyof EmployeeFormInput, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateCommissionForm(
    field: keyof ProfessionalCommissionFormInput,
    value: string | boolean
  ) {
    setCommissionForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateCommissionService(serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    const individualPrice =
      service?.default_price ?? service?.price ?? service?.promotional_price ?? null;
    const groupPrice = service?.promotional_price ?? individualPrice;
    const nextBasePrice =
      commissionForm.modality === "grupo" ? groupPrice : individualPrice;

    setCommissionForm((currentForm) => ({
      ...currentForm,
      service_id: serviceId,
      base_price: nextBasePrice === null ? "" : String(nextBasePrice)
    }));
  }

  function updateCommissionMode(serviceMode: string) {
    const service = services.find((item) => item.id === commissionForm.service_id);
    const individualPrice =
      service?.default_price ?? service?.price ?? service?.promotional_price ?? null;
    const groupPrice = service?.promotional_price ?? individualPrice;
    const nextBasePrice = serviceMode === "group" ? groupPrice : individualPrice;

    setCommissionForm((currentForm) => ({
      ...currentForm,
      modality: serviceMode,
      base_price: nextBasePrice === null ? "" : String(nextBasePrice)
    }));
  }

  function openCreateForm() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setMessage(null);
    setActiveTab("employees");
    setFormOpen(true);
  }

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);
    setForm(employeeToForm(employee));
    setMessage(null);
    setActiveTab("employees");
    setFormOpen(true);
  }

  function closeForm() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function openCreateCommission() {
    setEditingCommission(null);
    setCommissionForm(emptyCommissionForm);
    setMessage(null);
    setActiveTab("commissions");
  }

  function openEditCommission(rule: CommissionRule) {
    setEditingCommission(rule);
    setCommissionForm(commissionToForm(rule));
    setMessage(null);
    setActiveTab("commissions");
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

  function handleSubmitCommission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!commissionForm.professional_id || !commissionForm.service_id) {
      setMessage({
        ok: false,
        message: "Selecione profissional e servico."
      });
      return;
    }

    startTransition(async () => {
      const result = await saveProfessionalCommission({
        ...commissionForm,
        id: editingCommission?.id
      });

      setMessage(result);

      if (result.ok) {
        setEditingCommission(null);
        setCommissionForm(emptyCommissionForm);
        refreshEmployees();
      }
    });
  }

  function toggleCommissionStatus(rule: CommissionRule) {
    const reason =
      window.prompt("Motivo da alteracao de status da comissao:") ?? undefined;

    setMessage(null);
    startTransition(async () => {
      const result = await setProfessionalCommissionStatus(
        rule.id,
        !rule.active,
        reason
      );
      setMessage(result);

      if (result.ok) {
        refreshEmployees();
      }
    });
  }

  function handleDeleteCommission(rule: CommissionRule) {
    const reason = window.prompt(
      `Motivo para excluir a regra de comissao de ${rule.employee_name} em ${rule.service_name}:`
    );

    if (reason === null) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteProfessionalCommission(rule.id, reason);
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[
          ["employees", "Cadastro"],
          ["commissions", "Servicos e Comissoes"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value as ActiveTab)}
            style={{
              ...buttonStyle,
              background:
                activeTab === value ? "hsl(var(--primary))" : "transparent",
              color:
                activeTab === value
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

      {activeTab === "employees" ? (
        <>
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
        </>
      ) : null}

      {activeTab === "commissions" ? (
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
                Servicos e Comissoes
              </h2>
              <p>
                Configure a comissao por profissional, servico, tipo de atendimento e
                modalidade.
              </p>
            </div>
            <button type="button" onClick={openCreateCommission} style={buttonStyle}>
              Nova regra
            </button>
          </div>

          <form
            onSubmit={handleSubmitCommission}
            style={{
              display: "grid",
              gap: "14px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <label>
              Profissional
              <select
                value={commissionForm.professional_id}
                onChange={(event) =>
                  updateCommissionForm("professional_id", event.target.value)
                }
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Servico/Procedimento
              <select
                value={commissionForm.service_id}
                onChange={(event) => updateCommissionService(event.target.value)}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo de atendimento
              <select
                value={commissionForm.attendance_type}
                onChange={(event) =>
                  updateCommissionForm("attendance_type", event.target.value)
                }
                style={inputStyle}
              >
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
                <option value="domiciliar">Domiciliar</option>
              </select>
            </label>
            <label>
              Modalidade
              <select
                value={commissionForm.modality}
                onChange={(event) => updateCommissionMode(event.target.value)}
                style={inputStyle}
              >
                <option value="individual">Individual</option>
                <option value="grupo">Grupo</option>
              </select>
            </label>
            <label>
              Grupo: calcular por
              <select
                value={commissionForm.group_calculation_mode}
                onChange={(event) =>
                  updateCommissionForm("group_calculation_mode", event.target.value)
                }
                disabled={commissionForm.modality !== "grupo"}
                style={inputStyle}
              >
                <option value="por_paciente">Por paciente</option>
                <option value="por_turma">Por turma</option>
              </select>
            </label>
            <label>
              Valor base do servico
              <input
                inputMode="decimal"
                value={commissionForm.base_price}
                onChange={(event) =>
                  updateCommissionForm("base_price", event.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label>
              Tipo de comissao
              <select
                value={commissionForm.commission_type}
                onChange={(event) =>
                  updateCommissionForm("commission_type", event.target.value)
                }
                style={inputStyle}
              >
                <option value="percentual">Percentual</option>
                <option value="valor_fixo">Valor fixo</option>
              </select>
            </label>
            <label>
              Percentual ou valor
              <input
                inputMode="decimal"
                value={commissionForm.commission_value}
                onChange={(event) =>
                  updateCommissionForm("commission_value", event.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label>
              Valor estimado a receber
              <input readOnly value={money(estimatedCommission)} style={inputStyle} />
            </label>
            <label>
              Motivo da alteracao
              <input
                value={commissionForm.change_reason}
                onChange={(event) =>
                  updateCommissionForm("change_reason", event.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Observacoes
              <input
                value={commissionForm.notes}
                onChange={(event) => updateCommissionForm("notes", event.target.value)}
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
              {editingCommission ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommission(null);
                    setCommissionForm(emptyCommissionForm);
                  }}
                  style={buttonStyle}
                >
                  Cancelar edicao
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isPending}
                style={{
                  ...buttonStyle,
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))"
                }}
              >
                {isPending
                  ? "Salvando..."
                  : editingCommission
                    ? "Atualizar regra"
                    : "Salvar regra"}
              </button>
            </div>
          </form>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {[
                    "Profissional",
                    "Servico",
                    "Atendimento",
                    "Modalidade",
                    "Base",
                    "Comissao",
                    "Estimado",
                    "Status",
                    "Acoes"
                  ].map((heading) => (
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
                {filteredCommissionRules.length > 0 ? (
                  filteredCommissionRules.map((rule) => (
                    <tr key={rule.id}>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.employee_name}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.service_name}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.attendance_type}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.modality === "grupo"
                          ? rule.group_calculation_mode === "por_turma"
                            ? "Grupo por turma"
                            : "Grupo por paciente"
                          : "Individual"}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {money(rule.base_price)}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.commission_type === "valor_fixo"
                          ? money(rule.commission_value)
                          : `${rule.commission_value}%`}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {money(rule.estimated_amount)}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {rule.active ? "Ativa" : "Inativa"}
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
                            onClick={() => openEditCommission(rule)}
                            style={buttonStyle}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => toggleCommissionStatus(rule)}
                            style={buttonStyle}
                          >
                            {rule.active ? "Inativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteCommission(rule)}
                            style={{
                              ...buttonStyle,
                              borderColor: "hsl(var(--destructive))",
                              color: "hsl(var(--destructive))"
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: "16px", textAlign: "center" }}>
                      Nenhuma regra de comissao cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ overflowX: "auto" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>
              Historico de alteracoes
            </h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Profissional", "Servico", "Registro", "Antes", "Depois", "Motivo", "Data"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          borderBottom: "1px solid hsl(var(--border))",
                          padding: "10px",
                          textAlign: "left"
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {commissionHistory.length > 0 ? (
                  commissionHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.employee_name}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.service_name}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.old_value === null
                          ? "Criacao"
                          : item.new_value === null
                            ? "Exclusao"
                            : "Alteracao"}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.old_value === null
                          ? "-"
                          : String(item.old_value)}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.new_value === null
                          ? "-"
                          : String(item.new_value)}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {item.reason ?? "-"}
                      </td>
                      <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: "16px", textAlign: "center" }}>
                      Nenhum historico de comissao registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
