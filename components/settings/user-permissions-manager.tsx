"use client";

import * as React from "react";
import { ChevronDown, Copy, Search, ShieldCheck, UserRound } from "lucide-react";
import type { Database } from "@/types/database";
import {
  saveUserPermissions,
  type PermissionActionResult
} from "@/app/(app)/configuracoes/permissions-actions";
import {
  fullPermissionSet,
  permissionActionLabels,
  permissionActions,
  permissionModules,
  getEmptyPermissionMap,
  isAdmRole,
  type PermissionAction,
  type PermissionMap,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterPermissionEmployees } from "@/lib/permissions-filter";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type ActiveClinic = { id: string; name: string } | null;

type UserPermissionsManagerProps = {
  employees?: Employee[];
  initialPermissions?: Record<string, PermissionMap>;
  isAdmMaster?: boolean;
  activeClinic?: ActiveClinic;
};

const moduleDescriptions: Partial<Record<PermissionModuleKey, string>> = {
  dashboard: "Indicadores e visão geral da clínica.",
  pacientes: "Cadastros e informações dos pacientes.",
  clinicas: "Dados e configurações das clínicas.",
  agenda: "Agendamentos, horários e atendimentos.",
  funcionarios: "Equipe e vínculos profissionais.",
  funcoes: "Funções e cargos do sistema.",
  mwf_ia: "Assistente operacional MWF IA.",
  financeiro: "Lançamentos, baixas e informações financeiras.",
  servicos: "Serviços oferecidos pela clínica.",
  tipos_servico: "Classificações dos serviços.",
  servicos_basicos: "Configurações básicas dos serviços.",
  servicos_avancados: "Configurações avançadas dos serviços.",
  comissoes: "Regras e consultas de comissões.",
  pacotes: "Pacotes e sessões dos pacientes.",
  descontos: "Descontos aplicáveis aos serviços.",
  regras: "Regras operacionais de serviços.",
  protocolos: "Protocolos utilizados pela clínica.",
  recursos: "Recursos necessários aos serviços.",
  notificacoes: "Avisos e notificações internas.",
  prontuarios: "Prontuários e registros clínicos autorizados.",
  relatorios: "Relatórios e exportações.",
  configuracoes: "Configurações administrativas do sistema."
};

function clonePermissions(permissions?: PermissionMap) {
  const fallback = getEmptyPermissionMap();
  return Object.fromEntries(
    permissionModules.map((module) => [
      module.key,
      { ...fallback[module.key], ...(permissions?.[module.key] ?? {}) }
    ])
  ) as PermissionMap;
}

function samePermissions(left: PermissionMap, right: PermissionMap) {
  return permissionModules.every((module) =>
    permissionActions.every(
      (action) => Boolean(left[module.key]?.[action]) === Boolean(right[module.key]?.[action])
    )
  );
}

