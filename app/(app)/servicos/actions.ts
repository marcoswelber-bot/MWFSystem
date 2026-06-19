"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];
type CategoryInsert = Database["public"]["Tables"]["service_categories"]["Insert"];
type ProfessionalInsert =
  Database["public"]["Tables"]["service_professionals"]["Insert"];
type PackageInsert = Database["public"]["Tables"]["service_packages"]["Insert"];
type DiscountInsert = Database["public"]["Tables"]["service_discounts"]["Insert"];
type RuleInsert = Database["public"]["Tables"]["commercial_rules"]["Insert"];
type ProtocolInsert =
  Database["public"]["Tables"]["treatment_protocols"]["Insert"];
type ResourceInsert = Database["public"]["Tables"]["service_resources"]["Insert"];
type NotificationInsert =
  Database["public"]["Tables"]["internal_notifications"]["Insert"];

export type ServiceActionResult = {
  ok: boolean;
  message: string;
};

export type ServiceFormInput = {
  name: string;
  internal_code?: string;
  category_id?: string;
  category?: string;
  description?: string;
  classification?: string;
  attendance_type?: string;
  priority?: string;
  billing_type?: string;
  default_duration_minutes?: string;
  break_minutes?: string;
  default_price?: string;
  promotional_price?: string;
  required_credits?: string;
  color?: string;
  image_url?: string;
  is_group?: boolean;
  participant_limit?: string;
  allows_package?: boolean;
  requires_medical_record?: boolean;
  requires_consent_form?: boolean;
  requires_authorization?: boolean;
  requires_photos?: boolean;
  requires_attachment?: boolean;
  is_initial_assessment?: boolean;
  pre_service_instructions?: string;
  post_service_instructions?: string;
  required_materials?: string;
  room_required?: string;
  equipment_required?: string;
  preparation_minutes?: string;
  cleanup_minutes?: string;
  suggested_sessions?: string;
  suggested_price?: string;
  suggested_discount?: string;
  commission_type?: string;
  commission_value?: string;
  status?: string;
};

export type CategoryFormInput = {
  name: string;
  description?: string;
  color?: string;
};

export type ProfessionalLinkFormInput = {
  service_id: string;
  employee_id: string;
  is_primary?: boolean;
  commission_type?: string;
  commission_value?: string;
};

export type PackageFormInput = {
  name: string;
  description?: string;
  sessions_quantity?: string;
  total_price?: string;
  validity_days?: string;
  uses_credits?: boolean;
  contracted_credits?: string;
  allow_freeze?: boolean;
  allow_renewal?: boolean;
};

export type DiscountFormInput = {
  service_id?: string;
  name: string;
  sessions_quantity?: string;
  discount_type?: string;
  discount_value?: string;
  original_price?: string;
};

export type RuleFormInput = {
  name: string;
  rule_type: string;
  coupon_code?: string;
  discount_type?: string;
  discount_value?: string;
  max_discount_admin?: string;
  max_discount_manager?: string;
  max_discount_professional?: string;
  start_date?: string;
  end_date?: string;
};

export type ProtocolFormInput = {
  name: string;
  objective?: string;
  goal_id?: string;
  recommended_sessions?: string;
  recommended_interval_days?: string;
};

export type ResourceFormInput = {
  service_id: string;
  room?: string;
  equipment?: string;
  stretcher_required?: boolean;
  specific_device?: string;
  materials?: string;
  preparation_minutes?: string;
  cleanup_minutes?: string;
};

export type NotificationFormInput = {
  service_id?: string;
  employee_id?: string;
  title: string;
  message: string;
  notification_type?: string;
  whatsapp_template?: string;
};

type DeletableTable =
  | "service_categories"
  | "service_professionals"
  | "service_packages"
  | "service_discounts"
  | "commercial_rules"
  | "treatment_protocols"
  | "service_resources"
  | "internal_notifications";

