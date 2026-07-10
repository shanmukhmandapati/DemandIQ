import { useState } from 'react';

const TRY_ASKING = [
  'Who were our top 5 / 10 OEMs in the last 18 months?',
  'Show spend on a rolling window (last 18 months), not just FY',
  'Are we buying off contract?',
  'Which vendors are doing the same thing?',
  'Do we have a vendor for JAVA services?',
];

type Tone = 'warning' | 'critical';
const INSIGHTS: { tone: Tone; title: string; desc: string; cta: string }[] = [
  {
    tone: 'warning',
    title: 'Total spend up 11.2% vs prior period',
    desc: 'H2 acceleration driven primarily by IT Hardware (+18%) and Software (+9%)',
    cta: 'Explore insight',
  },
  {
    tone: 'critical',
    title: 'IT Hardware up 18% — driven by ANZ',
    desc: 'ANZ region has $4.2M in uncontracted purchases across Dell and Cisco SKUs',
    cta: 'View category',
  },
  {
    tone: 'warning',
    title: 'Consolidation opportunity across 3 SaaS vendors',
    desc: 'Overlapping analytics tooling — est. £480k annual saving if contracts are merged',
    cta: 'Explore insight',
  },
];

export function IntakeLanding({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (text: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [value, setValue] = useState('');

  function submit() {
    const t = value.trim();
    if (!t || busy) return;
    onSubmit(t);
  }

  return (
    <div className="thread h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-center text-3xl font-bold text-indigo-900">Ask Procurement Intelligence AI</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-slate-500">
          Ask questions about spend, vendors, contracts, and savings opportunities across your global estate.
        </p>

        {/* Search input */}
        <div className="relative mt-8">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-500 bg-white px-4 py-3.5 shadow-sm focus-within:border-blue-600">
            <Sparkle />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask a procurement question…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button title="Voice input (demo)" className="text-slate-400 hover:text-slate-600">
              <Mic />
            </button>
            <button
              onClick={submit}
              disabled={busy || !value.trim()}
              className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white disabled:opacity-50"
              title="Send"
            >
              <Send />
            </button>
          </div>
        </div>

        {/* Try asking */}
        <div className="mt-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Try asking</div>
          <div className="flex flex-wrap gap-3">
            {TRY_ASKING.map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => onSubmit(q)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="mt-10">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Insights you should look at
          </div>
          <div className="space-y-3">
            {INSIGHTS.map((it) => (
              <InsightCard key={it.title} {...it} onClick={() => onSubmit(it.title)} />
            ))}
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
      </div>
    </div>
  );
}

function InsightCard({ tone, title, desc, cta, onClick }: { tone: Tone; title: string; desc: string; cta: string; onClick: () => void }) {
  const styles =
    tone === 'warning'
      ? { border: '#f59e0b', bg: '#fefce8' }
      : { border: '#ef4444', bg: '#fef2f2' };
  return (
    <div className="rounded-xl px-5 py-4" style={{ background: styles.bg, borderLeft: `4px solid ${styles.border}` }}>
      <div className="flex items-start gap-3">
        {tone === 'warning' ? (
          <span className="mt-0.5 text-lg leading-none text-amber-500">⚠</span>
        ) : (
          <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-rose-500 text-[11px] font-bold text-rose-500">
            !
          </span>
        )}
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 text-sm text-slate-600">{desc}</div>
          <button onClick={onClick} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            {cta} →
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" fill="#3b82f6" />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="#60a5fa" />
    </svg>
  );
}
function Mic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function Send() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
