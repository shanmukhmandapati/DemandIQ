import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ConversationSummary, MockUser } from '../types';
import { StatusPill, TypeChip } from './ui';

export function ChatHistory({
  user,
  refreshKey,
  onOpen,
}: {
  user: MockUser;
  refreshKey: number;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    setItems(null);
    api.listConversations(user.id).then((cs) =>
      // Hide abandoned fresh chats (created but never engaged — just the greeting).
      setItems(cs.filter((c) => !(c.status === 'Active' && c.messageCount <= 1))),
    );
  }, [user.id, refreshKey]);

  if (!items) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="h-full overflow-y-auto thread">
      <div className="mx-auto max-w-3xl space-y-2 p-6">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--grid)] bg-surface p-10 text-center text-sm text-muted">
            No conversations yet. Start one from <span className="font-medium">New Demand</span>.
          </div>
        )}
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--grid)] bg-surface px-4 py-3 text-left hover:border-brand"
          >
            <div className="flex-1 truncate">
              <div className="truncate text-sm font-medium">{c.title}</div>
              <div className="text-xs text-muted">
                {c.status === 'Draft'
                  ? 'Draft — click to resume'
                  : c.status === 'Submitted'
                  ? `Submitted as ${c.submittedItemId} — click to view`
                  : 'In progress — click to continue'}
                {' · '}
                {new Date(c.updatedAt).toLocaleString()}
              </div>
            </div>
            {c.demandType && <TypeChip type={c.demandType} />}
            <StatusPill status={c.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
