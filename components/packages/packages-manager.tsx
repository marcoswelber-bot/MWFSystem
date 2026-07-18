"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, PackagePlus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PermissionSet } from "@/lib/permission-modules";
import type { Database } from "@/types/database";
import {
  cancelPatientPackage,
  createPatientPackage,
  deletePatientPackage,
  finishPatientPackage,
  updatePatientPackage,
  type PackageActionResult,
  type PackageStatus,
  type PatientPackageFormInput
} from "@/app/(app)/pacotes/actions";

type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"] & {
  clinic_name: string;
  patient_name: string;
  service_name: string;
  employee_name: string;
  derived_status: PackageStatus;
};
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

type PackagesManagerProps = {
  packages: PatientPackage[];
  clinics: Clinic[];
  patients: Patient[];
  services: Service[];
  employees: Employee[];
  totalPackages: number;
  currentPage: number;
  pageSize: number;
  currentClinicId: string | null;
  isAdmMaster: boolean;
  loadError?: string;
  permissions?: PermissionSet;
};

const statusOptions: Array<[PackageStatus, string]> = [
  ["active", "Ativo"],
  ["finished", "Finalizado"],
  ["cancelled", "Cancelado"],
  ["expired", "Vencido"]
];

const paymentMethodOptions = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartão"],
  ["boleto", "Boleto"],
  ["parcelado", "Parcelado"]
] as const;

