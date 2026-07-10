import type { DemandItem, MockUser } from '../types.js';
import { chat } from './client.js';

// Compact, customer-safe projection of the org's demands to ground answers.
function groundingJson(demands: DemandItem[]): string {
  return JSON.stringify(
    demands.map((d) => ({
      id: d.id,
      title: d.title,
      demandType: d.demandType,
      status: d.status,
      businessArea: d.businessArea,
      description: d.description,
      businessProblem: d.businessProblem,
      expectedValue: d.expectedValue,
      proposedTimeline: d.proposedTimeline,
      conditionalFields: d.conditionalFields,
      roi: d.roi,
      createdAt: d.createdAt,
    })),
    null,
    0,
  );
}

export function assistantSystem(user: MockUser, demands: DemandItem[]): string {
  return `You are the AI Studio Delivery Assistant for ${user.orgName}. You help ${user.name} understand their demand portfolio and the demand intake process. Answer questions clearly and concisely.

Rules:
- Ground every factual answer about demands ONLY in the data below. If something isn't in the data, say you don't have that information — do not invent demands, IDs, dates, or details.
- You may explain the intake process and demand types in general terms.
- Demand types: "new_ai_use_case" (a brand-new AI capability), "enhancement" (improving an existing solution), "capacity_request" (people/skills/effort), "exploratory" (early, vague interest).
- This is a prototype that does NOT track scores, cost, margin, rates, or delivery capacity — if asked about those, say they aren't tracked here.
- Keep answers short (a few sentences or a tight list). Use the demand's reference id (e.g. DEM-000123) when referring to a specific item.

Current demands for ${user.orgName} (${demands.length} total), as JSON:
${groundingJson(demands)}`;
}

export async function assistantReply(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const reply = await chat({ system, messages, maxTokens: 1024 });
  return reply || "Sorry, I couldn't generate an answer just now — please try again.";
}
