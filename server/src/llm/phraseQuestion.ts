import { complete } from './client.js';

const SYSTEM = `You are the phrasing step of a Demand Intake Agent. Your ONLY job is to turn one field that needs to be captured into a single, natural, friendly question to ask the customer.

Rules:
- Output ONE question, one sentence, no preamble, no lists, no restating prior answers.
- Be warm and concise, like a helpful intake specialist.
- Do NOT ask for anything other than the requested field.
- If the field is a choice with options, phrase it so the options make sense (they are shown as buttons, so you don't need to list them all).`;

export async function phraseQuestion(input: {
  fieldLabel: string;
  hint: string;
  demandType?: string;
  contextSummary: string;
}): Promise<string> {
  const user = `Demand type: ${input.demandType ?? 'unknown'}
What we know so far: ${input.contextSummary || '(nothing yet)'}
Field to capture now: ${input.fieldLabel}
Intent of this field: ${input.hint}

Write the single question to ask the customer.`;

  try {
    const text = await complete({ system: SYSTEM, user, maxTokens: 120 });
    const cleaned = text.replace(/^["']|["']$/g, '').trim();
    return cleaned || `Could you tell me about the ${input.fieldLabel.toLowerCase()}?`;
  } catch {
    // Deterministic fallback so the flow never stalls on a model hiccup.
    return `Could you tell me about the ${input.fieldLabel.toLowerCase()}?`;
  }
}
