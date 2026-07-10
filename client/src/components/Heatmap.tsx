import { useMemo, useState } from 'react';
import type { DemandItem, DemandType } from '../types';
import { TYPE_LABELS, formatMoney } from '../types';

const TYPES: DemandType[] = ['new_ai_use_case', 'enhancement', 'capacity_request', 'exploratory'];

type ColorBy = 'priority' | 'count';

interface Cell {
  count: number;
  value: number;
  avgScore: number;
}

// Blue sequential ramp for count magnitude.
const SEQ = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
function countColor(n: number, max: number) {
  if (n === 0) return { bg: 'var(--surface-1)', fg: 'var(--muted)', ring: true };
  const idx = max <= 1 ? 3 : Math.min(SEQ.length - 1, Math.round(((n - 1) / (max - 1)) * (SEQ.length - 1)));
  return { bg: SEQ[idx], fg: idx >= 3 ? '#fff' : 'var(--ink)', ring: false };
}
// Green -> red pastel heat for avg priority score (higher score = hotter).
function priorityColor(avg: number, count: number) {
  if (count === 0) return { bg: 'var(--surface-1)', fg: 'var(--muted)', ring: true };
  const c =
    avg < 66 ? '#cdeccd' : avg < 74 ? '#e6f0b3' : avg < 82 ? '#fdeeb3' : avg < 88 ? '#ffd9a8' : avg < 94 ? '#ffc19c' : '#ff9f8e';
  return { bg: c, fg: 'var(--ink)', ring: false };
}

