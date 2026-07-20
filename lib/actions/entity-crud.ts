"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import { assertCan } from "@/lib/permissions";
import type { PermissionModuleKey } from "@/lib/permission-modules";

export type CrudTable = "clinics" | "employees" | "employee_roles" | "services" | "medical_records";
export type CrudValue = string | number | boolean | null;
export type CrudPayload = Record<string, CrudValue>;

export type CrudActionResult = {
  ok: boolean;
  message: string;
};

const allowedTables = new Set<CrudTable>([
  "clinics",
  "employees",
  "employee_roles",
  "services",
  "medical_records"
]);

const tableModules: Record<CrudTable, PermissionModuleKey> = {
  clinics: "clinicas",
  employees: "funcionarios",
  employee_roles: "funcoes",
  services: "servicos",
  medical_records: "prontuarios"
};

function assertAllowedTable(table: CrudTable) {
  if (!allowedTables.has(table)) {
    throw new Error("Tabela nao permitida para esta operacao.");
  }
}

function cleanPayload(payload: CrudPayload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value
    ])
  ) as CrudPayload;
}

function validateRequiredFields(table: CrudTable, payload: CrudPayload) {
  const requiredField = table === "medical_records" ? "title" : "name";
  const value = payload[requiredField];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      table === "medical_records"
        ? "Titulo e obrigatorio."
        : "Nome e obrigatorio."
    );
  }
}

function successMessage(table: CrudTable, action: "create" | "update" | "status" | "delete") {
  const labels: Record<CrudTable, string> = {
    clinics: "Clinica",
    employees: "Funcionario",
    employee_roles: "Funcao",
    services: "Servico",
    medical_records: "Prontuario"
  };

  const actions = {
    create: "cadastrado com sucesso.",
    update: "atualizado com sucesso.",
    status: "status atualizado com sucesso.",
    delete: "excluido definitivamente."
  };

  return `${labels[table]} ${actions[action]}`;
}

export async function createCrudRecord(
  table: CrudTable,
  path: string,
  payload: CrudPayload
): Promise<CrudActionResult> {
  try {
    assertAllowedTable(table);
    await assertCan(tableModules[table], "create");
    const cleanData = cleanPayload(payload);
    validateRequiredFields(table, cleanData);

    if (table === "employee_roles") {
      const { getCurrentClinicScope } = await import("@/lib/access-control");
      const scope = await getCurrentClinicScope();
      const requestedClinic = typeof cleanData.clinic_id === "string" ? cleanData.clinic_id : null;
      const clinicId = scope.isAdmMaster ? requestedClinic : scope.clinicId;
      if (!clinicId) throw new Error("Selecione uma clinica para cadastrar a funcao.");
      cleanData.clinic_id = clinicId;
    }

    const supabase = await createClient();
    const { error } = await supabase.from(table).insert(cleanData);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath(path);
    return { ok: true, message: successMessage(table, "create") };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateCrudRecord(
  table: CrudTable,
  path: string,
  id: string,
  payload: CrudPayload
): Promise<CrudActionResult> {
  try {
    assertAllowedTable(table);
    await assertCan(tableModules[table], "edit");
    const cleanData = cleanPayload(payload);
    validateRequiredFields(table, cleanData);

    if (table === "employee_roles") {
      const { getCurrentClinicScope } = await import("@/lib/access-control");
      const scope = await getCurrentClinicScope();
      const requestedClinic = typeof cleanData.clinic_id === "string" ? cleanData.clinic_id : null;
      const clinicId = scope.isAdmMaster ? requestedClinic : scope.clinicId;
      if (!clinicId) throw new Error("Selecione uma clinica para cadastrar a funcao.");
      cleanData.clinic_id = clinicId;
    }

    const supabase = await createClient();
    const { error } = await supabase.from(table).update(cleanData).eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath(path);
    return { ok: true, message: successMessage(table, "update") };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function setCrudRecordStatus(
  table: CrudTable,
  path: string,
  id: string,
  status: "active" | "inactive"
): Promise<CrudActionResult> {
  try {
    assertAllowedTable(table);
    await assertCan(tableModules[table], "toggle");
    const supabase = await createClient();
    const { error } = await supabase.from(table).update({ status }).eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath(path);
    return { ok: true, message: successMessage(table, "status") };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteCrudRecord(
  table: CrudTable,
  path: string,
  id: string
): Promise<CrudActionResult> {
  try {
    assertAllowedTable(table);
    await assertCan(tableModules[table], "delete");
    if (table === "employee_roles") throw new Error("Funcoes devem ser inativadas para preservar o historico.");
    const supabase = await createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath(path);
    return { ok: true, message: successMessage(table, "delete") };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
