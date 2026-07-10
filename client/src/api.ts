import type {
  ActionLogEntry,
  ConversationSummary,
  ConversationView,
  DemandItem,
  MockUser,
} from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  users: () => req<MockUser[]>('/users'),

  startConversation: (userId: string) =>
    req<ConversationView>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  getConversation: (id: string) => req<ConversationView>(`/conversations/${id}`),

  sendMessage: (id: string, text: string) =>
    req<ConversationView>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  saveDraft: (id: string) =>
    req<ConversationView>(`/conversations/${id}/draft`, { method: 'POST' }),

  submit: (id: string, opts: { edits?: Record<string, string>; consent: boolean; idempotencyKey: string }) =>
    req<{ item: DemandItem; view: ConversationView }>(`/conversations/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  listConversations: (userId: string) =>
    req<ConversationSummary[]>(`/conversations?userId=${encodeURIComponent(userId)}`),

  demands: (userId: string) =>
    req<DemandItem[]>(`/demands?userId=${encodeURIComponent(userId)}`),

  actionLog: (conversationId: string) =>
    req<ActionLogEntry[]>(`/action-log?conversationId=${encodeURIComponent(conversationId)}`),

  assistant: (userId: string, messages: { role: 'user' | 'agent'; text: string }[]) =>
    req<{ reply: string }>('/assistant', {
      method: 'POST',
      body: JSON.stringify({ userId, messages }),
    }),

  getDebug: () => req<{ failNextSubmit: boolean }>('/debug'),
  setSimulateFailure: (enabled: boolean) =>
    req<{ failNextSubmit: boolean }>('/debug/simulate-failure', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
};
