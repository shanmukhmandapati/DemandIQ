import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMANDS,
  DOMAINS,
  REGIONS,
  STATUSES,
  fmtDate,
  money,
  moneyFull,
  type Band,
  type Demand,
  type DemandStatus,
} from './dummy';

/* ---------------- palette helpers (indigo / slate + emerald→rose heat) ---------------- */

const HEAT = ['#bbf7d0', '#d9f99d', '#fef08a', '#fde68a', '#fdba74', '#fca5a5'];
const COUNT_RAMP = ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5'];

function scoreColor(avg: number, count: number) {
  if (count === 0) return { bg: '#ffffff', fg: '#94a3b8', border: true };
  const i = avg < 62 ? 0 : avg < 70 ? 1 : avg < 77 ? 2 : avg < 84 ? 3 : avg < 90 ? 4 : 5;
  return { bg: HEAT[i], fg: '#0f172a', border: false };
}
function countColor(n: number, max: number) {
  if (n === 0) return { bg: '#ffffff', fg: '#94a3b8', border: true };
  const i = max <= 1 ? 3 : Math.min(5, Math.round(((n - 1) / (max - 1)) * 5));
  return { bg: COUNT_RAMP[i], fg: i >= 3 ? '#ffffff' : '#0f172a', border: false };
}

const bandText: Record<Band, string> = { High: 'text-rose-600', Medium: 'text-amber-600', Low: 'text-emerald-600' };
const bandChip: Record<Band, string> = {
  High: 'bg-rose-50 text-rose-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-emerald-50 text-emerald-700',
};
const statusChip: Record<DemandStatus, string> = {
  'Under Review': 'bg-amber-50 text-amber-700',
  Submitted: 'bg-indigo-50 text-indigo-700',
  'More Info Needed': 'bg-violet-50 text-violet-700',
  Draft: 'bg-slate-100 text-slate-600',
  Approved: 'bg-emerald-50 text-emerald-700',
};

/* ---------------- filter state ---------------- */

interface Filters {
  region: string;
  country: string;
  domain: string;
  priority: string;
  status: string;
  quickWin: string;
  value: string;
  score: string;
}
const EMPTY: Filters = {
  region: 'All',
  country: 'All',
  domain: 'All',
  priority: 'All',
  status: 'All',
  quickWin: 'All',
  value: 'All',
  score: 'All',
};

const ALL_COUNTRIES = REGIONS.flatMap((r) => r.countries);

function matchFilters(d: Demand, f: Filters): boolean {
  if (f.region !== 'All' && d.region !== f.region) return false;
  if (f.country !== 'All' && d.country !== f.country) return false;
  if (f.domain !== 'All' && d.domain !== f.domain) return false;
  if (f.priority !== 'All' && d.band !== f.priority) return false;
  if (f.status !== 'All' && d.status !== f.status) return false;
  if (f.quickWin !== 'All' && (f.quickWin === 'Yes') !== d.quickWin) return false;
  if (f.value === '<£250k' && d.value >= 250_000) return false;
  if (f.value === '£250k–£1M' && (d.value < 250_000 || d.value > 1_000_000)) return false;
  if (f.value === '>£1M' && d.value <= 1_000_000) return false;
  if (f.score === '80+' && d.priorityScore < 80) return false;
  if (f.score === '65–79' && (d.priorityScore < 65 || d.priorityScore > 79)) return false;
  if (f.score === '<65' && d.priorityScore >= 65) return false;
  return true;
}

/* ================================================================= */

