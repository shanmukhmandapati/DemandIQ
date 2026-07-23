import type { Conversation, DemandType, RequestType } from '../types.js';

export type FieldGroup = 'mandatory' | 'conditional' | 'sensitivity' | 'roi';

export interface FieldSpec {
  key: string;
  label: string;
  group: FieldGroup;
  hint: string; // intent, handed to the phrasing LLM
  type: 'text' | 'choice';
  options?: string[]; // for choice fields (rendered as quick replies)
  appliesTo?: DemandType[]; // legacy demand-type conditional fields
  appliesToRequest?: RequestType[]; // request-type conditional fields
  question?: string; // exact wording to ask verbatim (skips the phrasing LLM)
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

// Conditional fields keyed by the radio-selected request type. These are what
// make the chat "change accordingly" when a different request type is picked.
const REQUEST_CONDITIONAL: FieldSpec[] = [
  // deal_intake — capturing a new sales opportunity
  { key: 'client_name', label: 'Client / account', group: 'conditional', type: 'text', hint: 'The client or account this deal is for.', appliesToRequest: ['deal_intake'] },
  { key: 'opportunity_name', label: 'Opportunity name', group: 'conditional', type: 'text', hint: 'A short name for this opportunity or deal.', appliesToRequest: ['deal_intake'] },
  { key: 'offering', label: 'Offering / service line', group: 'conditional', type: 'text', hint: 'The offering, product, or service line involved.', appliesToRequest: ['deal_intake'] },
  { key: 'estimated_deal_value', label: 'Estimated deal value', group: 'conditional', type: 'text', hint: 'The rough total contract value or deal size.', appliesToRequest: ['deal_intake'] },
  { key: 'target_close_date', label: 'Target close date', group: 'conditional', type: 'text', hint: 'When they expect the deal to close.', appliesToRequest: ['deal_intake'] },
  { key: 'competitive_situation', label: 'Competitive situation', group: 'conditional', type: 'text', hint: 'Any incumbents or competitors in play.', appliesToRequest: ['deal_intake'] },

  // sow_approval — Deal Assurance review of a statement of work
  { key: 'sow_reference', label: 'SOW reference', group: 'conditional', type: 'text', hint: 'The SOW or contract reference / document name.', appliesToRequest: ['sow_approval'] },
  { key: 'contract_value', label: 'Contract value', group: 'conditional', type: 'text', hint: 'The total contract value covered by this SOW.', appliesToRequest: ['sow_approval'] },
  { key: 'delivery_scope', label: 'Scope of work', group: 'conditional', type: 'text', hint: 'A summary of the delivery scope and key deliverables.', appliesToRequest: ['sow_approval'] },
  { key: 'delivery_dates', label: 'Delivery dates', group: 'conditional', type: 'text', hint: 'The planned start and end dates for delivery.', appliesToRequest: ['sow_approval'] },
  { key: 'key_risks', label: 'Key risks', group: 'conditional', type: 'text', hint: 'The main delivery or commercial risks to flag for assurance.', appliesToRequest: ['sow_approval'] },
  { key: 'commercial_model', label: 'Commercial model', group: 'conditional', type: 'choice', options: ['Fixed price', 'Time & materials', 'Managed service', 'Other'], hint: 'The commercial / pricing model for the engagement.', appliesToRequest: ['sow_approval'] },

  // staff_augmentation — a request for people / skills
  { key: 'role_type', label: 'Role type', group: 'conditional', type: 'text', hint: 'The role(s) needed.', appliesToRequest: ['staff_augmentation'] },
  { key: 'skill_requirements', label: 'Skill requirements', group: 'conditional', type: 'text', hint: 'Key skills or expertise required.', appliesToRequest: ['staff_augmentation'] },
  { key: 'headcount_or_effort', label: 'Headcount or effort', group: 'conditional', type: 'text', hint: 'How many people or how much effort (e.g. FTE).', appliesToRequest: ['staff_augmentation'] },
  { key: 'start_date', label: 'Start date', group: 'conditional', type: 'text', hint: 'When the resources are needed.', appliesToRequest: ['staff_augmentation'] },
  { key: 'duration', label: 'Duration', group: 'conditional', type: 'text', hint: 'How long the engagement should last.', appliesToRequest: ['staff_augmentation'] },
  { key: 'location_preference', label: 'Location preference', group: 'conditional', type: 'text', hint: 'Any location / time-zone preference.', appliesToRequest: ['staff_augmentation'] },
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

// Fully-scripted question flows for specific request types. When a request type
// has a flow here, it REPLACES the generic mandatory + conditional + ROI set —
// the questions are asked verbatim, in this exact order.
const DEAL_INTAKE_FLOW: FieldSpec[] = [
  { key: 'client_name', label: 'Client name', group: 'mandatory', type: 'text', hint: 'The client / account for this opportunity.', question: 'What is the Client Name?' },
  { key: 'salesforce_id', label: 'Salesforce ID', group: 'conditional', type: 'text', hint: 'The Salesforce / SFDC opportunity ID.', question: 'What is the Salesforce ID?' },
  { key: 'fdes_required', label: 'FDEs required', group: 'conditional', type: 'choice', options: ['Yes', 'No', 'Not sure'], hint: 'Whether Field Delivery Engineers are needed.', question: 'Are FDEs (Field Delivery Engineers) required for this opportunity?' },
  { key: 'vendor_ai_model', label: 'Vendor / AI model', group: 'conditional', type: 'choice', options: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Private AI solution', 'Other'], hint: 'The hyperscaler / vendor / AI model in scope.', question: 'Which vendor or AI model is being used — which hyperscaler, or is it a private AI solution?' },
  { key: 'support_resources', label: 'Support / resources', group: 'conditional', type: 'text', hint: 'Onsite and remote resource needs.', question: 'What support/resources are required, including onsite and remote resource details?' },
  { key: 'estimated_acv_tcv', label: 'Estimated ACV / TCV', group: 'conditional', type: 'text', hint: 'Annual / total contract value estimate.', question: 'What is the estimated ACV/TCV (Annual Contract Value / Total Contract Value)?' },
  { key: 'qualification_stage', label: 'Qualification stage', group: 'conditional', type: 'choice', options: ['Prospecting', 'Qualification', 'Proposal / price quote', 'Negotiation / review', 'Closed'], hint: 'The current qualification stage.', question: 'What is the qualification stage, to identify the type of request?' },
  { key: 'expected_timelines', label: 'Expected timelines', group: 'conditional', type: 'text', hint: 'Expected delivery / decision timelines.', question: 'What are the expected timelines?' },
  { key: 'architect_aligned', label: 'Architect aligned', group: 'conditional', type: 'choice', options: ['Yes', 'No'], hint: 'Whether an architect is already aligned.', question: 'Has an architect already been aligned to this opportunity?' },
  { key: 'document_links', label: 'Document links', group: 'conditional', type: 'text', hint: 'Links to SOW/CPQ/RFP/RFI/RFQ documents.', question: 'Are there links to update SOW/CPQ/RFP/RFI/RFQ documents related to this request?' },
  { key: 'funded_status', label: 'Funded status', group: 'conditional', type: 'choice', options: ['Funded', 'Non-funded'], hint: 'Whether the opportunity is funded.', question: 'Is this a funded or non-funded opportunity?' },
];

const STAFF_AUG_FLOW: FieldSpec[] = [
  { key: 'customer_jd', label: 'Customer JD', group: 'conditional', type: 'text', hint: 'The customer job description (upload or paste / link).', question: 'Can you upload the Customer JD (Job Description)?' },
  { key: 'client_name', label: 'Client name', group: 'mandatory', type: 'text', hint: 'The client / account.', question: 'What is the client name?' },
  { key: 'salesforce_id', label: 'Salesforce ID', group: 'conditional', type: 'text', hint: 'The Salesforce / SFDC ID.', question: 'What is the Salesforce ID?' },
  { key: 'estimated_acv_tcv', label: 'Estimated ACV / TCV', group: 'conditional', type: 'text', hint: 'Annual / total contract value estimate.', question: 'What is the estimated ACV/TCV?' },
  { key: 'role_scope', label: 'Role scope', group: 'conditional', type: 'choice', options: ['Multiple roles', 'Individual role'], hint: 'Whether this is for multiple roles or one.', question: 'Is this for multiple roles or an individual role?' },
  { key: 'role_titles', label: 'Role title(s)', group: 'conditional', type: 'text', hint: 'The role title(s) required.', question: 'What is/are the role title(s)?' },
  { key: 'primary_skill', label: 'Primary skill', group: 'conditional', type: 'text', hint: 'Primary skill — which Hyperscaler / AI model.', question: 'What is the primary skill required (i.e., which Hyperscaler/AI Model)?' },
  { key: 'secondary_skill', label: 'Secondary skill', group: 'conditional', type: 'text', hint: 'Secondary skill (Power Platform, Co-Pilot/Studio, low/pro code, etc.).', question: 'What is the secondary skill required (e.g., Power Platform, Co-Pilot/Studio, low code/pro code, etc.)?' },
  { key: 'language_requirement', label: 'Language requirement', group: 'conditional', type: 'text', hint: 'Any language requirement.', question: 'Is there a language requirement?' },
  { key: 'domain_expertise', label: 'Domain expertise', group: 'conditional', type: 'text', hint: 'Industry / domain expertise needed.', question: 'What domain expertise is needed (industry — e.g., Insurance, Banking, Manufacturing, etc.)?' },
  { key: 'seniority_experience', label: 'Seniority / experience', group: 'conditional', type: 'text', hint: 'Seniority level / years of experience.', question: 'What level of seniority / years of experience is required?' },
  { key: 'job_grade', label: 'Job grade (NTT)', group: 'conditional', type: 'text', hint: 'The NTT job grade.', question: 'What is the job grade (NTT)?' },
  { key: 'shore_model', label: 'Shore model', group: 'conditional', type: 'choice', options: ['Onshore', 'Nearshore', 'Offshore'], hint: 'Onshore / nearshore / offshore.', question: 'Is the role Onshore, Nearshore, or Offshore?' },
  { key: 'onshore_location_type', label: 'Onshore location type', group: 'conditional', type: 'choice', options: ['Customer office-based', 'Remote'], hint: 'If onshore: office-based or remote.', question: 'If onshore, will the resource be customer office-based or remote?' },
  { key: 'allshore_location', label: 'All-shore location', group: 'conditional', type: 'text', hint: 'Location for all-shore resourcing.', question: 'What is the location for all-shore resourcing?' },
  { key: 'engagement_duration', label: 'Engagement duration', group: 'conditional', type: 'text', hint: 'Term / duration of the engagement.', question: 'What is the term/duration of the engagement?' },
  { key: 'start_date', label: 'Start date', group: 'conditional', type: 'text', hint: 'The required start date.', question: 'What is the start date?' },
  { key: 'required_capacity', label: 'Required capacity', group: 'conditional', type: 'choice', options: ['50%', '100%'], hint: 'Required capacity.', question: 'What is the required capacity (50%/100%)?' },
  { key: 'interview_process', label: 'Interview process', group: 'conditional', type: 'text', hint: "The client's interview requirements / process.", question: "What are the client's interview requirements/process?" },
  { key: 'security_clearance', label: 'Security clearance', group: 'conditional', type: 'choice', options: ['Yes', 'No'], hint: 'Whether a security clearance is required.', question: 'Is a security clearance required?' },
  { key: 'gogs_budget', label: 'GOGS budget', group: 'conditional', type: 'text', hint: 'The GOGS budget.', question: 'What is the GOGS budget?' },
  { key: 'partner_resources_open', label: 'Open to partner resources', group: 'conditional', type: 'choice', options: ['Yes', 'No'], hint: 'Whether the client is open to partner resources.', question: 'Is the client open to partner resources?' },
];

const SOW_FLOW: FieldSpec[] = [
  { key: 'client_name', label: 'Client name', group: 'mandatory', type: 'text', hint: 'The client / account.', question: 'What is the client name?' },
  { key: 'salesforce_id', label: 'Salesforce ID', group: 'conditional', type: 'text', hint: 'The Salesforce / SFDC ID.', question: 'What is the Salesforce ID?' },
  { key: 'estimated_acv_tcv', label: 'Estimated ACV / TCV', group: 'conditional', type: 'text', hint: 'Annual / total contract value estimate.', question: 'What is the estimated ACV/TCV?' },
  { key: 'sow_type', label: 'SOW type', group: 'conditional', type: 'choice', options: ['New', 'Renewal', 'Change order / amendment'], hint: 'The type of SOW.', question: 'What type of SOW is this — new, renewal, or change order/amendment?' },
  { key: 'delivery_scope', label: 'Scope of work', group: 'conditional', type: 'text', hint: 'Scope of work / project description.', question: 'What is the scope of work / project description?' },
  { key: 'commercial_model', label: 'Commercial model', group: 'conditional', type: 'choice', options: ['Fixed price', 'Time & material', 'Managed service'], hint: 'The commercial model.', question: 'What is the commercial model — Fixed Price, Time & Material, or Managed Service?' },
  { key: 'sow_term', label: 'SOW term / duration', group: 'conditional', type: 'text', hint: 'Term / duration with start and end dates.', question: 'What is the term/duration of the SOW (start date and end date)?' },
  { key: 'resources_roles', label: 'Resources / roles', group: 'conditional', type: 'text', hint: 'Resources / roles required and onshore/nearshore/offshore.', question: 'What resources/roles are required to deliver this SOW, and Onshore/Nearshore/Offshore?' },
  { key: 'internal_approver', label: 'Internal NTT approver', group: 'conditional', type: 'text', hint: 'The internal NTT approver / owner.', question: 'Who is the internal NTT approver/owner for this SOW?' },
  { key: 'document_links', label: 'Document links', group: 'conditional', type: 'text', hint: 'Links to draft SOW, CPQ, RFP/RFI/RFQ, or related docs.', question: 'Are there links to the draft SOW, CPQ, RFP/RFI/RFQ, or related documents?' },
];

const REQUEST_FLOWS: Partial<Record<RequestType, FieldSpec[]>> = {
  deal_intake: DEAL_INTAKE_FLOW,
  staff_augmentation: STAFF_AUG_FLOW,
  sow_approval: SOW_FLOW,
};

/** Full ordered list of fields that apply to a conversation, in ask order. */
export function orderedFields(c: Conversation): FieldSpec[] {
  // A scripted request-type flow replaces the generic field set entirely.
  if (c.requestType && REQUEST_FLOWS[c.requestType]) {
    const list = [...REQUEST_FLOWS[c.requestType]!];
    if (c.mentionsSensitiveData) list.push(SENSITIVITY);
    return list;
  }

  const list: FieldSpec[] = [...MANDATORY];
  if (c.requestType) {
    // Request-type flow (radio-driven) takes precedence.
    list.push(...REQUEST_CONDITIONAL.filter((f) => f.appliesToRequest!.includes(c.requestType!)));
  } else if (c.demandType) {
    // Legacy classify-based flow.
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
  return orderedFields(c)
    .filter((f) => f.group === 'mandatory' && !c.captured[f.key]?.trim())
    .map((f) => f.label);
}

export function findField(c: Conversation, key: string): FieldSpec | undefined {
  return orderedFields(c).find((f) => f.key === key);
}

export function isComplete(c: Conversation): boolean {
  return nextField(c) === null;
}