export function Heatmap({ demands, orgName }: { demands: DemandItem[]; orgName: string }) {
  const [colorBy, setColorBy] = useState<ColorBy>('priority');
  const [showValues, setShowValues] = useState(true);

  const { areas, matrix, maxCount, rowTotals, colTotals, grand } = useMemo(() => {
    const areaSet = Array.from(new Set(demands.map((d) => d.businessArea || 'Unspecified'))).sort();
    const m: Record<string, Record<DemandType, Cell>> = {};
    for (const a of areaSet) {
      m[a] = {
        new_ai_use_case: { count: 0, value: 0, avgScore: 0 },
        enhancement: { count: 0, value: 0, avgScore: 0 },
        capacity_request: { count: 0, value: 0, avgScore: 0 },
        exploratory: { count: 0, value: 0, avgScore: 0 },
      };
    }
    const scoreAccum: Record<string, Record<DemandType, number>> = {};
    for (const a of areaSet) scoreAccum[a] = { new_ai_use_case: 0, enhancement: 0, capacity_request: 0, exploratory: 0 };
    for (const d of demands) {
      const a = d.businessArea || 'Unspecified';
      const c = m[a][d.demandType];
      c.count += 1;
      c.value += d.scoring?.estAnnualValue ?? 0;
      scoreAccum[a][d.demandType] += d.scoring?.priorityScore ?? 0;
    }
    let maxCount = 0;
    const rt: Record<string, { count: number; value: number }> = {};
    const ct: Record<DemandType, { count: number; value: number }> = {
      new_ai_use_case: { count: 0, value: 0 },
      enhancement: { count: 0, value: 0 },
      capacity_request: { count: 0, value: 0 },
      exploratory: { count: 0, value: 0 },
    };
    let grandC = 0,
      grandV = 0;
    for (const a of areaSet) {
      let rc = 0,
        rv = 0;
      for (const t of TYPES) {
        const c = m[a][t];
        c.avgScore = c.count ? scoreAccum[a][t] / c.count : 0;
        maxCount = Math.max(maxCount, c.count);
        rc += c.count;
        rv += c.value;
        ct[t].count += c.count;
        ct[t].value += c.value;
      }
      rt[a] = { count: rc, value: rv };
      grandC += rc;
      grandV += rv;
    }
    return { areas: areaSet, matrix: m, maxCount, rowTotals: rt, colTotals: ct, grand: { count: grandC, value: grandV } };
  }, [demands]);

  if (demands.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--grid)] bg-surface p-10 text-center text-sm text-muted">
        No demands yet for {orgName}. Create one from <span className="font-medium">New Demand</span> and it will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--grid)] bg-surface p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Portfolio Heatmap (Count of Demands)</h3>
          <p className="text-xs text-muted">Business area × demand type · {orgName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Color by
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as ColorBy)}
              className="rounded-lg border border-[var(--grid)] bg-page px-2 py-1 text-ink"
            >
              <option value="priority">Avg. priority score</option>
              <option value="count">Count of demands</option>
            </select>
          </label>
          {colorBy === 'priority' ? (
            <ScaleLegend colors={['#cdeccd', '#e6f0b3', '#fdeeb3', '#ffd9a8', '#ffc19c', '#ff9f8e']} lo="Low" hi="High" />
          ) : (
            <ScaleLegend colors={SEQ} lo="fewer" hi="more" />
          )}
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
            Show £ values
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="w-40" />
              {TYPES.map((t) => (
                <th key={t} className="px-1 pb-1 text-center align-bottom text-[11px] font-medium leading-tight text-ink-2">
                  {TYPE_LABELS[t]}
                </th>
              ))}
              <th className="px-1 pb-1 text-center text-[11px] font-semibold text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a}>
                <td className="pr-2 text-right text-xs text-ink-2">{a}</td>
                {TYPES.map((t) => {
                  const cell = matrix[a][t];
                  const s =
                    colorBy === 'priority'
                      ? priorityColor(cell.avgScore, cell.count)
                      : countColor(cell.count, maxCount);
                  return (
                    <td key={t} className="p-0">
                      <div
                        title={`${a} · ${TYPE_LABELS[t]} — ${cell.count} demand${cell.count === 1 ? '' : 's'}${
                          cell.count ? `, avg score ${Math.round(cell.avgScore)}, ${formatMoney(cell.value)}` : ''
                        }`}
                        className="grid h-14 place-items-center rounded-md"
                        style={{
                          background: s.bg,
                          color: s.fg,
                          boxShadow: s.ring ? 'inset 0 0 0 1px var(--grid)' : 'none',
                        }}
                      >
                        {cell.count > 0 && (
                          <div className="text-center leading-tight">
                            <div className="tnum text-sm font-semibold">{cell.count}</div>
                            {showValues && <div className="tnum text-[10px] opacity-70">{formatMoney(cell.value)}</div>}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 text-center leading-tight">
                  <div className="tnum text-sm font-semibold text-ink-2">{rowTotals[a].count}</div>
                  {showValues && <div className="tnum text-[10px] text-muted">{formatMoney(rowTotals[a].value)}</div>}
                </td>
              </tr>
            ))}
            <tr>
              <td className="pr-2 pt-1 text-right text-[11px] font-semibold text-muted">Grand total</td>
              {TYPES.map((t) => (
                <td key={t} className="pt-1 text-center leading-tight">
                  <div className="tnum text-sm font-semibold text-ink-2">{colTotals[t].count}</div>
                  {showValues && <div className="tnum text-[10px] text-muted">{formatMoney(colTotals[t].value)}</div>}
                </td>
              ))}
              <td className="px-2 pt-1 text-center leading-tight">
                <div className="tnum text-sm font-bold">{grand.count}</div>
                {showValues && <div className="tnum text-[10px] text-muted">{formatMoney(grand.value)}</div>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Priority scores and values shown here are synthetic prototype figures for demonstration.
      </p>
    </div>
  );
}

function ScaleLegend({ colors, lo, hi }: { colors: string[]; lo: string; hi: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span>{lo}</span>
      <div className="flex overflow-hidden rounded">
        {colors.map((c) => (
          <span key={c} className="h-3 w-4" style={{ background: c }} />
        ))}
      </div>
      <span>{hi}</span>
    </div>
  );
}
