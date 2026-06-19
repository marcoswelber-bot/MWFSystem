"use client";

import * as React from "react";
import type { Database } from "@/types/database";
import {
  copyUserPermissions,
  restoreDefaultUserPermissions,
  saveUserPermissions,
  updateEmployeeRole,
  userRoles,
  type PermissionActionResult
} from "@/app/(app)/configuracoes/permissions-actions";
import {
  fullPermissionSet,
  permissionActionLabels,
  permissionActions,
  permissionModules,
  getEmptyPermissionMap,
  isAdmEmail,
  isAdmRole,
  type PermissionAction,
  type PermissionMap,
  type PermissionModuleKey,
  type PermissionSet
} from "@/lib/permission-modules";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

type UserPermissionsManagerProps = {
  employees: Employee[];
  initialPermissions: Record<string, PermissionMap>;
  isAdmMaster: boolean;
};

function clonePermissions(permissions?: PermissionMap) {
  const fallbackPermissions = getEmptyPermissionMap();

  return Object.fromEntries(
    permissionModules.map((module) => [
      module.key,
      { ...(permissions?.[module.key] ?? fallbackPermissions[module.key]) }
    ])
  ) as PermissionMap;
}

function getEmployeeLabel(employee: Employee) {
  return [employee.name, employee.email].filter(Boolean).join(" - ");
}

