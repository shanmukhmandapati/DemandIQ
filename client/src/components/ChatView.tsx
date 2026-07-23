import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ConversationSummary, ConversationView, MockUser, RequestType } from '../types';
import { REQUEST_TYPE_LABELS } from '../types';
import { ConfirmationCard } from './ConfirmationCard';
import { DuplicateCard } from './DuplicateCard';

// Minimal Web Speech API typings (not in the default TS DOM lib).
interface SpeechRecognitionEvent extends Event {
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognition };
    webkitSpeechRecognition?: { new (): SpeechRecognition };
  }
}

// Radio options for the "Request type" panel. Each drives its own question flow.
// CPQ Approval is intentionally disabled for now ("coming soon").
const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string; info: string; disabled?: boolean }[] = [
  { value: 'deal_intake', label: 'Deal Intake', info: 'Capture a new sales opportunity — client, offering, value and target close.' },
  { value: 'cpq_approval', label: 'Cost, Price, Quote (CPQ) Approval', info: 'Coming soon.', disabled: true },
  { value: 'sow_approval', label: 'Deal Assurance (SOW) Approval', info: 'Submit a statement of work for delivery / commercial assurance review.' },
  { value: 'staff_augmentation', label: 'Staff Augmentation', info: 'Request people, skills, headcount and duration for an engagement.' },
];

