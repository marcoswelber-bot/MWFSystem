import type { Route } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PermissionMap } from "@/lib/permission-modules";
import type { AssistantContext } from "@/lib/assistant/interpreter";
import { clearConversation, getConversation, saveConversation, type StoredConversation } from "./conversation-store.ts";
import { interpretOperationalMessage, rankEntityMatches, validateInterpretation, type OperationalDomain } from "./semantic-engine.ts";

type Card = { title: string; lines: string[]; tone?: "default" | "warning" | "success" };
type Action = { label: string; href?: Route; externalHref?: string; prompt?: string };
export type OperationalReply = { title: string; message: string; cards: Card[]; actions: Action[]; context: AssistantContext };
type Client = SupabaseClient<Database>;
type EntityCandidate = { id: string; name: string; detail?: string };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const route = (label: string, href: string): Action => ({ label, href: href as Route });
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00-03:00`));
const permissionKey: Partial<Record<OperationalDomain, keyof PermissionMap>> = {
  agenda: "agenda", pacientes: "pacientes", financeiro: "financeiro", pacotes: "pacotes",
  prontuarios: "prontuarios", funcionarios: "funcionarios", profissionais: "funcionarios",
  relatorios: "relatorios", servicos: "servicos", comissoes: "comissoes", notificacoes: "notificacoes"
};

function responseContext(conversationId: string, stored: StoredConversation): AssistantContext {
  return {
    conversationId,
    currentDomain: stored.currentDomain === "funcionarios" || stored.currentDomain === "notificacoes" ? "unknown" : stored.currentDomain,
    patientId: stored.patientId,
    patientName: stored.patientName,
    professionalName: stored.professionalName,
    serviceName: stored.serviceName,
    date: stored.date,
    time: stored.time,
    updatedAt: stored.updatedAt
  } as AssistantContext;
}

function reply(stored: StoredConversation, title: string, message: string, cards: Card[] = [], actions: Action[] = []): OperationalReply {
  return { title, message, cards, actions, context: responseContext(stored.conversationId, stored) };
}

function denied(stored: StoredConversation) {
  return reply(stored, "Acesso restrito", "Você não possui permissão para consultar ou executar esta operação.");
}

async function resolveCandidates(
  term: string | undefined,
  loader: () => Promise<{ data: EntityCandidate[] | null; error: { message: string } | null }>
) {
  if (!term) return { kind: "missing" as const, candidates: [] as ReturnType<typeof rankEntityMatches<EntityCandidate>> };
  const result = await loader();
  if (result.error) return { kind: "error" as const, candidates: [], error: result.error.message };
  const candidates = rankEntityMatches(term, result.data ?? []).slice(0, 5);
  if (!candidates.length) return { kind: "empty" as const, candidates };
  if (candidates.length === 1 || (candidates[0].score >= 0.9 && candidates[0].score - (candidates[1]?.score ?? 0) >= 0.08)) {
    return { kind: "resolved" as const, candidate: candidates[0], candidates };
  }
  return { kind: "ambiguous" as const, candidates };
}

async function resolvePatient(client: Client, clinicId: string, term?: string) {
  return resolveCandidates(term, async () => {
    const result = await client.from("patients").select("id,full_name,status").eq("clinic_id", clinicId).order("full_name").limit(200);
    return { data: (result.data ?? []).map((row) => ({ id: row.id, name: row.full_name, detail: row.status })), error: result.error };
  });
}

async function resolveEmployee(client: Client, clinicId: string, term?: string) {
  return resolveCandidates(term, async () => {
    const result = await client.from("employees").select("id,name,role,status").eq("clinic_id", clinicId).order("name").limit(200);
    return { data: (result.data ?? []).map((row) => ({ id: row.id, name: row.name, detail: `${row.role ?? "Sem função"} • ${row.status}` })), error: result.error };
  });
}

async function resolveService(client: Client, clinicId: string, term?: string) {
  return resolveCandidates(term, async () => {
    const result = await client.from("services").select("id,name,status,duration_minutes,default_duration_minutes").eq("clinic_id", clinicId).order("name").limit(200);
    return { data: (result.data ?? []).map((row) => ({ id: row.id, name: row.name, detail: `${row.duration_minutes ?? row.default_duration_minutes ?? 60} min • ${row.status}` })), error: result.error };
  });
}

function ambiguityReply(stored: StoredConversation, label: string, candidates: { name: string; detail?: string }[]) {
  stored.recentResults = candidates.map((candidate, index) => ({
    id: "id" in candidate ? String(candidate.id) : String(index + 1),
    domain: stored.currentDomain ?? "unknown",
    label: candidate.name,
    ordinal: index + 1
  }));
  saveConversation(stored);
  return reply(
    stored,
    `${label}: escolha uma opção`,
    "Encontrei mais de uma correspondência plausível.",
    [{ title: "Resultados", lines: candidates.map((candidate, index) => `${index + 1}. ${candidate.name}${candidate.detail ? ` • ${candidate.detail}` : ""}`) }],
    candidates.map((candidate) => ({ label: candidate.name, prompt: candidate.name }))
  );
}

export async function handleOperationalAssistant(args: {
  input: string;
  conversationId: string;
  userId: string;
  clinicId: string;
  permissions: PermissionMap;
  client: Client;
  previousContext?: AssistantContext;
}): Promise<OperationalReply> {
  const { input, conversationId, userId, clinicId, permissions, client, previousContext = {} } = args;
  const existing = getConversation(userId, clinicId, conversationId);
  const stored: StoredConversation = existing ?? {
    userId, clinicId, conversationId, updatedAt: Date.now(),
    currentDomain: (previousContext.currentDomain as OperationalDomain | null) ?? null
  };
  const recentSelection = stored.recentResults?.find((result) => {
    const ranked = rankEntityMatches(input, [{ id: result.id, name: result.label }])[0];
    return ranked?.score >= 0.9;
  });
  if (recentSelection && ["pacientes", "financeiro", "pacotes", "prontuarios", "agenda"].includes(stored.currentDomain ?? "")) {
    stored.patientId = recentSelection.id;
    stored.patientName = recentSelection.label;
  }
  const parsed = interpretOperationalMessage(input, {
    currentDomain: stored.currentDomain,
    patientName: stored.patientName,
    professionalName: stored.professionalName,
    serviceName: stored.serviceName
  });
  if (!validateInterpretation(parsed)) return reply(stored, "Não foi possível interpretar", "Informe novamente o que deseja consultar.");

  if (process.env.NODE_ENV === "development") {
    console.info("[MWF IA]", {
      normalizedText: parsed.normalizedText,
      intent: parsed.intent,
      confidence: parsed.confidence,
      entities: Object.keys(parsed.entities),
      tool: parsed.tool
    });
  }

  if (parsed.intent === "cancel") {
    clearConversation(userId, clinicId, conversationId);
    const reset = { ...stored, pendingAction: null, updatedAt: Date.now() };
    return reply(reset, "Operação cancelada", "Nenhuma alteração foi realizada.");
  }

  if (parsed.intent === "confirm") {
    if (!existing?.pendingAction) return reply(stored, "Nada para confirmar", "Não existe uma ação pendente nesta conversa.");
    const pending = existing.pendingAction;
    if (pending.type === "cancel_appointment") {
      if (!permissions.agenda.edit) return denied(stored);
      const current = await client.from("appointments").select("id,status,clinic_id").eq("id", pending.entityId ?? "").eq("clinic_id", clinicId).maybeSingle();
      if (current.error || !current.data) return reply(stored, "Agendamento não encontrado", "O registro não está mais disponível nesta clínica.");
      if (["cancelado", "concluido"].includes(current.data.status)) return reply(stored, "Ação não permitida", `O agendamento já está ${current.data.status}.`);
      const updated = await client.from("appointments").update({ status: "cancelado" }).eq("id", current.data.id).eq("clinic_id", clinicId).eq("status", current.data.status).select("id,status").maybeSingle();
      if (updated.error || !updated.data) return reply(stored, "Erro ao cancelar", "O Supabase não confirmou a alteração. Nada foi informado como concluído.");
      stored.pendingAction = null;
      saveConversation(stored);
      return reply(stored, "Agendamento cancelado", "O cancelamento foi confirmado e salvo no sistema.", [{ title: "Resultado", lines: [pending.summary], tone: "success" }], [route("Abrir Agenda", `/agenda?appointmentId=${updated.data.id}`)]);
    }
    if (pending.type === "create_appointment") {
      if (!permissions.agenda.create) return denied(stored);
      const payload = pending.payload;
      const conflict = await client.from("appointments").select("id").eq("clinic_id", clinicId).eq("employee_id", payload.employeeId).eq("appointment_date", payload.date).lt("start_time", payload.endTime).gt("end_time", payload.startTime).not("status", "in", '("cancelado","faltou")').limit(1);
      if (conflict.error) return reply(stored, "Erro ao validar agenda", "Não foi possível confirmar conflitos no Supabase.");
      if (conflict.data?.length) return reply(stored, "Horário indisponível", "Outro atendimento ocupa esse intervalo. Nenhuma alteração foi feita.");
      const created = await client.from("appointments").insert({
        clinic_id: clinicId,
        patient_id: payload.patientId,
        employee_id: payload.employeeId,
        service_id: payload.serviceId,
        appointment_date: payload.date,
        start_time: payload.startTime,
        end_time: payload.endTime,
        status: "agendado",
        appointment_origin: "mwf_ia"
      }).select("id").single();
      if (created.error || !created.data) return reply(stored, "Erro ao agendar", "O Supabase não confirmou a criação. Nenhum agendamento foi informado como concluído.");
      stored.pendingAction = null;
      saveConversation(stored);
      return reply(stored, "Agendamento criado", "O novo agendamento foi confirmado e salvo.", [{ title: "Resultado", lines: [pending.summary], tone: "success" }], [route("Abrir agendamento", `/agenda?appointmentId=${created.data.id}`)]);
    }
    if (pending.type === "prepare_charge") {
      stored.pendingAction = null;
      saveConversation(stored);
      return reply(stored, "Cobrança preparada", "O sistema não possui envio automático confirmado pela IA. Revise e envie pelo fluxo real do Financeiro.", [{ title: "Resumo", lines: [pending.summary], tone: "warning" }], [route("Abrir cobrança", `/financeiro/baixas?patientId=${pending.payload.patientId}`)]);
    }
  }

  const modulePermission = permissionKey[parsed.module];
  if (modulePermission && !permissions[modulePermission].view) return denied(stored);
  stored.currentDomain = parsed.module;
  stored.date = parsed.date ?? stored.date;
  stored.time = parsed.time ?? stored.time;

  if (parsed.module === "pacientes" && ["list", "search", "patient_history"].includes(parsed.intent)) {
    let query = client.from("patients").select("id,full_name,phone,email,status", { count: "exact" }).eq("clinic_id", clinicId).order("full_name").limit(20);
    if (parsed.filters.status) query = query.eq("status", parsed.filters.status);
    if (parsed.filters.initial) query = query.ilike("full_name", `${parsed.filters.initial}%`);
    const result = await query;
    if (result.error) return reply(stored, "Erro ao consultar pacientes", result.error.message);
    const term = parsed.entities.patient;
    const ranked = term ? rankEntityMatches(term, (result.data ?? []).map((row) => ({ id: row.id, name: row.full_name, row }))) : [];
    const rows = term ? ranked.map((item) => item.row) : result.data ?? [];
    if (term && ranked.length > 1 && ranked[0].score - ranked[1].score < 0.08) return ambiguityReply(stored, "Paciente", ranked);
    const selected = rows.length === 1 ? rows[0] : null;
    if (selected) {
      stored.patientId = selected.id; stored.patientName = selected.full_name;
    }
    if (parsed.intent === "patient_history" && selected) {
      const [appointments, packages, debts, records] = await Promise.all([
        permissions.agenda.view
          ? client.from("appointments").select("id,appointment_date,start_time,status").eq("clinic_id", clinicId).eq("patient_id", selected.id).order("appointment_date", { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null }),
        permissions.pacotes.view
          ? client.from("patient_packages").select("remaining_sessions,expiration_date,status").eq("clinic_id", clinicId).eq("patient_id", selected.id).order("created_at", { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null }),
        permissions.financeiro.view
          ? client.from("financial_transactions").select("open_amount").eq("clinic_id", clinicId).eq("patient_id", selected.id).gt("open_amount", 0)
          : Promise.resolve({ data: [], error: null }),
        permissions.prontuarios.view
          ? client.from("medical_records").select("id,status,created_at").eq("clinic_id", clinicId).eq("patient_id", selected.id).order("created_at", { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (appointments.error || packages.error || debts.error || records.error) return reply(stored, "Erro ao consultar histórico", "Não foi possível relacionar todos os dados autorizados do paciente.");
      const totalOpen = (debts.data ?? []).reduce((sum, item) => sum + Number(item.open_amount ?? 0), 0);
      const activePackage = (packages.data ?? []).find((item) => item.status === "active" || item.status === "ativo");
      saveConversation(stored);
      return reply(stored, `Resumo de ${selected.full_name}`, "Dados reais relacionados conforme suas permissões.", [
        ...(permissions.agenda.view ? [{ title: "Agenda", lines: appointments.data?.length ? appointments.data.map((item) => `${dateLabel(item.appointment_date)} às ${item.start_time.slice(0, 5)} • ${item.status}`) : ["Nenhum atendimento encontrado."] }] : []),
        ...(permissions.pacotes.view ? [{ title: "Pacote", lines: activePackage ? [`${activePackage.remaining_sessions} sessões restantes`, `Validade: ${activePackage.expiration_date ? dateLabel(activePackage.expiration_date) : "não informada"}`, `Status: ${activePackage.status}`] : ["Nenhum pacote ativo encontrado."] }] : []),
        ...(permissions.financeiro.view ? [{ title: "Financeiro", lines: [totalOpen > 0 ? `Em aberto: ${money(totalOpen)}` : "Sem débito em aberto"], tone: totalOpen > 0 ? "warning" as const : "success" as const }] : []),
        ...(permissions.prontuarios.view ? [{ title: "Prontuários", lines: [`${records.data?.length ?? 0} registro(s) recente(s) autorizado(s).`] }] : [])
      ], [
        route("Abrir paciente", `/pacientes?patientId=${selected.id}`),
        ...(permissions.agenda.view ? [route("Ver Agenda", `/agenda?patientId=${selected.id}`)] : []),
        ...(permissions.pacotes.view ? [route("Ver Pacotes", `/pacotes?patientId=${selected.id}`)] : [])
      ]);
    }
    stored.recentResults = rows.slice(0, 10).map((row, index) => ({ id: row.id, domain: "pacientes", label: row.full_name, ordinal: index + 1 }));
    saveConversation(stored);
    return reply(stored, "Pacientes", rows.length ? `Encontrei ${rows.length} paciente(s) na clínica ativa.` : "Nenhum paciente encontrado.", rows.length ? [{ title: "Resultados", lines: rows.slice(0, 10).map((row, index) => `${index + 1}. ${row.full_name} • ${row.status}`) }] : [], rows.slice(0, 5).map((row) => route(`Abrir ${row.full_name}`, `/pacientes?patientId=${row.id}`)));
  }

  if (parsed.module === "funcionarios" || parsed.module === "profissionais") {
    const resolved = parsed.entities.employee || parsed.entities.professional;
    const result = await client.from("employees").select("id,name,role,status").eq("clinic_id", clinicId).order("name").limit(100);
    if (result.error) return reply(stored, "Erro ao consultar equipe", result.error.message);
    const ranked = resolved ? rankEntityMatches(resolved, (result.data ?? []).map((row) => ({ id: row.id, name: row.name, row }))) : [];
    const rows = resolved ? ranked.map((item) => item.row) : result.data ?? [];
    if (resolved && ranked.length > 1 && ranked[0].score - ranked[1].score < 0.08) return ambiguityReply(stored, "Profissional", ranked);
    saveConversation(stored);
    return reply(stored, "Equipe", rows.length ? `Encontrei ${rows.length} resultado(s).` : "Nenhum profissional encontrado.", rows.length ? [{ title: "Profissionais", lines: rows.slice(0, 10).map((row) => `${row.name} • ${row.role ?? "Função não informada"} • ${row.status}`) }] : [], rows.slice(0, 5).map((row) => route(`Abrir ${row.name}`, `/funcionarios?employeeId=${row.id}`)));
  }

  if (parsed.module === "servicos") {
    const result = await client.from("services").select("id,name,price,duration_minutes,default_duration_minutes,status").eq("clinic_id", clinicId).order("name").limit(100);
    if (result.error) return reply(stored, "Erro ao consultar serviços", result.error.message);
    const ranked = parsed.entities.service ? rankEntityMatches(parsed.entities.service, (result.data ?? []).map((row) => ({ id: row.id, name: row.name, row }))) : [];
    const rows = parsed.entities.service ? ranked.map((item) => item.row) : result.data ?? [];
    saveConversation(stored);
    return reply(stored, "Serviços", rows.length ? `Encontrei ${rows.length} serviço(s).` : "Nenhum serviço encontrado.", rows.length ? [{ title: "Resultados", lines: rows.slice(0, 10).map((row) => `${row.name} • ${row.duration_minutes ?? row.default_duration_minutes ?? 60} min • ${money(Number(row.price ?? 0))}`) }] : [], [route("Abrir Serviços", "/servicos")]);
  }

  if (parsed.intent === "debtors" || parsed.intent === "prepare_charge") {
    if (!permissions.financeiro.view || !permissions.pacientes.view) return denied(stored);
    const patientResolution = parsed.entities.patient ? await resolvePatient(client, clinicId, parsed.entities.patient) : null;
    if (patientResolution?.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patientResolution.candidates);
    if (patientResolution?.kind === "empty") return reply(stored, "Paciente não encontrado", "Nenhum paciente desta clínica corresponde ao nome informado.");
    const patientId = patientResolution?.kind === "resolved" ? patientResolution.candidate.id : stored.patientId;
    let debts = client.from("financial_transactions").select("id,patient_id,open_amount,due_date,status").eq("clinic_id", clinicId).eq("transaction_type", "receita").gt("open_amount", 0).in("status", ["pendente", "parcial", "vencido"]).order("due_date").limit(500);
    if (patientId) debts = debts.eq("patient_id", patientId);
    const debtResult = await debts;
    if (debtResult.error) return reply(stored, "Erro ao consultar débitos", debtResult.error.message);
    const ids = [...new Set((debtResult.data ?? []).map((row) => row.patient_id).filter((id): id is string => Boolean(id)))];
    const patients = ids.length ? await client.from("patients").select("id,full_name,phone").eq("clinic_id", clinicId).in("id", ids) : { data: [], error: null };
    if (patients.error) return reply(stored, "Erro ao relacionar pacientes", patients.error.message);
    const patientMap = new Map((patients.data ?? []).map((row) => [row.id, row]));
    const totals = new Map<string, number>();
    for (const debt of debtResult.data ?? []) if (debt.patient_id && patientMap.has(debt.patient_id)) totals.set(debt.patient_id, (totals.get(debt.patient_id) ?? 0) + Number(debt.open_amount));
    const rows = [...totals].map(([id, total]) => ({ patient: patientMap.get(id)!, total }));
    if (parsed.intent === "prepare_charge") {
      if (!patientId || rows.length !== 1) return reply(stored, "Selecione um paciente", "Informe o nome do paciente para preparar uma cobrança individual.", rows.length ? [{ title: "Devedores", lines: rows.slice(0, 10).map((row) => `${row.patient.full_name} • ${money(row.total)}`) }] : []);
      const selected = rows[0];
      stored.patientId = selected.patient.id; stored.patientName = selected.patient.full_name;
      stored.pendingAction = { type: "prepare_charge", payload: { patientId, total: String(selected.total) }, summary: `${selected.patient.full_name} • ${money(selected.total)} • telefone ${selected.patient.phone ? "cadastrado" : "não cadastrado"}` };
      saveConversation(stored);
      return reply(stored, "Confirmar preparação da cobrança", "Revise o resumo e confirme. A confirmação abrirá o fluxo real; não declarará envio automático.", [{ title: "Cobrança", lines: [stored.pendingAction.summary], tone: "warning" }], [{ label: "Confirmar", prompt: "Sim" }, { label: "Cancelar", prompt: "Cancelar" }]);
    }
    stored.recentResults = rows.slice(0, 10).map((row, index) => ({ id: row.patient.id, domain: "financeiro", label: row.patient.full_name, ordinal: index + 1 }));
    saveConversation(stored);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return reply(stored, "Débitos reais", rows.length ? `${rows.length} paciente(s), total em aberto de ${money(total)}.` : "Nenhum débito em aberto encontrado.", rows.length ? [{ title: "Pacientes devedores", lines: rows.slice(0, 10).map((row) => `${row.patient.full_name} • ${money(row.total)}`), tone: "warning" }] : [], [route("Abrir Financeiro", "/financeiro/baixas")]);
  }

  if (parsed.intent === "revenue" || parsed.intent === "expenses") {
    const type = parsed.intent === "revenue" ? "receita" : "despesa";
    let query = client.from("financial_transactions").select("amount,paid_amount,open_amount,status,due_date").eq("clinic_id", clinicId).eq("transaction_type", type).limit(1000);
    if (parsed.date) query = query.gte("due_date", parsed.date);
    if (parsed.dateEnd) query = query.lte("due_date", parsed.dateEnd);
    const result = await query;
    if (result.error) return reply(stored, "Erro ao consultar financeiro", result.error.message);
    const total = (result.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const paid = (result.data ?? []).reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
    const open = (result.data ?? []).reduce((sum, row) => sum + Number(row.open_amount ?? 0), 0);
    saveConversation(stored);
    return reply(stored, type === "receita" ? "Receitas" : "Despesas", `${result.data?.length ?? 0} lançamento(s) real(is) encontrados.`, [{ title: "Totais", lines: [`Total: ${money(total)}`, `Pago: ${money(paid)}`, `Em aberto: ${money(open)}`] }], [route("Abrir Financeiro", "/financeiro")]);
  }

  if (parsed.intent === "patient_packages" || parsed.module === "pacotes") {
    const term = parsed.entities.patient ?? stored.patientName ?? undefined;
    const patient = await resolvePatient(client, clinicId, term);
    if (patient.kind === "missing") return reply(stored, "Qual paciente?", "Informe o nome ou parte do nome para consultar o pacote.");
    if (patient.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patient.candidates);
    if (patient.kind === "empty" || patient.kind === "error") return reply(stored, "Paciente não encontrado", "Nenhum paciente desta clínica corresponde ao nome informado.");
    const packages = await client.from("patient_packages").select("id,service_id,contracted_sessions,completed_sessions,remaining_sessions,expiration_date,status").eq("clinic_id", clinicId).eq("patient_id", patient.candidate.id).order("created_at", { ascending: false }).limit(20);
    if (packages.error) return reply(stored, "Erro ao consultar pacotes", packages.error.message);
    const serviceIds = [...new Set((packages.data ?? []).map((item) => item.service_id))];
    const services = serviceIds.length ? await client.from("services").select("id,name").eq("clinic_id", clinicId).in("id", serviceIds) : { data: [], error: null };
    const names = new Map((services.data ?? []).map((item) => [item.id, item.name]));
    stored.patientId = patient.candidate.id; stored.patientName = patient.candidate.name;
    saveConversation(stored);
    return reply(stored, `Pacotes de ${patient.candidate.name}`, packages.data?.length ? `${packages.data.length} pacote(s) encontrado(s).` : "Nenhum pacote encontrado.", packages.data?.length ? [{ title: "Pacotes", lines: packages.data.map((item) => `${names.get(item.service_id) ?? "Serviço"} • ${item.completed_sessions}/${item.contracted_sessions} realizadas • ${item.remaining_sessions} restantes • validade ${item.expiration_date ? dateLabel(item.expiration_date) : "não informada"} • ${item.status}`) }] : [], [route("Abrir Pacotes", `/pacotes?patientId=${patient.candidate.id}`)]);
  }

  if (parsed.module === "prontuarios") {
    const term = parsed.entities.patient ?? stored.patientName ?? undefined;
    const patient = term ? await resolvePatient(client, clinicId, term) : null;
    if (patient?.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patient.candidates);
    let query = client.from("medical_records").select("id,patient_id,title,status,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(20);
    if (patient?.kind === "resolved") query = query.eq("patient_id", patient.candidate.id);
    const result = await query;
    if (result.error) return reply(stored, "Erro ao consultar prontuários", result.error.message);
    saveConversation(stored);
    return reply(stored, "Prontuários", `${result.data?.length ?? 0} registro(s) autorizado(s) encontrado(s).`, result.data?.length ? [{ title: "Registros", lines: result.data.map((row) => `${row.title} • ${row.status} • ${dateLabel(row.created_at.slice(0, 10))}`) }] : [], [route("Abrir Prontuários", patient?.kind === "resolved" ? `/prontuarios?patientId=${patient.candidate.id}` : "/prontuarios")]);
  }

  if (parsed.intent === "availability") {
    if (!permissions.agenda.view) return denied(stored);
    const date = parsed.date ?? stored.date;
    if (!date) return reply(stored, "Qual data?", "Informe o dia para consultar horários livres reais.");
    const professional = parsed.entities.professional ?? stored.professionalName ?? undefined;
    const employee = professional ? await resolveEmployee(client, clinicId, professional) : null;
    if (employee?.kind === "ambiguous") return ambiguityReply(stored, "Profissional", employee.candidates);
    if (employee?.kind === "empty") return reply(stored, "Profissional não encontrado", "Nenhum profissional desta clínica corresponde ao nome informado.");
    const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
    const [hours, appointments, blocks, employees] = await Promise.all([
      client.from("clinic_opening_hours").select("is_open,opens_at,closes_at,break_starts_at,break_ends_at").eq("clinic_id", clinicId).eq("weekday", weekday).maybeSingle(),
      client.from("appointments").select("employee_id,start_time,end_time,status").eq("clinic_id", clinicId).eq("appointment_date", date).not("status", "in", '("cancelado","faltou")'),
      client.from("schedule_blocks").select("employee_id,block_type,start_time,end_time,status").eq("clinic_id", clinicId).eq("block_date", date).eq("status", "active"),
      client.from("employees").select("id,name").eq("clinic_id", clinicId).eq("status", "active").order("name")
    ]);
    if (hours.error || appointments.error || blocks.error || employees.error) return reply(stored, "Erro ao consultar disponibilidade", "Não foi possível relacionar horários, bloqueios e atendimentos no Supabase.");
    if (!hours.data?.is_open || !hours.data.opens_at || !hours.data.closes_at) return reply(stored, "Clínica fechada", `Não há expediente configurado em ${dateLabel(date)}.`);
    const selectedEmployees = employee?.kind === "resolved"
      ? (employees.data ?? []).filter((row) => row.id === employee.candidate.id)
      : employees.data ?? [];
    const toMinutes = (value: string | null) => {
      const [hour, minute] = (value ?? "00:00").slice(0, 5).split(":").map(Number);
      return hour * 60 + minute;
    };
    const opens = toMinutes(hours.data.opens_at);
    const closes = toMinutes(hours.data.closes_at);
    const duration = 60;
    const lines: string[] = [];
    for (const current of selectedEmployees) {
      const free: string[] = [];
      for (let start = opens; start + duration <= closes; start += 30) {
        const end = start + duration;
        const inBreak = hours.data.break_starts_at && hours.data.break_ends_at && start < toMinutes(hours.data.break_ends_at) && end > toMinutes(hours.data.break_starts_at);
        const occupied = (appointments.data ?? []).some((item) => item.employee_id === current.id && start < toMinutes(item.end_time ?? item.start_time) && end > toMinutes(item.start_time));
        const blocked = (blocks.data ?? []).some((item) => (!item.employee_id || item.employee_id === current.id) && (item.block_type === "dia_inteiro" || (start < toMinutes(item.end_time ?? item.start_time) && end > toMinutes(item.start_time))));
        if (!inBreak && !occupied && !blocked) free.push(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
      }
      if (free.length) lines.push(`${current.name}: ${free.slice(0, 8).join(", ")}`);
    }
    saveConversation(stored);
    return reply(stored, "Horários livres", lines.length ? `Disponibilidade real para ${dateLabel(date)}, considerando expediente, bloqueios e agendamentos.` : "Nenhum horário livre encontrado.", lines.length ? [{ title: "Opções de 60 minutos", lines }] : [], [route("Abrir Agenda", `/agenda?date=${date}`)]);
  }

  if (parsed.intent === "prepare_cancellation") {
    if (!permissions.agenda.edit) return denied(stored);
    const term = parsed.entities.patient ?? stored.patientName ?? undefined;
    const patient = term ? await resolvePatient(client, clinicId, term) : null;
    if (patient?.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patient.candidates);
    let query = client.from("appointments").select("id,patient_id,appointment_date,start_time,status").eq("clinic_id", clinicId).not("status", "in", '("cancelado","concluido")').order("appointment_date").order("start_time").limit(10);
    if (parsed.date) query = query.eq("appointment_date", parsed.date);
    if (patient?.kind === "resolved") query = query.eq("patient_id", patient.candidate.id);
    const result = await query;
    if (result.error) return reply(stored, "Erro ao consultar agenda", result.error.message);
    if (!result.data?.length) return reply(stored, "Agendamento não encontrado", "Nenhum agendamento compatível foi encontrado.");
    if (result.data.length > 1) return reply(stored, "Escolha o agendamento", "Há mais de um resultado; abra a Agenda ou refine paciente e data.", [{ title: "Agendamentos", lines: result.data.map((row, index) => `${index + 1}. ${dateLabel(row.appointment_date)} às ${row.start_time.slice(0, 5)} • ${row.status}`) }], [route("Abrir Agenda", "/agenda")]);
    const selected = result.data[0];
    stored.pendingAction = { type: "cancel_appointment", entityId: selected.id, payload: {}, summary: `${dateLabel(selected.appointment_date)} às ${selected.start_time.slice(0, 5)} • ${selected.status}` };
    saveConversation(stored);
    return reply(stored, "Confirmar cancelamento", "Esta alteração exige confirmação explícita.", [{ title: "Agendamento", lines: [stored.pendingAction.summary], tone: "warning" }], [{ label: "Confirmar cancelamento", prompt: "Sim" }, { label: "Manter agendamento", prompt: "Cancelar" }]);
  }

  if (parsed.intent === "prepare_appointment") {
    if (!permissions.agenda.create) return denied(stored);
    const patient = await resolvePatient(client, clinicId, parsed.entities.patient ?? stored.patientName ?? undefined);
    const employee = await resolveEmployee(client, clinicId, parsed.entities.professional ?? stored.professionalName ?? undefined);
    const service = await resolveService(client, clinicId, parsed.entities.service ?? stored.serviceName ?? undefined);
    if (patient.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patient.candidates);
    if (employee.kind === "ambiguous") return ambiguityReply(stored, "Profissional", employee.candidates);
    if (service.kind === "ambiguous") return ambiguityReply(stored, "Serviço", service.candidates);
    const missing = [patient.kind !== "resolved" && "paciente", employee.kind !== "resolved" && "profissional", service.kind !== "resolved" && "serviço", !parsed.date && "data", !parsed.time && "horário"].filter(Boolean);
    if (missing.length) return reply(stored, "Dados necessários", `Informe ${missing.join(", ")} para preparar o agendamento.`);
    const serviceRow = await client.from("services").select("duration_minutes,default_duration_minutes").eq("id", service.candidate!.id).eq("clinic_id", clinicId).single();
    if (serviceRow.error) return reply(stored, "Erro ao consultar serviço", serviceRow.error.message);
    const duration = serviceRow.data.duration_minutes ?? serviceRow.data.default_duration_minutes ?? 60;
    const [hours, minutes] = parsed.time!.split(":").map(Number);
    const end = hours * 60 + minutes + duration;
    const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    stored.pendingAction = {
      type: "create_appointment",
      payload: { patientId: patient.candidate!.id, employeeId: employee.candidate!.id, serviceId: service.candidate!.id, date: parsed.date!, startTime: parsed.time!, endTime },
      summary: `${patient.candidate!.name} • ${service.candidate!.name} • ${employee.candidate!.name} • ${dateLabel(parsed.date!)} das ${parsed.time} às ${endTime}`
    };
    stored.patientId = patient.candidate!.id; stored.patientName = patient.candidate!.name;
    stored.professionalId = employee.candidate!.id; stored.professionalName = employee.candidate!.name;
    stored.serviceId = service.candidate!.id; stored.serviceName = service.candidate!.name;
    saveConversation(stored);
    return reply(stored, "Confirmar novo agendamento", "Revise os dados. O registro só será criado após confirmação.", [{ title: "Resumo", lines: [stored.pendingAction.summary], tone: "warning" }], [{ label: "Confirmar agendamento", prompt: "Sim" }, { label: "Cancelar", prompt: "Cancelar" }]);
  }

  if (parsed.module === "agenda") {
    const start = parsed.date ?? new Date().toISOString().slice(0, 10);
    const end = parsed.dateEnd ?? start;
    const patient = parsed.entities.patient ? await resolvePatient(client, clinicId, parsed.entities.patient) : null;
    const professional = parsed.entities.professional ? await resolveEmployee(client, clinicId, parsed.entities.professional) : null;
    if (patient?.kind === "ambiguous") return ambiguityReply(stored, "Paciente", patient.candidates);
    if (professional?.kind === "ambiguous") return ambiguityReply(stored, "Profissional", professional.candidates);
    let appointments = client.from("appointments").select("id,patient_id,employee_id,service_id,appointment_date,start_time,end_time,status").eq("clinic_id", clinicId).gte("appointment_date", start).lte("appointment_date", end).order("appointment_date").order("start_time").limit(100);
    if (patient?.kind === "resolved") appointments = appointments.eq("patient_id", patient.candidate.id);
    if (professional?.kind === "resolved") appointments = appointments.eq("employee_id", professional.candidate.id);
    const result = await appointments;
    if (result.error) return reply(stored, "Erro ao consultar agenda", result.error.message);
    const patientIds = [...new Set((result.data ?? []).map((row) => row.patient_id))];
    const employeeIds = [...new Set((result.data ?? []).map((row) => row.employee_id))];
    const serviceIds = [...new Set((result.data ?? []).map((row) => row.service_id))];
    const [patients, employees, services] = await Promise.all([
      patientIds.length ? client.from("patients").select("id,full_name").eq("clinic_id", clinicId).in("id", patientIds) : Promise.resolve({ data: [] }),
      employeeIds.length ? client.from("employees").select("id,name").eq("clinic_id", clinicId).in("id", employeeIds) : Promise.resolve({ data: [] }),
      serviceIds.length ? client.from("services").select("id,name").eq("clinic_id", clinicId).in("id", serviceIds) : Promise.resolve({ data: [] })
    ]);
    const patientNames = new Map((patients.data ?? []).map((row) => [row.id, row.full_name]));
    const employeeNames = new Map((employees.data ?? []).map((row) => [row.id, row.name]));
    const serviceNames = new Map((services.data ?? []).map((row) => [row.id, row.name]));
    saveConversation(stored);
    return reply(stored, "Agenda", result.data?.length ? `${result.data.length} atendimento(s) entre ${dateLabel(start)} e ${dateLabel(end)}.` : "Nenhum atendimento encontrado no período.", result.data?.length ? [{ title: "Atendimentos", lines: result.data.slice(0, 15).map((row) => `${dateLabel(row.appointment_date)} ${row.start_time.slice(0, 5)} • ${patientNames.get(row.patient_id) ?? "Paciente"} • ${employeeNames.get(row.employee_id) ?? "Profissional"} • ${serviceNames.get(row.service_id) ?? "Serviço"} • ${row.status}`) }] : [], [route("Abrir Agenda", `/agenda?date=${start}`)]);
  }

  if (parsed.module === "notificacoes") {
    const result = await client.from("internal_notifications").select("id,title,message,status,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(20);
    if (result.error) return reply(stored, "Erro ao consultar notificações", result.error.message);
    saveConversation(stored);
    return reply(stored, "Notificações", `${result.data?.length ?? 0} notificação(ões) encontrada(s).`, result.data?.length ? [{ title: "Recentes", lines: result.data.map((row) => `${row.title} • ${row.status}`) }] : []);
  }

  if (parsed.module === "comissoes") {
    if (!permissions.comissoes.view) return denied(stored);
    const professional = parsed.entities.professional ?? parsed.entities.employee ?? stored.professionalName ?? undefined;
    const employee = professional ? await resolveEmployee(client, clinicId, professional) : null;
    if (employee?.kind === "ambiguous") return ambiguityReply(stored, "Profissional", employee.candidates);
    const employeeResult = await client.from("employees").select("id,name").eq("clinic_id", clinicId).eq("status", "active");
    if (employeeResult.error) return reply(stored, "Erro ao consultar profissionais", employeeResult.error.message);
    const employeeIds = employee?.kind === "resolved" ? [employee.candidate.id] : (employeeResult.data ?? []).map((item) => item.id);
    const commissions = employeeIds.length
      ? await client.from("professional_service_commissions").select("id,professional_id,service_id,commission_type,commission_value,estimated_amount,active").in("professional_id", employeeIds).eq("active", true).limit(100)
      : { data: [], error: null };
    if (commissions.error) return reply(stored, "Erro ao consultar comissões", commissions.error.message);
    const names = new Map((employeeResult.data ?? []).map((item) => [item.id, item.name]));
    saveConversation(stored);
    return reply(stored, "Comissões", `${commissions.data?.length ?? 0} regra(s) ativa(s) encontrada(s) para profissionais desta clínica.`, commissions.data?.length ? [{ title: "Regras", lines: commissions.data.slice(0, 20).map((item) => `${names.get(item.professional_id) ?? "Profissional"} • ${item.commission_type} ${item.commission_value} • estimativa ${money(Number(item.estimated_amount ?? 0))}`) }] : [], [route("Abrir Comissões", "/funcionarios")]);
  }

  if (parsed.module === "relatorios") {
    if (!permissions.relatorios.view) return denied(stored);
    const start = parsed.date ?? new Date().toISOString().slice(0, 10);
    const end = parsed.dateEnd ?? start;
    const [appointments, financial, packages] = await Promise.all([
      permissions.agenda.view
        ? client.from("appointments").select("id,status", { count: "exact" }).eq("clinic_id", clinicId).gte("appointment_date", start).lte("appointment_date", end).limit(1000)
        : Promise.resolve({ data: [], count: 0, error: null }),
      permissions.financeiro.view
        ? client.from("financial_transactions").select("transaction_type,amount,paid_amount,open_amount").eq("clinic_id", clinicId).gte("due_date", start).lte("due_date", end).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      permissions.pacotes.view
        ? client.from("patient_packages").select("remaining_sessions,status", { count: "exact" }).eq("clinic_id", clinicId).limit(1000)
        : Promise.resolve({ data: [], count: 0, error: null })
    ]);
    if (appointments.error || financial.error || packages.error) return reply(stored, "Erro ao gerar resumo", "Não foi possível relacionar os indicadores autorizados.");
    const revenues = (financial.data ?? []).filter((item) => item.transaction_type === "receita").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const expenses = (financial.data ?? []).filter((item) => item.transaction_type === "despesa").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    saveConversation(stored);
    return reply(stored, "Resumo operacional", `Indicadores reais de ${dateLabel(start)} a ${dateLabel(end)}.`, [
      ...(permissions.agenda.view ? [{ title: "Agenda", lines: [`${appointments.count ?? appointments.data?.length ?? 0} atendimento(s)`] }] : []),
      ...(permissions.financeiro.view ? [{ title: "Financeiro", lines: [`Receitas: ${money(revenues)}`, `Despesas: ${money(expenses)}`, `Resultado previsto: ${money(revenues - expenses)}`] }] : []),
      ...(permissions.pacotes.view ? [{ title: "Pacotes", lines: [`${packages.count ?? packages.data?.length ?? 0} pacote(s)`, `${(packages.data ?? []).reduce((sum, item) => sum + Number(item.remaining_sessions ?? 0), 0)} sessões restantes`] }] : [])
    ], [route("Abrir Relatórios", "/relatorios")]);
  }

  saveConversation(stored);
  return reply(stored, "Preciso de um detalhe", "Informe o módulo, pessoa, período ou ação que deseja consultar. Posso pesquisar dados reais da clínica ativa.");
}
