import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterPermissionEmployees,
  normalizePermissionSearch
} from "../lib/permissions-filter.ts";

const employees = [
  {
    id: "a1",
    clinic_id: "clinic-a",
    name: "João Fisioterapeuta",
    email: "joao@clinica.test",
    login_email: null,
    role: "Profissional",
    status: "active"
  },
  {
    id: "a2",
    clinic_id: "clinic-a",
    name: "Márcia Recepção",
    email: "marcia@clinica.test",
    login_email: null,
    role: "Recepcao",
    status: "inactive"
  },
  {
    id: "b1",
    clinic_id: "clinic-b",
    name: "João Demonstração",
    email: "demo@outra.test",
    login_email: null,
    role: "Profissional",
    status: "active"
  }
];

test("clínica A e clínica B recebem somente seus próprios funcionários", () => {
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a").map((employee) => employee.id),
    ["a1", "a2"]
  );
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-b").map((employee) => employee.id),
    ["b1"]
  );
});

test("busca parcial ignora acentos e diferenças entre maiúsculas", () => {
  assert.equal(normalizePermissionSearch("  MÁRCIA  "), "marcia");
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", { search: "marc" }).map(
      (employee) => employee.id
    ),
    ["a2"]
  );
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", { search: "JOAO" }).map(
      (employee) => employee.id
    ),
    ["a1"]
  );
});

test("busca por e-mail e cargo funciona dentro da clínica", () => {
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", {
      search: "joao@clinica"
    }).map((employee) => employee.id),
    ["a1"]
  );
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", {
      search: "recep"
    }).map((employee) => employee.id),
    ["a2"]
  );
});

test("filtros de cargo e status podem ser combinados", () => {
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", {
      role: "Profissional",
      status: "active"
    }).map((employee) => employee.id),
    ["a1"]
  );
  assert.deepEqual(
    filterPermissionEmployees(employees, "clinic-a", {
      role: "Recepcao",
      status: "inactive"
    }).map((employee) => employee.id),
    ["a2"]
  );
});

test("carregamento consulta funcionários e permissões somente da clínica atual", () => {
  const data = readFileSync(
    new URL("../app/(app)/configuracoes/permissions-data.ts", import.meta.url),
    "utf8"
  );
  assert.match(data, /getCurrentClinicScope/);
  assert.match(data, /\.from\("employees"\)\.select\("\*"\)\.eq\("clinic_id", scope\.clinicId\)/);
  assert.match(data, /\.in\("employee_id", employeeIds\)/);
  assert.doesNotMatch(data, /from\("employees"\)\.select\("\*"\)\.order/);
});

test("backend valida ADM Master, clínica ativa e vínculo antes de salvar", () => {
  const actions = readFileSync(
    new URL("../app/(app)/configuracoes/permissions-actions.ts", import.meta.url),
    "utf8"
  );
  assert.match(actions, /assertAdmMaster/);
  assert.match(actions, /assertSelectedClinic\(clinicId\)/);
  assert.match(actions, /\.eq\("clinic_id", clinicId\)/);
  assert.match(actions, /Funcionario nao pertence a clinica selecionada/);
  assert.match(actions, /isAdmRole\(targetEmployee\.role\)/);
  assert.match(actions, /Permissões salvas com sucesso/);
  assert.doesNotMatch(actions, /copyUserPermissions/);
});

test("tela inicia sem seleção e só mostra permissões depois do funcionário", () => {
  const component = readFileSync(
    new URL("../components/settings/user-permissions-manager.tsx", import.meta.url),
    "utf8"
  );
  assert.match(component, /useState\(""\)/);
  assert.match(
    component,
    /Selecione um funcionário desta clínica para configurar as permissões/
  );
  assert.match(
    component,
    /Selecione uma clínica para visualizar os funcionários e configurar as permissões/
  );
  assert.match(component, /\{selectedEmployee \? \(/);
  assert.doesNotMatch(component, /employees\[0\]/);
  assert.doesNotMatch(component, /<table/);
});

test("módulos usam chaves existentes e controles individuais e coletivos", () => {
  const component = readFileSync(
    new URL("../components/settings/user-permissions-manager.tsx", import.meta.url),
    "utf8"
  );
  assert.match(component, /permissionModules\.map/);
  assert.match(component, /permissionActions\.map/);
  assert.match(component, /Liberar todas/);
  assert.match(component, /Bloquear todas/);
  assert.match(component, /<details/);
  assert.match(component, /group-open:rotate-180/);
});

test("cópia permanece local até salvar e exige confirmação", () => {
  const component = readFileSync(
    new URL("../components/settings/user-permissions-manager.tsx", import.meta.url),
    "utf8"
  );
  assert.match(component, /window\.confirm/);
  assert.match(component, /setPermissions\(clonePermissions\(savedPermissions\[copySource\.id\]\)\)/);
  assert.match(component, /As alterações só serão salvas/);
  assert.equal((component.match(/saveUserPermissions\(/g) ?? []).length, 1);
});

test("cancelamento, estado alterado e sucesso de persistência são controlados", () => {
  const component = readFileSync(
    new URL("../components/settings/user-permissions-manager.tsx", import.meta.url),
    "utf8"
  );
  assert.match(component, /samePermissions/);
  assert.match(component, /disabled=\{!isDirty \|\| isPending/);
  assert.match(component, /Cancelar alterações/);
  assert.match(component, /setSavedPermissions/);
});

test("layout evita tabela e rolagem horizontal no mobile e preserva temas", () => {
  const component = readFileSync(
    new URL("../components/settings/user-permissions-manager.tsx", import.meta.url),
    "utf8"
  );
  assert.match(component, /overflow-x-hidden/);
  assert.match(component, /grid min-w-0 gap-4 lg:grid-cols-4/);
  assert.match(component, /w-full min-w-0/);
  assert.match(component, /dark:text-emerald-300/);
  assert.match(component, /safe-area-inset-bottom/);
});