export function UserPermissionsManager({
  employees: rawEmployees = [],
  initialPermissions: rawInitialPermissions = {},
  isAdmMaster = false,
  activeClinic = null
}: UserPermissionsManagerProps) {
  const employees = React.useMemo(
    () =>
      (Array.isArray(rawEmployees) ? rawEmployees : []).filter(
        (employee): employee is Employee =>
          Boolean(employee?.id && activeClinic?.id && employee.clinic_id === activeClinic.id)
      ),
    [rawEmployees, activeClinic?.id]
  );
  const [savedPermissions, setSavedPermissions] = React.useState<Record<string, PermissionMap>>(
    () =>
      Object.fromEntries(
        employees.map((employee) => [
          employee.id,
          clonePermissions(rawInitialPermissions[employee.id])
        ])
      )
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [copyFromEmployeeId, setCopyFromEmployeeId] = React.useState("");
  const [permissions, setPermissions] = React.useState<PermissionMap>(getEmptyPermissionMap);
  const [message, setMessage] = React.useState<PermissionActionResult | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const roles = React.useMemo(
    () =>
      [...new Set(employees.map((employee) => employee.role).filter((role): role is string => Boolean(role)))]
        .sort((left, right) => left.localeCompare(right, "pt-BR")),
    [employees]
  );
  const filteredEmployees = React.useMemo(() => {
    return filterPermissionEmployees(employees, activeClinic?.id ?? "", {
      search,
      role: roleFilter,
      status: statusFilter
    });
  }, [activeClinic?.id, employees, roleFilter, search, statusFilter]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const copySource = employees.find((employee) => employee.id === copyFromEmployeeId);
  const selectedIsAdmMaster = isAdmRole(selectedEmployee?.role);
  const baseline = selectedEmployeeId
    ? savedPermissions[selectedEmployeeId] ?? getEmptyPermissionMap()
    : getEmptyPermissionMap();
  const isDirty = Boolean(
    selectedEmployeeId &&
      !selectedIsAdmMaster &&
      !samePermissions(permissions, baseline)
  );

  function selectEmployee(employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    setSelectedEmployeeId(employee?.id ?? "");
    setPermissions(
      employee
        ? clonePermissions(
            isAdmRole(employee.role)
              ? Object.fromEntries(permissionModules.map((module) => [module.key, { ...fullPermissionSet }])) as PermissionMap
              : savedPermissions[employee.id]
          )
        : getEmptyPermissionMap()
    );
    setCopyFromEmployeeId("");
    setMessage(null);
  }

  function updatePermission(
    moduleKey: PermissionModuleKey,
    action: PermissionAction,
    checked: boolean
  ) {
    if (selectedIsAdmMaster) return;
    setPermissions((current) => ({
      ...current,
      [moduleKey]: { ...current[moduleKey], [action]: checked } as PermissionSet
    }));
    setMessage(null);
  }

  function setModulePermissions(moduleKey: PermissionModuleKey, checked: boolean) {
    if (selectedIsAdmMaster) return;
    setPermissions((current) => ({
      ...current,
      [moduleKey]: Object.fromEntries(
        permissionActions.map((action) => [action, checked])
      ) as PermissionSet
    }));
    setMessage(null);
  }

  function cancelChanges() {
    if (!selectedEmployeeId) return;
    setPermissions(clonePermissions(baseline));
    setCopyFromEmployeeId("");
    setMessage(null);
  }

  function applyCopy() {
    if (!selectedEmployee || !copySource || copySource.clinic_id !== activeClinic?.id) {
      setMessage({ ok: false, message: "Selecione um funcionário da mesma clínica." });
      return;
    }
    const confirmed = window.confirm(
      `Copiar as permissões de ${copySource.name} (${copySource.role ?? "Sem cargo"}) para ${selectedEmployee.name}? As alterações só serão salvas quando você clicar em Salvar permissões.`
    );
    if (!confirmed) return;
    setPermissions(clonePermissions(savedPermissions[copySource.id]));
    setMessage({
      ok: true,
      message: `Permissões de ${copySource.name} aplicadas na tela para ${selectedEmployee.name}. Revise e salve para confirmar.`
    });
  }

  function savePermissions() {
    if (!selectedEmployee || !activeClinic || !isDirty) return;
    startTransition(async () => {
      const result = await saveUserPermissions(
        selectedEmployee.id,
        activeClinic.id,
        permissions
      );
      setMessage(result);
      if (result.ok) {
        setSavedPermissions((current) => ({
          ...current,
          [selectedEmployee.id]: clonePermissions(permissions)
        }));
      }
    });
  }

  if (!activeClinic) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Selecione uma clínica para visualizar os funcionários e configurar as permissões.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="mt-6 grid min-w-0 gap-5 overflow-x-hidden">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Funcionário e clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clínica selecionada
            </p>
            <p className="mt-1 break-words font-semibold">{activeClinic.name}</p>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-4">
            <div className="grid gap-2 lg:col-span-2">
              <Label htmlFor="permission-employee-search">Buscar funcionário</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="permission-employee-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, e-mail ou cargo"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-role-filter">Cargo</Label>
              <select
                id="permission-role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos os cargos</option>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-status-filter">Status</Label>
              <select
                id="permission-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="permission-employee-select">
              Funcionário ({filteredEmployees.length})
            </Label>
            <select
              id="permission-employee-select"
              value={selectedEmployeeId}
              onChange={(event) => selectEmployee(event.target.value)}
              className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione um funcionário</option>
              {filteredEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} — {employee.email ?? employee.login_email ?? "Sem e-mail"} — {employee.role ?? "Sem cargo"}
                </option>
              ))}
            </select>
            {!filteredEmployees.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhum funcionário desta clínica corresponde aos filtros.
              </p>
            ) : null}
          </div>

          {selectedEmployee ? (
            <div className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Funcionário selecionado">
              {[
                ["Nome", selectedEmployee.name],
                ["E-mail", selectedEmployee.email ?? selectedEmployee.login_email ?? "Não informado"],
                ["Cargo", selectedEmployee.role ?? "Não informado"],
                ["Clínica", activeClinic.name],
                ["Status", selectedEmployee.status === "active" ? "Ativo" : "Inativo"]
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <UserRound className="h-5 w-5 shrink-0" />
              Selecione um funcionário desta clínica para configurar as permissões.
            </div>
          )}
        </CardContent>
      </Card>

      {message ? (
        <div
          role="status"
          className={message.ok
            ? "rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
            : "rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"}
        >
          {message.message}
        </div>
      ) : null}

      {selectedEmployee ? (
        <>
          <Card>
            <CardContent className="grid min-w-0 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="copy-permissions-from">Copiar permissões de</Label>
                <select
                  id="copy-permissions-from"
                  disabled={selectedIsAdmMaster}
                  value={copyFromEmployeeId}
                  onChange={(event) => setCopyFromEmployeeId(event.target.value)}
                  className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione uma origem da mesma clínica</option>
                  {employees
                    .filter((employee) => employee.id !== selectedEmployee.id)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role ?? "Sem cargo"}
                      </option>
                    ))}
                </select>
                {copySource ? (
                  <p className="text-xs text-muted-foreground">
                    Origem: {copySource.name} ({copySource.role ?? "Sem cargo"}) → Destino: {selectedEmployee.name}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!copySource || selectedIsAdmMaster}
                onClick={applyCopy}
                className="w-full md:w-auto"
              >
                <Copy className="mr-2 h-4 w-4" />
                Aplicar cópia
              </Button>
            </CardContent>
          </Card>

          {selectedIsAdmMaster ? (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
              Este funcionário é ADM Master. As permissões administrativas são obrigatórias e não podem ser bloqueadas.
            </div>
          ) : null}

          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {permissionModules.map((module) => {
              const modulePermissions = selectedIsAdmMaster
                ? fullPermissionSet
                : permissions[module.key] ?? getEmptyPermissionMap()[module.key];
              return (
                <details key={module.key} className="group min-w-0 rounded-xl border bg-card shadow-sm">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{module.label}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {moduleDescriptions[module.key] ?? "Permissões disponíveis para este módulo."}
                      </p>
                    </div>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={selectedIsAdmMaster} onClick={() => setModulePermissions(module.key, true)}>
                        Liberar todas
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={selectedIsAdmMaster} onClick={() => setModulePermissions(module.key, false)}>
                        Bloquear todas
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissionActions.map((action) => (
                        <label key={action} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={!isAdmMaster || selectedIsAdmMaster}
                            checked={Boolean(modulePermissions[action])}
                            onChange={(event) => updatePermission(module.key, action, event.target.checked)}
                            className="h-5 w-5 shrink-0 accent-primary"
                          />
                          <span className="capitalize">{permissionActionLabels[action]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={!isDirty || isPending} onClick={cancelChanges}>
              Cancelar alterações
            </Button>
            <Button type="button" disabled={!isDirty || isPending || selectedIsAdmMaster} onClick={savePermissions}>
              {isPending ? "Salvando..." : "Salvar permissões"}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
