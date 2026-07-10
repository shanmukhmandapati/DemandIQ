import type { Conversation, DemandType } from '../types.js';

export type FieldGroup = 'mandatory' | 'conditional' | 'sensitivity' | 'roi';

export interface FieldSpec {
  key: string;
  label: string;
  group: FieldGroup;
  hint: string; // intent, handed to the phrasing LLM
  type: 'text' | 'choice';
  options?: string[]; // for choice fields (rendered as quick replies)
  appliesTo?: DemandType[]; // conditional fields only
}

// Mandatory fields captured conversationally (submitter/org come from login;
// consent is captured at the confirm/submit step).
const MANDATORY: FieldSpec[] = [
  { key: 'description', label: 'Description', group: 'mandatory', type: 'text', hint: 'A clear description of the need in the customer\'s own words.' },
  { key: 'title', label: 'Title', group: 'mandatory', type: 'text', hint: 'A short name for this demand.' },
  { key: 'business_area', label: 'Business area', group: 'mandatory', type: 'text', hint: 'The business area, function, or department this belongs to.' },
  { key: 'business_problem', label: 'Business problem', group: 'mandatory', type: 'text', hint: 'The core problem or pain point they are trying to solve.' },
  { key: 'expected_value', label: 'Expected value', group: 'mandatory', type: 'text', hint: 'The outcome or value they expect if this succeeds.' },
  { key: 'proposed_timeline', label: 'Proposed timeline', group: 'mandatory', type: 'text', hint: 'When they want this delivered or started.' },
];

const CONDITIONAL: FieldSpec[] = [
  // capacity_request
  { key: 'role_type', label: 'Role type', group: 'conditional', type: 'text', hint: 'The role(s) needed.', appliesTo: ['capacity_request'] },
  { key: 'skill_requirements', label: 'Skill requirements', group: 'conditional', type: 'text', hint: 'Key skills or expertise required.', appliesTo: ['capacity_request'] },
  { key: 'headcount_or_effort', label: 'Headcount or effort', group: 'conditional', type: 'text', hint: 'How many people or how much effort (e.g. FTE).', appliesTo: ['capacity_request'] },
  { key: 'start_date', label: 'Start date', group: 'conditional', type: 'text', hint: 'When the resources are needed.', appliesTo: ['capacity_request'] },
  { key: 'duration', label: 'Duration', group: 'conditional', type: 'text', hint: 'How long the engagement should last.', appliesTo: ['capacity_request'] },
  { key: 'location_preference', label: 'Location preference', group: 'conditional', type: 'text', hint: 'Any location / time-zone preference.', appliesTo: ['capacity_request'] },
  // enhancement
  { key: 'existing_solution_name', label: 'Existing solution', group: 'conditional', type: 'text', hint: 'The name of the existing solution being enhanced.', appliesTo: ['enhancement'] },
  { key: 'current_limitation', label: 'Current limitation', group: 'conditional', type: 'text', hint: 'What the current solution can\'t do well today.', appliesTo: ['enhancement'] },
  { key: 'affected_users', label: 'Affected users', group: 'conditional', type: 'text', hint: 'Who is affected by the limitation.', appliesTo: ['enhancement'] },
  { key: 'urgency', label: 'Urgency', group: 'conditional', type: 'choice', options: ['Low', 'Medium', 'High'], hint: 'How urgent the enhancement is.', appliesTo: ['enhancement'] },
  // new_ai_use_case
  { key: 'target_process', label: 'Target process', group: 'conditional', type: 'text', hint: 'The process this AI use case would support or automate.', appliesTo: ['new_ai_use_case'] },
  { key: 'data_sources', label: 'Data sources', group: 'conditional', type: 'text', hint: 'The data sources the solution would rely on.', appliesTo: ['new_ai_use_case'] },
  { key: 'expected_users', label: 'Expected users', group: 'conditional', type: 'text', hint: 'Who would use the solution and roughly how many.', appliesTo: ['new_ai_use_case'] },
  { key: 'desired_outcome', label: 'Desired outcome', group: 'conditional', type: 'text', hint: 'The concrete outcome they want the solution to deliver.', appliesTo: ['new_ai_use_case'] },
];

const SENSITIVITY: FieldSpec = {
  key: 'data_sensitivity_flag',
  label: 'Data sensitivity',
  group: 'sensitivity',
  type: 'choice',
  options: ['No sensitive data', 'Contains sensitive/regulated data', 'Not sure'],
  hint: 'Whether the solution would touch sensitive or regulated data.',
};

const ROI: FieldSpec[] = [
  {
    key: 'benefit_category',
    label: 'Benefit category',
    group: 'roi',
    type: 'choice',
    options: ['Cost savings', 'Revenue growth', 'Risk reduction', 'Productivity', 'Other'],
    hint: 'The main category of benefit this would deliver.',
  },
  {
    key: 'estimated_annual_value_or_proxy',
    label: 'Estimated annual value',
    group: 'roi',
    type: 'text',
    hint: 'A rough estimate of annual value, or a proxy (e.g. hours saved) if unknown.',
  },
  {
    key: 'confidence_level',
    label: 'Confidence',
    group: 'roi',
    type: 'choice',
    options: ['Low', 'Medium', 'High'],
    hint: 'Their confidence in that value estimate.',
  },
];

/** Full ordered list of fields that apply to a conversation, in ask order. */
export function orderedFields(c: Conversation): FieldSpec[] {
  const list: FieldSpec[] = [...MANDATORY];
  if (c.demandType) {
    list.push(...CONDITIONAL.filter((f) => f.appliesTo!.includes(c.demandType!)));
  }
  if (c.mentionsSensitiveData) list.push(SENSITIVITY);
  list.push(...ROI);
  return list;
}

/** The next field to ask, or null when everything is captured. */
export function nextField(c: Conversation): FieldSpec | null {
  for (const f of orderedFields(c)) {
    const v = c.captured[f.key];
    if (!v || !v.trim()) return f;
  }
  return null;
}

/** Which mandatory fields are still missing (drives Draft-vs-Submit gating). */
export function missingMandatory(c: Conversation): string[] {
  return MANDATORY.filter((f) => !c.captured[f.key]?.trim()).map((f) => f.label);
}

export function findField(c: Conversation, key: string): FieldSpec | undefined {
  return orderedFields(c).find((f) => f.key === key);
}

export function isComplete(c: Conversation): boolean {
  return nextField(c) === null;
}