function cleanOptionalValue(value?: string) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function cleanOptionalNumber(value?: string) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return null;
  }

  const numberValue = Number(cleanValue.replace(",", "."));

  if (Number.isNaN(numberValue)) {
    throw new Error("Informe apenas numeros nos campos de valor ou quantidade.");
  }

  return numberValue;
}

function cleanOptionalInteger(value?: string) {
  const numberValue = cleanOptionalNumber(value);
  return numberValue === null ? null : Math.trunc(numberValue);
}

function getServicePayload(input: ServiceFormInput): ServiceInsert {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Nome do servico e obrigatorio.");
  }

  const defaultDuration = cleanOptionalInteger(input.default_duration_minutes);
  const defaultPrice = cleanOptionalNumber(input.default_price);
  const category = cleanOptionalValue(input.category);

  return {
    name,
    internal_code: cleanOptionalValue(input.internal_code),
    category_id: cleanOptionalValue(input.category_id),
    category,
    type: cleanOptionalValue(input.classification) ?? category,
    description: cleanOptionalValue(input.description),
    classification: cleanOptionalValue(input.classification),
    attendance_type: input.attendance_type ?? "presencial",
    priority: input.priority ?? "normal",
    billing_type: input.billing_type ?? "particular",
    duration_minutes: defaultDuration,
    default_duration_minutes: defaultDuration,
    break_minutes: cleanOptionalInteger(input.break_minutes),
    price: defaultPrice,
    default_price: defaultPrice,
    promotional_price: cleanOptionalNumber(input.promotional_price),
    required_credits: cleanOptionalInteger(input.required_credits) ?? 0,
    color: cleanOptionalValue(input.color),
    image_url: cleanOptionalValue(input.image_url),
    is_group: Boolean(input.is_group),
    participant_limit: cleanOptionalInteger(input.participant_limit),
    allows_package: input.allows_package ?? true,
    requires_medical_record: Boolean(input.requires_medical_record),
    requires_consent_form: Boolean(input.requires_consent_form),
    requires_authorization: Boolean(input.requires_authorization),
    requires_photos: Boolean(input.requires_photos),
    requires_attachment: Boolean(input.requires_attachment),
    is_initial_assessment: Boolean(input.is_initial_assessment),
    pre_service_instructions: cleanOptionalValue(input.pre_service_instructions),
    post_service_instructions: cleanOptionalValue(input.post_service_instructions),
    required_materials: cleanOptionalValue(input.required_materials),
    room_required: cleanOptionalValue(input.room_required),
    equipment_required: cleanOptionalValue(input.equipment_required),
    preparation_minutes: cleanOptionalInteger(input.preparation_minutes),
    cleanup_minutes: cleanOptionalInteger(input.cleanup_minutes),
    suggested_sessions: cleanOptionalInteger(input.suggested_sessions),
    suggested_price: cleanOptionalNumber(input.suggested_price),
    suggested_discount: cleanOptionalNumber(input.suggested_discount),
    commission_type: cleanOptionalValue(input.commission_type),
    commission_value: cleanOptionalNumber(input.commission_value),
    service_mode: input.is_group ? "grupo" : "individual",
    status: input.status ?? "active"
  };
}

function getDiscountPreview(input: DiscountFormInput) {
  const sessions = cleanOptionalInteger(input.sessions_quantity) ?? 1;
  const discountValue = cleanOptionalNumber(input.discount_value) ?? 0;
  const originalPrice = cleanOptionalNumber(input.original_price);

  if (originalPrice === null) {
    return {
      original_price: null,
      final_price: null,
      price_per_session: null,
      total_savings: null
    };
  }

  const totalOriginal = originalPrice * sessions;
  const totalSavings =
    input.discount_type === "fixed"
      ? discountValue
      : totalOriginal * (discountValue / 100);
  const finalPrice = Math.max(totalOriginal - totalSavings, 0);

  return {
    original_price: totalOriginal,
    final_price: finalPrice,
    price_per_session: sessions > 0 ? finalPrice / sessions : finalPrice,
    total_savings: totalSavings
  };
}