export function UserPermissionsManager({
  employees,
  initialPermissions,
  isAdmMaster
}: UserPermissionsManagerProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState(
    employees[0]?.id ?? ""
  );
  const [search, setSearch] = React.useState("");
  const [copyFromEmployeeId, setCopyFromEmployeeId] = React.useState("");
  const [permissions, setPermissions] = React.useState<PermissionMap>(
    selectedEmployeeId
      ? clonePermissions(initialPermissions[selectedEmployeeId])
      : getEmptyPermissionMap()
  );
  const [message, setMessage] = React.useState<PermissionActionResult | null>(
    null
  );
  const [isPending, startTransition] = React.useTransition();

  const selectedEmployee = employees.find(
    (employee) => employee.id === selectedEmployeeId
  );
  const selectedIsAdmMaster =
    isAdmRole(selectedEmployee?.role) || isAdmEmail(selectedEmployee?.email);

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
  const filteredEmployees = employees.filter((employee) => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return [employee.name, employee.email, employee.role]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  function selectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setPermissions(
      employeeId
        ? clonePermissions(initialPermissions[employeeId] ?? getEmptyPermissionMap())
        : getEmptyPermissionMap()
    );
    setMessage(null);
  }

  function updatePermission(
    moduleKey: PermissionModuleKey,
    action: PermissionAction,
    checked: boolean
  ) {
    setPermissions((current) => ({
      ...current,
      [moduleKey]: {
        ...(current[moduleKey] ?? {}),
        [action]: checked
      } as PermissionSet
    }));
  }

  function savePermissions() {
    if (!selectedEmployeeId) {
      return;
    }

    startTransition(async () => {
      setMessage(await saveUserPermissions(selectedEmployeeId, permissions));
    });
  }

  function copyPermissions() {
    if (!selectedEmployeeId || !copyFromEmployeeId) {
      setMessage({ ok: false, message: "Selecione o usuario de origem." });
      return;
    }

    startTransition(async () => {
      const result = await copyUserPermissions(copyFromEmployeeId, selectedEmployeeId);
      setMessage(result);

      if (result.ok) {
        setPermissions(
          clonePermissions(initialPermissions[copyFromEmployeeId] ?? getEmptyPermissionMap())
        );
      }
    });
  }

  function restoreDefaultPermissions() {
    if (!selectedEmployeeId) {
      return;
    }

    startTransition(async () => {
      const result = await restoreDefaultUserPermissions(selectedEmployeeId);
      setMessage(result);

      if (result.ok) {
        setPermissions(getEmptyPermissionMap());
      }
    });
  }

  function changeRole(role: string) {
    if (!selectedEmployeeId) {
      return;
    }

    startTransition(async () => {
      setMessage(await updateEmployeeRole(selectedEmployeeId, role));
    });
  }

  return (
    <section
      style={{
        border: "1px solid hsl(var(--border))",
        borderRadius: "8px",
        display: "grid",
        gap: "16px",
        marginTop: "24px",
        padding: "20px"
      }}
    >
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
          Permissoes de Usuarios
        </h2>
        <p>Somente o ADM Master libera ou bloqueia modulos e acoes.</p>
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

      {!isAdmMaster ? (
        <div
          style={{
            border: "1px solid hsl(var(--destructive))",
            borderRadius: "6px",
            color: "hsl(var(--destructive))",
            padding: "12px"
          }}
        >
          Apenas o ADM Master pode gerenciar permissoes.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        <label>
          Buscar usuario
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, email ou cargo"
            style={inputStyle}
          />
        </label>

        <label>
          Funcionario/usuario
          <select
            value={selectedEmployeeId}
            onChange={(event) => selectEmployee(event.target.value)}
            style={inputStyle}
          >
            {filteredEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {getEmployeeLabel(employee)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cargo
          <select
            disabled={!isAdmMaster || selectedIsAdmMaster}
            value={selectedEmployee?.role ?? "Profissional"}
            onChange={(event) => changeRole(event.target.value)}
            style={inputStyle}
          >
            {userRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label>
          Copiar permissoes de
          <select
            disabled={!isAdmMaster || selectedIsAdmMaster}
            value={copyFromEmployeeId}
            onChange={(event) => setCopyFromEmployeeId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Selecione</option>
            {employees
              .filter((employee) => employee.id !== selectedEmployeeId)
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {getEmployeeLabel(employee)}
                </option>
              ))}
          </select>
        </label>

        <div style={{ display: "flex", alignItems: "end" }}>
          <button
            type="button"
            disabled={!isAdmMaster || selectedIsAdmMaster || isPending}
            onClick={copyPermissions}
            style={buttonStyle}
          >
            Copiar permissoes
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Usuario", "Email", "Cargo", "Status"].map((heading) => (
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
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr
                key={employee.id}
                onClick={() => selectEmployee(employee.id)}
                style={{
                  background:
                    employee.id === selectedEmployeeId
                      ? "hsl(var(--secondary))"
                      : "transparent",
                  cursor: "pointer"
                }}
              >
                <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                  {employee.name}
                </td>
                <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                  {employee.email ?? "-"}
                </td>
                <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                  {employee.role ?? "-"}
                </td>
                <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                  {employee.status === "active" ? "Ativo" : "Inativo"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIsAdmMaster ? (
        <div
          style={{
            border: "1px solid hsl(var(--primary))",
            borderRadius: "6px",
            color: "hsl(var(--primary))",
            padding: "12px"
          }}
        >
          ADM Master sempre possui acesso total e nao pode ser limitado.
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px", textAlign: "left" }}>
                Modulo
              </th>
              {permissionActions.map((action) => (
                <th
                  key={action}
                  style={{
                    borderBottom: "1px solid hsl(var(--border))",
                    padding: "10px",
                    textAlign: "center"
                  }}
                >
                  {permissionActionLabels[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionModules.map((module) => {
              const modulePermissions = selectedIsAdmMaster
                ? fullPermissionSet
                : permissions[module.key];

              return (
                <tr key={module.key}>
                  <td style={{ borderBottom: "1px solid hsl(var(--border))", padding: "10px" }}>
                    {module.label}
                  </td>
                  {permissionActions.map((action) => (
                    <td
                      key={action}
                      style={{
                        borderBottom: "1px solid hsl(var(--border))",
                        padding: "10px",
                        textAlign: "center"
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!isAdmMaster || selectedIsAdmMaster}
                        checked={Boolean(modulePermissions?.[action])}
                        onChange={(event) =>
                          updatePermission(module.key, action, event.target.checked)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={!isAdmMaster || selectedIsAdmMaster || isPending}
          onClick={restoreDefaultPermissions}
          style={{ ...buttonStyle, marginRight: "8px" }}
        >
          Restaurar permissoes padrao
        </button>
        <button
          type="button"
          disabled={!isAdmMaster || selectedIsAdmMaster || isPending}
          onClick={savePermissions}
          style={{
            ...buttonStyle,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))"
          }}
        >
          {isPending ? "Salvando..." : "Salvar permissoes"}
        </button>
      </div>
    </section>
  );
}
