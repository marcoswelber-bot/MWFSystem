"use server";

import type { Route } from "next";
import { getCurrentClinicScope } from "@/lib/access-control";
import { interpretAssistantQuery, normalizeAssistantText, similarity, type AssistantContext } from "@/lib/assistant/interpreter";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AssistantCard = { title: string; lines: string[]; tone?: "default" | "warning" | "success" };
export type AssistantAction = { label: string; href?: Route; externalHref?: string; prompt?: string };
export type AssistantReply = { title: string; message: string; cards: AssistantCard[]; actions: AssistantAction[]; context: AssistantContext };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR").format(new Date(value + "T12:00:00"));
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const minutes = (value?: string | null) => { const [hour, minute] = (value ?? "00:00").slice(0, 5).split(":").map(Number); return hour * 60 + minute; };
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const overlap = (start: number, end: number, otherStart: string | null, otherEnd: string | null) => start < minutes(otherEnd ?? otherStart) && end > minutes(otherStart);
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }

function action(label: string, href: string): AssistantAction { return { label, href: href as Route }; }
function catalogMatch<T extends { name: string }>(text: string, rows: T[]) {
  const normalized = normalizeAssistantText(text);
  return rows.map((row) => ({ row, score: normalized.includes(normalizeAssistantText(row.name)) ? 2 : Math.max(...normalizeAssistantText(row.name).split(" ").map((part) => Math.max(...normalized.split(" ").map((token) => similarity(token, part))))) })).sort((a, b) => b.score - a.score)[0];
}

function patientMatches<T extends { id: string; full_name: string; cpf?: string | null; phone?: string | null; email?: string | null }>(term: string, patients: T[]) {
  const normalized = normalizeAssistantText(term);
  const searchedDigits = term.replace(/\D/g, "");
  return patients.map((patient) => {
    const name = normalizeAssistantText(patient.full_name);
    const first = name.split(" ")[0];
    const exactDocument = searchedDigits.length >= 4 && [patient.cpf, patient.phone].some((value) => (value ?? "").replace(/\D/g, "").includes(searchedDigits));
    const exactEmail = Boolean(patient.email) && patient.email?.trim().toLowerCase() === term.trim().toLowerCase();
    const score = exactDocument || exactEmail ? 3 : name === normalized ? 3 : name.includes(normalized) ? 2 + normalized.length / name.length : Math.max(similarity(normalized, name), similarity(normalized, first));
    return { patient, score };
  }).filter((item) => item.score >= 0.62).sort((a, b) => b.score - a.score).slice(0, 5);
}

function unavailable(message: string, context: AssistantContext): AssistantReply {
  return { title: "Não foi possível consultar agora", message, cards: [], actions: [], context };
}

