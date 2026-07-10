import { complete, extractJson } from './client.js';

export interface DuplicateResult {
  matchType: 'exact' | 'likely' | 'related' | 'none';
  candidateId?: string;
  rationale: string;
}

interface Candidate {
  id: string;
  title: string;
  demandType: string;
  businessArea: string;
  description: string;
}

const VALID: DuplicateResult['matchType'][] = ['exact', 'likely', 'related', 'none'];

const SYSTEM = `You are the duplicate-detection step of a Demand Intake Agent. Given a NEW draft demand and a list of EXISTING demand items, decide whether the new one duplicates or relates to an existing one.

match_type definitions:
- "exact": essentially the same request (same problem + same solution intent).
- "likely": very probably the same underlying need, worth confirming with the user.
- "related": adjacent/overlapping but a distinct ask (FYI only).
- "none": no meaningful overlap.

Pick the single best candidate if match_type is exact/likely/related. Judge on the substance of the problem and solution, not just wording.

Respond with ONLY a JSON object:
{"match_type":"exact|likely|related|none","candidate_id":"<id or null>","rationale":"one short sentence"}`;

export async function duplicateCheck(
  draftSummary: string,
  candidates: Candidate[],
): Promise<DuplicateResult> {
  if (candidates.length === 0) {
    return { matchType: 'none', rationale: 'No existing items to compare against.' };
  }
  const list = candidates
    .map(
      (c) =>
        `- id: ${c.id} | type: ${c.demandType} | area: ${c.businessArea} | title: ${c.title} | desc: ${c.description}`,
    )
    .join('\n');

  const user = `NEW draft demand:
"""${draftSummary}"""

EXISTING demand items:
${list}`;

  try {
    const raw = await complete({ system: SYSTEM, user, maxTokens: 400 });
    const parsed = extractJson<{
      match_type: string;
      candidate_id: string | null;
      rationale: string;
    }>(raw);
    const matchType = (VALID as string[]).includes(parsed?.match_type ?? '')
      ? (parsed!.match_type as DuplicateResult['matchType'])
      : 'none';
    const candidateId =
      matchType !== 'none' && parsed?.candidate_id && candidates.some((c) => c.id === parsed.candidate_id)
        ? parsed.candidate_id
        : undefined;
    return {
      matchType: candidateId || matchType === 'none' ? matchType : 'none',
      candidateId,
      rationale: parsed?.rationale?.trim() || 'No strong match found.',
    };
  } catch {
    // On failure, do not block submission.
    return { matchType: 'none', rationale: 'Duplicate check unavailable; proceeding.' };
  }
}
