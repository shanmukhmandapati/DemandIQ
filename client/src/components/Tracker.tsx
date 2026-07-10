import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Band, DemandItem, DemandType, MockUser } from '../types';
import { TYPE_LABELS, formatMoney } from '../types';
import { Heatmap } from './Heatmap';
import { PriorityPill, StatusPill, TypeChip, YesNoPill, bandColor } from './ui';

const SOLUTION_AREAS: Record<DemandType, string[]> = {
  new_ai_use_case: ['Generative AI', 'Document Intelligence', 'NLP', 'Workflow Automation'],
  enhancement: ['Model Optimization', 'MLOps', 'Analytics'],
  capacity_request: ['Talent & Skills', 'Delivery Capacity'],
  exploratory: ['Discovery', 'Advisory'],
};

export function Tracker({ user, refreshKey }: { user: MockUser; refreshKey: number }) {
  const [demands, setDemands] = useState<DemandItem[] | null>(null);
  const [selected, setSelected] = useState<DemandItem | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setDemands(null);
    api.demands(user.id).then(setDemands);
  }, [user.id, refreshKey]);

  const kpis = useMemo(() => {
    const d = demands ?? [];
    const n = d.length || 1;
    const value = d.reduce((s, x) => s + (x.scoring?.estAnnualValue ?? 0), 0);
    const avgScore = Math.round(d.reduce((s, x) => s + (x.scoring?.priorityScore ?? 0), 0) / n);
    const high = d.filter((x) => x.scoring?.priorityBand === 'High').length;
    const quick = d.filter((x) => x.scoring?.quickWin).length;
    const bets = d.filter((x) => x.scoring?.strategicBet).length;
    const pct = (x: number) => (d.length ? Math.round((x / d.length) * 100) : 0);
    return { total: d.length, value, avgScore, high, quick, bets, pct };
  }, [demands]);

  const filtered = useMemo(() => {
    const d = demands ?? [];
    const q = query.trim().toLowerCase();
    const list = q ? d.filter((x) => (x.title + x.id).toLowerCase().includes(q)) : d;
    return [...list].sort((a, b) => (b.scoring?.priorityScore ?? 0) - (a.scoring?.priorityScore ?? 0));
  }, [demands, query]);

  if (!demands) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading portfolio…</div>;
  }

  return (
    <div className="h-full overflow-y-auto thread">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Total Demands" value={String(kpis.total)} icon="▦" tint="var(--brand)" />
          <Kpi label="Est. Annual Value" value={formatMoney(kpis.value)} icon="£" tint="var(--good)" />
          <Kpi label="Avg. Priority Score" value={String(kpis.avgScore || 0)} icon="◔" tint="var(--cat-cap)" />
          <Kpi label="High Priority" value={`${kpis.high}`} sub={`${kpis.pct(kpis.high)}% of portfolio`} icon="⚑" tint="var(--critical)" />
          <Kpi label="Quick Wins" value={`${kpis.quick}`} sub={`${kpis.pct(kpis.quick)}%`} icon="⚡" tint="var(--warning)" />
          <Kpi label="Strategic Bets" value={`${kpis.bets}`} sub={`${kpis.pct(kpis.bets)}%`} icon="◈" tint="var(--cat-enh)" />
        </div>

        <Heatmap demands={demands} orgName={user.orgName} />

        {/* Prioritised demands table */}
        <div className="rounded-2xl border border-[var(--grid)] bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--grid)] px-4 py-3">
            <h3 className="text-sm font-semibold">
              Prioritised demands <span className="text-muted">({filtered.length})</span>
            </h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search demands…"
              className="w-56 rounded-lg border border-[var(--grid)] bg-page px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--grid)] text-left text-[11px] uppercase tracking-wide text-muted">
                  <Th>Priority</Th>
                  <Th>Demand ID</Th>
                  <Th>Title</Th>
                  <Th>Account</Th>
                  <Th className="text-right">Est. Value</Th>
                  <Th className="text-right">Score</Th>
                  <Th>Quick Win</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="cursor-pointer border-b border-[var(--grid)] last:border-0 hover:bg-page"
                  >
                    <Td>{d.scoring && <PriorityPill band={d.scoring.priorityBand} />}</Td>
                    <Td className="tnum font-medium text-brand">{d.id}</Td>
                    <Td className="max-w-[16rem] truncate font-medium">{d.title}</Td>
                    <Td className="text-ink-2">{user.orgName}</Td>
                    <Td className="tnum text-right">{d.scoring ? formatMoney(d.scoring.estAnnualValue) : '—'}</Td>
                    <Td className="tnum text-right font-semibold">{d.scoring?.priorityScore ?? '—'}</Td>
                    <Td>{d.scoring && <YesNoPill yes={d.scoring.quickWin} />}</Td>
                    <Td><StatusPill status={d.status} /></Td>
                    <Td className="tnum text-right text-muted">{new Date(d.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">
                      No demands match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <DetailDrawer item={selected} orgName={user.orgName} owner={user.name} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Kpi({ label, value, sub, icon, tint }: { label: string; value: string; sub?: string; icon: string; tint: string }) {
  return (
    <div className="rounded-xl border border-[var(--grid)] bg-surface px-4 py-3">
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted">{label}</div>
        <span
          className="grid h-6 w-6 place-items-center rounded-lg text-xs"
          style={{ background: `color-mix(in srgb, ${tint} 14%, white)`, color: tint }}
        >
          {icon}
        </span>
      </div>
      <div className="tnum mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}

function DetailDrawer({
  item,
  orgName,
  owner,
  onClose,
}: {
  item: DemandItem;
  orgName: string;
  owner: string;
  onClose: () => void;
}) {
  const s = item.scoring;
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-xl thread" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="tnum text-xs font-semibold text-muted">{item.id}</span>
              {s && <PriorityPill band={s.priorityBand} />}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
            <div className="mt-1 text-xs text-muted">
              {orgName} · {item.businessArea}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <TypeChip type={item.demandType} />
          <StatusPill status={item.status} />
        </div>

        {s && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <ScoreCard label="Priority Score" value={`${s.priorityScore}`} suffix="/100" />
            <BandCard label="Strategic Impact" band={s.strategicImpact} />
            <BandCard label="Business Value" band={s.businessValue} />
            <ScoreCard label="Est. Annual Value" value={formatMoney(s.estAnnualValue)} />
            <ScoreCard label="ROI Potential" value={`${s.roiPotential.toFixed(1)}x`} />
            <BandCard label="Ease of Impl." band={s.ease} />
            <ScoreCard label="Quick Win" value={s.quickWin ? 'Yes' : 'No'} accent={s.quickWin ? 'var(--good)' : undefined} />
            <BandCard label="Confidence" band={s.confidence} />
            <BandCard label="Strategic Fit" band={s.strategicFit} />
          </div>
        )}

        <Section title="Executive summary">{item.description}</Section>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Solution areas</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SOLUTION_AREAS[item.demandType].map((a) => (
              <span key={a} className="rounded-md bg-page px-2 py-0.5 text-xs text-ink-2">{a}</span>
            ))}
          </div>
        </div>

        <Section title="Business problem">{item.businessProblem}</Section>
        <Section title="Expected value">{item.expectedValue}</Section>
        <Section title="Proposed timeline">{item.proposedTimeline}</Section>

        {Object.keys(item.conditionalFields).length > 0 && (
          <>
            <Divider />
            {Object.entries(item.conditionalFields).map(([k, v]) => (
              <Section key={k} title={k.replace(/_/g, ' ')}>{v}</Section>
            ))}
          </>
        )}

        <Divider />
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <Meta label="Submitted by" value={owner} />
          <Meta label="Submitted on" value={new Date(item.createdAt).toLocaleDateString()} />
          <Meta label="Source" value="WebChat" />
          <Meta label="Account owner" value={orgName} />
        </div>
        {item.duplicateReferences.length > 0 && (
          <>
            <Divider />
            <Section title="Duplicate references">
              {item.duplicateReferences.map((r) => `${r.candidateId} (${r.matchType} → ${r.userDecision})`).join(', ')}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--grid)] bg-page px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="tnum mt-0.5 text-sm font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
        {suffix && <span className="text-xs font-normal text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
function BandCard({ label, band }: { label: string; band: Band }) {
  return (
    <div className="rounded-lg border border-[var(--grid)] bg-page px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold" style={{ color: `color-mix(in srgb, ${bandColor(band)} 80%, black)` }}>
        {band}
      </div>
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-0.5 text-sm">{children || <span className="text-muted">—</span>}</div>
    </div>
  );
}
function Divider() {
  return <div className="my-4 h-px bg-[var(--grid)]" />;
}
