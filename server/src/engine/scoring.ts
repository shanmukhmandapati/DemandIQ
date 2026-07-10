import type { DemandItem } from '../types.js';

// ⚠️ PROTOTYPE-ONLY synthetic scoring. The prototype has no real scoring engine,
// so we derive stable, deterministic pseudo-scores from each demand purely to
// power the internal "Demand Prioritisation" dashboard visuals. Not a real model.

export type Band = 'Low' | 'Medium' | 'High';

export interface Scoring {
  priorityScore: number; // 0-100
  priorityBand: Band;
  estAnnualValue: number; // numeric (GBP, prototype)
  quickWin: boolean;
  strategicBet: boolean;
  roiPotential: number; // multiple, e.g. 2.8
  ease: Band;
  businessValue: Band;
  strategicImpact: Band;
  strategicFit: Band;
  confidence: Band;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Parse seeded value strings like "~$400k/yr" or "~$1.2M/yr" into a number.
function parseValue(v?: string): number | null {
  if (!v) return null;
  const m = v.replace(/,/g, '').match(/([\d.]+)\s*([kKmM])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] || '').toLowerCase();
  return unit === 'm' ? n * 1_000_000 : unit === 'k' ? n * 1_000 : n;
}

function cap(b?: string): Band {
  const v = (b || '').toLowerCase();
  return v === 'high' ? 'High' : v === 'medium' || v === 'med' ? 'Medium' : 'Low';
}

export function deriveScoring(item: DemandItem): Scoring {
  const h = hash(item.id);
  const priorityScore = 58 + (h % 42); // 58..99
  const priorityBand: Band = priorityScore >= 82 ? 'High' : priorityScore >= 70 ? 'Medium' : 'Low';
  const estAnnualValue = parseValue(item.roi.estimatedValue) ?? 150_000 + (h % 18) * 75_000;
  const quickWin = h % 3 === 0;
  const roiPotential = Math.round((1.4 + (h % 22) / 10) * 10) / 10; // 1.4..3.5
  const strategicBet = priorityScore >= 84 && estAnnualValue >= 500_000;
  const ease: Band = (['High', 'Medium', 'Low'] as Band[])[h % 3];
  const strategicImpact: Band =
    priorityScore >= 84 ? 'High' : priorityScore >= 72 ? 'Medium' : 'Low';
  const confidence = item.roi.confidence ? cap(item.roi.confidence) : priorityBand;

  return {
    priorityScore,
    priorityBand,
    estAnnualValue,
    quickWin,
    strategicBet,
    roiPotential,
    ease,
    businessValue: priorityBand,
    strategicImpact,
    strategicFit: strategicImpact,
    confidence,
  };
}

export type ScoredDemand = DemandItem & { scoring: Scoring };

export function withScoring(item: DemandItem): ScoredDemand {
  return { ...item, scoring: deriveScoring(item) };
}