export async function askMwfAssistant(input: string, previousContext: AssistantContext = {}): Promise<AssistantReply> {
  const permissions = await getCurrentPermissionMap();
  const scope = await getCurrentClinicScope();
  const supabase = await createClient();
  const context = previousContext.updatedAt && Date.now() - previousContext.updatedAt < 30 * 60_000 ? previousContext : {};
  const parsed = interpretAssistantQuery(input, context);
  if (!input.trim()) return { title: "Como posso ajudar?", message: "Digite uma pergunta ou escolha um comando rápido.", cards: [], actions: [], context: parsed };

  const navigationCommands = [
    { names: ["agenda"], label: "Agenda", href: "/agenda", allowed: permissions.agenda.view },
    { names: ["financeiro", "pagamentos"], label: "Financeiro", href: "/financeiro", allowed: permissions.financeiro.view },
    { names: ["pacientes"], label: "Pacientes", href: "/pacientes", allowed: permissions.pacientes.view },
    { names: ["pacotes"], label: "Pacotes", href: "/pacotes", allowed: permissions.pacotes.view },
    { names: ["prontuarios", "prontuario"], label: "Prontuários", href: "/prontuarios", allowed: permissions.prontuarios.view },
    { names: ["profissionais", "funcionarios"], label: "Profissionais", href: "/funcionarios", allowed: permissions.funcionarios.view },
    { names: ["servicos"], label: "Serviços", href: "/servicos", allowed: permissions.servicos.view },
    { names: ["relatorios"], label: "Relatórios", href: "/relatorios", allowed: permissions.relatorios.view },
    { names: ["clinicas"], label: "Clínicas", href: "/clinicas", allowed: permissions.clinicas.view }
  ];
  const navigationMatch = navigationCommands.find((item) =>
    item.names.some((name) => new RegExp(`^(?:abrir|abra|ir para|ver|mostrar) (?:o |a |os |as )?${name}$`).test(parsed.normalizedText))
  );
  if (navigationMatch) {
    if (!navigationMatch.allowed) {
      return { title: "Permissão necessária", message: "Você não possui permissão para consultar esta informação.", cards: [], actions: [], context: parsed };
    }
    return {
      title: navigationMatch.label,
      message: `Posso abrir o módulo ${navigationMatch.label} para você.`,
      cards: [],
      actions: [action(`Abrir ${navigationMatch.label}`, navigationMatch.href)],
      context: parsed
    };
  }

  let patientsQuery = supabase.from("patients").select("id,full_name,cpf,phone,email,clinic_id,status").eq("status", "active").order("full_name").limit(300);
  let employeesQuery = supabase.from("employees").select("id,name,clinic_id,status").eq("status", "active").order("name").limit(200);
  let servicesQuery = supabase.from("services").select("id,name,clinic_id,status,duration_minutes,default_duration_minutes").eq("status", "active").order("name").limit(200);
  if (scope.clinicId) {
    patientsQuery = patientsQuery.eq("clinic_id", scope.clinicId);
    employeesQuery = employeesQuery.eq("clinic_id", scope.clinicId);
    servicesQuery = servicesQuery.eq("clinic_id", scope.clinicId);
  }
  const [patientsResult, employeesResult, servicesResult] = await Promise.all([patientsQuery, employeesQuery, servicesQuery]);
  if (patientsResult.error || employeesResult.error || servicesResult.error) return unavailable("Tente novamente ou abra o módulo correspondente.", parsed);
  let patients = patientsResult.data ?? [];
  const employees = employeesResult.data ?? [];
  const services = servicesResult.data ?? [];
  const directPatientTerm = parsed.patientName ?? (parsed.intent === "search" ? input.trim() : null);
  if (directPatientTerm && directPatientTerm.length >= 2) {
    const term = directPatientTerm.replaceAll("%", "\\%").replaceAll(",", " ");
    let directQuery = supabase
      .from("patients")
      .select("id,full_name,cpf,phone,email,clinic_id,status")
      .eq("status", "active")
      .or("full_name.ilike.%" + term + "%,cpf.ilike.%" + term + "%,phone.ilike.%" + term + "%,email.ilike.%" + term + "%")
      .order("full_name")
      .limit(12);
    if (scope.clinicId) directQuery = directQuery.eq("clinic_id", scope.clinicId);
    const directResult = await directQuery;
    if (!directResult.error) {
      patients = [...new Map([...(directResult.data ?? []), ...patients].map((patient) => [patient.id, patient])).values()];
    }
  }
  const employeeMatch = catalogMatch(parsed.normalizedText, employees);
  const serviceMatch = catalogMatch(parsed.normalizedText, services);
  if (employeeMatch?.score >= 0.78) parsed.professionalName = employeeMatch.row.name;
  if (serviceMatch?.score >= 0.78) parsed.serviceName = serviceMatch.row.name;

  if (parsed.intent === "check_debtors" && /^(devedor|debdor|devdor|debto|decedo|decendo|pendecia|atrazados|divda)$/.test(parsed.normalizedText)) {
    return {
      title: "Você quis dizer?",
      message: "Posso consultar os dados reais do Financeiro.",
      cards: [],
      actions: [
        { label: "Pacientes com débitos", prompt: "débitos" },
        { label: "Pagamentos vencidos", prompt: "pagamentos vencidos" },
        { label: "Valores em aberto", prompt: "valores em aberto" }
      ],
      context: { ...parsed, patientName: null }
    };
  }

  const concepts = [
    { terms: ["pagamento", "pagamentos"], label: "Pagamentos", prompt: "Abrir pagamentos", href: permissions.financeiro.view ? "/financeiro/baixas" : null },
    { terms: ["devedor", "devedores"], label: "Pacientes devedores", prompt: "Quem está devendo?", href: null },
    { terms: ["agenda", "horarios"], label: "Agenda", prompt: "Tem horário disponível?", href: permissions.agenda.view ? "/agenda" : null },
    { terms: ["paciente", "pacientes"], label: "Pacientes", prompt: "Buscar paciente", href: permissions.pacientes.view ? "/pacientes" : null },
    { terms: ["profissional", "profissionais"], label: "Profissionais", prompt: "Buscar profissional", href: permissions.funcionarios.view ? "/funcionarios" : null },
    { terms: ["clinica", "clinicas"], label: "Clínicas", prompt: "Buscar clínica", href: permissions.clinicas.view ? "/clinicas" : null },
    { terms: ["financeiro"], label: "Financeiro", prompt: "Consultar financeiro", href: permissions.financeiro.view ? "/financeiro" : null },
    { terms: ["pacotes"], label: "Pacotes", prompt: "Pacotes vencendo", href: permissions.pacotes.view ? "/pacotes" : null },
    { terms: ["relatorios"], label: "Relatórios", prompt: "Abrir relatórios", href: permissions.relatorios.view ? "/relatorios" : null }
  ];
  const concept = concepts.map((item) => ({ item, score: Math.max(...item.terms.map((term) => similarity(parsed.normalizedText, term))) })).sort((left, right) => right.score - left.score)[0];
  if (concept?.score >= 0.72 && (!concept.item.terms.includes(parsed.normalizedText) || parsed.normalizedText === "devedor") && parsed.normalizedText.split(" ").length <= 2) {
    const actions = concept.item.label === "Pacientes devedores" || concept.item.href ? [{ label: concept.item.label, ...(concept.item.href ? { href: concept.item.href as Route } : { prompt: concept.item.prompt }) }] : [];
    return { title: "Você quis dizer?", message: concept.item.label, cards: [], actions, context: { ...parsed, patientName: null } };
  }

  if (parsed.intent === "check_alerts") {
    if (!scope.clinicId) return { title: "Selecione uma clínica", message: "Escolha uma clínica para ver alertas operacionais isolados.", cards: [], actions: [], context: parsed };
    const today = isoDate(new Date());
    const in30 = isoDate(addDays(new Date(), 30));
    if (/pacotes?.*venc/.test(parsed.normalizedText)) {
      if (!permissions.pacotes.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso a Pacotes.", cards: [], actions: [], context: parsed };
      const result = await supabase.from("patient_packages").select("patient_id,expiration_date,remaining_sessions").eq("clinic_id", scope.clinicId).eq("status", "active").gte("expiration_date", today).lte("expiration_date", in30).order("expiration_date").limit(10);
      const names = new Map(patients.map((row) => [row.id, row.full_name]));
      return { title: "Pacotes vencendo", message: result.data?.length ? result.data.length + " pacote(s) vencem nos próximos 30 dias." : "Nenhum pacote próximo do vencimento.", cards: result.data?.length ? [{ title: "Prioridades", lines: result.data.map((row) => (names.get(row.patient_id) ?? "Paciente") + " — " + dateLabel(row.expiration_date ?? today) + " — " + row.remaining_sessions + " sessão(ões)") }] : [], actions: [action("Abrir Pacotes", "/pacotes")], context: parsed };
    }
    if (!permissions.pacientes.view || !permissions.agenda.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso aos dados necessários.", cards: [], actions: [], context: parsed };
    const future = await supabase.from("appointments").select("patient_id").eq("clinic_id", scope.clinicId).gte("appointment_date", today).not("status", "eq", "cancelado");
    const scheduled = new Set((future.data ?? []).map((row) => row.patient_id));
    const rows = patients.filter((row) => !scheduled.has(row.id)).slice(0, 10);
    return { title: "Pacientes sem retorno", message: rows.length ? "Pacientes ativos sem próximo atendimento encontrado." : "Nenhum paciente sem retorno encontrado.", cards: rows.length ? [{ title: "Primeiros resultados", lines: rows.map((row) => row.full_name) }] : [], actions: [action("Ver pacientes", "/pacientes"), action("Abrir agenda", "/agenda")], context: parsed };
  }

  if (parsed.intent === "check_debtors") {
    if (!permissions.financeiro.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso ao Financeiro.", cards: [], actions: [], context: parsed };
    const onlyOverdue = /vencid|atrasad/.test(parsed.normalizedText);
    const today = isoDate(new Date());
    let debtQuery = supabase.from("financial_transactions").select("patient_id,open_amount,due_date").eq("transaction_type", "receita").in("status", ["pendente", "parcial"]).gt("open_amount", 0).order("due_date").limit(100);
    if (scope.clinicId) debtQuery = debtQuery.eq("clinic_id", scope.clinicId);
    if (onlyOverdue) debtQuery = debtQuery.lt("due_date", today);
    const debtResult = await debtQuery;
    if (debtResult.error) return unavailable("Não foi possível consultar o Financeiro agora.", parsed);
    const totals = new Map<string, number>();
    for (const row of debtResult.data ?? []) if (row.patient_id) totals.set(row.patient_id, (totals.get(row.patient_id) ?? 0) + Number(row.open_amount ?? 0));
    const debtPatientIds = [...totals.keys()];
    let debtPatientsQuery = supabase.from("patients").select("id,full_name").in("id", debtPatientIds.length ? debtPatientIds : ["00000000-0000-0000-0000-000000000000"]);
    if (scope.clinicId) debtPatientsQuery = debtPatientsQuery.eq("clinic_id", scope.clinicId);
    const debtPatientsResult = await debtPatientsQuery;
    const names = new Map((debtPatientsResult.data ?? []).map((row) => [row.id, row.full_name]));
    const allDebtors = [...totals.entries()].map(([id, total]) => ({ id, name: names.get(id), total })).filter((item) => item.name).sort((left, right) => right.total - left.total);
    const totalOpen = allDebtors.reduce((sum, item) => sum + item.total, 0);
    const debtors = allDebtors.slice(0, 10);
    return {
      title: onlyOverdue ? "Pagamentos vencidos" : "Pacientes com débitos",
      message: debtors.length ? `Encontrei ${allDebtors.length} paciente(s). Total em aberto: ${money(totalOpen)}.` : "Não encontrei pacientes com débitos nesta clínica. Todos os pagamentos consultados estão em dia.",
      cards: debtors.length ? [{ title: "Financeiro", lines: debtors.map((item) => `${item.name}: ${money(item.total)}`), tone: "warning" }] : [],
      actions: [
        action("Ver todos no Financeiro", "/financeiro/baixas"),
        ...(!onlyOverdue ? [{ label: "Filtrar vencidos", prompt: "pagamentos vencidos" }] : []),
        { label: "Buscar paciente", prompt: "buscar paciente" }
      ],
      context: parsed
    };
  }

  let patient: (typeof patients)[number] | null = null;
  const patientSearchTerm = parsed.patientName ?? (parsed.intent === "search" ? input.trim() : null);
  if (patientSearchTerm) {
    const matches = patientMatches(patientSearchTerm, patients);
    if (matches.length > 1 && matches[0].score - matches[1].score < 0.35) {
      return {
        title: "Você quis dizer?",
        message: "Encontrei nomes parecidos nesta clínica. Escolha o paciente correto.",
        cards: [{ title: "Pacientes encontrados", lines: matches.map((item) => item.patient.full_name) }],
        actions: matches.map((item) => ({ label: item.patient.full_name, prompt: "Buscar " + item.patient.full_name })),
        context: { ...parsed, patientName: null }
      };
    }
    if (matches[0] && matches[0].score < 1.25) {
      return { title: "Você quis dizer?", message: matches[0].patient.full_name, cards: [], actions: [{ label: matches[0].patient.full_name, prompt: "Buscar " + matches[0].patient.full_name }], context: { ...parsed, patientName: null } };
    }
    patient = matches[0]?.patient ?? null;
    if (!patient && parsed.intent !== "check_availability" && parsed.intent !== "search") {
      return {
        title: "Não encontrei esse paciente",
        message: "Não encontrei um paciente com esse nome nesta clínica. Talvez o nome esteja incompleto ou você queira consultar outro módulo.",
        cards: [],
        actions: [
          ...(permissions.pacientes.view ? [action("Ver pacientes", "/pacientes")] : []),
          ...(permissions.financeiro.view ? [{ label: "Ver pacientes com débitos", prompt: "débitos" }] : []),
          ...(permissions.agenda.view ? [{ label: "Consultar Agenda", prompt: "tem horário disponível?" }] : [])
        ],
        context: { ...parsed, patientName: null }
      };
    }
    if (patient) parsed.patientName = patient.full_name;
  }

  if (parsed.intent === "search" && !patient) {
    const service = serviceMatch?.score >= 0.78 ? serviceMatch.row : null;
    const employee = employeeMatch?.score >= 0.78 ? employeeMatch.row : null;
    if (service) return { title: serviceMatch.score < 1.25 ? "Você quis dizer?" : "Serviço encontrado", message: service.name, cards: [], actions: serviceMatch.score < 1.25 ? [{ label: service.name, prompt: "Buscar " + service.name }] : permissions.servicos.view ? [action("Abrir serviços", "/servicos")] : [], context: { ...parsed, serviceName: service.name } };
    if (employee) return { title: employeeMatch.score < 1.25 ? "Você quis dizer?" : "Profissional encontrado", message: employee.name, cards: [], actions: employeeMatch.score < 1.25 ? [{ label: employee.name, prompt: "Buscar " + employee.name }] : permissions.agenda.view ? [action("Ver agenda", "/agenda")] : [], context: { ...parsed, professionalName: employee.name } };
    return { title: "Busca universal", message: "Informe o nome de um paciente, profissional ou serviço.", cards: [], actions: [], context: parsed };
  }

  if (["check_patient_financial_status", "check_last_payment", "check_session_payment"].includes(parsed.intent) && !patient) {
    return { title: "Qual paciente?", message: "Informe o nome do paciente para consultar o Financeiro.", cards: [], actions: [], context: { ...parsed, pendingIntent: parsed.intent } };
  }

  if (parsed.intent === "schedule_patient" && !patient) {
    return { title: "Qual paciente?", message: "Informe o nome, CPF ou telefone do paciente que deseja agendar.", cards: [], actions: [], context: { ...parsed, pendingIntent: parsed.intent } };
  }

  if (parsed.intent === "schedule_patient" && patient && !parsed.serviceName) {
    return {
      title: "Qual serviço?",
      message: `Encontrei ${patient.full_name}. Escolha um serviço real da clínica.`,
      cards: [],
      actions: services.slice(0, 6).map((service) => ({ label: service.name, prompt: service.name })),
      context: { ...parsed, patientName: patient.full_name, pendingIntent: parsed.intent }
    };
  }

  if (parsed.intent === "schedule_patient" && patient && !parsed.professionalName) {
    return {
      title: "Qual profissional?",
      message: `Serviço: ${parsed.serviceName}. Escolha um profissional da clínica.`,
      cards: [],
      actions: employees.slice(0, 6).map((employee) => ({ label: employee.name, prompt: employee.name })),
      context: { ...parsed, patientName: patient.full_name, pendingIntent: parsed.intent }
    };
  }

  if (parsed.intent === "check_availability" || parsed.intent === "schedule_patient") {
    if (!permissions.agenda.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso à Agenda.", cards: [], actions: [], context: parsed };
    if (!scope.clinicId) return { title: "Selecione uma clínica", message: "Escolha uma clínica no menu antes de consultar horários.", cards: [], actions: [], context: parsed };
    if (!parsed.date) {
      return {
        title: patient ? "Agendar retorno" : "Para quando?",
        message: patient ? "Encontrei " + patient.full_name + ". Informe o dia para consultar horários reais." : "Informe o período desejado.",
        cards: [],
        actions: [{ label: "Hoje", prompt: input + " hoje" }, { label: "Amanhã", prompt: input + " amanhã" }, { label: "Esta semana", prompt: input + " esta semana" }],
        context: { ...parsed, pendingIntent: parsed.intent }
      };
    }
    const rangeEnd = parsed.dateRangeEnd ?? parsed.date;
    const appointmentQuery = supabase.from("appointments").select("appointment_date,start_time,end_time,employee_id,patient_id,status").eq("clinic_id", scope.clinicId).gte("appointment_date", parsed.date).lte("appointment_date", rangeEnd).in("status", ["agendado", "confirmado", "realizado"]);
    const blockQuery = supabase.from("schedule_blocks").select("block_date,start_time,end_time,employee_id,block_type,status").eq("clinic_id", scope.clinicId).gte("block_date", parsed.date).lte("block_date", rangeEnd).eq("status", "active");
    const hoursQuery = supabase.from("clinic_opening_hours").select("weekday,is_open,opens_at,closes_at,break_starts_at,break_ends_at").eq("clinic_id", scope.clinicId);
    const [appointmentResult, blockResult, hoursResult] = await Promise.all([appointmentQuery, blockQuery, hoursQuery]);
    if (appointmentResult.error || blockResult.error) return unavailable("Não foi possível consultar a Agenda agora.", parsed);
    const selectedEmployees = parsed.professionalName ? employees.filter((employee) => employee.name === parsed.professionalName) : employees;
    const selectedService = services.find((service) => service.name === parsed.serviceName);
    const duration = selectedService ? Number(selectedService.duration_minutes ?? selectedService.default_duration_minutes ?? 30) : 30;
    const results: string[] = [];
    for (let cursor = new Date(parsed.date + "T12:00:00"); isoDate(cursor) <= rangeEnd && results.length < 18; cursor = addDays(cursor, 1)) {
      const day = isoDate(cursor);
      const configured = (hoursResult.data ?? []).find((row) => row.weekday === cursor.getDay());
      if (configured && !configured.is_open) continue;
      const opens = minutes(configured?.opens_at ?? "07:00");
      const closes = minutes(configured?.closes_at ?? "21:00");
      for (const employee of selectedEmployees) {
        for (let start = opens; start + duration <= closes && results.length < 18; start += 30) {
          const end = start + duration;
          if (parsed.period === "morning" && start >= 12 * 60) continue;
          if (parsed.period === "afternoon" && (start < 12 * 60 || start >= 18 * 60)) continue;
          if (parsed.period === "evening" && start < 18 * 60) continue;
          if (day === isoDate(new Date()) && start <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
          if (configured?.break_starts_at && overlap(start, end, configured.break_starts_at, configured.break_ends_at)) continue;
          const occupied = (appointmentResult.data ?? []).some((row) => row.appointment_date === day && (row.employee_id === employee.id || (patient && row.patient_id === patient.id)) && overlap(start, end, row.start_time, row.end_time ?? row.start_time));
          const blocked = (blockResult.data ?? []).some((row) => row.block_date === day && (!row.employee_id || row.employee_id === employee.id) && (row.block_type === "dia_inteiro" || overlap(start, end, row.start_time, row.end_time ?? row.start_time)));
          if (!occupied && !blocked) results.push(dateLabel(day) + " às " + time(start) + (selectedEmployees.length > 1 ? " com " + employee.name : ""));
        }
      }
    }
    const patientParam = patient ? "&patientId=" + patient.id : "";
    const warnings: string[] = [];
    if (patient && permissions.financeiro.view) {
      let query = supabase.from("financial_transactions").select("open_amount").eq("patient_id", patient.id).eq("transaction_type", "receita").in("status", ["pendente", "parcial"]);
      if (scope.clinicId) query = query.eq("clinic_id", scope.clinicId);
      const openResult = await query;
      const total = (openResult.data ?? []).reduce((sum, row) => sum + Number(row.open_amount ?? 0), 0);
      if (total > 0) warnings.push("Pendência financeira: " + money(total));
    }
    if (patient && permissions.pacotes.view) {
      let query = supabase.from("patient_packages").select("remaining_sessions,expiration_date,status").eq("patient_id", patient.id).eq("status", "active").limit(1);
      if (scope.clinicId) query = query.eq("clinic_id", scope.clinicId);
      const packageResult = await query.maybeSingle();
      if (packageResult.data) warnings.push("Pacote: " + packageResult.data.remaining_sessions + " sessão(ões) restante(s)" + (packageResult.data.expiration_date ? ", vence " + dateLabel(packageResult.data.expiration_date) : ""));
    }
    return {
      title: patient ? "Horários para " + patient.full_name : "Horários disponíveis",
      message: results.length ? "Encontrei opções reais na agenda selecionada." : "Não encontrei horários disponíveis nesse período.",
      cards: [
        ...(results.length ? [{ title: parsed.professionalName ? "Com " + parsed.professionalName : "Primeiras opções", lines: results.slice(0, 12), tone: "success" as const }] : []),
        ...(warnings.length ? [{ title: "Atenção antes de confirmar", lines: warnings, tone: "warning" as const }] : [])
      ],
      actions: [
        ...(permissions.agenda.create && patient ? [action("Agendar retorno", "/agenda?new=1" + patientParam + "&date=" + parsed.date)] : []),
        action("Abrir agenda", "/agenda?date=" + parsed.date),
        { label: "Escolher outro dia", prompt: patient ? "Agendar " + patient.full_name : "Horários disponíveis" }
      ],
      context: parsed
    };
  }

  if (patient) {
    let appointmentsQuery = supabase.from("appointments").select("id,appointment_date,start_time,status,employee_id,service_id").eq("patient_id", patient.id).order("appointment_date", { ascending: false }).limit(60);
    let packagesQuery = supabase.from("patient_packages").select("id,status,remaining_sessions,contracted_sessions,completed_sessions,expiration_date,service_id").eq("patient_id", patient.id).order("purchase_date", { ascending: false }).limit(20);
    let transactionsQuery = supabase.from("financial_transactions").select("id,status,amount,paid_amount,open_amount,payment_date,payment_method,due_date,appointment_date,service_id,description,transaction_type").eq("patient_id", patient.id).eq("transaction_type", "receita").order("due_date", { ascending: false }).limit(80);
    if (scope.clinicId) {
      appointmentsQuery = appointmentsQuery.eq("clinic_id", scope.clinicId);
      packagesQuery = packagesQuery.eq("clinic_id", scope.clinicId);
      transactionsQuery = transactionsQuery.eq("clinic_id", scope.clinicId);
    }
    const [appointmentsResult, packagesResult, transactionsResult] = await Promise.all([
      permissions.agenda.view ? appointmentsQuery : Promise.resolve({ data: [] }),
      permissions.pacotes.view ? packagesQuery : Promise.resolve({ data: [] }),
      permissions.financeiro.view ? transactionsQuery : Promise.resolve({ data: [] })
    ]);
    const appointments = appointmentsResult.data ?? [];
    const packages = packagesResult.data ?? [];
    const transactions = transactionsResult.data ?? [];
    const today = isoDate(new Date());
    const next = [...appointments].reverse().find((row) => row.appointment_date >= today && row.status !== "cancelado");
    const last = appointments.find((row) => row.appointment_date < today || row.status === "realizado");
    const activePackage = packages.find((row) => row.status === "active");
    const open = transactions.filter((row) => row.status !== "cancelado" && Number(row.open_amount ?? 0) > 0);
    const totalOpen = open.reduce((sum, row) => sum + Number(row.open_amount ?? 0), 0);
    const paid = transactions.filter((row) => row.status === "pago" || Number(row.paid_amount ?? 0) > 0).sort((a, b) => (b.payment_date ?? b.due_date).localeCompare(a.payment_date ?? a.due_date));
    const lastPayment = paid[0] ?? null;
    const employeeMap = new Map(employees.map((row) => [row.id, row.name]));
    const serviceMap = new Map(services.map((row) => [row.id, row.name]));
    const commonActions = [
      ...(permissions.pacientes.view ? [action("Abrir paciente", "/pacientes?patientId=" + patient.id)] : []),
      ...(permissions.agenda.view ? [action("Abrir agenda", "/agenda?patientId=" + patient.id)] : []),
      ...(permissions.agenda.create ? [action("Agendar retorno", "/agenda?new=1&patientId=" + patient.id)] : []),
      ...(permissions.pacotes.view ? [action("Ver pacote", "/pacotes?patientId=" + patient.id)] : []),
      ...(permissions.prontuarios.view ? [action("Ver prontuário", "/prontuarios?q=" + encodeURIComponent(patient.full_name))] : []),
      ...(permissions.financeiro.view ? [action("Abrir financeiro", "/financeiro/baixas?patientId=" + patient.id)] : []),
      ...((patient.phone ?? "").replace(/\D/g, "") ? [{
        label: "WhatsApp",
        externalHref: "https://wa.me/" + ((patient.phone ?? "").replace(/\D/g, "").startsWith("55") ? (patient.phone ?? "").replace(/\D/g, "") : "55" + (patient.phone ?? "").replace(/\D/g, ""))
      }] : [])
    ];

    if (parsed.intent === "check_last_payment" || parsed.intent === "check_session_payment") {
      if (!permissions.financeiro.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso ao Financeiro.", cards: [], actions: [], context: parsed };
      const sessionTransaction = parsed.intent === "check_session_payment" && last ? transactions.find((row) => row.appointment_date === last.appointment_date) : null;
      const selected = sessionTransaction ?? lastPayment;
      return {
        title: parsed.intent === "check_session_payment" ? "Pagamento do atendimento" : "Último pagamento de " + patient.full_name,
        message: selected ? (Number(selected.open_amount ?? 0) > 0 ? "Existe saldo restante neste lançamento." : "Pagamento registrado.") : "Não encontrei pagamento registrado para este paciente.",
        cards: selected ? [{ title: "Financeiro", lines: [
          "Data: " + dateLabel(selected.payment_date ?? selected.due_date),
          "Valor pago: " + money(Number(selected.paid_amount ?? 0)),
          "Saldo: " + money(Number(selected.open_amount ?? 0)),
          "Forma: " + (selected.payment_method ?? "Não informada"),
          "Serviço: " + (serviceMap.get(selected.service_id ?? "") ?? selected.description ?? "Não informado")
        ], tone: Number(selected.open_amount ?? 0) > 0 ? "warning" : "success" }] : [],
        actions: commonActions.filter((item) => item.label === "Abrir financeiro" || item.label === "Agendar retorno" || item.label === "Abrir paciente"),
        context: parsed
      };
    }

    if (parsed.intent === "check_patient_financial_status") {
      if (!permissions.financeiro.view) return { title: "Acesso restrito", message: "Seu perfil não possui acesso ao Financeiro.", cards: [], actions: [], context: parsed };
      return {
        title: patient.full_name + (totalOpen > 0 ? " possui pendências" : " está em dia"),
        message: totalOpen > 0 ? "Total em aberto: " + money(totalOpen) : "Não há saldo em aberto registrado.",
        cards: [
          ...(open.length ? [{ title: "Títulos em aberto", lines: open.slice(0, 5).map((row) => money(Number(row.open_amount ?? 0)) + " — vencimento " + dateLabel(row.due_date)), tone: "warning" as const }] : []),
          ...(lastPayment ? [{ title: "Último pagamento", lines: [dateLabel(lastPayment.payment_date ?? lastPayment.due_date) + " — " + money(Number(lastPayment.paid_amount ?? 0)) + " — " + (lastPayment.payment_method ?? "Forma não informada")], tone: "success" as const }] : [])
        ],
        actions: commonActions.filter((item) => item.label !== "Ver pacote"),
        context: parsed
      };
    }

    const history = appointments.filter((row) => row.status === "realizado");
    const frequent = <T extends string | null>(values: T[]) => {
      const counts = new Map<string, number>();
      values.filter(Boolean).forEach((value) => counts.set(String(value), (counts.get(String(value)) ?? 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const frequentEmployee = employeeMap.get(frequent(history.map((row) => row.employee_id)) ?? "");
    const frequentService = serviceMap.get(frequent(history.map((row) => row.service_id)) ?? "");
    const frequentHour = frequent(history.map((row) => row.start_time?.slice(0, 5) ?? null));
    return {
      title: patient.full_name,
      message: history.length >= 2 && /costuma|normalmente|horario que/.test(parsed.normalizedText)
        ? patient.full_name + " costuma vir por volta de " + (frequentHour ?? "horário variável") + (frequentEmployee ? " com " + frequentEmployee : "") + "."
        : "Resumo operacional compacto, sem dados de prontuário.",
      cards: [
        ...(permissions.agenda.view ? [{ title: "Agenda", lines: [
          "Última sessão: " + (last ? dateLabel(last.appointment_date) + " às " + last.start_time.slice(0, 5) : "Não encontrada"),
          "Próxima sessão: " + (next ? dateLabel(next.appointment_date) + " às " + next.start_time.slice(0, 5) : "Não agendada"),
          "Profissional frequente: " + (frequentEmployee ?? "Sem padrão suficiente"),
          "Serviço frequente: " + (frequentService ?? "Sem padrão suficiente")
        ] }] : []),
        ...(permissions.pacotes.view ? [{ title: "Pacote", lines: activePackage ? [
          "Status: Ativo",
          "Sessões restantes: " + activePackage.remaining_sessions,
          "Realizadas: " + activePackage.completed_sessions,
          "Validade: " + (activePackage.expiration_date ? dateLabel(activePackage.expiration_date) : "Sem data")
        ] : ["Nenhum pacote ativo encontrado"] }] : []),
        ...(permissions.financeiro.view ? [{ title: "Financeiro", lines: [
          totalOpen > 0 ? "Em aberto: " + money(totalOpen) : "Em dia",
          "Último pagamento: " + (lastPayment ? dateLabel(lastPayment.payment_date ?? lastPayment.due_date) + " — " + money(Number(lastPayment.paid_amount ?? 0)) : "Não encontrado")
        ], tone: totalOpen > 0 ? "warning" as const : "success" as const }] : [])
      ],
      actions: commonActions,
      context: parsed
    };
  }

  return {
    title: "Não consegui identificar exatamente o que você deseja",
    message: "Você pode consultar Agenda, Pacientes, Financeiro, Pacotes ou Profissionais.",
    cards: [],
    actions: [
      ...(permissions.agenda.view ? [{ label: "Agenda", prompt: "tem horário disponível?" }] : []),
      ...(permissions.pacientes.view ? [{ label: "Pacientes", prompt: "buscar paciente" }] : []),
      ...(permissions.financeiro.view ? [{ label: "Financeiro", prompt: "débitos" }] : []),
      ...(permissions.pacotes.view ? [{ label: "Pacotes", prompt: "pacotes vencendo" }] : []),
      ...(permissions.funcionarios.view ? [{ label: "Profissionais", prompt: "buscar profissional" }] : [])
    ],
    context: parsed
  };
}
