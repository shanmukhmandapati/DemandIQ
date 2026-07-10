import type { DemandType } from '../types.js';
import { complete, extractJson } from './client.js';

export interface ClassificationResult {
  demandType: DemandType;
  extracted: Record<string, string>; // known field keys the text already implies
  mentionsSensitiveData: boolean;
  rationale: string;
}

const VALID_TYPES: DemandType[] = [
  'new_ai_use_case',
  'enhancement',
  'capacity_request',
  'exploratory',
];

// Known field keys the classifier is allowed to prefill from free text.
const KNOWN_KEYS = [
  'title',
  'description',
  'business_area',
  'business_problem',
  'expected_value',
  'proposed_timeline',
  // conditional
  'role_type',
  'skill_requirements',
  'headcount_or_effort',
  'start_date',
  'duration',
  'location_preference',
  'existing_solution_name',
  'current_limitation',
  'affected_users',
  'urgency',
  'target_process',
  'data_sources',
  'expected_users',
  'desired_outcome',
];

const SYSTEM = `You are the classification step of a Demand Intake Agent for an AI delivery team.
Classify a customer's free-text request into exactly one demand_type and extract any fields already implied by the text. Do NOT invent facts — only extract what is clearly stated or strongly implied.

demand_type options:
- "new_ai_use_case": a brand-new AI capability or solution the customer wants built.
- "enhancement": improving or extending an existing solution the customer already has.
- "capacity_request": a request for people/skills/effort (staffing) rather than a specific product.
- "exploratory": vague interest, discovery, or "we're wondering if AI could help" with no concrete ask yet.

Extractable field keys (include only those clearly present): ${KNOWN_KEYS.join(', ')}.

Also set mentions_sensitive_data = true if the text references regulated or sensitive data (PII, PHI, financial/health records, GDPR, etc.).

Respond with ONLY a JSON object, no prose, in this exact shape:
{"demand_type":"...","extracted":{"<key>":"<value>"},"mentions_sensitive_data":false,"rationale":"one short sentence"}`;

export async function classify(freeText: string): Promise<ClassificationResult> {
  const raw = await complete({
    system: SYSTEM,
    user: `Customer request:\n"""${freeText}"""`,
    maxTokens: 800,
  });
  const parsed = extractJson<{
    demand_type: string;
    extracted?: Record<string, string>;
    mentions_sensitive_data?: boolean;
    rationale?: string;
  }>(raw);

  const demandType = (VALID_TYPES as string[]).includes(parsed?.demand_type ?? '')
    ? (parsed!.demand_type as DemandType)
    : 'exploratory';

  const extracted: Record<string, string> = {};
  if (parsed?.extracted) {
    for (const [k, v] of Object.entries(parsed.extracted)) {
      if (KNOWN_KEYS.includes(k) && typeof v === 'string' && v.trim()) {
        extracted[k] = v.trim();
      }
    }
  }
  // Always keep the raw description if the model didn't extract one.
  if (!extracted.description) extracted.description = freeText.trim();

  return {
    demandType,
    extracted,
    mentionsSensitiveData: Boolean(parsed?.mentions_sensitive_data),
    rationale: parsed?.rationale?.trim() || 'Classified from the initial description.',
  };
}
