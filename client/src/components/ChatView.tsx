import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ConversationStep, ConversationSummary, ConversationView, MockUser } from '../types';
import { TypeChip } from './ui';
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

const INTAKE_STEPS = [
  'Business Objective',
  'Need Overview',
  'Business Context',
  'Scope & Requirements',
  'Value & Impact',
  'Constraints & Dependencies',
  'Additional Information',
  'Review & Confirm',
];

const SUGGESTED_PROMPTS = [
  'What information do you need from me?',
  'What are the common solution approaches for this type of need?',
  'Can you show similar demands submitted by others?',
  'How long does the intake and review process take?',
  'What happens after I submit this demand?',
];

const INSIGHTS = [
  'Similar demands and outcomes',
  'Estimated effort and timeline',
  'Potential solution areas',
  'Related policies and guidelines',
];

export function ChatView({
  user,
  conversationId,
  onConversationCreated,
  onSubmitted,
  onNewConversation,
  onOpenConversation,
  refreshKey,
}: {
  user: MockUser;
  conversationId: string | null;
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
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dictationBase = useRef('');

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

  // Left-rail conversation list (recent + drafts), scoped to the current user.
  useEffect(() => {
    api.listConversations(user.id).then(setConvs).catch(() => setConvs([]));
  }, [user.id, refreshKey, view?.conversation.updatedAt]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [view?.conversation.messages.length, busy]);

  const c = view?.conversation;

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || !c) return;
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
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const recent = convs.filter((x) => x.status !== 'Draft');
  const drafts = convs.filter((x) => x.status === 'Draft');

  return (
    <div className="flex h-full">
      {/* ── Left rail: conversations & drafts ───────────────────────── */}
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-[var(--grid)] bg-surface md:flex">
        <div className="flex items-center justify-between px-4 pt-5">
          <h2 className="text-base font-semibold">Demand Intake</h2>
          <button
            onClick={onNewConversation}
            className="grid h-6 w-6 place-items-center rounded-md text-lg text-muted hover:bg-page"
            title="New conversation"
          >
            ＋
          </button>
        </div>

        <div className="px-4 pt-3">
          <button
            onClick={onNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            <span>＋</span> New Conversation
          </button>
        </div>

        <ConvSection
          title="Recent Conversations"
          items={recent}
          activeId={conversationId}
          onOpen={onOpenConversation}
          empty="No conversations yet"
        />
        {recent.length > 0 && (
          <button className="px-4 pb-1 text-left text-sm font-medium text-brand hover:underline">
            View all conversations
          </button>
        )}

        {drafts.length > 0 && (
          <>
            <ConvSection
              title="Your Drafts"
              count={drafts.length}
              items={drafts}
              activeId={conversationId}
              onOpen={onOpenConversation}
            />
            <button className="px-4 pb-1 text-left text-sm font-medium text-brand hover:underline">
              View all drafts
            </button>
          </>
        )}

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-[var(--grid)] bg-page p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-brand">◎</span> Need help?
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              See guidance on how to submit a demand
            </p>
            <button
              onClick={() => setGuideOpen(true)}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              View Intake Guide →
            </button>
          </div>
        </div>
      </aside>

      {/* ── Center: the chat ────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col bg-page">
        {/* Agent header */}
        <div className="border-b border-[var(--grid)] bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <BotAvatar />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Demand Intake Agent</h1>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,white)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                  Beta
                </span>
              </div>
              <p className="text-xs text-muted">
                I'll help you capture your business need and create a demand for the right solution.
              </p>
            </div>
            {c?.demandType && (
              <div className="ml-auto">
                <TypeChip type={c.demandType} />
              </div>
            )}
          </div>
        </div>

        {!view || !c ? (
          <div className="grid flex-1 place-items-center text-sm text-muted">
            {error ? <span className="text-[var(--critical)]">{error}</span> : 'Starting your intake…'}
          </div>
        ) : (
          <>
            {/* thread */}
            <div ref={threadRef} className="thread flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {c.messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role !== 'user' && <BotAvatar small />}
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-br-md bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-ink'
                        : 'rounded-tl-md border border-[var(--grid)] bg-surface text-ink shadow-sm'
                    }`}
                  >
                    {m.text}
                    <div className="mt-1 text-[10px] text-muted">{fmtTime(m.ts)}</div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-3">
                  <BotAvatar small />
                  <div className="rounded-2xl rounded-tl-md border border-[var(--grid)] bg-surface px-4 py-3 text-sm text-muted">
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

            {/* composer / footer */}
            {c.step === 'submitted' ? (
              <div className="border-t border-[var(--grid)] bg-surface px-6 py-4 text-center">
                <div className="text-sm font-medium text-[var(--good-text)]">
                  ✓ Demand submitted as {c.submittedItemId}
                </div>
                <p className="mt-1 text-xs text-muted">You can track it in the Demand Tracker.</p>
              </div>
            ) : c.step === 'confirmation' ? null : (
              <div className="border-t border-[var(--grid)] bg-surface px-6 py-4">
                {error && (
                  <div className="mb-2 rounded-lg bg-[color-mix(in_srgb,var(--critical)_8%,white)] px-3 py-2 text-sm text-[var(--critical)]">
                    {error}{' '}
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
                        className="rounded-lg border border-[color-mix(in_srgb,var(--brand)_40%,white)] px-3 py-2 text-sm font-medium text-brand hover:bg-[color-mix(in_srgb,var(--brand)_8%,white)] disabled:opacity-50"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-2xl border border-[var(--grid)] bg-page px-3 py-2 focus-within:border-brand">
                  <button className="pb-1 text-muted hover:text-ink-2" title="Attach (demo)">
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
                    className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm focus:outline-none"
                  />
                  <button
                    onClick={toggleDictation}
                    disabled={!speechSupported}
                    className={`pb-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      listening ? 'animate-pulse text-[var(--critical)]' : 'text-muted hover:text-ink-2'
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
                    disabled={busy || !input.trim()}
                    className="grid h-8 w-8 place-items-center rounded-lg text-brand hover:bg-[color-mix(in_srgb,var(--brand)_10%,white)] disabled:opacity-40"
                    title="Send"
                  >
                    <Send />
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleSaveDraft}
                    disabled={busy}
                    className="text-xs font-medium text-muted hover:text-ink-2 disabled:opacity-50"
                    title="Save progress and resume later"
                  >
                    Save draft
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Right rail: progress, prompts, insights ─────────────────── */}
      <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--grid)] bg-surface p-4 xl:flex">
        <ProgressCard step={c?.step} missing={view?.missingMandatory.length ?? 7} />

        <Card title="Suggested prompts">
          <div className="space-y-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                disabled={busy || !c || c.step === 'submitted'}
                onClick={() => send(p)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--grid)] px-3 py-2.5 text-left text-sm text-ink-2 transition hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <span>{p}</span>
                <span className="shrink-0 text-muted">→</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Insights you can ask">
          <div className="space-y-3">
            {INSIGHTS.map((p) => (
              <button
                key={p}
                disabled={busy || !c || c.step === 'submitted'}
                onClick={() => send(p)}
                className="flex w-full items-center gap-3 text-left text-sm text-ink-2 hover:text-brand disabled:opacity-50"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand">
                  ◈
                </span>
                <span>{p}</span>
              </button>
            ))}
          </div>
        </Card>
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