const quantityDiscountTiers = [
  { minSessions: 20, discountPercent: 15 },
  { minSessions: 10, discountPercent: 10 },
  { minSessions: 5, discountPercent: 5 }
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: PatientPackageFormInput = {
  clinic_id: "",
  patient_id: "",
  service_id: "",
  employee_id: "",
  sale_responsible_id: "",
  contracted_sessions: "1",
  completed_sessions: "0",
  unit_session_value: "0",
  discount_percent: "0",
  total_value: "0",
  purchase_date: today(),
  expiration_date: "",
  payment_method: "pix",
  status: "active",
  notes: ""
};

function packageToForm(item: PatientPackage): PatientPackageFormInput {
  return {
    clinic_id: item.clinic_id,
    patient_id: item.patient_id,
    service_id: item.service_id,
    employee_id: item.employee_id ?? "",
    sale_responsible_id: item.sale_responsible_id ?? "",
    contracted_sessions: String(item.contracted_sessions),
    completed_sessions: String(item.completed_sessions),
    unit_session_value: String(item.unit_session_value ?? 0),
    discount_percent: String(item.discount_percent ?? 0),
    total_value: String(item.total_value ?? 0),
    purchase_date: item.purchase_date,
    expiration_date: item.expiration_date ?? "",
    payment_method: item.payment_method,
    status: item.status as PackageStatus,
    notes: item.notes ?? ""
  };
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function numberFromForm(value?: string) {
  const parsedValue = Number.parseFloat(value?.replace(",", ".") ?? "0");
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function integerFromForm(value?: string) {
  const parsedValue = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function moneyFormValue(value: number) {
  return Math.max(value, 0).toFixed(2);
}

function getServiceDefaultValue(service?: Service) {
  return Number(service?.default_price ?? service?.price ?? 0);
}

function getPricingValues(form: PatientPackageFormInput) {
  const quantity = Math.max(integerFromForm(form.contracted_sessions), 0);
  const unitValue = Math.max(numberFromForm(form.unit_session_value), 0);
  const discountPercent = Math.min(
    Math.max(numberFromForm(form.discount_percent), 0),
    100
  );
  const subtotal = quantity * unitValue;
  const discountValue = subtotal * (discountPercent / 100);
  const total = Math.max(subtotal - discountValue, 0);

  return { quantity, unitValue, discountPercent, subtotal, discountValue, total };
}

function getPreparedQuantityDiscount(quantity: number) {
  return (
    quantityDiscountTiers.find((tier) => quantity >= tier.minSessions)
      ?.discountPercent ?? 0
  );
}

function statusLabel(status: PackageStatus) {
  return statusOptions.find(([value]) => value === status)?.[1] ?? "Ativo";
}

function statusClass(status: PackageStatus) {
  const classes: Record<PackageStatus, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
    finished: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    expired: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
  };

  return classes[status];
}

export function PackagesManager({
  packages,
  clinics,
  patients,
  services,
  employees,
  totalPackages,
  currentPage,
  pageSize,
  currentClinicId,
  isAdmMaster,
  loadError,
  permissions
}: PackagesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<PackageActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingPackage, setEditingPackage] = React.useState<PatientPackage | null>(
    null
  );
  const [form, setForm] = React.useState<PatientPackageFormInput>(emptyForm);
  const [clinicFilter, setClinicFilter] = React.useState(currentClinicId ?? "all");
  const [patientFilter, setPatientFilter] = React.useState("all");
  const [serviceFilter, setServiceFilter] = React.useState("all");
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<PackageStatus | "all">("all");

  const canCreate = permissions?.create ?? true;
  const canEdit = permissions?.edit ?? true;
  const canDelete = permissions?.delete ?? true;

  const filteredPackages = packages.filter((item) => {
    if (clinicFilter !== "all" && item.clinic_id !== clinicFilter) return false;
    if (patientFilter !== "all" && item.patient_id !== patientFilter) return false;
    if (serviceFilter !== "all" && item.service_id !== serviceFilter) return false;
    if (employeeFilter !== "all" && item.employee_id !== employeeFilter) return false;
    if (statusFilter !== "all" && item.derived_status !== statusFilter) return false;
    return true;
  });

  const totals = filteredPackages.reduce(
    (accumulator, item) => {
      accumulator.active += item.derived_status === "active" ? 1 : 0;
      accumulator.expired += item.derived_status === "expired" ? 1 : 0;
      accumulator.finished += item.derived_status === "finished" ? 1 : 0;
      accumulator.contracted += item.contracted_sessions;
      accumulator.completed += item.completed_sessions;
      accumulator.remaining += item.remaining_sessions;
      return accumulator;
    },
    { active: 0, expired: 0, finished: 0, contracted: 0, completed: 0, remaining: 0 }
  );

  const pricing = getPricingValues(form);

  function refresh() {
    router.refresh();
  }

  function openCreateForm() {
    setEditingPackage(null);
    setForm({
      ...emptyForm,
      clinic_id: currentClinicId ?? ""
    });
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(item: PatientPackage) {
    setEditingPackage(item);
    setForm(packageToForm(item));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingPackage(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function updateFormWithPricing(
    nextValues: Partial<PatientPackageFormInput>,
    baseForm = form
  ) {
    const nextForm = { ...baseForm, ...nextValues };
    const shouldSuggestQuantityDiscount =
      nextValues.contracted_sessions !== undefined &&
      numberFromForm(baseForm.discount_percent) === 0;

    if (shouldSuggestQuantityDiscount) {
      nextForm.discount_percent = String(
        getPreparedQuantityDiscount(integerFromForm(nextForm.contracted_sessions))
      );
    }

    const nextPricing = getPricingValues(nextForm);

    setForm({
      ...nextForm,
      discount_percent: String(nextPricing.discountPercent),
      total_value: moneyFormValue(nextPricing.total)
    });
  }

  function updateSelectedService(serviceId: string) {
    const selectedService = services.find((service) => service.id === serviceId);
    const unitValue = getServiceDefaultValue(selectedService);

    updateFormWithPricing({
      service_id: serviceId,
      unit_session_value: moneyFormValue(unitValue)
    });
  }

  function submitPackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = editingPackage
        ? await updatePatientPackage(editingPackage.id, form)
        : await createPatientPackage(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refresh();
      }
    });
  }

  function finishPackage(item: PatientPackage) {
    startTransition(async () => {
      const result = await finishPatientPackage(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  function cancelPackage(item: PatientPackage) {
    startTransition(async () => {
      const result = await cancelPatientPackage(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  function removePackage(item: PatientPackage) {
    if (!window.confirm("Excluir este pacote?")) {
      return;
    }

    startTransition(async () => {
      const result = await deletePatientPackage(item.id);
      setMessage(result);
      if (result.ok) refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          )}
        >
          {message.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-normal">Pacotes contratados</h2>
          <p className="text-sm text-muted-foreground">
            Estrutura independente preparada para Agenda e Financeiro futuros.
          </p>
        </div>
        {canCreate ? (
          <Button type="button" onClick={openCreateForm}>
            <PackagePlus className="h-4 w-4" />
            Novo pacote
          </Button>
        ) : null}
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Pacotes ativos" value={totals.active} />
        <MetricCard label="Pacotes vencidos" value={totals.expired} />
        <MetricCard label="Pacotes finalizados" value={totals.finished} />
        <MetricCard label="Sessões contratadas" value={totals.contracted} />
        <MetricCard label="Sessões realizadas" value={totals.completed} />
        <MetricCard label="Sessões restantes" value={totals.remaining} />
      </section>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SelectFilter
            label="Clínica"
            value={clinicFilter}
            onChange={setClinicFilter}
            disabled={!isAdmMaster}
            options={[
              ["all", "Todas"],
              ...clinics.map((clinic) => [clinic.id, clinic.name] as [string, string])
            ]}
          />
          <SelectFilter
            label="Paciente"
            value={patientFilter}
            onChange={setPatientFilter}
            options={[
              ["all", "Todos"],
              ...patients.map((patient) => [patient.id, patient.full_name] as [string, string])
            ]}
          />
          <SelectFilter
            label="Serviço"
            value={serviceFilter}
            onChange={setServiceFilter}
            options={[
              ["all", "Todos"],
              ...services.map((service) => [service.id, service.name] as [string, string])
            ]}
          />
          <SelectFilter
            label="Profissional"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            options={[
              ["all", "Todos"],
              ...employees.map((employee) => [employee.id, employee.name] as [string, string])
            ]}
          />
          <SelectFilter
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as PackageStatus | "all")}
            options={[["all", "Todos"], ...statusOptions]}
          />
        </div>
      </Card>
      {totalPackages > pageSize ? (
        <nav aria-label="Paginacao de pacotes" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Pagina {currentPage} de {Math.ceil(totalPackages / pageSize)} ({totalPackages} pacotes)</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={currentPage <= 1} onClick={() => router.push(`/pacotes?page=${currentPage - 1}`)}>Anterior</Button>
            <Button type="button" variant="outline" disabled={currentPage * pageSize >= totalPackages} onClick={() => router.push(`/pacotes?page=${currentPage + 1}`)}>Proxima</Button>
          </div>
        </nav>
      ) : null}

      {formOpen ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-normal">
              {editingPackage ? "Editar pacote" : "Novo pacote"}
            </h3>
            <Button type="button" variant="outline" onClick={closeForm}>
              Fechar
            </Button>
          </div>

          <form onSubmit={submitPackage} className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Clínica"
                value={form.clinic_id ?? ""}
                onChange={(value) => setForm((current) => ({ ...current, clinic_id: value }))}
                disabled={!isAdmMaster}
                options={clinics.map((clinic) => [clinic.id, clinic.name])}
                required
              />
              <SelectField
                label="Paciente"
                value={form.patient_id}
                onChange={(value) => setForm((current) => ({ ...current, patient_id: value }))}
                options={patients.map((patient) => [patient.id, patient.full_name])}
                required
              />
              <SelectField
                label="Serviço"
                value={form.service_id}
                onChange={updateSelectedService}
                options={services.map((service) => [service.id, service.name])}
                required
              />
              <SelectField
                label="Responsavel pela venda"
                value={form.sale_responsible_id ?? ""}
                onChange={(value) =>
                  setForm((current) => ({ ...current, sale_responsible_id: value }))
                }
                options={employees.map((employee) => [employee.id, employee.name])}
              />
              <TextField
                label="Quantidade contratada"
                type="number"
                value={form.contracted_sessions}
                onChange={(value) =>
                  updateFormWithPricing({ contracted_sessions: value })
                }
                required
              />
              <TextField
                label="Valor unitario"
                type="number"
                value={form.unit_session_value}
                onChange={(value) =>
                  updateFormWithPricing({ unit_session_value: value })
                }
                required
              />
              <TextField
                label="Desconto (%)"
                type="number"
                value={form.discount_percent}
                onChange={(value) => updateFormWithPricing({ discount_percent: value })}
              />
              <TextField
                label="Valor total"
                type="number"
                value={moneyFormValue(pricing.total)}
                onChange={() => undefined}
                disabled
              />
              <TextField
                label="Data da compra"
                type="date"
                value={form.purchase_date}
                onChange={(value) => setForm((current) => ({ ...current, purchase_date: value }))}
                required
              />
              <TextField
                label="Data de validade"
                type="date"
                value={form.expiration_date ?? ""}
                onChange={(value) =>
                  setForm((current) => ({ ...current, expiration_date: value }))
                }
              />
              <SelectField
                label="Forma de pagamento"
                value={form.payment_method}
                onChange={(value) => setForm((current) => ({ ...current, payment_method: value }))}
                options={paymentMethodOptions.map(([value, label]) => [value, label])}
              />
              <SelectField
                label="Status"
                value={form.status ?? "active"}
                onChange={(value) =>
                  setForm((current) => ({ ...current, status: value as PackageStatus }))
                }
                options={statusOptions}
              />
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Observações
              <textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar pacote"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3">Sessões</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPackages.length > 0 ? (
                filteredPackages.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3">
                      <strong>{item.patient_name}</strong>
                      <p className="text-xs text-muted-foreground">{item.clinic_name}</p>
                    </td>
                    <td className="px-4 py-3">{item.service_name}</td>
                    <td className="px-4 py-3">{item.employee_name}</td>
                    <td className="px-4 py-3">
                      {item.completed_sessions}/{item.contracted_sessions}
                      <p className="text-xs text-muted-foreground">
                        {item.remaining_sessions} restantes
                      </p>
                    </td>
                    <td className="px-4 py-3">{money(item.total_value)}</td>
                    <td className="px-4 py-3">{item.expiration_date ?? "-"}</td>
                    <td className="px-4 py-3">
                      {paymentMethodOptions.find(([value]) => value === item.payment_method)?.[1] ??
                        item.payment_method}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-semibold",
                          statusClass(item.derived_status)
                        )}
                      >
                        {statusLabel(item.derived_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canEdit ? (
                          <>
                            <ActionButton label="Editar" icon={Edit3} onClick={() => openEditForm(item)} />
                            <ActionButton
                              label="Finalizar"
                              icon={CheckCircle2}
                              onClick={() => finishPackage(item)}
                              disabled={isPending || item.derived_status === "finished"}
                            />
                            <ActionButton
                              label="Cancelar"
                              icon={XCircle}
                              onClick={() => cancelPackage(item)}
                              disabled={isPending || item.derived_status === "cancelled"}
                            />
                          </>
                        ) : null}
                        {canDelete ? (
                          <ActionButton
                            label="Excluir"
                            icon={Trash2}
                            onClick={() => removePackage(item)}
                            danger
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum pacote encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <strong className="block text-2xl tracking-normal">{value}</strong>
      <span className="text-sm text-muted-foreground">{label}</span>
    </Card>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
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

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  danger = false
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50",
        danger && "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
