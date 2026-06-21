"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import type {
  PermissionAction,
  PermissionMap,
  PermissionModuleKey
} from "@/lib/permission-modules";
import {
  createCategory,
  createService,
  deleteService,
  setCategoryStatus,
  setServiceStatus,
  updateService,
  updateCategory,
  type CategoryFormInput,
  type ServiceActionResult,
  type ServiceFormInput
} from "@/app/(app)/servicos/actions";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
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
  clinics: Clinic[];
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
  initialTab?: Tab;
  loadError?: string;
  isAdmMaster: boolean;
  currentClinicId: string | null;
  permissions?: PermissionMap;
};

const emptyServiceForm: ServiceFormInput = {
  clinic_id: "",
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

function serviceToForm(service: Service): ServiceFormInput {
  return {
    clinic_id: service.clinic_id ?? "",
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
  clinics,
  categories,
  initialSearch,
  initialTab = "basicServices",
  loadError,
  isAdmMaster,
  currentClinicId,
  permissions
}: ServicesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [tab, setTab] = React.useState<Tab>(
    initialTab === "serviceTypes" && !isAdmMaster ? "basicServices" : initialTab
  );
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
  const [message, setMessage] = React.useState<ServiceActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  React.useEffect(() => {
    setTab(initialTab === "serviceTypes" && !isAdmMaster ? "basicServices" : initialTab);
  }, [initialTab, isAdmMaster]);

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
    setServiceForm({
      ...emptyServiceForm,
      clinic_id: isAdmMaster ? "" : currentClinicId ?? ""
    });
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
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = editingCategory
        ? await updateCategory(editingCategory.id, categoryForm)
        : await createCategory(categoryForm);
      setMessage(result);

      if (result.ok) {
        resetCategoryForm();
        refresh();
      }
    });
  }

  function toggleCategoryStatus(category: Category) {
    if (!isAdmMaster) {
      setMessage({
        ok: false,
        message: "Apenas o ADM pode ativar ou inativar tipos de servico."
      });
      return;
    }

    startTransition(async () => {
      setResult(
        await setCategoryStatus(
          category.id,
          category.status === "active" ? "inactive" : "active"
        )
      );
    });
  }

  const tabs: Array<[Tab, string]> = [
    ["basicServices", "Servicos"],
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
  const isServicesTab = tab === "basicServices";
  const activeCategories = categories.filter(
    (category) => category.status === "active"
  );
  const can = (moduleKey: PermissionModuleKey, action: PermissionAction) =>
    permissions?.[moduleKey]?.[action] ?? true;
  const visibleTabs = tabs.filter(([value]) => {
    const moduleByTab: Record<Tab, PermissionModuleKey> = {
      basicServices: "servicos_basicos",
      advancedServices: "servicos_avancados",
      serviceTypes: "tipos_servico",
      professionals: "comissoes",
      packages: "pacotes",
      discounts: "descontos",
      rules: "regras",
      protocols: "protocolos",
      resources: "recursos",
      notifications: "notificacoes",
      history: "servicos"
    };

    if (value === "serviceTypes" && !isAdmMaster) {
      return false;
    }

    return can(moduleByTab[value], "view");
  });
  const developmentTabs = tabs.filter(
    ([value]) => value !== "basicServices" && value !== "serviceTypes"
  );

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {visibleTabs.map(([value, label]) => (
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

      {isServicesTab ? (
        <>
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

            {can("servicos", "create") ? (
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

          {serviceFormOpen ? (
            <section style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
                    {editingService ? "Editar servico" : "Novo servico"}
                  </h2>
                  <p>Cadastro com os dados principais do servico.</p>
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
                <SelectField
                  label="Clinica/Unidade"
                  value={serviceForm.clinic_id ?? ""}
                  onChange={(value) =>
                    setServiceForm((current) => ({ ...current, clinic_id: value }))
                  }
                  options={clinics.map((clinic) => [clinic.id, clinic.name])}
                  inputStyle={inputStyle}
                  disabled={!isAdmMaster}
                />
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
            headers={["Nome", "Tipo", "Valor", "Duracao", "Status", "Acoes"]}
            rows={filteredServices.map((service) => [
              service.name,
              service.category ?? "-",
              money(service.default_price),
              service.default_duration_minutes
                ? `${service.default_duration_minutes} min`
                : "-",
              service.status === "active" ? "Ativo" : "Inativo",
              <ActionGroup key={service.id}>
                {can("servicos", "edit") ? (
                  <button type="button" onClick={() => openEditService(service)} style={buttonStyle}>
                    Editar
                  </button>
                ) : null}
                {can("servicos", "toggle") ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleServiceStatus(service)}
                    style={buttonStyle}
                  >
                    {service.status === "active" ? "Inativar" : "Ativar"}
                  </button>
                ) : null}
                {can("servicos", "delete") ? (
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
                ) : null}
              </ActionGroup>
            ])}
            emptyText="Nenhum servico encontrado."
          />
        </>
      ) : null}

      {tab === "serviceTypes" && isAdmMaster ? (
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
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleCategoryStatus(category)}
                    style={buttonStyle}
                  >
                    {category.status === "active" ? "Inativar" : "Ativar"}
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

      {developmentTabs.map(([value, title]) =>
        tab === value ? (
          <DevelopmentSection key={value} title={title} />
        ) : null
      )}
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

function DevelopmentSection({ title }: { title: string }) {
  return (
    <SupportSection title={title}>
      <div
        style={{
          border: "1px dashed hsl(var(--border))",
          borderRadius: "8px",
          padding: "24px"
        }}
      >
        <p style={{ fontWeight: 700 }}>{title} em desenvolvimento</p>
        <p style={{ color: "hsl(var(--muted-foreground))", marginTop: "6px" }}>
          Esta aba sera ativada em uma proxima etapa.
        </p>
      </div>
    </SupportSection>
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
  inputStyle,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  inputStyle: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
        disabled={disabled}
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
