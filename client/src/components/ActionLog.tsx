import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ActionLogEntry, ConversationSummary, MockUser } from '../types';

const ACTION_COLOR: Record<string, string> = {
  classification: 'var(--cat-new)',
  question_asked: 'var(--cat-cap)',
  answer_captured: 'var(--muted)',
  duplicate_check: 'var(--warning)',
  duplicate_decision: 'var(--warning)',
  draft_saved: 'var(--baseline)',
  confirmation: 'var(--cat-enh)',
  record_created: 'var(--good)',
  error: 'var(--critical)',
};

export function ActionLog({
  user,
  activeConversationId,
}: {
  user: MockUser;
  activeConversationId: string | null;
}) {
  const [convos, setConvos] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [log, setLog] = useState<ActionLogEntry[]>([]);

  useEffect(() => {
    api.listConversations(user.id).then((cs) => {
      setConvos(cs);
      setSelected((prev) => prev || activeConversationId || cs[0]?.id || '');
    });
  }, [user.id, activeConversationId]);

  useEffect(() => {
    if (selected) api.actionLog(selected).then(setLog);
    else setLog([]);
  }, [selected]);

  return (
    <div className="h-full overflow-y-auto thread">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="rounded-xl border border-[var(--grid)] bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Internal · Auditability
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Every decision the agent makes for a conversation is recorded here — classification,
            each question asked, answers captured, the duplicate check, and record creation.
          </p>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[var(--grid)] bg-page px-3 py-2 text-sm"
          >
            <option value="">Select a conversation…</option>
            {convos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.status}
              </option>
            ))}
          </select>
        </div>

        {selected && log.length === 0 && (
          <div className="text-center text-sm text-muted">No log entries yet for this conversation.</div>
        )}

        <ol className="relative space-y-3 border-l border-[var(--grid)] pl-5">
          {log.map((e) => (
            <li key={e.id} className="relative">
              <span
                className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-1)]"
                style={{ background: ACTION_COLOR[e.actionType] ?? 'var(--muted)' }}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{e.actionType.replace(/_/g, ' ')}</span>
                <span className="tnum text-[11px] text-muted">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm text-ink-2">{e.detail}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
