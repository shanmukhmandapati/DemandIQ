import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ConversationView, MockUser } from '../types';
import { TypeChip } from './ui';
import { ConfirmationCard } from './ConfirmationCard';
import { DuplicateCard } from './DuplicateCard';
import { IntakeLanding } from './IntakeLanding';

export function ChatView({
  user,
  conversationId,
  onConversationCreated,
  onSubmitted,
}: {
  user: MockUser;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onSubmitted: (itemId: string) => void;
}) {
  const [view, setView] = useState<ConversationView | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Create or load the conversation exactly once on mount. The ref guard makes
  // this idempotent under React StrictMode's double-invoked effects, so we never
  // create two conversations (or render the greeting twice).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const v = conversationId
          ? await api.getConversation(conversationId)
          : await api.startConversation(user.id);
        setView(v);
        if (!conversationId) onConversationCreated(v.conversation.id);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [view?.conversation.messages.length, busy]);

  if (!view) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        {error ? <span className="text-[var(--critical)]">{error}</span> : 'Starting your intake…'}
      </div>
    );
  }

  const c = view.conversation;
  const isConfirmation = c.step === 'confirmation';
  const isSubmitted = c.step === 'submitted';
  const isDuplicateStep = c.step === 'duplicate_decision';
  // Landing hero: shown until the user sends their first message.
  const showLanding = c.step === 'classify' && c.messages.every((m) => m.role !== 'user');

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    setBusy(true);
    setError(null);
    // optimistic user bubble
    setView((v) =>
      v
        ? {
            ...v,
            conversation: {
              ...v.conversation,
              messages: [
                ...v.conversation.messages,
                { id: `local-${Date.now()}`, role: 'user', text: t, ts: new Date().toISOString() },
              ],
            },
          }
        : v,
    );
    try {
      const next = await api.sendMessage(c.id, t);
      setView(next);
    } catch (e) {
      setError((e as Error).message);
      // reload authoritative state
      try {
        setView(await api.getConversation(c.id));
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(edits: Record<string, string>, consent: boolean) {
    if (submitting) return; // client-side idempotency guard (double-click)
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.submit(c.id, { edits, consent, idempotencyKey: c.id });
      setView(res.view);
      onSubmitted(res.item.id);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    try {
      setView(await api.saveDraft(c.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (showLanding) {
    return <IntakeLanding onSubmit={(t) => send(t)} busy={busy} error={error} />;
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* status strip */}
      <div className="flex items-center gap-2 px-4 py-3">
        <TypeChip type={c.demandType} />
        {c.demandType && <span className="text-xs text-muted">·</span>}
        <span className="text-xs text-muted">
          {isSubmitted
            ? `Submitted as ${c.submittedItemId}`
            : view.missingMandatory.length
            ? `${view.missingMandatory.length} required field(s) remaining`
            : 'All required fields captured'}
        </span>
      </div>

      {/* thread */}
      <div ref={threadRef} className="thread flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {c.messages.map((m) => (
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
                <Dot /> <Dot /> <Dot />
              </span>
            </div>
          </div>
        )}

        {isDuplicateStep && view.duplicateCandidate && (
          <DuplicateCard
            candidate={view.duplicateCandidate}
            matchType={c.duplicate?.matchType}
            rationale={c.duplicate?.rationale}
          />
        )}

        {isConfirmation && (
          <ConfirmationCard
            view={view}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
          />
        )}
      </div>

      {/* composer / footer */}
      {isSubmitted ? (
        <div className="border-t border-[var(--grid)] bg-surface px-4 py-4 text-center">
          <div className="text-sm font-medium text-[var(--good-text)]">
            ✓ Demand submitted as {c.submittedItemId}
          </div>
          <p className="mt-1 text-xs text-muted">You can track it in the Demand Tracker.</p>
        </div>
      ) : isConfirmation ? null : (
        <div className="border-t border-[var(--grid)] bg-surface px-4 py-3">
          {error && (
            <div className="mb-2 rounded-lg bg-[color-mix(in_srgb,var(--critical)_8%,white)] px-3 py-2 text-sm text-[var(--critical)]">
              {error}{' '}
              <button className="font-medium underline" onClick={() => setError(null)}>
                dismiss
              </button>
            </div>
          )}
          {view.quickReplies.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {view.quickReplies.map((q) => (
                <button
                  key={q.value}
                  disabled={busy}
                  onClick={() => send(q.label.replace(/\s*✓$/, ''))}
                  className="rounded-full border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-[color-mix(in_srgb,var(--brand)_8%,white)] disabled:opacity-50"
                >
                  {q.label}
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
                  send(input);
                }
              }}
              rows={1}
              placeholder="Type your message…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--grid)] bg-page px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={busy}
              className="rounded-xl border border-[var(--grid)] px-3 py-2.5 text-sm font-medium text-ink-2 hover:bg-page disabled:opacity-50"
              title="Save progress and resume later"
            >
              Save draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />;
}