/* ── Right-rail intake progress ─────────────────────────────────────── */
function ProgressCard({ step, missing }: { step?: ConversationStep; missing: number }) {
  const current = computeStep(step, missing); // 1-based
  const done = step === 'submitted';
  const pct = done ? 100 : Math.round(((current - 1) / (INTAKE_STEPS.length - 1)) * 100);

  return (
    <Card
      title="Intake Progress"
      right={<span className="text-xs text-muted">Step {Math.min(current, INTAKE_STEPS.length)} of {INTAKE_STEPS.length}</span>}
    >
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--grid)]">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-3">
        {INTAKE_STEPS.map((label, i) => {
          const state = done || i < current - 1 ? 'done' : i === current - 1 ? 'active' : 'todo';
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  state === 'done'
                    ? 'bg-[var(--good-text)] text-white'
                    : state === 'active'
                    ? 'bg-brand text-white'
                    : 'bg-[var(--grid)] text-muted'
                }`}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span
                className={`text-sm ${
                  state === 'active' ? 'font-semibold text-brand' : state === 'done' ? 'text-ink' : 'text-muted'
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Map conversation state to a believable 1-based step in the 8-step rail.
function computeStep(step: ConversationStep | undefined, missing: number): number {
  switch (step) {
    case 'confirm_type':
      return 2;
    case 'questioning': {
      const total = 7;
      const captured = Math.max(0, total - missing);
      return Math.min(6, 3 + Math.floor((captured / total) * 4));
    }
    case 'duplicate_decision':
      return 7;
    case 'confirmation':
    case 'submitted':
      return 8;
    default:
      return 1; // classify / unknown
  }
}

/* ── Left-rail conversation section ─────────────────────────────────── */
function ConvSection({
  title,
  items,
  activeId,
  onOpen,
  count,
  empty,
}: {
  title: string;
  items: ConversationSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  count?: number;
  empty?: string;
}) {
  return (
    <div className="px-2 pt-5">
      <div className="flex items-center gap-2 px-2 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</span>
        {count != null && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--grid)] px-1 text-[10px] font-semibold text-ink-2">
            {count}
          </span>
        )}
      </div>
      {items.length === 0 && empty ? (
        <p className="px-2 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 5).map((x) => (
            <li key={x.id}>
              <button
                onClick={() => onOpen(x.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                  x.id === activeId ? 'bg-[color-mix(in_srgb,var(--brand)_10%,white)]' : 'hover:bg-page'
                }`}
              >
                <span className="mt-0.5 shrink-0 text-sm text-muted">▢</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{x.title || 'Untitled demand'}</span>
                    <span className="shrink-0 text-[11px] text-muted">{relTime(x.updatedAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {x.demandType ? x.demandType.replace(/_/g, ' ') : `${x.messageCount} messages`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="rounded-xl border border-[var(--grid)] bg-page p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
