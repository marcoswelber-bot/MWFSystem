"use server";

import type { Route } from "next";
import { getCurrentClinicScope } from "@/lib/access-control";
import type { AssistantContext } from "@/lib/assistant/interpreter";
import { handleOperationalAssistant } from "@/lib/mwf-ai/operational-assistant";
import { getCurrentPermissionMap } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AssistantCard = {
  title: string;
  lines: string[];
  tone?: "default" | "warning" | "success";
};

export type AssistantAction = {
  label: string;
  href?: Route;
  externalHref?: string;
  prompt?: string;
  actionId?: string;
  domain?: string;
  intent?: string;
  payload?: Record<string, string>;
};

export type AssistantReply = {
  title: string;
  message: string;
  cards: AssistantCard[];
  actions: AssistantAction[];
  context: AssistantContext;
};

export async function askMwfAssistant(
  input: string,
  previousContext: AssistantContext = {}
): Promise<AssistantReply> {
  const [permissions, scope, supabase] = await Promise.all([
    getCurrentPermissionMap(),
    getCurrentClinicScope(),
    createClient()
  ]);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const context =
    previousContext.updatedAt &&
    Date.now() - previousContext.updatedAt < 30 * 60_000
      ? previousContext
      : { conversationId: previousContext.conversationId };

  if (!input.trim()) {
    return {
      title: "Como posso ajudar?",
      message: "Digite uma consulta ou operação sobre a clínica ativa.",
      cards: [],
      actions: [],
      context
    };
  }
  if (!user) {
    return {
      title: "Sessão necessária",
      message: "Entre novamente para consultar o sistema.",
      cards: [],
      actions: [],
      context
    };
  }
  if (!scope.clinicId) {
    return {
      title: "Selecione uma clínica",
      message: "Escolha a clínica ativa antes de consultar dados.",
      cards: [],
      actions: [],
      context
    };
  }

  const conversationId = previousContext.conversationId ?? crypto.randomUUID();
  return handleOperationalAssistant({
    input,
    conversationId,
    userId: user.id,
    clinicId: scope.clinicId,
    permissions,
    client: supabase,
    previousContext: { ...context, conversationId }
  });
}
