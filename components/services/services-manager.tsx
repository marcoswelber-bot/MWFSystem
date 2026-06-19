"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import {
  createCategory,
  createCommercialRule,
  createDiscount,
  createInternalNotification,
  createPackage,
  createProfessionalLink,
  createProtocol,
  createResource,
  createService,
  deleteCategory,
  deleteService,
  deleteSupportRecord,
  setServiceStatus,
  updateService,
  updateCategory,
  type CategoryFormInput,
  type DiscountFormInput,
  type NotificationFormInput,
  type PackageFormInput,
  type ProfessionalLinkFormInput,
  type ProtocolFormInput,
  type ResourceFormInput,
  type RuleFormInput,
  type ServiceActionResult,
  type ServiceFormInput
} from "@/app/(app)/servicos/actions";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Category = Database["public"]["Tables"]["service_categories"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type ProfessionalLink =
  Database["public"]["Tables"]["service_professionals"]["Row"] & {
    service_name: string;
    employee_name: string;
  };
type ServicePackage = Database["public"]["Tables"]["service_packages"]["Row"];
type Discount = Database["public"]["Tables"]["service_discounts"]["Row"] & {
  service_name: string;
};
type CommercialRule = Database["public"]["Tables"]["commercial_rules"]["Row"];
type TreatmentGoal = Database["public"]["Tables"]["treatment_goals"]["Row"];
type Protocol = Database["public"]["Tables"]["treatment_protocols"]["Row"] & {
  goal_name: string;
};
type Resource = Database["public"]["Tables"]["service_resources"]["Row"] & {
  service_name: string;
};
type InternalNotification =
  Database["public"]["Tables"]["internal_notifications"]["Row"] & {
    service_name: string;
    employee_name: string;
  };
type AuditLog = Database["public"]["Tables"]["service_audit_logs"]["Row"] & {
  service_name: string;
};

type StatusFilter = "all" | "active" | "inactive";
type Tab =
  | "basicServices"
  | "advancedServices"
  | "serviceTypes"
  | "professionals"
  | "packages"
  | "discounts"
  | "rules"
  | "protocols"
  | "resources"
  | "notifications"
  | "history";

type ServicesManagerProps = {
  services: Service[];
  categories: Category[];
  employees: Employee[];
  professionalLinks: ProfessionalLink[];
  packages: ServicePackage[];
  discounts: Discount[];
  commercialRules: CommercialRule[];
  goals: TreatmentGoal[];
  protocols: Protocol[];
  resources: Resource[];
  notifications: InternalNotification[];
  auditLogs: AuditLog[];
  initialSearch: string;
  loadError?: string;
  isAdmMaster: boolean;
};

const emptyServiceForm: ServiceFormInput = {
  name: "",
  internal_code: "",
  category_id: "",
  category: "",
  description: "",
  classification: "procedimento",
  attendance_type: "presencial",
  priority: "normal",
  billing_type: "particular",
  default_duration_minutes: "",
  break_minutes: "",
  default_price: "",
  promotional_price: "",
  required_credits: "0",
  color: "#2563eb",
  image_url: "",
  is_group: false,
  participant_limit: "",
  allows_package: true,
  requires_medical_record: false,
  requires_consent_form: false,
  requires_authorization: false,
  requires_photos: false,
  requires_attachment: false,
  is_initial_assessment: false,
  pre_service_instructions: "",
  post_service_instructions: "",
  required_materials: "",
  room_required: "",
  equipment_required: "",
  preparation_minutes: "",
  cleanup_minutes: "",
  suggested_sessions: "",
  suggested_price: "",
  suggested_discount: "",
  commission_type: "",
  commission_value: "",
  status: "active"
};

const emptyCategoryForm: CategoryFormInput = {
  name: "",
  description: "",
  color: "#2563eb",
  status: "active"
};

const emptyProfessionalLinkForm: ProfessionalLinkFormInput = {
  service_id: "",
  employee_id: "",
  is_primary: false,
  commission_type: "",
  commission_value: ""
};

const emptyPackageForm: PackageFormInput = {
  name: "",
  description: "",
  sessions_quantity: "1",
  total_price: "",
  validity_days: "",
  uses_credits: false,
  contracted_credits: "0",
  allow_freeze: true,
  allow_renewal: true
};

const emptyDiscountForm: DiscountFormInput = {
  service_id: "",
  name: "",
  sessions_quantity: "1",
  discount_type: "percent",
  discount_value: "",
  original_price: ""
};

const emptyRuleForm: RuleFormInput = {
  name: "",
  rule_type: "coupon",
  coupon_code: "",
  discount_type: "percent",
  discount_value: "",
  max_discount_admin: "",
  max_discount_manager: "",
  max_discount_professional: "",
  start_date: "",
  end_date: ""
};

const emptyProtocolForm: ProtocolFormInput = {
  name: "",
  objective: "",
  goal_id: "",
  recommended_sessions: "",
  recommended_interval_days: ""
};

const emptyResourceForm: ResourceFormInput = {
  service_id: "",
  room: "",
  equipment: "",
  stretcher_required: false,
  specific_device: "",
  materials: "",
  preparation_minutes: "",
  cleanup_minutes: ""
};

const emptyNotificationForm: NotificationFormInput = {
  service_id: "",
  employee_id: "",
  title: "",
  message: "",
  notification_type: "internal",
  whatsapp_template: ""
};

function serviceToForm(service: Service): ServiceFormInput {
  return {
    name: service.name,
    internal_code: service.internal_code ?? "",
    category_id: service.category_id ?? "",
    category: service.category ?? service.type ?? "",
    description: service.description ?? "",
    classification: service.classification ?? service.type ?? "procedimento",
    attendance_type: service.attendance_type ?? "presencial",
    priority: service.priority ?? "normal",
    billing_type: service.billing_type ?? "particular",
    default_duration_minutes:
      service.default_duration_minutes === null
        ? ""
        : String(service.default_duration_minutes),
    break_minutes: service.break_minutes === null ? "" : String(service.break_minutes),
    default_price: service.default_price === null ? "" : String(service.default_price),
    promotional_price:
      service.promotional_price === null ? "" : String(service.promotional_price),
    required_credits: String(service.required_credits ?? 0),
    color: service.color ?? "#2563eb",
    image_url: service.image_url ?? "",
    is_group: service.is_group,
    participant_limit:
      service.participant_limit === null ? "" : String(service.participant_limit),
    allows_package: service.allows_package,
    requires_medical_record: service.requires_medical_record,
    requires_consent_form: service.requires_consent_form,
    requires_authorization: service.requires_authorization,
    requires_photos: service.requires_photos,
    requires_attachment: service.requires_attachment,
    is_initial_assessment: service.is_initial_assessment,
    pre_service_instructions: service.pre_service_instructions ?? "",
    post_service_instructions: service.post_service_instructions ?? "",
    required_materials: service.required_materials ?? "",
    room_required: service.room_required ?? "",
    equipment_required: service.equipment_required ?? "",
    preparation_minutes:
      service.preparation_minutes === null ? "" : String(service.preparation_minutes),
    cleanup_minutes:
      service.cleanup_minutes === null ? "" : String(service.cleanup_minutes),
    suggested_sessions:
      service.suggested_sessions === null ? "" : String(service.suggested_sessions),
    suggested_price:
      service.suggested_price === null ? "" : String(service.suggested_price),
    suggested_discount:
      service.suggested_discount === null ? "" : String(service.suggested_discount),
    commission_type: service.commission_type ?? "",
    commission_value:
      service.commission_value === null ? "" : String(service.commission_value),
    status: service.status
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

export function ServicesManager({
  services,
  categories,
  employees,
  professionalLinks,
  packages,
  discounts,
  commercialRules,
  goals,
  protocols,
  resources,
  notifications,
  auditLogs,
  initialSearch,
  loadError,
  isAdmMaster
}: ServicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [tab, setTab] = React.useState<Tab>("basicServices");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [search, setSearch] = React.useState(initialSearch);
  const [serviceFormOpen, setServiceFormOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [serviceForm, setServiceForm] =
    React.useState<ServiceFormInput>(emptyServiceForm);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(
    null
  );
  const [categoryForm, setCategoryForm] =
    React.useState<CategoryFormInput>(emptyCategoryForm);
  const [professionalForm, setProfessionalForm] =
    React.useState<ProfessionalLinkFormInput>(emptyProfessionalLinkForm);
  const [packageForm, setPackageForm] =
    React.useState<PackageFormInput>(emptyPackageForm);
  const [discountForm, setDiscountForm] =
    React.useState<DiscountFormInput>(emptyDiscountForm);
  const [ruleForm, setRuleForm] = React.useState<RuleFormInput>(emptyRuleForm);
  const [protocolForm, setProtocolForm] =
    React.useState<ProtocolFormInput>(emptyProtocolForm);
  const [resourceForm, setResourceForm] =
    React.useState<ResourceFormInput>(emptyResourceForm);
  const [notificationForm, setNotificationForm] =
    React.useState<NotificationFormInput>(emptyNotificationForm);
  const [message, setMessage] = React.useState<ServiceActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  const activeCount = services.filter((service) => service.status === "active").length;
  const inactiveCount = services.filter(
    (service) => service.status === "inactive"
  ).length;
  const filteredServices = services.filter((service) => {
    if (statusFilter !== "all" && service.status !== statusFilter) {
      return false;
    }

    return true;
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

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/servicos?q=${encodeURIComponent(query)}` : "/servicos");
  }

  function setResult(result: ServiceActionResult) {
    setMessage(result);

    if (result.ok) {
      refresh();
    }
  }

  function openCreateService() {
    setEditingService(null);
    setServiceForm(emptyServiceForm);
    setMessage(null);
    setServiceFormOpen(true);
    if (!isServicesTab) {
      setTab("basicServices");
    }
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceForm(serviceToForm(service));
    setMessage(null);
    setServiceFormOpen(true);
  }

  function closeServiceForm() {
    setEditingService(null);
    setServiceForm(emptyServiceForm);
    setServiceFormOpen(false);
  }

  function submitService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!serviceForm.name.trim()) {
      setMessage({ ok: false, message: "Nome do servico e obrigatorio." });
      return;
    }

    if (!serviceForm.category_id) {
      setMessage({
        ok: false,
        message: "Selecione um tipo de servico cadastrado pelo ADM."
      });
      return;
    }

    startTransition(async () => {
      const result = editingService
        ? await updateService(editingService.id, serviceForm)
        : await createService(serviceForm);
      setMessage(result);

      if (result.ok) {
        closeServiceForm();
        refresh();
      }
    });
  }

  function toggleServiceStatus(service: Service) {
    startTransition(async () => {
      setResult(
        await setServiceStatus(
          service.id,
          service.status === "active" ? "inactive" : "active"
        )
      );
    });
  }

  function removeService(service: Service) {
    if (
      !window.confirm(
        `Excluir definitivamente o servico ${service.name}? Esta acao nao pode ser desfeita.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setResult(await deleteService(service.id));
    });
  }

  function deleteSupport(table: Parameters<typeof deleteSupportRecord>[0], id: string) {
    if (!window.confirm("Excluir definitivamente este registro?")) {
      return;
    }

    startTransition(async () => {
      setResult(await deleteSupportRecord(table, id));
    });
  }

  function submitSupport(
    event: React.FormEvent<HTMLFormElement>,
    action: () => Promise<ServiceActionResult>,
    afterSuccess: () => void
  ) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result);

      if (result.ok) {
        afterSuccess();
        refresh();
      }
    });
  }

  function editCategory(category: Category) {
    if (!isAdmMaster) {
      setMessage({
        ok: false,
        message: "Apenas o ADM pode editar tipos de servico."
      });
      return;
    }

    setEditingCategory(category);
    setCategoryForm({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      color: category.color ?? "#2563eb",
      status: category.status
    });
    setMessage(null);
  }

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
  }

  function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    submitSupport(
      event,
      () =>
        editingCategory
          ? updateCategory(editingCategory.id, categoryForm)
          : createCategory(categoryForm),
      resetCategoryForm
    );
  }

  function removeCategory(category: Category) {
    if (!isAdmMaster) {
      setMessage({
        ok: false,
        message: "Apenas o ADM pode excluir tipos de servico."
      });
      return;
    }

    if (
      !window.confirm(
        `Excluir definitivamente o tipo de servico ${category.name}?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setResult(await deleteCategory(category.id));
    });
  }

  const tabs: Array<[Tab, string]> = [
    ["basicServices", "Servicos Basicos"],
    ["advancedServices", "Servicos Avancados"],
    ["serviceTypes", "Tipos de servico"],
    ["professionals", "Profissionais"],
    ["packages", "Pacotes"],
    ["discounts", "Descontos"],
    ["rules", "Regras"],
    ["protocols", "Protocolos"],
    ["resources", "Recursos"],
    ["notifications", "Notificacoes"],
    ["history", "Historico"]
  ];
  const isServicesTab = tab === "basicServices" || tab === "advancedServices";
  const isAdvancedServices = tab === "advancedServices";
  const activeCategories = categories.filter(
    (category) => category.status === "active"
  );

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
            placeholder="Buscar por nome, codigo ou tipo de servico"
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>
            Buscar
          </button>
        </form>

        <button
          type="button"
          onClick={openCreateService}
          style={{
            ...buttonStyle,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))"
          }}
        >
          Novo servico
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            style={{
              ...buttonStyle,
              background: tab === value ? "hsl(var(--primary))" : "transparent",
              color: tab === value ? "hsl(var(--primary-foreground))" : "inherit"
            }}
          >
            {label}
          </button>
        ))}
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
          <p>Servicos ativos</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{filteredServices.length}</strong>
          <p>Registros encontrados</p>
        </div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "16px" }}>
          <strong style={{ fontSize: "24px" }}>{inactiveCount}</strong>
          <p>Servicos inativos</p>
        </div>
      </section>

      {isServicesTab ? (
        <>
          {serviceFormOpen ? (
            <section style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
                    {editingService ? "Editar servico" : "Novo servico"}
                  </h2>
                  <p>
                    {isAdvancedServices
                      ? "Configuracoes completas para agenda, financeiro e comissoes."
                      : "Cadastro rapido com os dados essenciais do servico."}
                  </p>
                </div>
                <button type="button" onClick={closeServiceForm} style={buttonStyle}>
                  Fechar
                </button>
              </div>

              <form
                onSubmit={submitService}
                style={{
                  display: "grid",
                  gap: "14px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
                }}
              >
                <label>
                  Nome do servico
                  <input
                    required
                    value={serviceForm.name}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    style={inputStyle}
                  />
                </label>
                <label>
                  Tipo de servico
                  <select
                    required
                    value={serviceForm.category_id}
                    onChange={(event) => {
                      const selected = categories.find(
                        (category) => category.id === event.target.value
                      );
                      setServiceForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                        category: selected?.name ?? ""
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="">Selecione um tipo cadastrado</option>
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Duracao padrao
                  <input
                    inputMode="numeric"
                    value={serviceForm.default_duration_minutes}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        default_duration_minutes: event.target.value
                      }))
                    }
                    style={inputStyle}
                  />
                </label>
                <label>
                  Valor padrao
                  <input
                    inputMode="decimal"
                    value={serviceForm.default_price}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        default_price: event.target.value
                      }))
                    }
                    style={inputStyle}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={serviceForm.status}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        status: event.target.value
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </label>
                {isAdvancedServices ? (
                  <>
                    <label>
                      Codigo interno
                      <input
                        value={serviceForm.internal_code}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            internal_code: event.target.value
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label>
                      Tipo de atendimento
                      <select
                        value={serviceForm.is_group ? "grupo" : "individual"}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            is_group: event.target.value === "grupo",
                            classification:
                              event.target.value === "grupo"
                                ? "grupo"
                                : current.classification
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="individual">Individual</option>
                        <option value="grupo">Grupo</option>
                      </select>
                    </label>
                    <label>
                      Limite de participantes
                      <input
                        inputMode="numeric"
                        disabled={!serviceForm.is_group}
                        value={serviceForm.participant_limit}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            participant_limit: event.target.value
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label>
                      Intervalo apos atendimento
                      <input
                        inputMode="numeric"
                        value={serviceForm.break_minutes}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            break_minutes: event.target.value
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label>
                      Preco promocional
                      <input
                        inputMode="decimal"
                        value={serviceForm.promotional_price}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            promotional_price: event.target.value
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label>
                      Comissao padrao opcional
                      <select
                        value={serviceForm.commission_type}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            commission_type: event.target.value
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Sem padrao</option>
                        <option value="percentual">Percentual</option>
                        <option value="valor_fixo">Valor fixo</option>
                      </select>
                    </label>
                    <label>
                      Valor da comissao padrao
                      <input
                        inputMode="decimal"
                        value={serviceForm.commission_value}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            commission_value: event.target.value
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ gridColumn: "1 / -1" }}>
                      Observacoes internas
                      <textarea
                        value={serviceForm.description ?? ""}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            description: event.target.value
                          }))
                        }
                        rows={3}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ gridColumn: "1 / -1" }}>
                      Regras especiais do servico
                      <textarea
                        value={serviceForm.pre_service_instructions ?? ""}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            pre_service_instructions: event.target.value
                          }))
                        }
                        rows={3}
                        style={inputStyle}
                      />
                    </label>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ fontWeight: 700 }}>Comissao por profissional</p>
                      <p>
                        Use a aba Profissionais para vincular profissionais e a aba
                        Servicos e Comissoes em Funcionarios para regras por modalidade.
                      </p>
                    </div>
                  </>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    gridColumn: "1 / -1",
                    justifyContent: "flex-end"
                  }}
                >
                  <button type="button" onClick={closeServiceForm} style={buttonStyle}>
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

          <DataTable
            headers={["Nome", "Codigo", "Tipo", "Valor", "Duracao", "Status", "Acoes"]}
            rows={filteredServices.map((service) => [
              service.name,
              service.internal_code ?? "-",
              service.category ?? "-",
              money(service.default_price),
              service.default_duration_minutes
                ? `${service.default_duration_minutes} min`
                : "-",
              service.status === "active" ? "Ativo" : "Inativo",
              <ActionGroup key={service.id}>
                <button type="button" onClick={() => openEditService(service)} style={buttonStyle}>
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleServiceStatus(service)}
                  style={buttonStyle}
                >
                  {service.status === "active" ? "Inativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => removeService(service)}
                  style={{
                    ...buttonStyle,
                    borderColor: "hsl(var(--destructive))",
                    color: "hsl(var(--destructive))"
                  }}
                >
                  Excluir definitivo
                </button>
              </ActionGroup>
            ])}
            emptyText="Nenhum servico encontrado."
          />
        </>
      ) : null}

      {tab === "serviceTypes" ? (
        <SupportSection
          title="Tipos de servico"
          form={
            isAdmMaster ? (
              <form onSubmit={submitCategory} style={formGridStyle}>
                <TextField label="Nome" value={categoryForm.name} onChange={(value) => setCategoryForm((current) => ({ ...current, name: value }))} inputStyle={inputStyle} required />
                <TextField label="Cor" value={categoryForm.color ?? ""} onChange={(value) => setCategoryForm((current) => ({ ...current, color: value }))} inputStyle={inputStyle} type="color" />
                <SelectField label="Status" value={categoryForm.status ?? "active"} onChange={(value) => setCategoryForm((current) => ({ ...current, status: value }))} options={[["active", "Ativo"], ["inactive", "Inativo"]]} inputStyle={inputStyle} />
                <TextAreaField label="Descricao" value={categoryForm.description ?? ""} onChange={(value) => setCategoryForm((current) => ({ ...current, description: value }))} inputStyle={inputStyle} />
                <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                  {editingCategory ? (
                    <button type="button" onClick={resetCategoryForm} style={buttonStyle}>
                      Cancelar edicao
                    </button>
                  ) : null}
                  <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
                </div>
              </form>
            ) : (
              <div
                style={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  padding: "12px"
                }}
              >
                Usuarios comuns podem apenas escolher tipos ja cadastrados pelo ADM.
              </div>
            )
          }
        >
          <DataTable
            headers={["Nome", "Descricao", "Status", "Acoes"]}
            rows={categories.map((category) => [
              category.name,
              category.description ?? "-",
              category.status === "active" ? "Ativa" : "Inativa",
              isAdmMaster ? (
                <ActionGroup key={category.id}>
                  <button type="button" onClick={() => editCategory(category)} style={buttonStyle}>
                    Editar
                  </button>
                  <button type="button" onClick={() => removeCategory(category)} style={buttonStyle}>
                    Excluir
                  </button>
                </ActionGroup>
              ) : (
                "-"
              )
            ])}
            emptyText="Nenhum tipo de servico cadastrado."
          />
        </SupportSection>
      ) : null}

      {tab === "professionals" ? (
        <SupportSection
          title="Profissionais vinculados"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createProfessionalLink(professionalForm),
                  () => setProfessionalForm(emptyProfessionalLinkForm)
                )
              }
              style={formGridStyle}
            >
              <SelectField label="Servico" value={professionalForm.service_id} onChange={(value) => setProfessionalForm((current) => ({ ...current, service_id: value }))} options={services.map((service) => [service.id, service.name])} inputStyle={inputStyle} />
              <SelectField label="Profissional" value={professionalForm.employee_id} onChange={(value) => setProfessionalForm((current) => ({ ...current, employee_id: value }))} options={employees.map((employee) => [employee.id, employee.name])} inputStyle={inputStyle} />
              <TextField label="Tipo de comissao" value={professionalForm.commission_type ?? ""} onChange={(value) => setProfessionalForm((current) => ({ ...current, commission_type: value }))} inputStyle={inputStyle} />
              <TextField label="Valor da comissao" value={professionalForm.commission_value ?? ""} onChange={(value) => setProfessionalForm((current) => ({ ...current, commission_value: value }))} inputStyle={inputStyle} />
              <CheckboxField label="Profissional principal" checked={Boolean(professionalForm.is_primary)} onChange={(value) => setProfessionalForm((current) => ({ ...current, is_primary: value }))} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Servico", "Profissional", "Principal", "Comissao", "Acoes"]}
            rows={professionalLinks.map((link) => [
              link.service_name,
              link.employee_name,
              link.is_primary ? "Sim" : "Nao",
              [link.commission_type, link.commission_value].filter(Boolean).join(" ") || "-",
              <button key={link.id} type="button" onClick={() => deleteSupport("service_professionals", link.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhum profissional vinculado."
          />
        </SupportSection>
      ) : null}

      {tab === "packages" ? (
        <SupportSection
          title="Pacotes de sessoes e creditos"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createPackage(packageForm),
                  () => setPackageForm(emptyPackageForm)
                )
              }
              style={formGridStyle}
            >
              <TextField label="Nome" value={packageForm.name} onChange={(value) => setPackageForm((current) => ({ ...current, name: value }))} inputStyle={inputStyle} required />
              <TextField label="Sessoes" value={packageForm.sessions_quantity ?? ""} onChange={(value) => setPackageForm((current) => ({ ...current, sessions_quantity: value }))} inputStyle={inputStyle} />
              <TextField label="Valor total" value={packageForm.total_price ?? ""} onChange={(value) => setPackageForm((current) => ({ ...current, total_price: value }))} inputStyle={inputStyle} />
              <TextField label="Validade em dias" value={packageForm.validity_days ?? ""} onChange={(value) => setPackageForm((current) => ({ ...current, validity_days: value }))} inputStyle={inputStyle} />
              <TextField label="Creditos contratados" value={packageForm.contracted_credits ?? ""} onChange={(value) => setPackageForm((current) => ({ ...current, contracted_credits: value }))} inputStyle={inputStyle} />
              <CheckboxField label="Usa creditos" checked={Boolean(packageForm.uses_credits)} onChange={(value) => setPackageForm((current) => ({ ...current, uses_credits: value }))} />
              <CheckboxField label="Permite congelamento" checked={Boolean(packageForm.allow_freeze)} onChange={(value) => setPackageForm((current) => ({ ...current, allow_freeze: value }))} />
              <CheckboxField label="Permite renovacao" checked={Boolean(packageForm.allow_renewal)} onChange={(value) => setPackageForm((current) => ({ ...current, allow_renewal: value }))} />
              <TextAreaField label="Descricao" value={packageForm.description ?? ""} onChange={(value) => setPackageForm((current) => ({ ...current, description: value }))} inputStyle={inputStyle} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Nome", "Sessoes", "Total", "Por sessao", "Creditos", "Acoes"]}
            rows={packages.map((item) => [
              item.name,
              String(item.sessions_quantity),
              money(item.total_price),
              money(item.price_per_session),
              `${item.used_credits}/${item.contracted_credits}`,
              <button key={item.id} type="button" onClick={() => deleteSupport("service_packages", item.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhum pacote cadastrado."
          />
        </SupportSection>
      ) : null}

      {tab === "discounts" ? (
        <SupportSection
          title="Descontos progressivos"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createDiscount(discountForm),
                  () => setDiscountForm(emptyDiscountForm)
                )
              }
              style={formGridStyle}
            >
              <SelectField label="Servico" value={discountForm.service_id ?? ""} onChange={(value) => setDiscountForm((current) => ({ ...current, service_id: value }))} options={services.map((service) => [service.id, service.name])} inputStyle={inputStyle} />
              <TextField label="Nome" value={discountForm.name} onChange={(value) => setDiscountForm((current) => ({ ...current, name: value }))} inputStyle={inputStyle} required />
              <TextField label="Quantidade contratada" value={discountForm.sessions_quantity ?? ""} onChange={(value) => setDiscountForm((current) => ({ ...current, sessions_quantity: value }))} inputStyle={inputStyle} />
              <SelectField label="Tipo" value={discountForm.discount_type ?? "percent"} onChange={(value) => setDiscountForm((current) => ({ ...current, discount_type: value }))} options={[["percent", "Percentual"], ["fixed", "Valor fixo"]]} inputStyle={inputStyle} />
              <TextField label="Desconto" value={discountForm.discount_value ?? ""} onChange={(value) => setDiscountForm((current) => ({ ...current, discount_value: value }))} inputStyle={inputStyle} />
              <TextField label="Valor original por sessao" value={discountForm.original_price ?? ""} onChange={(value) => setDiscountForm((current) => ({ ...current, original_price: value }))} inputStyle={inputStyle} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Nome", "Servico", "Qtd", "Original", "Final", "Economia", "Acoes"]}
            rows={discounts.map((discount) => [
              discount.name,
              discount.service_name,
              String(discount.sessions_quantity),
              money(discount.original_price),
              money(discount.final_price),
              money(discount.total_savings),
              <button key={discount.id} type="button" onClick={() => deleteSupport("service_discounts", discount.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhum desconto cadastrado."
          />
        </SupportSection>
      ) : null}

      {tab === "rules" ? (
        <SupportSection
          title="Regras comerciais"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createCommercialRule(ruleForm),
                  () => setRuleForm(emptyRuleForm)
                )
              }
              style={formGridStyle}
            >
              <TextField label="Nome" value={ruleForm.name} onChange={(value) => setRuleForm((current) => ({ ...current, name: value }))} inputStyle={inputStyle} required />
              <SelectField label="Tipo" value={ruleForm.rule_type} onChange={(value) => setRuleForm((current) => ({ ...current, rule_type: value }))} options={[["coupon", "Cupom"], ["campaign", "Campanha"], ["agreement", "Convenio"], ["referral", "Indicacao"], ["cashback", "Cashback futuro"], ["loyalty", "Fidelidade futura"]]} inputStyle={inputStyle} />
              <TextField label="Cupom" value={ruleForm.coupon_code ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, coupon_code: value }))} inputStyle={inputStyle} />
              <TextField label="Desconto" value={ruleForm.discount_value ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, discount_value: value }))} inputStyle={inputStyle} />
              <TextField label="Max. admin" value={ruleForm.max_discount_admin ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, max_discount_admin: value }))} inputStyle={inputStyle} />
              <TextField label="Max. gerente" value={ruleForm.max_discount_manager ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, max_discount_manager: value }))} inputStyle={inputStyle} />
              <TextField label="Max. profissional" value={ruleForm.max_discount_professional ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, max_discount_professional: value }))} inputStyle={inputStyle} />
              <TextField label="Inicio" value={ruleForm.start_date ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, start_date: value }))} inputStyle={inputStyle} type="date" />
              <TextField label="Fim" value={ruleForm.end_date ?? ""} onChange={(value) => setRuleForm((current) => ({ ...current, end_date: value }))} inputStyle={inputStyle} type="date" />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Nome", "Tipo", "Cupom", "Desconto", "Periodo", "Acoes"]}
            rows={commercialRules.map((rule) => [
              rule.name,
              rule.rule_type,
              rule.coupon_code ?? "-",
              rule.discount_value === null ? "-" : String(rule.discount_value),
              [rule.start_date, rule.end_date].filter(Boolean).join(" a ") || "-",
              <button key={rule.id} type="button" onClick={() => deleteSupport("commercial_rules", rule.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhuma regra comercial cadastrada."
          />
        </SupportSection>
      ) : null}

      {tab === "protocols" ? (
        <SupportSection
          title="Protocolos de tratamento"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createProtocol(protocolForm),
                  () => setProtocolForm(emptyProtocolForm)
                )
              }
              style={formGridStyle}
            >
              <TextField label="Nome" value={protocolForm.name} onChange={(value) => setProtocolForm((current) => ({ ...current, name: value }))} inputStyle={inputStyle} required />
              <SelectField label="Objetivo" value={protocolForm.goal_id ?? ""} onChange={(value) => setProtocolForm((current) => ({ ...current, goal_id: value }))} options={goals.map((goal) => [goal.id, goal.name])} inputStyle={inputStyle} />
              <TextField label="Sessoes recomendadas" value={protocolForm.recommended_sessions ?? ""} onChange={(value) => setProtocolForm((current) => ({ ...current, recommended_sessions: value }))} inputStyle={inputStyle} />
              <TextField label="Intervalo recomendado" value={protocolForm.recommended_interval_days ?? ""} onChange={(value) => setProtocolForm((current) => ({ ...current, recommended_interval_days: value }))} inputStyle={inputStyle} />
              <TextAreaField label="Objetivo do protocolo" value={protocolForm.objective ?? ""} onChange={(value) => setProtocolForm((current) => ({ ...current, objective: value }))} inputStyle={inputStyle} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Nome", "Objetivo", "Sessoes", "Intervalo", "Acoes"]}
            rows={protocols.map((protocol) => [
              protocol.name,
              protocol.goal_name,
              protocol.recommended_sessions === null ? "-" : String(protocol.recommended_sessions),
              protocol.recommended_interval_days === null ? "-" : `${protocol.recommended_interval_days} dias`,
              <button key={protocol.id} type="button" onClick={() => deleteSupport("treatment_protocols", protocol.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhum protocolo cadastrado."
          />
        </SupportSection>
      ) : null}

      {tab === "resources" ? (
        <SupportSection
          title="Recursos necessarios"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createResource(resourceForm),
                  () => setResourceForm(emptyResourceForm)
                )
              }
              style={formGridStyle}
            >
              <SelectField label="Servico" value={resourceForm.service_id} onChange={(value) => setResourceForm((current) => ({ ...current, service_id: value }))} options={services.map((service) => [service.id, service.name])} inputStyle={inputStyle} />
              <TextField label="Sala" value={resourceForm.room ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, room: value }))} inputStyle={inputStyle} />
              <TextField label="Equipamento" value={resourceForm.equipment ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, equipment: value }))} inputStyle={inputStyle} />
              <TextField label="Aparelho especifico" value={resourceForm.specific_device ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, specific_device: value }))} inputStyle={inputStyle} />
              <TextField label="Tempo de preparo" value={resourceForm.preparation_minutes ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, preparation_minutes: value }))} inputStyle={inputStyle} />
              <TextField label="Tempo de limpeza" value={resourceForm.cleanup_minutes ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, cleanup_minutes: value }))} inputStyle={inputStyle} />
              <CheckboxField label="Exige maca" checked={Boolean(resourceForm.stretcher_required)} onChange={(value) => setResourceForm((current) => ({ ...current, stretcher_required: value }))} />
              <TextAreaField label="Materiais utilizados" value={resourceForm.materials ?? ""} onChange={(value) => setResourceForm((current) => ({ ...current, materials: value }))} inputStyle={inputStyle} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Servico", "Sala", "Equipamento", "Preparo", "Limpeza", "Acoes"]}
            rows={resources.map((resource) => [
              resource.service_name,
              resource.room ?? "-",
              resource.equipment ?? "-",
              resource.preparation_minutes === null ? "-" : `${resource.preparation_minutes} min`,
              resource.cleanup_minutes === null ? "-" : `${resource.cleanup_minutes} min`,
              <button key={resource.id} type="button" onClick={() => deleteSupport("service_resources", resource.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhum recurso cadastrado."
          />
        </SupportSection>
      ) : null}

      {tab === "notifications" ? (
        <SupportSection
          title="Notificacoes internas e WhatsApp manual"
          form={
            <form
              onSubmit={(event) =>
                submitSupport(
                  event,
                  () => createInternalNotification(notificationForm),
                  () => setNotificationForm(emptyNotificationForm)
                )
              }
              style={formGridStyle}
            >
              <SelectField label="Servico" value={notificationForm.service_id ?? ""} onChange={(value) => setNotificationForm((current) => ({ ...current, service_id: value }))} options={services.map((service) => [service.id, service.name])} inputStyle={inputStyle} />
              <SelectField label="Profissional" value={notificationForm.employee_id ?? ""} onChange={(value) => setNotificationForm((current) => ({ ...current, employee_id: value }))} options={employees.map((employee) => [employee.id, employee.name])} inputStyle={inputStyle} />
              <TextField label="Titulo" value={notificationForm.title} onChange={(value) => setNotificationForm((current) => ({ ...current, title: value }))} inputStyle={inputStyle} required />
              <TextAreaField label="Mensagem interna" value={notificationForm.message} onChange={(value) => setNotificationForm((current) => ({ ...current, message: value }))} inputStyle={inputStyle} />
              <TextAreaField label="Mensagem pronta para WhatsApp" value={notificationForm.whatsapp_template ?? ""} onChange={(value) => setNotificationForm((current) => ({ ...current, whatsapp_template: value }))} inputStyle={inputStyle} />
              <SubmitButton isPending={isPending} buttonStyle={buttonStyle} />
            </form>
          }
        >
          <DataTable
            headers={["Titulo", "Servico", "Profissional", "Status", "WhatsApp", "Acoes"]}
            rows={notifications.map((notification) => [
              notification.title,
              notification.service_name,
              notification.employee_name,
              notification.status,
              notification.whatsapp_template ? (
                <a
                  key={`${notification.id}-wa`}
                  href={`https://wa.me/?text=${encodeURIComponent(notification.whatsapp_template)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "hsl(var(--primary))", fontWeight: 700 }}
                >
                  Abrir mensagem
                </a>
              ) : (
                "-"
              ),
              <button key={notification.id} type="button" onClick={() => deleteSupport("internal_notifications", notification.id)} style={buttonStyle}>
                Excluir
              </button>
            ])}
            emptyText="Nenhuma notificacao cadastrada."
          />
        </SupportSection>
      ) : null}

      {tab === "history" ? (
        <SupportSection title="Historico e auditoria">
          <DataTable
            headers={["Servico", "Acao", "Campo", "Antes", "Depois", "Data"]}
            rows={auditLogs.map((log) => [
              log.service_name,
              log.action,
              log.field_name ?? "-",
              log.old_value ?? "-",
              log.new_value ?? "-",
              new Date(log.created_at).toLocaleString("pt-BR")
            ])}
            emptyText="Nenhum historico registrado."
          />
        </SupportSection>
      ) : null}
    </div>
  );
}

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};

function SupportSection({
  title,
  form,
  children
}: {
  title: string;
  form?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid hsl(var(--border))",
        borderRadius: "8px",
        display: "grid",
        gap: "16px",
        padding: "20px"
      }}
    >
      <h2 style={{ fontSize: "20px", fontWeight: 700 }}>{title}</h2>
      {form}
      {children}
    </section>
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

function TextField({
  label,
  value,
  onChange,
  inputStyle,
  required,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputStyle: React.CSSProperties;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        required={required}
        type={type}
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
  inputStyle
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  inputStyle: React.CSSProperties;
}) {
  return (
    <label>
      {label}
      <select
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

function CheckboxField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function SubmitButton({
  isPending,
  buttonStyle
}: {
  isPending: boolean;
  buttonStyle: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gridColumn: "1 / -1" }}>
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
  );
}
