import type { DemandType, DuplicateCandidate } from '../types';
import { TypeChip } from './ui';

export function DuplicateCard({
  candidate,
  matchType,
  rationale,
}: {
  candidate: DuplicateCandidate;
  matchType?: string;
  rationale?: string;
}) {
  const strong = matchType === 'exact' || matchType === 'likely';
  return (
    <div
      className="mx-auto w-full max-w-2xl rounded-2xl border bg-surface p-4 shadow-sm"
      style={{ borderColor: strong ? 'color-mix(in srgb, var(--warning) 55%, white)' : 'var(--grid)' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            background: 'color-mix(in srgb, var(--warning) 18%, white)',
            color: '#8a5a00',
          }}
        >
          Possible duplicate · {matchType}
        </span>
      </div>
      <div className="rounded-xl border border-[var(--grid)] bg-page p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">{candidate.title}</div>
          <span className="tnum text-xs text-muted">{candidate.id}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <TypeChip type={candidate.demandType as DemandType} />
          <span className="text-xs text-muted">{candidate.businessArea}</span>
        </div>
        <p className="mt-2 text-sm text-ink-2">{candidate.description}</p>
      </div>
      {rationale && <p className="mt-2 text-xs text-muted">Why flagged: {rationale}</p>}
      <p className="mt-2 text-sm text-ink-2">
        Is this the same request, or something distinct? (We won’t merge anything automatically.)
      </p>
    </div>
  );
}