export function PrioritisationDashboard({ onExit }: { onExit: () => void }) {
  const [staged, setStaged] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Europe']));
  const [colorBy, setColorBy] = useState<'score' | 'count'>('score');
  const [showValues, setShowValues] = useState(true);
  const [cell, setCell] = useState<{ country: string; domain: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pool = useMemo(() => DEMANDS.filter((d) => matchFilters(d, applied)), [applied]);

  const kpis = useMemo(() => {
    const n = pool.length || 1;
    const value = pool.reduce((s, d) => s + d.value, 0);
    const high = pool.filter((d) => d.band === 'High').length;
    const quick = pool.filter((d) => d.quickWin).length;
    const bets = pool.filter((d) => d.band === 'High' && d.value >= 800_000).length;
    const avg = Math.round(pool.reduce((s, d) => s + d.priorityScore, 0) / n);
    const pct = (x: number) => (pool.length ? Math.round((x / pool.length) * 100) : 0);
    return { total: pool.length, value, avg: avg || 0, high, quick, bets, pct };
  }, [pool]);

  // matrix[country][domain] = {count,value,scoreSum}
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, { count: number; value: number; scoreSum: number }>> = {};
    for (const c of ALL_COUNTRIES) {
      m[c] = {};
      for (const dom of DOMAINS) m[c][dom] = { count: 0, value: 0, scoreSum: 0 };
    }
    for (const d of pool) {
      const cell = m[d.country]?.[d.domain];
      if (cell) {
        cell.count += 1;
        cell.value += d.value;
        cell.scoreSum += d.priorityScore;
      }
    }
    let maxCount = 0;
    for (const c of ALL_COUNTRIES) for (const dom of DOMAINS) maxCount = Math.max(maxCount, m[c][dom].count);
    return { m, maxCount };
  }, [pool]);

  const tableRows = useMemo(() => {
    let rows = pool;
    if (cell) rows = rows.filter((d) => d.country === cell.country && d.domain === cell.domain);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((d) => (d.title + d.id + d.account).toLowerCase().includes(q));
    return [...rows].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [pool, cell, search]);

  const PAGE = 10;
  const pageRows = tableRows.slice(page * PAGE, page * PAGE + PAGE);
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE));

  const selected = selectedId ? DEMANDS.find((d) => d.id === selectedId) ?? null : tableRows[0] ?? null;

  function applyFilters() {
    setApplied(staged);
    setPage(0);
    setCell(null);
  }
  function clearAll() {
    setStaged(EMPTY);
    setApplied(EMPTY);
    setCell(null);
    setSearch('');
    setPage(0);
  }

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-800">
      {/* ---------- Filter rail ---------- */}
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            DIQ
          </div>
          <div className="text-sm font-semibold">DemandIQ</div>
          <button onClick={onExit} className="ml-auto text-xs text-slate-400 hover:text-indigo-600" title="Back to app">
            ‹ Back
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="text-sm font-semibold">Filters</span>
          <button onClick={clearAll} className="text-xs font-medium text-indigo-600 hover:underline">
            Clear All
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          <Field label="Date Range">
            <input
              readOnly
              value="01 Apr 2024 – 30 Jun 2024"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500"
            />
          </Field>
          <SectionLabel>Geography</SectionLabel>
          <Select label="Region" value={staged.region} onChange={(v) => setStaged({ ...staged, region: v })} options={['All', ...REGIONS.map((r) => r.region)]} />
          <Select label="Country" value={staged.country} onChange={(v) => setStaged({ ...staged, country: v })} options={['All', ...ALL_COUNTRIES]} />
          <SectionLabel>Domain / Solution</SectionLabel>
          <Select label="Domain" value={staged.domain} onChange={(v) => setStaged({ ...staged, domain: v })} options={['All', ...DOMAINS]} />
          <SectionLabel>Opportunity</SectionLabel>
          <Select label="Priority" value={staged.priority} onChange={(v) => setStaged({ ...staged, priority: v })} options={['All', 'High', 'Medium', 'Low']} />
          <Select label="Quick Win" value={staged.quickWin} onChange={(v) => setStaged({ ...staged, quickWin: v })} options={['All', 'Yes', 'No']} />
          <SectionLabel>Value &amp; Scoring</SectionLabel>
          <Select label="Est. Annual Value" value={staged.value} onChange={(v) => setStaged({ ...staged, value: v })} options={['All', '<£250k', '£250k–£1M', '>£1M']} />
          <Select label="Priority Score" value={staged.score} onChange={(v) => setStaged({ ...staged, score: v })} options={['All', '80+', '65–79', '<65']} />
          <SectionLabel>Status</SectionLabel>
          <Select label="Demand Status" value={staged.status} onChange={(v) => setStaged({ ...staged, status: v })} options={['All', ...STATUSES]} />
        </div>
        <div className="space-y-2 border-t border-slate-100 p-4">
          <button onClick={applyFilters} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Apply Filters
          </button>
          <button className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Save View
          </button>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold">Demand Prioritisation Heatmap</h1>
          <div className="flex items-center gap-2">
            <HeaderBtn icon="★">Saved Views</HeaderBtn>
            <HeaderBtn icon="⟳" />
            <HeaderBtn icon="⭳">Export</HeaderBtn>
            <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                AM
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium">Alex Morgan</div>
                <div className="text-xs text-slate-400">Portfolio Manager</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Total Demands" value={String(kpis.total)} delta="+18%" icon="▦" tint="#4f46e5" />
              <Kpi label="Est. Annual Value" value={money(kpis.value)} delta="+22%" icon="£" tint="#0d9488" />
              <Kpi label="Avg. Priority Score" value={String(kpis.avg)} delta="+5" icon="◔" tint="#7c3aed" />
              <Kpi label="High Priority" value={`${kpis.high}`} sub={`${kpis.pct(kpis.high)}%`} delta="+12%" icon="⚑" tint="#e11d48" />
              <Kpi label="Quick Wins" value={`${kpis.quick}`} sub={`${kpis.pct(kpis.quick)}%`} delta="+8%" icon="⚡" tint="#d97706" />
              <Kpi label="Strategic Bets" value={`${kpis.bets}`} sub={`${kpis.pct(kpis.bets)}%`} delta="+4%" icon="◈" tint="#059669" />
            </div>

            {/* Heatmap */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Portfolio Heatmap (Count of Demands)</h3>
                  <p className="text-xs text-slate-400">Region / country × domain · click a cell to drill down</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <label className="flex items-center gap-1.5">
                    Color by
                    <select value={colorBy} onChange={(e) => setColorBy(e.target.value as 'score' | 'count')} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                      <option value="score">Avg. Priority Score</option>
                      <option value="count">Count of Demands</option>
                    </select>
                  </label>
                  <span className="flex items-center gap-1">
                    Low
                    <span className="flex overflow-hidden rounded">
                      {(colorBy === 'score' ? HEAT : COUNT_RAMP).map((c) => (
                        <span key={c} className="h-3 w-4" style={{ background: c }} />
                      ))}
                    </span>
                    High
                  </span>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} /> Show values
                  </label>
                </div>
              </div>
              <HeatTable
                matrix={matrix.m}
                maxCount={matrix.maxCount}
                colorBy={colorBy}
                showValues={showValues}
                expanded={expanded}
                onToggle={(r) => {
                  const next = new Set(expanded);
                  next.has(r) ? next.delete(r) : next.add(r);
                  setExpanded(next);
                }}
                selectedCell={cell}
                onCell={(country, domain) => {
                  setCell({ country, domain });
                  setPage(0);
                  setSelectedId(null);
                }}
              />
            </div>

            {/* Demands table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold">
                  Demands{' '}
                  <span className="font-normal text-slate-500">
                    {cell ? `in ${cell.domain} / ${cell.country}` : 'in portfolio'} ({tableRows.length})
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search demands…"
                    className="w-52 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  {cell && (
                    <button onClick={() => setCell(null)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                      Clear drill
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <Th>Priority</Th><Th>Demand ID</Th><Th>Title</Th><Th>Account</Th>
                      <Th className="text-right">Est. Value</Th><Th className="text-right">Score</Th>
                      <Th>Quick Win</Th><Th>Status</Th><Th className="text-right">Submitted</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${selected?.id === d.id ? 'bg-indigo-50/50' : ''}`}
                      >
                        <Td><Chip className={bandChip[d.band]}>{d.band}</Chip></Td>
                        <Td className="font-medium text-indigo-600">{d.id}</Td>
                        <Td className="max-w-[15rem] truncate font-medium text-slate-700">{d.title}</Td>
                        <Td className="text-slate-500">{d.account}</Td>
                        <Td className="text-right tabular-nums">{money(d.value)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{d.priorityScore}</Td>
                        <Td><Chip className={d.quickWin ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{d.quickWin ? 'Yes' : 'No'}</Chip></Td>
                        <Td><Chip className={statusChip[d.status]}>{d.status}</Chip></Td>
                        <Td className="text-right tabular-nums text-slate-500">{fmtDate(d.submittedOn)}</Td>
                      </tr>
                    ))}
                    {tableRows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No demands match the current filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {tableRows.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
                  <span>
                    Showing {page * PAGE + 1}–{Math.min(tableRows.length, (page + 1) * PAGE)} of {tableRows.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <PageBtn disabled={page === 0} onClick={() => setPage(page - 1)}>‹</PageBtn>
                    <span className="px-2">{page + 1} / {pageCount}</span>
                    <PageBtn disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>›</PageBtn>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---------- Detail panel ---------- */}
          {selected && <DetailPanel demand={selected} onClose={() => setSelectedId('__none__')} key={selected.id} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function HeatTable({
  matrix, maxCount, colorBy, showValues, expanded, onToggle, selectedCell, onCell,
}: {
  matrix: Record<string, Record<string, { count: number; value: number; scoreSum: number }>>;
  maxCount: number;
  colorBy: 'score' | 'count';
  showValues: boolean;
  expanded: Set<string>;
  onToggle: (r: string) => void;
  selectedCell: { country: string; domain: string } | null;
  onCell: (country: string, domain: string) => void;
}) {
  const agg = (countries: string[], domain: string) => {
    let count = 0, value = 0, scoreSum = 0;
    for (const c of countries) {
      const cell = matrix[c][domain];
      count += cell.count; value += cell.value; scoreSum += cell.scoreSum;
    }
    return { count, value, scoreSum };
  };
  const colorFor = (c: { count: number; value: number; scoreSum: number }) =>
    colorBy === 'score' ? scoreColor(c.count ? c.scoreSum / c.count : 0, c.count) : countColor(c.count, maxCount);

  const renderCell = (cellData: { count: number; value: number; scoreSum: number }, country: string, domain: string, clickable: boolean) => {
    const s = colorFor(cellData);
    const isSel = clickable && selectedCell?.country === country && selectedCell?.domain === domain;
    return (
      <td key={domain} className="p-0">
        <button
          disabled={!clickable}
          onClick={() => onCell(country, domain)}
          title={`${country} · ${domain} — ${cellData.count} demand${cellData.count === 1 ? '' : 's'}`}
          className="grid h-12 w-full place-items-center rounded-md text-center leading-tight transition"
          style={{
            background: s.bg,
            color: s.fg,
            boxShadow: isSel ? 'inset 0 0 0 2px #4f46e5' : s.border ? 'inset 0 0 0 1px #e2e8f0' : 'none',
            cursor: clickable ? 'pointer' : 'default',
          }}
        >
          {cellData.count > 0 && (
            <span>
              <span className="block text-sm font-semibold tabular-nums">{cellData.count}</span>
              {showValues && <span className="block text-[10px] tabular-nums opacity-70">{money(cellData.value)}</span>}
            </span>
          )}
        </button>
      </td>
    );
  };

  const totalCol = (cellData: { count: number; value: number }) => (
    <td className="px-2 text-center leading-tight">
      <span className="block text-sm font-semibold tabular-nums text-slate-600">{cellData.count}</span>
      {showValues && <span className="block text-[10px] tabular-nums text-slate-400">{money(cellData.value)}</span>}
    </td>
  );

  const grand = DOMAINS.reduce(
    (acc, dom) => {
      const a = agg(REGIONS.flatMap((r) => r.countries), dom);
      acc[dom] = a; acc._c += a.count; acc._v += a.value;
      return acc;
    },
    { _c: 0, _v: 0 } as Record<string, any>,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="w-40 pb-1 text-left text-[11px] font-medium text-slate-400">Region / Country</th>
            {DOMAINS.map((d) => (
              <th key={d} className="px-1 pb-1 text-center align-bottom text-[10px] font-medium leading-tight text-slate-500">{d}</th>
            ))}
            <th className="px-1 pb-1 text-center text-[11px] font-semibold text-slate-400">Total</th>
          </tr>
        </thead>
        <tbody>
          {REGIONS.map(({ region, countries }) => {
            const isOpen = expanded.has(region);
            const regionRowTotal = countries.reduce((s, c) => s + DOMAINS.reduce((s2, d) => s2 + matrix[c][d].count, 0), 0);
            const regionValTotal = countries.reduce((s, c) => s + DOMAINS.reduce((s2, d) => s2 + matrix[c][d].value, 0), 0);
            return (
              <RegionGroup key={region}>
                <tr>
                  <td className="pr-2">
                    <button onClick={() => onToggle(region)} className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span> {region}
                    </button>
                  </td>
                  {DOMAINS.map((d) => renderCell(agg(countries, d), region, d, false))}
                  {totalCol({ count: regionRowTotal, value: regionValTotal })}
                </tr>
                {isOpen &&
                  countries.map((country) => {
                    const rc = DOMAINS.reduce((s, d) => s + matrix[country][d].count, 0);
                    const rv = DOMAINS.reduce((s, d) => s + matrix[country][d].value, 0);
                    return (
                      <tr key={country}>
                        <td className="pr-2 pl-4 text-right text-xs text-slate-500">{country}</td>
                        {DOMAINS.map((d) => renderCell(matrix[country][d], country, d, true))}
                        {totalCol({ count: rc, value: rv })}
                      </tr>
                    );
                  })}
              </RegionGroup>
            );
          })}
          <tr>
            <td className="pr-2 pt-1 text-left text-[11px] font-semibold text-slate-400">Grand Total</td>
            {DOMAINS.map((d) => (
              <td key={d} className="pt-1 text-center leading-tight">
                <span className="block text-sm font-bold tabular-nums text-slate-700">{grand[d].count}</span>
                {showValues && <span className="block text-[10px] tabular-nums text-slate-400">{money(grand[d].value)}</span>}
              </td>
            ))}
            <td className="px-2 pt-1 text-center leading-tight">
              <span className="block text-sm font-bold tabular-nums">{grand._c}</span>
              {showValues && <span className="block text-[10px] tabular-nums text-slate-400">{money(grand._v)}</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({ demand: d, onClose }: { demand: Demand; onClose: () => void }) {
  return (
    <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-400">{d.id}</span>
            <Chip className={bandChip[d.band]}>{d.band} Priority</Chip>
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{d.title}</h2>
          <div className="mt-1 text-xs text-slate-400">{d.account} · {d.domain} · {d.country}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip className={statusChip[d.status]}>{d.status}</Chip>
        {d.proactive && <Chip className="bg-teal-50 text-teal-700">Proactive Proposal</Chip>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ScoreCard label="Priority Score" value={`${d.priorityScore}`} suffix="/100" />
        <BandCard label="Strategic Impact" band={d.strategicImpact} />
        <BandCard label="Business Value" band={d.businessValue} />
        <ScoreCard label="Est. Annual Value" value={moneyFull(d.value)} />
        <ScoreCard label="ROI Potential" value={`${d.roiPotential.toFixed(1)}x`} />
        <BandCard label="Ease of Impl." band={d.ease} />
        <ScoreCard label="Quick Win" value={d.quickWin ? 'Yes' : 'No'} accent={d.quickWin ? 'text-emerald-600' : undefined} />
        <BandCard label="Confidence" band={d.confidence} />
        <BandCard label="Strategic Fit" band={d.strategicFit} />
      </div>

      <PanelSection title="Executive Summary">{d.executiveSummary}</PanelSection>

      <div className="mt-4">
        <PanelHead>Solution Areas</PanelHead>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {d.solutionAreas.map((s) => (
            <span key={s} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{s}</span>
          ))}
        </div>
      </div>

      <PanelSection title="Recommended Solution Approach">{d.recommendedApproach}</PanelSection>

      <div className="mt-4">
        <PanelHead>Recommended Skills / Resource Roles</PanelHead>
        <table className="mt-1.5 w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1 font-medium">Role</th><th className="py-1 font-medium">Key Skills</th>
              <th className="py-1 text-center font-medium">FTE</th><th className="py-1 text-right font-medium">Phase</th>
            </tr>
          </thead>
          <tbody>
            {d.roles.map((r) => (
              <tr key={r.role} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 font-medium text-slate-700">{r.role}</td>
                <td className="py-1.5 pr-2 text-slate-500">{r.skills}</td>
                <td className="py-1.5 text-center tabular-nums text-slate-500">{r.fte}</td>
                <td className="py-1.5 text-right text-slate-500">{r.phase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <PanelHead>Additional Information</PanelHead>
        <div className="mt-1.5 grid grid-cols-2 gap-y-2 text-xs">
          <Meta label="Submitted By" value={d.accountOwner} />
          <Meta label="Submitted On" value={fmtDate(d.submittedOn)} />
          <Meta label="Last Updated" value={fmtDate(d.lastUpdated)} />
          <Meta label="Account Owner" value={d.account} />
          <Meta label="Tags" value={d.tags.join(', ')} />
          <Meta label="Attachments" value={`${d.attachments} files`} />
        </div>
      </div>

      <button className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        View Full Demand Record →
      </button>
    </aside>
  );
}

/* ---------------- tiny primitives ---------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}
function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">{children}</div>;
}
function HeaderBtn({ icon, children }: { icon: string; children?: ReactNode }) {
  return (
    <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
      <span>{icon}</span>
      {children}
    </button>
  );
}
function Kpi({ label, value, sub, delta, icon, tint }: { label: string; value: string; sub?: string; delta: string; icon: string; tint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-xs text-slate-500">{label}</div>
        <span className="grid h-6 w-6 place-items-center rounded-lg text-xs" style={{ background: `color-mix(in srgb, ${tint} 14%, white)`, color: tint }}>{icon}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-slate-400">({sub})</span>}
      </div>
      <div className="text-xs text-emerald-600">↑ {delta} vs prior period</div>
    </div>
  );
}
function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}
function Chip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}
function PageBtn({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
      {children}
    </button>
  );
}
function ScoreCard({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${accent ?? 'text-slate-800'}`}>
        {value}{suffix && <span className="text-xs font-normal text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
function BandCard({ label, band }: { label: string; band: Band }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${bandText[band]}`}>{band}</div>
    </div>
  );
}
function PanelHead({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</div>;
}
function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <PanelHead>{title}</PanelHead>
      <div className="mt-0.5 text-sm text-slate-600">{children}</div>
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}
function RegionGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
