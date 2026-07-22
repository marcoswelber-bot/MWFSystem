export type MwfAiDomain =
  | "agenda" | "financeiro" | "pacotes" | "prontuarios" | "relatorios"
  | "servicos" | "profissionais" | "pacientes" | "clinicas" | "comissoes" | "unknown";

export type MwfAiAction = "list" | "list_pending" | "check_availability" | "schedule" | "search" | "open" | "summarize" | "prepare_charge" | "unknown";

export type MwfAiIntent =
  | "list_appointments" | "check_availability" | "schedule_patient"
  | "check_patient_financial_status" | "check_debtors" | "check_last_payment"
  | "check_session_payment" | "check_alerts" | "patient_summary"
  | "discover" | "select_domain" | "confirm" | "cancel" | "search" | "unknown";

export type MwfAiTemporalScope = "today" | "tomorrow" | "yesterday" | "current_week" | "next_week" | "current_month" | "next" | "explicit_date" | null;

export type MwfAiEntity = { type: "patient" | "professional" | "service" | "code" | "cpf" | "phone" | "email" | "number"; value: string };
export type MwfAiFilter = { field: string; operator: "eq" | "contains" | "starts_with" | "open" | "next"; value?: string };
export type MwfAiOption = { actionId: string; domain: MwfAiDomain; intent: MwfAiIntent; label: string; payload?: Record<string, string> };
export type MwfAiResultRef = { id: string; domain: MwfAiDomain; label: string; ordinal: number; numericTokens?: string[]; payload?: Record<string, string> };
export type MwfAiPendingOperation = { kind: "confirmation" | "selection" | "action"; actionId: string; domain: MwfAiDomain; intent: MwfAiIntent; label: string; payload?: Record<string, string> };

export type MwfAiContext = {
  pendingIntent?: MwfAiIntent | null;
  currentDomain?: MwfAiDomain | null;
  patientId?: string | null;
  patientName?: string | null;
  professionalName?: string | null;
  serviceName?: string | null;
  date?: string | null;
  dateRangeEnd?: string | null;
  period?: "morning" | "afternoon" | "evening" | null;
  time?: string | null;
  filters?: MwfAiFilter[];
  pendingOptions?: MwfAiOption[];
  pendingOperation?: MwfAiPendingOperation | null;
  recentResults?: MwfAiResultRef[];
  updatedAt?: number;
};

export type MwfAiInterpretation = MwfAiContext & {
  intent: MwfAiIntent;
  domain: MwfAiDomain;
  action: MwfAiAction;
  temporalScope: MwfAiTemporalScope;
  entities: MwfAiEntity[];
  confidence: number;
  requiresClarification: boolean;
  patientSearchAllowed: boolean;
  normalizedText: string;
  resolution?: { kind: "confirmed" | "cancelled" | "selected" | "result"; actionId?: string; result?: MwfAiResultRef };
};
