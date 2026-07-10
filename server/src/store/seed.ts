import type { DemandItem } from '../types.js';
import type { Repository } from './repository.js';

// A few historical demand items across orgs. One (DEM-000101, Castellan Legal)
// is deliberately close to an easy demo prompt like "AI contract review tool"
// so duplicate detection has something real to match.
const SEED_ITEMS: DemandItem[] = [
  {
    id: 'DEM-000101',
    title: 'AI Contract Review Assistant',
    demandType: 'new_ai_use_case',
    description:
      'An assistant that reviews inbound vendor contracts, flags non-standard clauses, and summarizes risk for the legal team.',
    businessArea: 'Legal Operations',
    businessProblem:
      'Manual contract review is slow and inconsistent, creating a backlog and delaying deals.',
    expectedValue: 'Cut contract turnaround time and reduce missed risk clauses.',
    proposedTimeline: 'Q3 kickoff, pilot within 3 months',
    submitterId: 'user-tom',
    customerOrgId: 'org-castellan',
    sourceChannel: 'webchat',
    status: 'Submitted',
    duplicateReferences: [],
    conditionalFields: {
      target_process: 'Vendor contract review',
      data_sources: 'Contract PDFs, clause library',
      expected_users: 'Legal ops team (12 reviewers)',
      desired_outcome: 'Faster, more consistent contract triage',
    },
    roi: { benefitCategory: 'Productivity', estimatedValue: '~$400k/yr', confidence: 'medium' },
    createdAt: '2026-05-02T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z',
  },
  {
    id: 'DEM-000102',
    title: 'Claims Triage Copilot',
    demandType: 'new_ai_use_case',
    description:
      'A copilot that classifies incoming insurance claims by complexity and routes them to the right adjuster queue.',
    businessArea: 'Claims',
    businessProblem: 'Claims are manually triaged, causing uneven workloads and slow first response.',
    expectedValue: 'Faster first response and more balanced adjuster workloads.',
    proposedTimeline: '6-month build',
    submitterId: 'user-nadia',
    customerOrgId: 'org-meridian',
    sourceChannel: 'webchat',
    status: 'Submitted',
    duplicateReferences: [],
    conditionalFields: {
      target_process: 'Claims intake and triage',
      data_sources: 'Claims system, policy DB',
      expected_users: 'Claims adjusters (approx 40)',
      desired_outcome: 'Automated complexity scoring and routing',
    },
    roi: { benefitCategory: 'Productivity', estimatedValue: '~$1.2M/yr', confidence: 'high' },
    createdAt: '2026-05-20T09:30:00.000Z',
    updatedAt: '2026-05-20T09:30:00.000Z',
  },
  {
    id: 'DEM-000103',
    title: 'Fraud Model Enhancement',
    demandType: 'enhancement',
    description:
      'Improve the existing fraud-scoring model to reduce false positives on low-value auto claims.',
    businessArea: 'Fraud & SIU',
    businessProblem: 'Too many false positives waste investigator time on low-value claims.',
    expectedValue: 'Free up investigator capacity for genuine high-value cases.',
    proposedTimeline: 'Next quarter',
    submitterId: 'user-nadia',
    customerOrgId: 'org-meridian',
    sourceChannel: 'webchat',
    status: 'Draft',
    duplicateReferences: [],
    conditionalFields: {
      existing_solution_name: 'FraudScore v2',
      current_limitation: 'High false-positive rate on sub-$5k auto claims',
      affected_users: 'SIU investigators',
      urgency: 'Medium',
    },
    roi: { benefitCategory: 'Cost savings', estimatedValue: '~$300k/yr', confidence: 'low' },
    createdAt: '2026-06-11T14:15:00.000Z',
    updatedAt: '2026-06-11T14:15:00.000Z',
  },
  {
    id: 'DEM-000104',
    title: 'Warehouse Demand Forecasting Data Scientists',
    demandType: 'capacity_request',
    description:
      'Need two data scientists to build seasonal demand-forecasting models for regional warehouses.',
    businessArea: 'Supply Chain Analytics',
    businessProblem: 'No in-house capacity to build forecasting models before peak season.',
    expectedValue: 'Better stock positioning and lower carrying costs ahead of peak.',
    proposedTimeline: 'Start within 6 weeks',
    submitterId: 'user-priya',
    customerOrgId: 'org-northwind',
    sourceChannel: 'webchat',
    status: 'Submitted',
    duplicateReferences: [],
    conditionalFields: {
      role_type: 'Data Scientist',
      skill_requirements: 'Time-series forecasting, Python, demand planning',
      headcount_or_effort: '2 FTE',
      start_date: 'Within 6 weeks',
      duration: '5 months',
      location_preference: 'Remote (EU time zones)',
    },
    roi: { benefitCategory: 'Cost savings', estimatedValue: '~$800k/yr', confidence: 'medium' },
    createdAt: '2026-06-25T08:00:00.000Z',
    updatedAt: '2026-06-25T08:00:00.000Z',
  },
];

export function seed(repo: Repository): void {
  for (const item of SEED_ITEMS) repo.createDemand(item);
}

// Customer-safe projection of a candidate for duplicate matching + display.
export function candidateSummaries(repo: Repository): {
  id: string;
  title: string;
  demandType: string;
  businessArea: string;
  description: string;
  customerOrgId: string;
}[] {
  const orgIds = ['org-meridian', 'org-castellan', 'org-northwind'];
  const all = orgIds.flatMap((o) => repo.listDemandsByOrg(o));
  return all.map((d) => ({
    id: d.id,
    title: d.title,
    demandType: d.demandType,
    businessArea: d.businessArea,
    description: d.description,
    customerOrgId: d.customerOrgId,
  }));
}
