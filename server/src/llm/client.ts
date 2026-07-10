import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-6';

// Single shared client. API key is read from ANTHROPIC_API_KEY server-side only.
export const anthropic = new Anthropic();

/**
 * Single-purpose text completion. `thinking` is disabled for low latency
 * (this model family rejects budget_tokens; disabled is accepted).
 */
export async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: 'disabled' },
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Multi-turn chat completion (system + alternating user/assistant messages).
 * Used by the free-form Assistant. Thinking disabled for latency.
 */
export async function chat(opts: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: 'disabled' },
    system: opts.system,
    messages: opts.messages,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Extract a JSON object from a model response, tolerating ```json fences and
 * surrounding prose. Returns null if nothing parseable is found.
 */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  else {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      candidate = candidate.slice(first, last + 1);
    }
  }
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
