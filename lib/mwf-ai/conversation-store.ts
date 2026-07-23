import type { OperationalDomain } from "./semantic-engine.ts";

export type StoredConversation = {
  userId: string;
  clinicId: string;
  conversationId: string;
  currentDomain?: OperationalDomain | null;
  patientId?: string | null;
  patientName?: string | null;
  professionalId?: string | null;
  professionalName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  date?: string | null;
  time?: string | null;
  recentResults?: { id: string; domain: OperationalDomain; label: string; ordinal: number }[];
  pendingAction?: {
    type: "cancel_appointment" | "create_appointment" | "prepare_charge";
    entityId?: string;
    payload: Record<string, string>;
    summary: string;
  } | null;
  updatedAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __mwfAiConversations?: Map<string, StoredConversation>;
};

const store = globalStore.__mwfAiConversations ?? new Map<string, StoredConversation>();
globalStore.__mwfAiConversations = store;
const TTL = 30 * 60_000;

function key(userId: string, clinicId: string, conversationId: string) {
  return `${userId}:${clinicId}:${conversationId}`;
}

export function getConversation(userId: string, clinicId: string, conversationId: string, now = Date.now()) {
  const storeKey = key(userId, clinicId, conversationId);
  const conversation = store.get(storeKey);
  if (!conversation || now - conversation.updatedAt > TTL) {
    store.delete(storeKey);
    return null;
  }
  return conversation;
}

export function saveConversation(conversation: StoredConversation) {
  for (const [storeKey, current] of store) {
    if (Date.now() - current.updatedAt > TTL) store.delete(storeKey);
  }
  store.set(key(conversation.userId, conversation.clinicId, conversation.conversationId), {
    ...conversation,
    updatedAt: Date.now()
  });
}

export function clearConversation(userId: string, clinicId: string, conversationId: string) {
  store.delete(key(userId, clinicId, conversationId));
}
