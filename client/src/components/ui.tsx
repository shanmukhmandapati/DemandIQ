import type { Band, DemandType } from '../types';
import { TYPE_COLORS, TYPE_LABELS } from '../types';

const BAND_COLOR: Record<Band, string> = {
  High: 'var(--critical)',
  Medium: 'var(--warning)',
  Low: 'var(--good)',
};

export function bandColor(b: Band): string {
  return BAND_COLOR[b];
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color: `color-mix(in srgb, ${color} 78%, black)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function PriorityPill({ band }: { band: Band }) {
  return <Pill label={`${band} priority`} color={BAND_COLOR[band]} />;
}

export function YesNoPill({ yes }: { yes: boolean }) {
  return <Pill label={yes ? 'Yes' : 'No'} color={yes ? 'var(--good)' : 'var(--muted)'} />;
}

export function TypeChip({ type }: { type?: DemandType }) {
  if (!type) return null;
  const color = TYPE_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {TYPE_LABELS[type]}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const submitted = status === 'Submitted';
  const draft = status === 'Draft';
  const color = submitted ? 'var(--good)' : draft ? 'var(--warning)' : 'var(--brand)';
  const text = submitted ? 'var(--good-text)' : draft ? '#8a5a00' : 'var(--brand-deep)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color: text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}