export function ChatView({
  user,
  conversationId,
  initialRequestType,
  onRequestTypeChange,
  onConversationCreated,
  onSubmitted,
  onNewConversation,
  onOpenConversation,
  refreshKey,
}: {
  user: MockUser;
  conversationId: string | null;
  initialRequestType?: RequestType;
  onRequestTypeChange?: (rt: RequestType) => void;
  onConversationCreated: (id: string) => void;
  onSubmitted: (itemId: string) => void;
  onNewConversation: () => void;
  onOpenConversation: (id: string) => void;
  refreshKey: number;
}) {
  const [view, setView] = useState<ConversationView | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ConversationSummary[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dictationBase = useRef('');

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    if (names.length) setAttachments((prev) => [...prev, ...names]);
    e.target.value = ''; // allow re-picking the same file
  }

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;
  const speechSupported = !!SpeechRecognitionCtor;

  function toggleDictation() {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionCtor();
    recognitionRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    dictationBase.current = input ? input.trimEnd() + ' ' : '';
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(dictationBase.current + transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }

  // Stop dictation on unmount so the mic is released.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  // Create or load the conversation exactly once on mount. The ref guard makes
  // this idempotent under React StrictMode's double-invoked effects, so we never
  // create two conversations (or render the greeting twice).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        let v = conversationId
          ? await api.getConversation(conversationId)
          : await api.startConversation(user.id);
        // A brand-new conversation inherits the currently selected request type
        // so its questions start immediately (e.g. New Conversation while SOW is
        // selected opens straight into the SOW questions).
        if (!conversationId && initialRequestType) {
          v = await api.setRequestType(v.conversation.id, initialRequestType);
        }
        setView(v);
        if (!conversationId) onConversationCreated(v.conversation.id);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report the active request type upward so a future New Conversation inherits it.
  useEffect(() => {
    const rt = view?.conversation.requestType;
    if (rt) onRequestTypeChange?.(rt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.conversation.requestType]);

  // Left-panel drafts list, scoped to the current user.
  function loadDrafts() {
    api
      .listConversations(user.id)
      .then((list) => setDrafts(list.filter((x) => x.status === 'Draft')))
      .catch(() => setDrafts([]));
  }
  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, refreshKey, view?.conversation.updatedAt]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [view?.conversation.messages.length, busy]);

  const c = view?.conversation;

  async function send(text: string) {
    let t = text.trim();
    if ((!t && attachments.length === 0) || busy || !c) return;
    if (attachments.length) {
      t = (t ? t + '\n\n' : '') + `📎 Attached: ${attachments.join(', ')}`;
      setAttachments([]);
    }
    recognitionRef.current?.stop();
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
      try {
        setView(await api.getConversation(c.id));
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function selectRequestType(rt: RequestType) {
    if (!c || busy || rt === c.requestType) return;
    setBusy(true);
    setError(null);
    try {
      setView(await api.setRequestType(c.id, rt));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(edits: Record<string, string>, consent: boolean) {
    if (submitting || !c) return; // client-side idempotency guard (double-click)
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
    if (!c) return;
    try {
      setView(await api.saveDraft(c.id));
      loadDrafts();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Left rail: drafts ───────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--grid)] bg-surface md:flex">
        <div className="px-4 pt-5">
          <button
            onClick={onNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep"
          >
            <span>＋</span> New request
          </button>
        </div>

        <div className="px-4 pb-2 pt-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Drafts
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {drafts.length === 0 ? (
            <p className="px-2 text-xs leading-relaxed text-muted">
              No saved drafts yet. Use <span className="font-medium text-ink-2">Save draft</span> to keep a request and resume it later.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {drafts.map((d) => {
                const active = d.id === conversationId;
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => onOpenConversation(d.id)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                        active ? 'bg-[color-mix(in_srgb,var(--brand)_10%,white)]' : 'hover:bg-page'
                      }`}
                    >
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[11px] text-[#8a5a00]">
                        ✎
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink">
                            {d.title || 'Untitled draft'}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted">{fmtTime(d.updatedAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {d.requestType ? REQUEST_TYPE_LABELS[d.requestType] : `${d.messageCount} messages`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Center: the chat ────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col bg-page">
        {/* Agent header */}
        <div className="border-b border-[var(--grid)] bg-surface px-6 py-3.5">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <BotAvatar />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold text-ink">
                  {c?.requestType ? `${REQUEST_TYPE_LABELS[c.requestType]} Assistant` : 'Demand Intake Assistant'}
                </h1>
                <span className="rounded-md bg-[color-mix(in_srgb,var(--brand)_10%,white)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">
                  Beta
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
                <span>Online · guided intake</span>
              </div>
            </div>
          </div>
        </div>

        {!view || !c ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted">
            {error ? (
              <span className="text-[var(--critical)]">{error}</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <Dot /> <Dot /> <Dot />
                </span>
                Preparing your workspace…
              </span>
            )}
          </div>
        ) : (
          <>
            {/* thread */}
            <div ref={threadRef} className="thread flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
                {c.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-end gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {m.role === 'user' ? <UserAvatar name={user.name} /> : <BotAvatar small />}
                    <div className={`flex max-w-[80%] flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'rounded-2xl rounded-br-sm bg-brand text-white'
                            : 'rounded-2xl rounded-bl-sm border border-[var(--grid)] bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-muted">{fmtTime(m.ts)}</span>
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-end gap-2.5">
                    <BotAvatar small />
                    <div className="rounded-2xl rounded-bl-sm border border-[var(--grid)] bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                      <span className="inline-flex gap-1">
                        <Dot /> <Dot /> <Dot />
                      </span>
                    </div>
                  </div>
                )}

                {view.duplicateCandidate && c.step === 'duplicate_decision' && (
                  <DuplicateCard
                    candidate={view.duplicateCandidate}
                    matchType={c.duplicate?.matchType}
                    rationale={c.duplicate?.rationale}
                  />
                )}

                {c.step === 'confirmation' && (
                  <ConfirmationCard
                    view={view}
                    submitting={submitting}
                    submitError={submitError}
                    onSubmit={handleSubmit}
                    onSaveDraft={handleSaveDraft}
                  />
                )}
              </div>
            </div>

            {/* composer / footer */}
            {c.step === 'submitted' ? (
              <div className="border-t border-[var(--grid)] bg-surface px-6 py-5">
                <div className="mx-auto flex max-w-3xl items-center justify-center gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--good)_35%,white)] bg-[color-mix(in_srgb,var(--good)_8%,white)] px-4 py-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--good-text)] text-xs text-white">✓</span>
                  <div className="text-sm">
                    <span className="font-semibold text-[var(--good-text)]">Request submitted</span>
                    <span className="text-ink-2"> as {c.submittedItemId}. </span>
                    <span className="text-muted">Open the Dashboard to view it.</span>
                  </div>
                </div>
              </div>
            ) : c.step === 'confirmation' ? null : (
              <div className="border-t border-[var(--grid)] bg-surface px-4 py-3.5">
                <div className="mx-auto max-w-3xl">
                  {error && (
                    <div className="mb-2.5 flex items-center justify-between gap-2 rounded-lg border border-[color-mix(in_srgb,var(--critical)_25%,white)] bg-[color-mix(in_srgb,var(--critical)_8%,white)] px-3 py-2 text-sm text-[var(--critical)]">
                      <span>{error}</span>
                      <button className="font-medium underline" onClick={() => setError(null)}>
                        dismiss
                      </button>
                    </div>
                  )}
                  {view.quickReplies.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {view.quickReplies.map((q) => (
                        <button
                          key={q.value}
                          disabled={busy}
                          onClick={() => send(q.label.replace(/\s*✓$/, ''))}
                          className="rounded-full border border-[var(--grid)] bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {attachments.map((name, i) => (
                        <span
                          key={`${name}-${i}`}
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--grid)] bg-page px-2.5 py-1 text-xs text-ink-2"
                        >
                          <Paperclip />
                          <span className="max-w-[160px] truncate">{name}</span>
                          <button
                            onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                            className="text-muted hover:text-[var(--critical)]"
                            title="Remove attachment"
                            aria-label={`Remove ${name}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFilesPicked}
                  />
                  <div className="flex items-end gap-2 rounded-2xl border border-[var(--grid)] bg-page px-2.5 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition focus-within:border-brand focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--brand)_18%,white)]">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-[var(--grid)] hover:text-ink-2"
                      title="Attach files"
                    >
                      <Paperclip />
                    </button>
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
                      placeholder="Type your answer or ask a follow-up question…"
                      className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none"
                    />
                    <button
                      onClick={toggleDictation}
                      disabled={!speechSupported}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        listening ? 'animate-pulse text-[var(--critical)]' : 'text-muted hover:bg-[var(--grid)] hover:text-ink-2'
                      }`}
                      title={
                        !speechSupported
                          ? 'Voice input not supported in this browser'
                          : listening
                          ? 'Stop dictation'
                          : 'Dictate with your voice'
                      }
                      aria-pressed={listening}
                    >
                      <Mic />
                    </button>
                    <button
                      onClick={() => send(input)}
                      disabled={busy || (!input.trim() && attachments.length === 0)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-deep disabled:bg-[var(--grid)] disabled:text-muted"
                      title="Send"
                    >
                      <Send />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="hidden text-[11px] text-muted sm:block">
                      Press <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift</kbd> + <kbd className="font-sans">Enter</kbd> for a new line
                    </span>
                    <button
                      onClick={handleSaveDraft}
                      disabled={busy}
                      className="ml-auto text-xs font-medium text-muted hover:text-ink-2 disabled:opacity-50"
                      title="Save this request as a draft to resume later"
                    >
                      Save draft
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Right rail: progress, prompts, insights ─────────────────── */}
      <aside className="hidden w-72 shrink-0 flex-col gap-2.5 overflow-hidden border-l border-[var(--grid)] bg-surface p-3 xl:flex">
        <RequestTypeCard
          current={c?.requestType}
          disabled={busy || !c || c?.step === 'submitted'}
          onSelect={selectRequestType}
        />
      </aside>

      {guideOpen && <IntakeGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

function IntakeGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--grid)] px-6 py-4">
          <div className="flex items-center gap-3">
            <BotAvatar small />
            <div>
              <h2 className="text-lg font-semibold">Demand Intake Guide</h2>
              <p className="text-xs text-muted">How to submit a demand and what to expect.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-ink-2">
          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">1. Describe your need</h3>
            <p>
              Start by telling the agent — in plain language — what you're trying to achieve.
              No forms or jargon required. The agent classifies your request into one of four
              demand types and only asks the questions that actually apply.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">2. The four demand types</h3>
            <ul className="space-y-2">
              <GuideItem term="New AI use case" desc="A brand-new AI capability or solution you'd like to explore or build." />
              <GuideItem term="Enhancement" desc="An improvement or fix to an existing solution that's already live." />
              <GuideItem term="Capacity request" desc="A need for people, skills, or effort (roles, headcount, duration)." />
              <GuideItem term="Exploratory" desc="An early-stage idea you want to think through before committing." />
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">3. Answer a few guided questions</h3>
            <p className="mb-2">
              The agent captures the essentials and tracks progress on the right. Every demand needs:
            </p>
            <p className="text-xs text-muted">
              Title · Description · Business area · Business problem · Expected value ·
              Proposed timeline. Type-specific questions and a short ROI check may follow.
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">4. Duplicate check</h3>
            <p>
              Before you finish, the agent checks for similar existing demands. If it finds a close
              match it shows you a summary and asks whether yours is the same or distinct — nothing
              is ever merged automatically.
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">5. Review, save, or submit</h3>
            <p>
              Review the summary the agent assembles from your answers. You can <strong>Save draft</strong>{' '}
              at any point and resume later, or <strong>Confirm &amp; submit</strong> to create a tracked
              Demand Item. Submitted demands appear in the Demand Tracker.
            </p>
          </section>

          <div className="rounded-lg border border-[var(--grid)] bg-page px-4 py-3 text-xs text-muted">
            Tip: use the <strong>Suggested prompts</strong> and <strong>Insights you can ask</strong> on the
            right if you're unsure what to say — you can ask the agent anything about the process.
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--grid)] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideItem({ term, desc }: { term: string; desc: string }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span>
        <span className="font-medium text-ink">{term}</span> — {desc}
      </span>
    </li>
  );
}

/* ── Right-rail request-type selector ───────────────────────────────── */
function RequestTypeCard({
  current,
  disabled,
  onSelect,
}: {
  current?: RequestType;
  disabled: boolean;
  onSelect: (rt: RequestType) => void;
}) {
  return (
    <Card title="Request type">
      <p className="mb-2 text-[11px] leading-snug text-muted">
        Pick a request type — the questions adapt to your choice. Switching resets the chat.
      </p>
      <div className="space-y-1.5" role="radiogroup" aria-label="Request type">
        {REQUEST_TYPE_OPTIONS.map((o) => {
          const selected = current === o.value;
          const isDisabled = disabled || o.disabled;
          return (
            <label
              key={o.value}
              title={o.info}
              className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition ${
                selected
                  ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_8%,white)]'
                  : 'border-[var(--grid)]'
              } ${
                o.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : isDisabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:border-brand'
              }`}
            >
              <input
                type="radio"
                name="request-type"
                className="mt-0.5 accent-[var(--brand)]"
                checked={selected}
                disabled={isDisabled}
                onChange={() => !isDisabled && onSelect(o.value)}
              />
              <span className="min-w-0">
                <span className={selected ? 'font-semibold text-brand' : 'text-ink-2'}>{o.label}</span>
                {o.disabled && <span className="ml-1 text-[10px] text-muted">(coming soon)</span>}
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Small building blocks ──────────────────────────────────────────── */
function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--grid)] bg-page p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function BotAvatar({ small }: { small?: boolean }) {
  const size = small ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className={`grid ${size} shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-brand`}>
      <svg width={small ? 16 : 20} height={small ? 16 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4M9 4h6" />
        <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init =
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'U';
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--grid)] text-[11px] font-semibold text-ink-2">
      {init}
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />;
}
function Paperclip() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function Mic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function Send() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
