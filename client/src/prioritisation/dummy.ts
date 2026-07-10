// Self-contained DUMMY dataset for the Demand Prioritisation dashboard.
// Deterministic (seeded) so numbers are stable across renders/screenshots.
// None of this touches the real backend — it's demo data for the UI only.

export type Band = 'Low' | 'Medium' | 'High';

export interface Role {
  role: string;
  skills: string;
  fte: string;
  phase: string;
}

export interface Demand {
  id: string;
  title: string;
  region: string;
  country: string;
  domain: string;
  account: string;
  accountOwner: string;
  priorityScore: number;
  band: Band;
  value: number;
  quickWin: boolean;
  status: DemandStatus;
  proactive: boolean;
  submittedOn: string; // ISO date
  lastUpdated: string;
  strategicImpact: Band;
  businessValue: Band;
  ease: Band;
  confidence: Band;
  strategicFit: Band;
  roiPotential: number;
  executiveSummary: string;
  solutionAreas: string[];
  recommendedApproach: string;
  roles: Role[];
  tags: string[];
  attachments: number;
}

export type DemandStatus = 'Under Review' | 'Submitted' | 'More Info Needed' | 'Draft' | 'Approved';

export const REGIONS: { region: string; countries: string[] }[] = [
  { region: 'Europe', countries: ['United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands'] },
  { region: 'Asia Pacific', countries: ['Singapore', 'Japan', 'Australia', 'India', 'China'] },
  { region: 'Americas', countries: ['United States', 'Canada', 'Brazil', 'Mexico'] },
  { region: 'Middle East & Africa', countries: ['UAE', 'Saudi Arabia', 'South Africa'] },
];

export const DOMAINS = [
  'Finance',
  'HR',
  'Operations',
  'Legal',
  'Customer Experience',
  'Supply Chain',
  'Technology',
  'Marketing',
  'Procurement',
];

export const STATUSES: DemandStatus[] = [
  'Under Review',
  'Submitted',
  'More Info Needed',
  'Draft',
  'Approved',
];

const ACCOUNTS = [
  'NHS Digital',
  'Barclays',
  'Tesco',
  'Vodafone',
  'BMW Group',
  'Nestlé',
  'HSBC',
  'Unilever',
  'Siemens',
  'Maersk',
];

const OWNERS = ['James Walker', 'Sarah Thompson', 'Liam Chen', 'Aisha Khan', 'Marco Rossi', 'Elena Novak'];

const TITLES: Record<string, string[]> = {
  Finance: ['Invoice Processing Automation', 'Fraud Detection Model', 'Cash-Flow Forecasting', 'Expense Audit Copilot', 'Financial Report Generator'],
  HR: ['Résumé Screening Assistant', 'Employee Q&A Bot', 'Attrition Prediction', 'Onboarding Copilot', 'Policy Search Assistant'],
  Operations: ['Process Mining Insights', 'Ops Ticket Triage', 'Capacity Planning Model', 'SOP Generator', 'Incident Summariser'],
  Legal: ['AI Contract Review Assistant', 'Legal Clause Extraction', 'Contract Risk Scoring', 'Legal Knowledge Search', 'Policy Comparison Tool'],
  'Customer Experience': ['Support Chat Copilot', 'Sentiment Analytics', 'Call Summarisation', 'Churn Prediction', 'Knowledge Base Assistant'],
  'Supply Chain': ['Demand Forecasting', 'Supplier Risk Scoring', 'Route Optimisation', 'Inventory Copilot', 'Logistics Anomaly Detection'],
  Technology: ['Code Review Assistant', 'Incident RCA Copilot', 'Test Generation', 'Cloud Cost Optimiser', 'Doc Generation'],
  Marketing: ['Campaign Copywriter', 'Audience Segmentation', 'Content Generation', 'Lead Scoring Model', 'Brand Sentiment Tracker'],
  Procurement: ['Supplier Discovery', 'Contract Spend Analysis', 'PO Automation', 'Vendor Risk Assessment', 'Tender Summariser'],
};

const SOLUTION_POOL = [
  'Generative AI',
  'Document Intelligence',
  'NLP',
  'Workflow Automation',
  'Predictive Analytics',
  'Computer Vision',
  'RAG',
  'MLOps',
  'Conversational AI',
  'Data Engineering',
];