async function writeAuditLog(
  action: string,
  serviceId?: string,
  fieldName?: string,
  oldValue?: string | null,
  newValue?: string | null
) {
  const supabase = await createClient();
  await supabase.from("service_audit_logs").insert({
    service_id: serviceId ?? null,
    action,
    field_name: fieldName ?? null,
    old_value: oldValue ?? null,
    new_value: newValue ?? null
  });
}

export async function createService(
  input: ServiceFormInput
): Promise<ServiceActionResult> {
  try {
    const supabase = await createClient();
    const payload = getServicePayload(input);
    const { data, error } = await supabase
      .from("services")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog("created", data?.id);
    revalidatePath("/servicos");
    return { ok: true, message: "Servico cadastrado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function updateService(
  id: string,
  input: ServiceFormInput
): Promise<ServiceActionResult> {
  try {
    const supabase = await createClient();
    const payload = getServicePayload(input) satisfies ServiceUpdate;
    const { error } = await supabase.from("services").update(payload).eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog("updated", id);
    revalidatePath("/servicos");
    return { ok: true, message: "Servico atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function setServiceStatus(
  id: string,
  status: "active" | "inactive"
): Promise<ServiceActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("services").update({ status }).eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog(status === "active" ? "activated" : "deactivated", id);
    revalidatePath("/servicos");
    return { ok: true, message: "Status do servico atualizado." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteService(id: string): Promise<ServiceActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("services").delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Servico excluido definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createCategory(input: CategoryFormInput) {
  try {
    if (!input.name.trim()) {
      throw new Error("Nome da categoria e obrigatorio.");
    }

    const payload: CategoryInsert = {
      name: input.name.trim(),
      description: cleanOptionalValue(input.description),
      color: cleanOptionalValue(input.color)
    };
    const supabase = await createClient();
    const { error } = await supabase.from("service_categories").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Categoria criada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createProfessionalLink(input: ProfessionalLinkFormInput) {
  try {
    if (!input.service_id || !input.employee_id) {
      throw new Error("Selecione servico e profissional.");
    }

    const payload: ProfessionalInsert = {
      service_id: input.service_id,
      employee_id: input.employee_id,
      is_primary: Boolean(input.is_primary),
      commission_type: cleanOptionalValue(input.commission_type),
      commission_value: cleanOptionalNumber(input.commission_value)
    };
    const supabase = await createClient();
    const { error } = await supabase.from("service_professionals").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog("professional_linked", input.service_id);
    revalidatePath("/servicos");
    return { ok: true, message: "Profissional vinculado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createPackage(input: PackageFormInput) {
  try {
    if (!input.name.trim()) {
      throw new Error("Nome do pacote e obrigatorio.");
    }

    const sessions = cleanOptionalInteger(input.sessions_quantity) ?? 1;
    const totalPrice = cleanOptionalNumber(input.total_price);
    const contractedCredits = cleanOptionalInteger(input.contracted_credits) ?? 0;
    const payload: PackageInsert = {
      name: input.name.trim(),
      description: cleanOptionalValue(input.description),
      sessions_quantity: sessions,
      total_price: totalPrice,
      price_per_session:
        totalPrice !== null && sessions > 0 ? totalPrice / sessions : null,
      validity_days: cleanOptionalInteger(input.validity_days),
      uses_credits: Boolean(input.uses_credits),
      contracted_credits: contractedCredits,
      available_credits: contractedCredits,
      allow_freeze: input.allow_freeze ?? true,
      allow_renewal: input.allow_renewal ?? true
    };
    const supabase = await createClient();
    const { error } = await supabase.from("service_packages").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Pacote criado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createDiscount(input: DiscountFormInput) {
  try {
    if (!input.name.trim()) {
      throw new Error("Nome do desconto e obrigatorio.");
    }

    const preview = getDiscountPreview(input);
    const payload: DiscountInsert = {
      service_id: cleanOptionalValue(input.service_id),
      name: input.name.trim(),
      sessions_quantity: cleanOptionalInteger(input.sessions_quantity) ?? 1,
      discount_type: input.discount_type ?? "percent",
      discount_value: cleanOptionalNumber(input.discount_value) ?? 0,
      ...preview
    };
    const supabase = await createClient();
    const { error } = await supabase.from("service_discounts").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog("discount_created", input.service_id);
    revalidatePath("/servicos");
    return { ok: true, message: "Desconto criado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createCommercialRule(input: RuleFormInput) {
  try {
    if (!input.name.trim()) {
      throw new Error("Nome da regra e obrigatorio.");
    }

    const payload: RuleInsert = {
      name: input.name.trim(),
      rule_type: input.rule_type,
      coupon_code: cleanOptionalValue(input.coupon_code),
      discount_type: cleanOptionalValue(input.discount_type),
      discount_value: cleanOptionalNumber(input.discount_value),
      max_discount_admin: cleanOptionalNumber(input.max_discount_admin),
      max_discount_manager: cleanOptionalNumber(input.max_discount_manager),
      max_discount_professional: cleanOptionalNumber(
        input.max_discount_professional
      ),
      start_date: cleanOptionalValue(input.start_date),
      end_date: cleanOptionalValue(input.end_date)
    };
    const supabase = await createClient();
    const { error } = await supabase.from("commercial_rules").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Regra comercial criada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createProtocol(input: ProtocolFormInput) {
  try {
    if (!input.name.trim()) {
      throw new Error("Nome do protocolo e obrigatorio.");
    }

    const payload: ProtocolInsert = {
      name: input.name.trim(),
      objective: cleanOptionalValue(input.objective),
      goal_id: cleanOptionalValue(input.goal_id),
      recommended_sessions: cleanOptionalInteger(input.recommended_sessions),
      recommended_interval_days: cleanOptionalInteger(
        input.recommended_interval_days
      )
    };
    const supabase = await createClient();
    const { error } = await supabase.from("treatment_protocols").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Protocolo criado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createResource(input: ResourceFormInput) {
  try {
    if (!input.service_id) {
      throw new Error("Selecione um servico.");
    }

    const payload: ResourceInsert = {
      service_id: input.service_id,
      room: cleanOptionalValue(input.room),
      equipment: cleanOptionalValue(input.equipment),
      stretcher_required: Boolean(input.stretcher_required),
      specific_device: cleanOptionalValue(input.specific_device),
      materials: cleanOptionalValue(input.materials),
      preparation_minutes: cleanOptionalInteger(input.preparation_minutes),
      cleanup_minutes: cleanOptionalInteger(input.cleanup_minutes)
    };
    const supabase = await createClient();
    const { error } = await supabase.from("service_resources").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    await writeAuditLog("resource_created", input.service_id);
    revalidatePath("/servicos");
    return { ok: true, message: "Recurso criado com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function createInternalNotification(input: NotificationFormInput) {
  try {
    if (!input.title.trim() || !input.message.trim()) {
      throw new Error("Titulo e mensagem sao obrigatorios.");
    }

    const payload: NotificationInsert = {
      service_id: cleanOptionalValue(input.service_id),
      employee_id: cleanOptionalValue(input.employee_id),
      title: input.title.trim(),
      message: input.message.trim(),
      notification_type: input.notification_type ?? "internal",
      whatsapp_template: cleanOptionalValue(input.whatsapp_template)
    };
    const supabase = await createClient();
    const { error } = await supabase.from("internal_notifications").insert(payload);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Notificacao interna criada com sucesso." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function deleteSupportRecord(
  table: DeletableTable,
  id: string
): Promise<ServiceActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      return { ok: false, message: getErrorMessage(error) };
    }

    revalidatePath("/servicos");
    return { ok: true, message: "Registro excluido definitivamente." };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
