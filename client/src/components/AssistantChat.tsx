import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ChatMessage, MockUser } from '../types';

const STARTERS = [
  'How many demands do we have and what types?',
  'What is the status of my demands?',
  "What's the difference between an enhancement and a new AI use case?",
  'Summarize our demand portfolio.',
];

export function AssistantChat({ user }: { user: MockUser }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Reset the thread with a fresh greeting whenever the user (org) changes.
  useEffect(() => {
    setMessages([
      {
        id: 'greet',
        role: 'agent',
        text: `Hi ${user.name.split(' ')[0]} — I'm your AI Studio assistant for ${user.orgName}. Ask me anything about your demands or how the intake process works.`,
        ts: new Date().toISOString(),
      },
    ]);
    setError(null);
  }, [user.id, user.name, user.orgName]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  async function ask(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: t,
      ts: new Date().toISOString(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setBusy(true);
    try {
      const { reply } = await api.assistant(
        user.id,
        history.map((m) => ({ role: m.role, text: m.text })),
      );
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'agent', text: reply, ts: new Date().toISOString() },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showStarters = messages.length <= 1 && !busy;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="px-4 py-3 text-xs text-muted">
        Assistant · answers grounded in {user.orgName}’s demand data
      </div>

      <div ref={threadRef} className="thread flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'rounded-br-md bg-brand text-white'
                  : 'rounded-bl-md border border-[var(--grid)] bg-surface text-ink'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-[var(--grid)] bg-surface px-4 py-2.5 text-sm text-muted">
              <span className="inline-flex gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--grid)] bg-surface px-4 py-3">
        {error && (
          <div className="mb-2 rounded-lg bg-[color-mix(in_srgb,var(--critical)_8%,white)] px-3 py-2 text-sm text-[var(--critical)]">
            {error}
          </div>
        )}
        {showStarters && (
          <div className="mb-2 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-[var(--grid)] px-3 py-1.5 text-sm text-ink-2 hover:border-brand hover:text-brand"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder="Ask a question…"
            className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--grid)] bg-page px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
          />
          <button
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