const ROLE_SETS: Role[] = [
  { role: 'Solution Architect', skills: 'Azure AI, Solution Design', fte: '1', phase: 'Discovery' },
  { role: 'Data Engineer', skills: 'Azure, Data Pipelines', fte: '1-2', phase: 'Build' },
  { role: 'ML Engineer', skills: 'NLP, LLM, Prompt Eng.', fte: '1-2', phase: 'Build' },
  { role: 'Software Developer', skills: '.NET, React, APIs', fte: '2-3', phase: 'Build' },
  { role: 'UX / UI Designer', skills: 'Workflow UX', fte: '1', phase: 'Build' },
  { role: 'QA Engineer', skills: 'Test Automation', fte: '1', phase: 'Test' },
];

const DATES = [
  '2024-06-12', '2024-06-10', '2024-06-09', '2024-06-08', '2024-06-07',
  '2024-05-28', '2024-05-20', '2024-05-14', '2024-04-30', '2024-04-18',
  '2024-04-05', '2024-03-22', '2024-03-11', '2024-02-27', '2024-02-09',
];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240601);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

function bandFromScore(s: number): Band {
  return s >= 80 ? 'High' : s >= 65 ? 'Medium' : 'Low';
}
function bandFromScoreSoft(s: number): Band {
  return s >= 82 ? 'High' : s >= 68 ? 'Medium' : 'Low';
}

function makeDemand(region: string, country: string, domain: string, idn: number): Demand {
  const priorityScore = between(52, 98);
  const band = bandFromScore(priorityScore);
  const value = between(50, 1500) * 1000;
  const quickWin = rand() < 0.32;
  const roiPotential = Math.round((1.3 + rand() * 2.4) * 10) / 10;
  const nSol = between(3, 4);
  const solutionAreas: string[] = [];
  while (solutionAreas.length < nSol) {
    const s = pick(SOLUTION_POOL);
    if (!solutionAreas.includes(s)) solutionAreas.push(s);
  }
  const title = pick(TITLES[domain]);
  const submittedOn = pick(DATES);
  return {
    id: `DM-${idn}`,
    title,
    region,
    country,
    domain,
    account: pick(ACCOUNTS),
    accountOwner: pick(OWNERS),
    priorityScore,
    band,
    value,
    quickWin,
    status: pick(STATUSES),
    proactive: rand() < 0.4,
    submittedOn,
    lastUpdated: submittedOn,
    strategicImpact: bandFromScoreSoft(priorityScore),
    businessValue: band,
    ease: pick<Band>(['Low', 'Medium', 'High']),
    confidence: bandFromScoreSoft(priorityScore),
    strategicFit: bandFromScoreSoft(priorityScore),
    roiPotential,
    executiveSummary: `Implement an AI-powered ${title.toLowerCase()} to reduce manual effort, improve accuracy, and standardise outcomes across ${domain.toLowerCase()} operations.`,
    solutionAreas,
    recommendedApproach: `Start with a focused MVP for the highest-volume workflow, with a human-in-the-loop review step. Expand to full ${domain.toLowerCase()} coverage based on pilot outcomes.`,
    roles: ROLE_SETS,
    tags: ['AI', domain, quickWin ? 'Quick Win' : 'Strategic'],
    attachments: between(0, 4),
  };
}

// Weight some cells heavier (Europe/UK, Technology/Operations) for a realistic spread.
function cellCount(region: string, country: string, domain: string): number {
  let base = between(4, 13);
  if (region === 'Europe') base += 4;
  if (region === 'Americas') base += 2;
  if (country === 'United Kingdom' || country === 'United States') base += 3;
  if (domain === 'Technology' || domain === 'Operations' || domain === 'Customer Experience') base += 2;
  return Math.min(28, base);
}

function build(): Demand[] {
  const out: Demand[] = [];
  let idn = 10000;
  for (const { region, countries } of REGIONS) {
    for (const country of countries) {
      for (const domain of DOMAINS) {
        const n = cellCount(region, country, domain);
        for (let i = 0; i < n; i++) out.push(makeDemand(region, country, domain, idn++));
      }
    }
  }
  return out;
}

export const DEMANDS: Demand[] = build();

// ---- money formatting ----
export function money(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}
export function moneyFull(n: number): string {
  return `£${n.toLocaleString('en-GB')}`;
}
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}
